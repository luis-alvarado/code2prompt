import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore'; // Dependency for parsing .gitignore

export function activate(context: vscode.ExtensionContext) {
  //console.log('Code2Prompt extension activated');
  // Register the command to generate a prompt from selected files or workspace
  const disposable = vscode.commands.registerCommand('code2prompt.generatePrompt', async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    let selectedUris: vscode.Uri[] = [];
    let isEntireCodebase = false;
    let selectedTemplate: { name: string; template: string } | undefined;

    // Fetch all eligible files in the workspace
    const files = await getWorkspaceFiles();
    const items: vscode.QuickPickItem[] = [
      { label: '@workspace', description: 'Include all files in workspace' },
      ...files.map(file => ({
        label: vscode.workspace.asRelativePath(file.fsPath),
        description: 'File',
        detail: file.fsPath
      }))
    ];

    // Get templates from configuration
    const templates = vscode.workspace.getConfiguration('code2prompt').get<{ name: string; template: string }[]>('templates', [
      { name: 'Default', template: '{metadata}\n\n{content}' }
    ]);

    if (uri || uris) {
      // Handle right-click from explorer context
      const initialSelection = uris && uris.length > 0 ? uris : [uri!]; // URIs from multi-select or single file

      // Direct selection: use the right-clicked files immediately without Quick Pick
      selectedUris = initialSelection;
      isEntireCodebase = false;
      selectedTemplate = templates[0]; // Default template for right-click

      // Optional: Uncomment below to enable Quick Pick for right-click with pre-selection
      /*
      const preSelected = initialSelection.map(u => vscode.workspace.asRelativePath(u.fsPath));
      const quickPick = vscode.window.createQuickPick();
      quickPick.items = items;
      quickPick.canSelectMany = true;
      quickPick.placeholder = 'Confirm or adjust selection (Ctrl/Cmd+click for multiple)';
      quickPick.selectedItems = items.filter(item => preSelected.includes(item.label));
      
      const selectedItems = await new Promise<vscode.QuickPickItem[] | undefined>(resolve => {
        quickPick.onDidAccept(() => {
          resolve(quickPick.selectedItems.slice());
          quickPick.hide();
        });
        quickPick.onDidHide(() => resolve(undefined));
        quickPick.show();
      });

      if (!selectedItems || selectedItems.length === 0) {
        vscode.window.showInformationMessage('No files selected.');
        return;
      }

      isEntireCodebase = selectedItems.some(item => item.label === '@workspace');
      selectedUris = isEntireCodebase
        ? files
        : selectedItems.filter(item => item.label !== '@workspace').map(item => files.find(f => vscode.workspace.asRelativePath(f.fsPath) === item.label)!);
      */
    } else {
      // Handle command palette invocation: show Quick Pick for selection
      const selectedItems = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select files or "@workspace" (Ctrl/Cmd+click for multiple)',
        canPickMany: true,
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!selectedItems || selectedItems.length === 0) {
        vscode.window.showInformationMessage('No files selected.');
        return;
      }

      // If @workspace is selected, use all files and ignore other selections
      isEntireCodebase = selectedItems.some(item => item.label === '@workspace');
      selectedUris = isEntireCodebase
        ? files
        : selectedItems.filter(item => item.label !== '@workspace').map(item => files.find(f => vscode.workspace.asRelativePath(f.fsPath) === item.label)!);

      // Prompt for template selection
      const templateItems = templates.map(t => ({ label: t.name, description: t.template }));
      const chosenTemplate = await vscode.window.showQuickPick(templateItems, {
        placeHolder: 'Select a prompt template'
      });

      if (!chosenTemplate) {
        vscode.window.showInformationMessage('No template selected.');
        return;
      }

      selectedTemplate = templates.find(t => t.name === chosenTemplate.label);
    }

    // Generate the prompt with selected files
    const prompt = await generatePrompt(selectedUris, isEntireCodebase, selectedTemplate!.template);
    
    // Save the prompt to a file in .code2prompt subdirectory
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // e.g., 20250305123456
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const subDir = '.code2prompt';
    const dirPath = workspaceFolder 
      ? `${workspaceFolder}/${subDir}`
      : `${require('os').tmpdir()}/${subDir}`;
    
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
    const filePath = `${dirPath}/prompt_${timestamp}.txt`;
    const fileUri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(prompt, 'utf8'));
    
    // Open the generated file in a new tab
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc, { preview: false });
  });

  context.subscriptions.push(disposable);
}

// Fetch all files in the workspace, respecting .gitignore and file type filters
async function getWorkspaceFiles(): Promise<vscode.Uri[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceFolder) {
    return [];
  }

  // Fetch include and exclude patterns from configuration
  const includePatterns = vscode.workspace.getConfiguration('code2prompt').get<string[]>('filePatterns', ['**/*.{ts,js,py,md,txt,cpp,h,java}']);
  const customExcludes = vscode.workspace.getConfiguration('code2prompt').get<string[]>('excludePatterns', []);
  const defaultExcludes = ['**/{node_modules,.git,dist,out}/**']; 

  // Combine excludes, filtering out empty entries
  const allExcludes = [...defaultExcludes, ...customExcludes].filter(Boolean);
  const excludePattern = allExcludes.length > 0 ? allExcludes.join(',') : null; // Null if no excludes

  // Collect files based on include patterns
  let files: vscode.Uri[] = [];
  for (const pattern of includePatterns) {
    files.push(...await vscode.workspace.findFiles(pattern, excludePattern));
  }

  // Apply .gitignore filters
  const gitignorePath = path.join(workspaceFolder, '.gitignore');
  const ig = ignore();
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    ig.add(gitignoreContent);
  }

  files = files.filter(file => {
    const relativePath = path.relative(workspaceFolder, file.fsPath);
    return !ig.ignores(relativePath);
  });

  return files;
}

// Generate the prompt text with metadata and file contents
async function generatePrompt(uris: vscode.Uri[], isEntireCodebase: boolean, template: string): Promise<string> {

  let metadata = '### Prompt Metadata ###\n';
  metadata += `Scope: ${isEntireCodebase ? 'Entire Codebase' : 'Selected Files'}\n`;
  metadata += `Generated: ${new Date().toISOString()}\n`;
  metadata += `File Count: ${uris.length}\n`;
  metadata += `Workspace: ${vscode.workspace.name || 'No Workspace'}\n`;
  const tree = uris.map(uri => vscode.workspace.asRelativePath(uri.fsPath)).sort().join('\n');
  metadata += `Directory Tree:\n${tree}\n`;  

  let content = '';
  const maxFileSize = 10 * 1024 * 1024; // 10MB limit per file
  const maxTotalSize = 45 * 1024 * 1024; // 45MB total limit
  let totalSize = 0;

  for (const uri of uris) {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > maxFileSize) {
        console.warn(`Skipping large file: ${uri.fsPath} (${stat.size / 1024 / 1024}MB)`);
        content += `### File: ${vscode.workspace.asRelativePath(uri.fsPath)} ###\n[Skipped: File exceeds 10MB]\n\n`;
        continue;
      }
      const doc = await vscode.workspace.openTextDocument(uri);
      const fileContent = doc.getText();
      const fileSize = Buffer.from(fileContent).length;
      
      if (totalSize + fileSize > maxTotalSize) {
        console.warn(`Skipping ${uri.fsPath} to keep total size under 45MB`);
        content += `### File: ${vscode.workspace.asRelativePath(uri.fsPath)} ###\n[Skipped: Total size limit reached]\n\n`;
        continue;
      }

      const relativePath = vscode.workspace.asRelativePath(uri.fsPath);
      content += `### File: ${relativePath} ###\n${fileContent}\n\n`;
      totalSize += fileSize;
    } catch (error) {
      console.error(`Error reading file ${uri.fsPath}: ${error}`);
    }
  }
  
  metadata += `Total Characters: ${content.length}\n`;
  if (totalSize > maxTotalSize) {
    metadata += `Note: Some files skipped to stay under 45MB limit\n`;
  }
  metadata += '### End Metadata ###\n\n';
  
  // Apply the selected template
  return template
  .replace('{metadata}', metadata.trim())
  .replace('{content}', content.trim());
}

export function deactivate() {}