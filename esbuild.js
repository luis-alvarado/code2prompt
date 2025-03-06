const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const tsconfig = production ? 'tsconfig.prod.json' : 'tsconfig.dev.json';

const commonOptions = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  external: ['vscode'], // Exclude vscode from both builds
  define: production ? { 'process.env.NODE_ENV': '"production"' } : {}, // Optimize conditional checks
  tsconfig: tsconfig  
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