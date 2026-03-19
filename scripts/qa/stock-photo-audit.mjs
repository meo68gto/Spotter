#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
const sourceRoot = join(repoRoot, 'apps/mobile/src');
const registryPath = join(repoRoot, 'apps/mobile/src/lib/stockPhotos.ts');

const walk = async (dir) => {
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    const absolute = join(dir, entry);
    const info = await stat(absolute);
    if (info.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) files.push(absolute);
  }
  return files;
};

const registryContent = await readFile(registryPath, 'utf8');
const registryUrls = [...new Set([...registryContent.matchAll(/https?:\/\/[^'"\s)]+/g)].map((match) => match[0]))];
const registryKeys = [...registryContent.matchAll(/^\s*([a-zA-Z0-9_]+):\s*$/gm)].map((match) => match[1]);

const isImageUrl = (url) =>
  /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url) ||
  url.includes('images.pexels.com') ||
  url.includes('images.unsplash.com');

const files = await walk(sourceRoot);
const inlineViolations = [];
const keyUsageCounts = new Map(registryKeys.map((key) => [key, 0]));

for (const file of files) {
  const content = await readFile(file, 'utf8');
  const foundUrls = [...content.matchAll(/https?:\/\/[^'"\s)]+/g)].map((match) => match[0]).filter(isImageUrl);
  for (const url of foundUrls) {
    if (file.endsWith('stockPhotos.ts')) continue;
    if (!registryUrls.includes(url)) {
      inlineViolations.push({ file: relative(repoRoot, file), url });
    }
  }

  if (!file.endsWith('stockPhotos.ts')) {
    for (const key of registryKeys) {
      if (content.includes(`stockPhotos.${key}`) || content.includes(`['${key}']`) || content.includes(`\"${key}\"`)) {
        keyUsageCounts.set(key, (keyUsageCounts.get(key) ?? 0) + 1);
      }
    }
  }
}

const unusedKeys = [...keyUsageCounts.entries()].filter(([, count]) => count === 0).map(([key]) => key);
const duplicateUrls = registryUrls.filter((url, index) => registryUrls.indexOf(url) !== index);

if (inlineViolations.length > 0) {
  console.error('Inline remote image URL violations found:');
  for (const violation of inlineViolations) {
    console.error(`- ${violation.file}: ${violation.url}`);
  }
  process.exit(1);
}

if (duplicateUrls.length > 0) {
  console.warn('Duplicate stock photo URLs found:');
  for (const url of [...new Set(duplicateUrls)]) console.warn(`- ${url}`);
}

if (unusedKeys.length > 0) {
  console.warn('Unused stock photo keys found:');
  for (const key of unusedKeys) console.warn(`- ${key}`);
}

console.log('Stock photo audit passed with no inline URL violations.');
