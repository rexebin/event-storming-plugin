#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';

const dist = join(process.cwd(), 'dist');

// Clean dist folder
try {
  rmSync(dist, { recursive: true, force: true });
} catch {}
mkdirSync(dist, { recursive: true });

const browserEntries = [
  ['src/content.ts', 'content.js'],
  ['src/vscode-preview.ts', 'vscode-preview.js'],
];

for (const [entryPoint, outputFile] of browserEntries) {
  await esbuild.build({
    entryPoints: [join(process.cwd(), entryPoint)],
    bundle: true,
    outfile: join(dist, outputFile),
    format: 'iife',
    target: 'es2022',
    minify: false,
    sourcemap: false,
    platform: 'browser',
  });
}

// Copy static assets
const assets = ['manifest.json', 'style.css', 'icon.svg'];
for (const asset of assets) {
  copyFileSync(join(process.cwd(), asset), join(dist, asset));
  console.log(`    ✓ ${asset}`);
}

console.log('Assets bundled to dist/');
