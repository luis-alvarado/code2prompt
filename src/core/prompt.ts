import * as fs from 'fs';
import * as path from 'path';

export interface PromptOptions {
  files: string[];
  isEntireCodebase: boolean;
  template: string;
  workspaceFolder?: string;
}

export async function generatePrompt(options: PromptOptions): Promise<string> {
  const { files, isEntireCodebase, template, workspaceFolder = process.cwd() } = options;

  let metadata = '### Prompt Metadata ###\n';
  metadata += `Scope: ${isEntireCodebase ? 'Entire Codebase' : 'Selected Files'}\n`;
  metadata += `Generated: ${new Date().toISOString()}\n`;
  metadata += `File Count: ${files.length}\n`;
  metadata += `Workspace: ${path.basename(workspaceFolder || 'No Workspace')}\n`;
  const tree = files.map(file => path.relative(workspaceFolder, file)).sort().join('\n');
  metadata += `Directory Tree:\n${tree}\n`;

  let content = '';
  const maxFileSize = 10 * 1024 * 1024;
  const maxTotalSize = 45 * 1024 * 1024;
  let totalSize = 0;

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (stat.size > maxFileSize) {
        console.warn(`Skipping large file: ${file} (${stat.size / 1024 / 1024}MB)`);
        content += `### File: ${path.relative(workspaceFolder, file)} ###\n[Skipped: File exceeds 10MB]\n\n`;
        continue;
      }
      const fileContent = fs.readFileSync(file, 'utf8');
      const fileSize = Buffer.from(fileContent).length;

      if (totalSize + fileSize > maxTotalSize) {
        console.warn(`Skipping ${file} to keep total size under 45MB`);
        content += `### File: ${path.relative(workspaceFolder, file)} ###\n[Skipped: Total size limit reached]\n\n`;
        continue;
      }

      const relativePath = path.relative(workspaceFolder, file);
      content += `### File: ${relativePath} ###\n${fileContent}\n\n`;
      totalSize += fileSize;
    } catch (error) {
      console.error(`Error reading file ${file}: ${error}`);
    }
  }

  metadata += `Total Characters: ${content.length}\n`;
  if (totalSize > maxTotalSize) {
    metadata += `Note: Some files skipped to stay under 45MB limit\n`;
  }
  metadata += '### End Metadata ###\n\n';

  return template
    .replace('{metadata}', metadata.trim())
    .replace('{content}', content.trim());
}