# Code2Prompt README

Code2Prompt is a VS Code extension that allows you to generate structured prompts from your workspace for AI-assisted development. It provides an intuitive way to extract relevant code snippets, metadata, and content to create structured prompts directly within VS Code.

## Features

- **Right-click Context Menu**: Select one or more files and generate a structured prompt from them.
- **Command Palette Integration**: Run the command from the VS Code command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS) and select "Generate Prompt from Files".
- **Customizable Templates**: Define prompt templates to format extracted content.
- **CLI Support**: Use the `code2prompt` CLI tool for automation and scripting.

## Requirements

No additional dependencies are required for the extension. However, if you plan to use the CLI version, ensure it is installed globally or accessible within your workspace.

## Extension Settings

This extension contributes the following settings:

- `code2prompt.enable`: Enable/disable the extension.
- `code2prompt.defaultTemplate`: Set a default template for prompt generation.
- `code2prompt.include`: Default glob patterns for included files.
- `code2prompt.exclude`: Default glob patterns for excluded files.

## CLI Usage

The Code2Prompt CLI provides a flexible way to generate structured prompts from the command line.

### **Usage:**
```sh
code2prompt [options] [files...]
```

### **Options:**
- `-d, --dir <path>`      Specify the working directory (default: current directory)
- `-a, --all`             Include all files in the directory (ignores specific files)
- `-i, --include <glob>`  Glob pattern(s) to include (e.g., `"**/*.ts"`, comma-separated)
- `-e, --exclude <glob>`  Glob pattern(s) to exclude (e.g., `"**/*.md"`, comma-separated)
- `-t, --template <name>` Template for the prompt (default: `"{metadata}\n\n{content}"`)
- `-o, --output <file>`   Output file name (default: `"prompt_<timestamp>.txt"`)
- `-h, --help`            Show this help message

### **Examples:**
```sh
code2prompt src/main.ts -t "Summary" -o summary.txt
```
_Generate a summary prompt for `main.ts`_

```sh
code2prompt --dir ./project --all -t "Bug Check" -i "**/*.py,**/*.js" -e "**/*.md"
```
_Generate a bug check prompt for all `.py` and `.js` files, excluding `.md` files_

```sh
code2prompt -i "**/*.md" --dir ./project
```
_Generate a default prompt for all `.md` files in the project directory_

## Known Issues

- Large file selections may take longer to process.
- Some file types may not extract relevant metadata correctly.

## Release Notes

### 1.0.0
- Initial release with VS Code extension and CLI support.
- Right-click menu and command palette integration.
- Configurable templates and filtering options.

## Extension Guidelines

Ensure that you've read through the [extension guidelines](https://code.visualstudio.com/api/references/extension-guidelines) and follow best practices for developing your extension.

## More Information

- [Visual Studio Code's Extension API](https://code.visualstudio.com/api)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy using Code2Prompt!**

