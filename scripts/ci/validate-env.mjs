import { readFile } from 'node:fs/promises';

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_ACCESS_TOKEN'
];

const files = ['.env.example', '.env.staging.example', '.env.production.example'];

for (const file of files) {
  const text = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
  const missing = required.filter((key) => !new RegExp(`^${key}=`, 'm').test(text));
  if (missing.length) {
    console.error(`${file} missing keys: ${missing.join(', ')}`);
    process.exit(1);
  }
}

console.log('Environment template validation passed.');
