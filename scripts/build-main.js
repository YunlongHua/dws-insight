const esbuild = require('esbuild');
const path = require('path');

async function build() {
  // Bundle main process
  await esbuild.build({
    entryPoints: ['src/main/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/main/index.js',
    external: ['electron', 'pg', 'better-sqlite3', 'electron-store', 'electron-log'],
    format: 'cjs',
    sourcemap: false,
  });

  // Bundle preload
  await esbuild.build({
    entryPoints: ['src/preload/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/preload/index.js',
    external: ['electron'],
    format: 'cjs',
    sourcemap: false,
  });

  console.log('Main process build complete');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
