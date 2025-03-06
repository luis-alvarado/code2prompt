import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
import { glob } from 'fast-glob';

export interface FileOptions {
  workspaceFolder?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  getConfig?: (key: string, defaultValue: any) => any;
  isVSCode?: boolean; // Explicitly indicate environment
}

export async function getFiles(options: FileOptions = {}): Promise<string[]> {
  const { workspaceFolder, getConfig, isVSCode = false } = options;
  const effectiveWorkspaceFolder = workspaceFolder || (isVSCode ? undefined : process.cwd());
  if (!effectiveWorkspaceFolder) {
    console.log('No workspace folder found');
    return [];
  }

  const includePatterns = options.includePatterns || (getConfig 
    ? getConfig('filePatterns', ['**/*.{ts,js,py,md,txt,cpp,h,java}']) 
    : ['**/*.{ts,js,py,md,txt,cpp,h,java}']);
  const customExcludes = options.excludePatterns || (getConfig 
    ? getConfig('excludePatterns', []) 
    : []);
  const defaultExcludes = ['**/{node_modules,.git,dist,out}/**'];
  const allExcludes = [...defaultExcludes, ...customExcludes].filter(Boolean);

  let files: string[];
  if (isVSCode && typeof vscode !== 'undefined' && vscode.workspace.findFiles) {
    const uris: vscode.Uri[] = [];
    for (const pattern of includePatterns) {
      uris.push(...await vscode.workspace.findFiles(pattern, allExcludes.length > 0 ? allExcludes.join(',') : null));
    }
    files = uris.map(uri => uri.fsPath);
  } else {
    files = await glob(includePatterns, { cwd: effectiveWorkspaceFolder, ignore: allExcludes, absolute: true });
  }

  const gitignorePath = path.join(effectiveWorkspaceFolder, '.gitignore');
  const ig = ignore();
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    ig.add(gitignoreContent);
  }

  return files.filter(file => {
    const relativePath = path.relative(effectiveWorkspaceFolder, file);
    return !ig.ignores(relativePath);
  });
}