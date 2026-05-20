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

// Bundle content.ts (entry point) into a single file
// This bundles content.ts + dsl.ts + renderer.ts together
await esbuild.build({
  entryPoints: [join(process.cwd(), 'src/content.ts')],
  bundle: true,
  outfile: join(dist, 'content.js'),
  format: 'iife', // Immediately Invoked Function Expression (no import/export)
  target: 'es2022',
  minify: false,
  sourcemap: false,
  // Tell esbuild this is a browser environment
  platform: 'browser',
});

// Copy static assets
const assets = ['manifest.json', 'style.css', 'icon.svg'];
for (const asset of assets) {
  copyFileSync(join(process.cwd(), asset), join(dist, asset));
  console.log(`    ✓ ${asset}`);
}

console.log('Assets bundled to dist/');
