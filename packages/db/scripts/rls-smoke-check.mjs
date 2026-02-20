import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');

const requiredPolicies = [
  'users_select_self',
  'skill_profiles_select_own',
  'matches_select_own',
  'sessions_select_own',
  'coach_reviews_select_related'
];

for (const policy of requiredPolicies) {
  if (!migration.includes(`policy ${policy}`)) {
    console.error(`Expected policy not found: ${policy}`);
    process.exit(1);
  }
}

console.log('RLS smoke check passed.');
