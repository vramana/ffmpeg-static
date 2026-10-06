#!/usr/bin/env node
// Fills the npm/ packages with built binaries and their license files, and
// stamps a version on all of them.
//
//   node scripts/npm-prepare.mjs --artifacts <dir> --version <x.y.z> [--allow-missing]
//
// <dir> holds one ffmpeg-<target>/ folder per build, the layout
// `gh run download` / actions/download-artifact produce.
import { chmodSync, copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    artifacts: { type: 'string' },
    version: { type: 'string' },
    'allow-missing': { type: 'boolean', default: false },
  },
});
if (!args.artifacts || !args.version) {
  console.error('usage: npm-prepare.mjs --artifacts <dir> --version <x.y.z> [--allow-missing]');
  process.exit(2);
}

const npmDir = path.join(import.meta.dirname, '..', 'npm');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

const mainFile = path.join(npmDir, 'ffmpeg', 'package.json');
const main = readJson(mainFile);
const prefix = `${main.name}-`;
const platformDirs = readdirSync(npmDir).filter((d) => d.startsWith('ffmpeg-'));
const licenseDir = path.join(npmDir, 'binary-license');
const LICENSE_FILES = ['LICENSE', 'THIRD-PARTY-NOTICES.md'];

let missing = 0;
for (const dir of platformDirs) {
  const target = dir.slice('ffmpeg-'.length);
  const pkgFile = path.join(npmDir, dir, 'package.json');
  const pkg = readJson(pkgFile);
  if (pkg.name !== prefix + target || !(pkg.name in main.optionalDependencies)) {
    throw new Error(`${pkgFile}: name must be ${prefix + target} and listed in ${mainFile}`);
  }

  // The GPL text and third-party notices ship with every platform package.
  for (const file of LICENSE_FILES) {
    copyFileSync(path.join(licenseDir, file), path.join(npmDir, dir, file));
  }

  for (const file of pkg.files.filter((f) => !LICENSE_FILES.includes(f))) {
    const src = path.join(args.artifacts, `ffmpeg-${target}`, file);
    if (!existsSync(src)) {
      if (!args['allow-missing']) throw new Error(`missing ${src}`);
      console.warn(`warning: missing ${src}`);
      missing++;
      continue;
    }
    const dest = path.join(npmDir, dir, file);
    copyFileSync(src, dest);
    chmodSync(dest, 0o755);
  }

  pkg.version = args.version;
  writeJson(pkgFile, pkg);
  main.optionalDependencies[pkg.name] = args.version;
}

main.version = args.version;
writeJson(mainFile, main);
console.log(`prepared ${platformDirs.length} platform packages at ${args.version}` +
  (missing ? ` (${missing} files missing)` : ''));
