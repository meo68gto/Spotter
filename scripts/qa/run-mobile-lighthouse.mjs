#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
const artifactsDir = resolve(repoRoot, '.artifacts/qa/lighthouse');
await mkdir(artifactsDir, { recursive: true });

const run = (cmd, args, cwd = repoRoot) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', env: process.env });
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${cmd} ${args.join(' ')} failed with code ${code}`));
    });
  });

await run('pnpm', ['--filter', '@spotter/mobile', 'build']);
await run('pnpm', ['exec', 'lhci', 'autorun', '--config=apps/mobile/lighthouserc.json']);
console.log(`Lighthouse completed. See ${artifactsDir}`);
