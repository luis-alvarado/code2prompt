#!/usr/bin/env node

import minimist from 'minimist';
import * as fs from 'fs';
import * as path from 'path';
import { getFiles } from '../core/files';
import { generatePrompt } from '../core/prompt';

function showHelp() {
  console.log(`
Usage: code2prompt [options] [files...]

Generate structured prompts from files for AI-assisted development.

Options:
  -d, --dir <path>      Specify the working directory (default: current directory)
  -a, --all             Include all files in the directory (ignores specific files)
  -t, --template <name> Template for the prompt (default: "{metadata}\\n\\n{content}")
  -o, --output <file>   Output file name (default: "prompt_<timestamp>.txt")
  -h, --help            Show this help message

Examples:
  code2prompt src/main.ts -t "Summary" -o summary.txt
    Generate a summary prompt for main.ts
  code2prompt --dir ./project --all -t "Bug Check"
    Generate a bug check prompt for all files in ./project
  code2prompt file1.ts file2.ts
    Generate a default prompt for file1.ts and file2.ts
`);
}

async function main() {
  const args = minimist(process.argv.slice(2), {
    string: ['dir', 'template', 'output'],
    boolean: ['all', 'help'],
    alias: { d: 'dir', t: 'template', o: 'output', a: 'all', h: 'help' }
  });

  // Show help if --help or no args
  if (args.help || process.argv.length <= 2) {
    showHelp();
    process.exit(0);
  }

  const workspaceFolder = args.dir ? path.resolve(args.dir) : process.cwd();
  const isEntireCodebase = args.all || false;
  const template = args.template || '{metadata}\n\n{content}';
  const outputFile = args.output || `prompt_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.txt`;

  const files = isEntireCodebase 
    ? await getFiles({ workspaceFolder }) 
    : (args._ as string[]).map(f => path.resolve(workspaceFolder, f));

  // Validate input
  if (files.length === 0) {
    console.error('Error: No files specified or found. Use --all or provide file paths.');
    showHelp();
    process.exit(1);
  }

  const prompt = await generatePrompt({ files, isEntireCodebase, template, workspaceFolder });
  const dirPath = path.join(workspaceFolder, '.code2prompt');
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);

  const filePath = path.join(dirPath, outputFile);
  fs.writeFileSync(filePath, prompt, 'utf8');
  console.log(`Prompt saved to ${filePath}`);
}

main().catch(err => {
  console.error('Error:', err);
  showHelp();
  process.exit(1);
});