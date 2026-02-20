import { glob } from 'glob';
import { readFile } from 'node:fs/promises';

const files = await glob('migrations/*.sql', { cwd: new URL('..', import.meta.url).pathname });

if (!files.length) {
  console.error('No SQL migrations found in packages/db/migrations');
  process.exit(1);
}

for (const file of files) {
  const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (!content.includes('enable row level security')) {
    console.error(`Missing RLS enable statement in ${file}`);
    process.exit(1);
  }
}

console.log(`Migration check passed for ${files.length} migration(s).`);
