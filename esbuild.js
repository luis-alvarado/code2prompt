const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const commonOptions = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  sourcemap: !production,
  minify: production,
  external: ['vscode'] // Exclude vscode from both builds
};

esbuild.build({
  ...commonOptions,
  entryPoints: ['src/extension/extension.ts'],
  outfile: 'dist/extension.js'
}).catch(() => process.exit(1));

esbuild.build({
  ...commonOptions,
  entryPoints: ['src/cli/cli.ts'],
  outfile: 'dist/cli.js'
}).catch(() => process.exit(1));

if (watch) {
  esbuild.context({
    ...commonOptions,
    entryPoints: ['src/extension/extension.ts'],
    outfile: 'dist/extension.js'
  }).then(ctx => ctx.watch());
  esbuild.context({
    ...commonOptions,
    entryPoints: ['src/cli/cli.ts'],
    outfile: 'dist/cli.js'
  }).then(ctx => ctx.watch());
}