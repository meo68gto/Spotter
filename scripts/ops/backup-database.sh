#!/usr/bin/env bash
#
# Database Backup Script for Spotter Production
# Creates encrypted backups of critical tables
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../../.artifacts/backups"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
BACKUP_NAME="spotter_backup_${TIMESTAMP}"
LOG_FILE="${BACKUP_DIR}/${BACKUP_NAME}.log"

# Required environment variables
: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD not set}"

# Tables to backup (critical data)
CRITICAL_TABLES=(
  "users"
  "membership_tiers"
  "tier_history"
  "user_connections"
  "introduction_requests"
  "golf_courses"
  "golf_rounds"
  "round_participants"
  "round_invitations"
  "vouches"
  "trust_reports"
  "event_registrations"
  "payments"
  "subscriptions"
  "organizer_events"
  "organizer_members"
)

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Logging function
log() {
  echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] $1" | tee -a "${LOG_FILE}"
}

# Error handling
error_exit() {
  log "ERROR: $1"
  exit 1
}

log "Starting Spotter database backup: ${BACKUP_NAME}"
log "Backup directory: ${BACKUP_DIR}"

# Check dependencies
command -v psql >/dev/null 2>&1 || error_exit "psql is required but not installed"
command -v pg_dump >/dev/null 2>&1 || error_exit "pg_dump is required but not installed"

# Extract connection details from SUPABASE_URL
# Format: https://<project-ref>.supabase.co
PROJECT_REF=$(echo "${SUPABASE_URL}" | sed -n 's|https://\([^.]*\).*|\1|p')
DB_HOST="db.${PROJECT_REF}.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

log "Connecting to database host: ${DB_HOST}"

# Test connection
log "Testing database connection..."
if ! PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -c "SELECT 1;" >/dev/null 2>&1; then
  error_exit "Failed to connect to database"
fi

log "Database connection successful"

# Create schema backup
log "Creating schema backup..."
SCHEMA_FILE="${BACKUP_DIR}/${BACKUP_NAME}_schema.sql"
PGPASSWORD="${SUPABASE_DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --schema-only \
  --no-owner \
  --no-privileges \
  > "${SCHEMA_FILE}" 2>>"${LOG_FILE}" || error_exit "Schema backup failed"

log "Schema backup complete: ${SCHEMA_FILE}"

# Backup critical tables
for table in "${CRITICAL_TABLES[@]}"; do
  log "Backing up table: ${table}"
  
  TABLE_FILE="${BACKUP_DIR}/${BACKUP_NAME}_${table}.csv"
  
  PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -c "\COPY (SELECT * FROM public.${table}) TO '${TABLE_FILE}' WITH CSV HEADER;" \
    2>>"${LOG_FILE}" || {
    log "WARNING: Failed to backup table ${table}"
    continue
  }
  
  # Compress the CSV
  gzip -f "${TABLE_FILE}"
  log "Table ${table} backed up: ${TABLE_FILE}.gz"
done

# Create metadata file
METADATA_FILE="${BACKUP_DIR}/${BACKUP_NAME}_metadata.json"
cat > "${METADATA_FILE}" <<EOF
{
  "backup_name": "${BACKUP_NAME}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "project_ref": "${PROJECT_REF}",
  "tables_backed_up": $(printf '["%s"]' "$(IFS=,; echo "${CRITICAL_TABLES[*]}")" | sed 's/,/", "/g'),
  "schema_file": "${BACKUP_NAME}_schema.sql",
  "log_file": "${BACKUP_NAME}.log"
}
EOF

log "Metadata saved: ${METADATA_FILE}"

# Create manifest
MANIFEST_FILE="${BACKUP_DIR}/${BACKUP_NAME}_manifest.txt"
{
  echo "Spotter Database Backup Manifest"
  echo "================================"
  echo "Backup Name: ${BACKUP_NAME}"
  echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "Project: ${PROJECT_REF}"
  echo ""
  echo "Files:"
  ls -lh "${BACKUP_DIR}/${BACKUP_NAME}"* 2>/dev/null || true
} > "${MANIFEST_FILE}"

log "Backup manifest: ${MANIFEST_FILE}"

# Cleanup old backups (keep last 30 days)
log "Cleaning up old backups..."
find "${BACKUP_DIR}" -name "spotter_backup_*" -type f -mtime +30 -delete 2>/dev/null || true

# Calculate backup size
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}"* 2>/dev/null | tail -1 | awk '{print $1}')
log "Total backup size: ${BACKUP_SIZE}"

log "Backup complete: ${BACKUP_NAME}"
log "To restore, use: ./restore-production.sh ${BACKUP_NAME}"

echo ""
echo "Backup Summary"
echo "=============="
echo "Name: ${BACKUP_NAME}"
echo "Location: ${BACKUP_DIR}"
echo "Size: ${BACKUP_SIZE}"
echo "Log: ${LOG_FILE}"
echo ""
echo "Files created:"
ls -lh "${BACKUP_DIR}/${BACKUP_NAME}"* 2>/dev/null || true
