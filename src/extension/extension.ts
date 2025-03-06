import * as vscode from 'vscode';
import { getFiles, FileOptions } from '../core/files';
import { generatePrompt, PromptOptions } from '../core/prompt';

export function activate(context: vscode.ExtensionContext) {
  console.log('Code2Prompt extension activated');

  const disposable = vscode.commands.registerCommand('code2prompt.generatePrompt', async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    console.log('Command triggered', { uri: uri?.fsPath, uris: uris?.map(u => u.fsPath) });

    let selectedUris: string[] = [];
    let isEntireCodebase = false;
    let selectedTemplate: { name: string; template: string } | undefined;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const configGetter = (key: string, defaultValue: any) => vscode.workspace.getConfiguration('code2prompt').get(key, defaultValue);
    try {
      const files = await getFiles({ workspaceFolder, getConfig: configGetter, isVSCode: true });
      console.log('Files found:', files.length);

      const items: vscode.QuickPickItem[] = [
        { label: '@workspace', description: 'Include all files in workspace' },
        ...files.map(file => ({
          label: vscode.workspace.asRelativePath(file),
          description: 'File',
          detail: file
        }))
      ];

      const templates = configGetter('templates', [{ name: 'Default', template: '{metadata}\n\n{content}' }]) as { name: string; template: string }[];

      if (uri || uris) {
        console.log('Right-click path entered');
        const initialSelection = uris && uris.length > 0 ? uris : [uri!];
        selectedUris = initialSelection.map(u => u.fsPath);
        isEntireCodebase = false;
        selectedTemplate = templates[0];
        console.log('Selected URIs:', selectedUris);
      } else {
        console.log('Command Palette path entered');
        const selectedItems = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select files or "@workspace" (Ctrl/Cmd+click for multiple)',
          canPickMany: true,
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (!selectedItems || selectedItems.length === 0) {
          vscode.window.showInformationMessage('No files selected.');
          console.log('No files selected in Quick Pick');
          return;
        }

        isEntireCodebase = selectedItems.some(item => item.label === '@workspace');
        selectedUris = isEntireCodebase
          ? files
          : selectedItems.filter(item => item.label !== '@workspace').map(item => files.find(f => vscode.workspace.asRelativePath(f) === item.label)!);

        const templateItems = templates.map(t => ({ label: t.name, description: t.template }));
        const chosenTemplate = await vscode.window.showQuickPick(templateItems, {
          placeHolder: 'Select a prompt template'
        });

        if (!chosenTemplate) {
          vscode.window.showInformationMessage('No template selected.');
          console.log('No template selected');
          return;
        }

        selectedTemplate = templates.find(t => t.name === chosenTemplate.label);
      }

      console.log('Generating prompt with:', { selectedUris, isEntireCodebase, template: selectedTemplate });
      const prompt = await generatePrompt({ files: selectedUris, isEntireCodebase, template: selectedTemplate!.template, workspaceFolder });
      console.log('Prompt generated, length:', prompt.length);

      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const subDir = '.code2prompt';
      const dirPath = workspaceFolder 
        ? `${workspaceFolder}/${subDir}`
        : `${require('os').tmpdir()}/${subDir}`;
      
      console.log('Creating directory:', dirPath);
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
      const filePath = `${dirPath}/prompt_${timestamp}.txt`;
      const fileUri = vscode.Uri.file(filePath);
      console.log('Writing file:', filePath);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(prompt, 'utf8'));
      
      console.log('Opening file:', filePath);
      const doc = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(doc, { preview: false });
      console.log('File saved and opened:', filePath);
    } catch (error) {
      console.error('Error in prompt generation:', error);
      vscode.window.showErrorMessage('Failed to generate prompt. Check debug console.');
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}