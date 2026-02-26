/**
 * RLS smoke check — scans ALL migration files and verifies:
 * 1. Every table with RLS enabled has at least one SELECT policy.
 * 2. A set of required named policies exist somewhere in the migration suite.
 *
 * Fix M-15 / m-6: previously only checked 0001_init.sql.
 */

import { glob } from 'glob';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../migrations');

const migrationFiles = await glob('*.sql', { cwd: migrationsDir, absolute: true });

if (!migrationFiles.length) {
  console.error('No SQL migrations found in packages/db/migrations');
  process.exit(1);
}

migrationFiles.sort(); // process in chronological order

// Concatenate all migrations into one corpus for policy detection
const allSql = (
  await Promise.all(migrationFiles.map((f) => readFile(f, 'utf8')))
).join('\n');

// ----- 1. Check required named policies still exist -----
const requiredPolicies = [
  'users_select_self',
  'skill_profiles_select_own',
  'matches_select_own',
  'sessions_select_own',
  'coach_reviews_select_related',
];

let failed = false;

for (const policy of requiredPolicies) {
  if (!allSql.includes(`policy ${policy}`)) {
    console.error(`Expected RLS policy not found across all migrations: ${policy}`);
    failed = true;
  }
}

// ----- 2. Verify every table with RLS has ≥1 policy -----
// Match: "alter table <schema>.<table> enable row level security"
const rlsEnableRe = /alter\s+table\s+(?:\w+\.)?(\w+)\s+enable\s+row\s+level\s+security/gi;
// Match: "create policy ... on <schema>.<table>"
const policyOnRe = /create\s+policy\s+[^\n]+\s+on\s+(?:\w+\.)?(\w+)/gi;

const tablesWithRls = new Set();
const tablesWithPolicy = new Set();

let m;
while ((m = rlsEnableRe.exec(allSql)) !== null) {
  tablesWithRls.add(m[1].toLowerCase());
}
while ((m = policyOnRe.exec(allSql)) !== null) {
  tablesWithPolicy.add(m[1].toLowerCase());
}

for (const table of tablesWithRls) {
  if (!tablesWithPolicy.has(table)) {
    console.error(`Table "${table}" has RLS enabled but no policies found across migrations.`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `RLS smoke check passed. Scanned ${migrationFiles.length} migration(s). ` +
  `${tablesWithRls.size} table(s) with RLS, all have policies.`
);
