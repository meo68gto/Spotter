#!/usr/bin/env node
// ============================================================================
// Golfregi CSV Import Script
// Fox Phase 0: Import tournament registrations from Golfregi export
//
// Usage:
//   node scripts/integrations/golfregi-import.js <path-to-csv> [--output-json <file>]
//   node scripts/integrations/golfregi-import.js <path-to-csv> --dry-run
//
// Input CSV format (Golfregi export):
//   FirstName, LastName, Email, Handicap, Team, PaymentStatus, ...
//
// Output JSON:
//   {
//     players: SpotterUser[],
//     registrations: SpotterTournamentRegistration[]
//   }
//
// The output is ready for Supabase insert or API call.
// ============================================================================

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let inputPath = null;
let outputJsonPath = null;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output-json' && i + 1 < args.length) {
    outputJsonPath = args[++i];
  } else if (args[i] === '--dry-run') {
    dryRun = true;
  } else if (!args[i].startsWith('--')) {
    inputPath = args[i];
  }
}

if (!inputPath) {
  console.error('Usage: node golfregi-import.js <csv-path> [--output-json <file>] [--dry-run]');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Error: File not found: ${inputPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Golfregi CSV Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Golfregi export CSV string into an array of row objects.
 * Handles quoted fields, commas inside quotes, and header normalization.
 */
function parseCsv(raw) {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);

  // Normalize headers: lowercase, strip spaces, collapse multiple spaces
  const normalizedHeaders = headers.map((h) =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = {};
    for (let j = 0; j < normalizedHeaders.length; j++) {
      row[normalizedHeaders[j]] = (values[j] || '').trim();
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

// ---------------------------------------------------------------------------
// Name Parsing
// ---------------------------------------------------------------------------

/**
 * Golfregi typically exports Name as "LastName, FirstName" or "FirstName LastName".
 * This function handles both formats.
 */
function parseName(nameStr) {
  if (!nameStr) return { firstName: '', lastName: '' };
  const s = nameStr.trim();

  if (s.includes(',')) {
    // "LastName, FirstName"
    const parts = s.split(',').map((p) => p.trim());
    return { lastName: parts[0] || '', firstName: parts[1] || '' };
  }

  // "FirstName LastName"
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// ---------------------------------------------------------------------------
// Handicap Validation (matches DB constraint -10 to 54, one decimal)
// ---------------------------------------------------------------------------

function validateHandicap(raw) {
  if (!raw || raw === '' || raw === 'N/A' || raw === 'NH') return null;
  const parsed = parseFloat(raw);
  if (isNaN(parsed)) return null;
  if (parsed < -10 || parsed > 54) {
    throw new Error(
      `Handicap "${raw}" is out of range. Must be between -10.0 and 54.0. ` +
      `Player will be imported with null handicap.`
    );
  }
  // Round to one decimal place
  return Math.round(parsed * 10) / 10;
}

// ---------------------------------------------------------------------------
// Email Normalization
// ---------------------------------------------------------------------------

function normalizeEmail(email) {
  if (!email) return null;
  const s = email.trim().toLowerCase();
  // Basic RFC 5322 simplified validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

// ---------------------------------------------------------------------------
// Team Assignment
// ---------------------------------------------------------------------------

function normalizeTeam(teamStr) {
  if (!teamStr || teamStr === '' || teamStr === 'N/A') return null;
  // Remove leading "Team " prefix if present, normalize whitespace
  return teamStr.replace(/^team\s+/i, '').trim() || null;
}

// ---------------------------------------------------------------------------
// Payment Status Mapping
// ---------------------------------------------------------------------------

/**
 * Map Golfregi payment statuses to Spotter registration statuses.
 * Golfregi common statuses: PAID, PENDING, REFUNDED, WAIVED, NONE
 */
function mapPaymentStatus(golfregiStatus) {
  if (!golfregiStatus) return 'registered'; // default
  const s = golfregiStatus.toUpperCase().trim();
  switch (s) {
    case 'PAID':
    case 'COMPLETE':
    case 'CONFIRMED':
      return 'paid';
    case 'PENDING':
    case 'AWAITING':
    case 'INVOICED':
      return 'pending';
    case 'REFUNDED':
    case 'CANCELLED':
    case 'VOID':
      return 'cancelled';
    case 'WAIVED':
    case 'COMP':
      return 'waived';
    default:
      return 'registered';
  }
}

// ---------------------------------------------------------------------------
// UUID v4 Generator (for dry-run / mock IDs)
// ---------------------------------------------------------------------------

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Main Transform: CSV Row -> Spotter User + Registration
// ---------------------------------------------------------------------------

/**
 * Known Golfregi header aliases (handles common export variations).
 * Maps normalized CSV headers to our expected field names.
 */
const KNOWN_FIELD_MAP = {
  // Name fields
  firstname: 'firstname',
  last_name: 'lastname',
  lastname: 'lastname',
  full_name: 'fullname',
  name: 'fullname',
  // Email
  email_address: 'email',
  emailaddress: 'email',
  // Handicap
  handicap_index: 'handicap',
  handicapindex: 'handicap',
  player_handicap: 'handicap',
  // Team
  team_name: 'team',
  teamname: 'team',
  grouping: 'team',
  group: 'team',
  flight: 'team',
  // Payment
  payment_status: 'paymentstatus',
  paymentstatus: 'paymentstatus',
  payment: 'paymentstatus',
  status: 'paymentstatus',
  // Phone
  phone: 'phone',
  phone_number: 'phone',
  phonenumber: 'phone',
};

/**
 * Remap a raw row using known field aliases.
 */
function remapRow(rawRow) {
  const remapped = {};
  for (const [rawKey, value] of Object.entries(rawRow)) {
    const mapped = KNOWN_FIELD_MAP[rawKey] || rawKey;
    remapped[mapped] = value;
  }
  return remapped;
}

/**
 * Transform a single CSV row into Spotter player + registration objects.
 * @param {object} row - Parsed and remapped CSV row
 * @param {string} tournamentId - Tournament UUID to register players for
 * @returns {{ player: object, registration: object } | null}
 */
function transformRow(row, tournamentId) {
  // Name parsing
  let firstName, lastName;
  if (row.fullname) {
    const parsed = parseName(row.fullname);
    firstName = parsed.firstName;
    lastName = parsed.lastName;
  } else {
    firstName = row.firstname || '';
    lastName = row.lastname || '';
  }

  if (!firstName && !lastName) {
    console.warn(`  ⚠ Skipping row with no name: ${JSON.stringify(row)}`);
    return null;
  }

  // Email
  const email = normalizeEmail(row.email || row.emailaddress || '');
  if (!email) {
    console.warn(`  ⚠ Skipping "${firstName} ${lastName}" — invalid or missing email`);
    return null;
  }

  // Handicap
  const handicapIndex = validateHandicap(row.handicap || '');
  if (row.handicap && handicapIndex === null) {
    console.warn(`  ⚠ "${firstName} ${lastName}" has invalid handicap "${row.handicap}" — imported as null`);
  }

  // Team
  const team = normalizeTeam(row.team || row.grouping || row.flight || '');

  // Payment
  const paymentStatus = mapPaymentStatus(row.paymentstatus || row.payment || row.status || '');

  // Build display name (reuse lastName, firstName format used in Spotter)
  const displayName = `${lastName}, ${firstName}`.trim();

  const playerId = generateUuid();

  return {
    player: {
      id: playerId,
      email,
      displayName,
      firstName,
      lastName,
      handicapIndex,
      ghinNumber: row.ghin || row.ghinnumber || null,
      source: 'golfregi_import',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    registration: {
      id: generateUuid(),
      userId: playerId,
      tournamentId, // caller passes this
      teamName: team,
      paymentStatus,
      registeredAt: new Date().toISOString(),
      importedFrom: 'golfregi',
      sourceData: {
        originalName: `${firstName} ${lastName}`.trim(),
        originalEmail: email,
        originalHandicap: row.handicap || null,
        originalTeam: team,
        originalPaymentStatus: row.paymentstatus || row.paymentstatus || '',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('\n🛎️  Golfregi CSV Import');
  console.log('========================');
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputJsonPath || 'stdout'}`);
  console.log(`Dry-run: ${dryRun ? 'YES (no files written)' : 'NO'}`);

  const csvRaw = fs.readFileSync(inputPath, 'utf-8');
  const rawRows = parseCsv(csvRaw);
  console.log(`\nParsed ${rawRows.length} rows from CSV`);

  if (rawRows.length === 0) {
    console.error('Error: No data rows found in CSV');
    process.exit(1);
  }

  // Show detected headers
  const headers = Object.keys(rawRows[0]);
  console.log(`Detected columns: ${headers.join(', ')}`);

  // Ask for tournament ID if not provided via env (dry-run uses mock)
  const tournamentId = process.env.GOLFREGI_TOURNAMENT_ID || generateUuid();
  if (!process.env.GOLFREGI_TOURNAMENT_ID) {
    console.log(
      `\n⚠  GOLFREGI_TOURNAMENT_ID not set. Using mock UUID for dry-run: ${tournamentId}`
    );
    if (!dryRun) {
      console.log('Set GOLFREGI_TOURNAMENT_ID env var for real imports.');
    }
  }

  // Transform each row
  const players = [];
  const registrations = [];
  const skipped = [];

  for (const rawRow of rawRows) {
    const row = remapRow(rawRow);
    try {
      const result = transformRow(row, tournamentId);
      if (result) {
        players.push(result.player);
        registrations.push(result.registration);
      } else {
        skipped.push(rawRow);
      }
    } catch (err) {
      console.error(`  ✗ Error processing row: ${err.message}`);
      skipped.push(rawRow);
    }
  }

  // Deduplicate by email (take first occurrence)
  const seenEmails = new Set();
  const uniquePlayers = [];
  const uniqueRegistrations = [];
  for (let i = 0; i < players.length; i++) {
    if (!seenEmails.has(players[i].email)) {
      seenEmails.add(players[i].email);
      uniquePlayers.push(players[i]);
      uniqueRegistrations.push(registrations[i]);
    } else {
      console.warn(
        `  ⚠ Duplicate email "${players[i].email}" — skipping duplicate row #${i + 2}`
      );
    }
  }

  // Stats
  console.log(`\n📊 Import Summary`);
  console.log(`  Total CSV rows:  ${rawRows.length}`);
  console.log(`  Players imported: ${uniquePlayers.length}`);
  console.log(`  Skipped:          ${skipped.length + (rawRows.length - players.length)}`);
  console.log(`  Duplicates:       ${players.length - uniquePlayers.length}`);

  // Group by team
  const teamCounts = {};
  for (const reg of uniqueRegistrations) {
    const team = reg.teamName || '(no team)';
    teamCounts[team] = (teamCounts[team] || 0) + 1;
  }
  console.log(`\n📋 Teams:`);
  for (const [team, count] of Object.entries(teamCounts).sort()) {
    console.log(`  ${team}: ${count} player(s)`);
  }

  // Payment status breakdown
  const paymentCounts = {};
  for (const reg of uniqueRegistrations) {
    paymentCounts[reg.paymentStatus] = (paymentCounts[reg.paymentStatus] || 0) + 1;
  }
  console.log(`\n💳 Payment Status:`);
  for (const [status, count] of Object.entries(paymentCounts).sort()) {
    console.log(`  ${status}: ${count}`);
  }

  const output = {
    meta: {
      importedAt: new Date().toISOString(),
      sourceFile: path.basename(inputPath),
      tournamentId,
      totalPlayers: uniquePlayers.length,
      totalRegistrations: uniqueRegistrations.length,
      dryRun,
    },
    players: uniquePlayers,
    registrations: uniqueRegistrations,
    skippedRows: skipped.slice(0, 50), // cap for output size
  };

  if (outputJsonPath) {
    if (dryRun) {
      console.log(`\n🔍 Dry-run: would write ${outputJsonPath}`);
    } else {
      fs.writeFileSync(outputJsonPath, JSON.stringify(output, null, 2));
      console.log(`\n✅ Written: ${outputJsonPath}`);
    }
  } else {
    console.log('\n--- JSON Output ---');
    console.log(JSON.stringify(output, null, 2));
  }

  // Usage example for Supabase
  console.log('\n📦 Supabase Insert Example:');
  console.log('---------------------------');
  console.log(
    `await supabase.from('users').insert(${JSON.stringify(uniquePlayers.map(p => ({
      id: p.id, email: p.email, display_name: p.displayName,
      handicap_index: p.handicapIndex, ghin_number: p.ghinNumber
    })), null, 2)});`
  );
  console.log(
    `await supabase.from('tournament_registrations').insert(${JSON.stringify(uniqueRegistrations.map(r => ({
      id: r.id, user_id: r.userId, tournament_id: r.tournamentId,
      team_name: r.teamName, payment_status: r.paymentStatus
    })), null, 2)});`
  );

  if (skipped.length > 0) {
    console.log(`\n⚠  ${skipped.length} rows were skipped. Review skippedRows in output JSON.`);
  }

  console.log('\n✅ Done.\n');
}

main();
