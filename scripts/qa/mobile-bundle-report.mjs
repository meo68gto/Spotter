#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
const distRoot = join(repoRoot, 'apps/mobile/dist');
const outputPath = join(repoRoot, '.artifacts/qa/mobile-bundle-report.json');

const walk = async (dir) => {
  const entries = await readdir(dir);
  const paths = [];
  for (const entry of entries) {
    const absolute = join(dir, entry);
    const info = await stat(absolute);
    if (info.isDirectory()) {
      paths.push(...(await walk(absolute)));
      continue;
    }
    paths.push(absolute);
  }
  return paths;
};

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

if (!(await exists(distRoot))) {
  console.error('Missing apps/mobile/dist. Run: pnpm --filter @spotter/mobile build');
  process.exit(1);
}

const files = await walk(distRoot);
const jsFiles = files.filter((file) => file.endsWith('.js'));
const assetFiles = files.filter((file) => !file.endsWith('.js') && !file.endsWith('.map'));

const withSize = async (targets) => {
  const out = [];
  for (const target of targets) {
    const info = await stat(target);
    out.push({ file: relative(repoRoot, target), bytes: info.size });
  }
  return out.sort((a, b) => b.bytes - a.bytes);
};

const jsBySize = await withSize(jsFiles);
const assetsBySize = await withSize(assetFiles);

const stockRegistryPath = join(repoRoot, 'apps/mobile/src/lib/stockPhotos.ts');
const sourceTreePath = join(repoRoot, 'apps/mobile/src');
const stockRegistry = await readFile(stockRegistryPath, 'utf8');
const sourceFiles = await walk(sourceTreePath);
const sourceText = (await Promise.all(sourceFiles.filter((p) => p.endsWith('.ts') || p.endsWith('.tsx')).map((p) => readFile(p, 'utf8')))).join('\n');

const urls = [...stockRegistry.matchAll(/https?:\/\/[^'"\s)]+/g)].map((match) => match[0]);
const duplicateUrls = urls.filter((url, index) => urls.indexOf(url) !== index);
const unusedUrls = urls.filter((url) => !sourceText.includes(url));

const report = {
  generatedAt: new Date().toISOString(),
  distRoot: relative(repoRoot, distRoot),
  jsTotalBytes: jsBySize.reduce((acc, item) => acc + item.bytes, 0),
  assetTotalBytes: assetsBySize.reduce((acc, item) => acc + item.bytes, 0),
  largestJs: jsBySize.slice(0, 10),
  largestAssets: assetsBySize.slice(0, 20),
  stockPhotoDuplicateUrls: [...new Set(duplicateUrls)],
  stockPhotoUnusedUrls: unusedUrls
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Wrote bundle report: ${relative(repoRoot, outputPath)}`);
