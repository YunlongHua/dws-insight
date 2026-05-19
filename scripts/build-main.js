const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function build() {
  // Bundle main process
  await esbuild.build({
    entryPoints: ['src/main/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/main/index.js',
    external: ['electron', 'pg', 'electron-store', 'electron-log'],
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

  // Copy sql-wasm.wasm for sql.js
  const wasmSrc = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmDest = path.join(__dirname, '..', 'dist', 'main', 'sql-wasm.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, wasmDest);
    console.log('Copied sql-wasm.wasm');
  }

  console.log('Main process build complete');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
