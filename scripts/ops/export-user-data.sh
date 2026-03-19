#!/usr/bin/env bash
#
# User Data Export Script for Spotter
# GDPR-compliant user data export
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORT_DIR="${SCRIPT_DIR}/../../.artifacts/user-exports"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")

# Required environment variables
: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"

# Usage
usage() {
  cat <<EOF
Usage: $0 <user-id> [options]

Export all data for a specific user (GDPR-compliant)

Options:
  -f, --format    Output format: json (default) or csv
  -o, --output    Output directory (default: .artifacts/user-exports)
  -h, --help      Show this help message

Example:
  $0 123e4567-e89b-12d3-a456-426614174000
  $0 123e4567-e89b-12d3-a456-426614174000 --format csv
EOF
  exit 1
}

# Parse arguments
USER_ID=""
FORMAT="json"

while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--format)
      FORMAT="$2"
      shift 2
      ;;
    -o|--output)
      EXPORT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    -*)
      echo "Unknown option: $1"
      usage
      ;;
    *)
      if [[ -z "${USER_ID}" ]]; then
        USER_ID="$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "${USER_ID}" ]]; then
  echo "Error: User ID is required"
  usage
fi

# Validate UUID format
if [[ ! "${USER_ID}" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  echo "Error: Invalid UUID format"
  exit 1
fi

# Create export directory
mkdir -p "${EXPORT_DIR}"
EXPORT_NAME="user_export_${USER_ID}_${TIMESTAMP}"
EXPORT_PATH="${EXPORT_DIR}/${EXPORT_NAME}"
mkdir -p "${EXPORT_PATH}"

log() {
  echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] $1"
}

log "Starting user data export for: ${USER_ID}"
log "Export directory: ${EXPORT_PATH}"
log "Format: ${FORMAT}"

# Supabase REST API helper
supabase_request() {
  local endpoint="$1"
  local query="${2:-}"
  
  local url="${SUPABASE_URL}/rest/v1/${endpoint}"
  if [[ -n "${query}" ]]; then
    url="${url}?${query}"
  fi
  
  curl -sS "${url}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Accept: application/json"
}

# Export user profile
log "Exporting user profile..."
supabase_request "users" "select=*&id=eq.${USER_ID}" > "${EXPORT_PATH}/profile.json"

# Export professional identity
log "Exporting professional identity..."
supabase_request "user_professional_identities" "select=*&user_id=eq.${USER_ID}" > "${EXPORT_PATH}/professional_identity.json"

# Export golf identity
log "Exporting golf identity..."
supabase_request "user_golf_identities" "select=*&user_id=eq.${USER_ID}" > "${EXPORT_PATH}/golf_identity.json"

# Export connections
log "Exporting connections..."
supabase_request "user_connections" "select=*&or=(user_id.eq.${USER_ID},connected_user_id.eq.${USER_ID})" > "${EXPORT_PATH}/connections.json"

# Export introduction requests
log "Exporting introduction requests..."
supabase_request "introduction_requests" "select=*&or=(requester_id.eq.${USER_ID},introducer_id.eq.${USER_ID},target_user_id.eq.${USER_ID})" > "${EXPORT_PATH}/introductions.json"

# Export rounds created
log "Exporting rounds..."
supabase_request "golf_rounds" "select=*&creator_id=eq.${USER_ID}" > "${EXPORT_PATH}/rounds_created.json"

# Export round participations
log "Exporting round participations..."
supabase_request "round_participants" "select=*&member_id=eq.${USER_ID}" > "${EXPORT_PATH}/round_participations.json"

# Export round invitations
log "Exporting round invitations..."
supabase_request "round_invitations" "select=*&invitee_id=eq.${USER_ID}" > "${EXPORT_PATH}/round_invitations.json"

# Export vouches
log "Exporting vouches..."
supabase_request "vouches" "select=*&or=(voucher_id.eq.${USER_ID},vouched_id.eq.${USER_ID})" > "${EXPORT_PATH}/vouches.json"

# Export trust reports
log "Exporting trust reports..."
supabase_request "trust_reports" "select=*&or=(reporter_id.eq.${USER_ID},reported_id.eq.${USER_ID})" > "${EXPORT_PATH}/trust_reports.json"

# Export reputation
log "Exporting reputation..."
supabase_request "user_reputation" "select=*&user_id=eq.${USER_ID}" > "${EXPORT_PATH}/reputation.json"

# Export tier history
log "Exporting tier history..."
supabase_request "tier_history" "select=*&user_id=eq.${USER_ID}" > "${EXPORT_PATH}/tier_history.json"

# Export event registrations
log "Exporting event registrations..."
supabase_request "event_registrations" "select=*&user_id=eq.${USER_ID}" > "${EXPORT_PATH}/event_registrations.json"

# Export payments
log "Exporting payments..."
supabase_request "payments" "select=*&user_id=eq.${USER_ID}" > "${EXPORT_PATH}/payments.json"

# Export subscriptions
log "Exporting subscriptions..."
supabase_request "subscriptions" "select=*&user_id=eq.${USER_ID}" > "${EXPORT_PATH}/subscriptions.json"

# Export notifications
log "Exporting notifications..."
supabase_request "notifications" "select=*&user_id=eq.${USER_ID}" > "${EXPORT_PATH}/notifications.json"

# Export saved members
log "Exporting saved members..."
supabase_request "saved_members" "select=*&user_id=eq.${USER_ID}" > "${EXPORT_PATH}/saved_members.json"

# Export network connections
log "Exporting network connections..."
supabase_request "network_connections" "select=*&or=(requester_id.eq.${USER_ID},recipient_id.eq.${USER_ID})" > "${EXPORT_PATH}/network_connections.json"

# Create metadata file
cat > "${EXPORT_PATH}/metadata.json" <<EOF
{
  "export_id": "${EXPORT_NAME}",
  "user_id": "${USER_ID}",
  "exported_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "format": "${FORMAT}",
  "tables_exported": [
    "users",
    "user_professional_identities",
    "user_golf_identities",
    "user_connections",
    "introduction_requests",
    "golf_rounds",
    "round_participants",
    "round_invitations",
    "vouches",
    "trust_reports",
    "user_reputation",
    "tier_history",
    "event_registrations",
    "payments",
    "subscriptions",
    "notifications",
    "saved_members",
    "network_connections"
  ],
  "gdpr_compliant": true,
  "retention_days": 30
}
EOF

# Create summary
log "Creating export summary..."
{
  echo "User Data Export Summary"
  echo "======================="
  echo "User ID: ${USER_ID}"
  echo "Export ID: ${EXPORT_NAME}"
  echo "Exported At: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo ""
  echo "Files Exported:"
  ls -lh "${EXPORT_PATH}"
  echo ""
  echo "Total Size: $(du -sh "${EXPORT_PATH}" | awk '{print $1}')"
} > "${EXPORT_PATH}/SUMMARY.txt"

# Create archive
ARCHIVE_FILE="${EXPORT_DIR}/${EXPORT_NAME}.tar.gz"
tar -czf "${ARCHIVE_FILE}" -C "${EXPORT_DIR}" "${EXPORT_NAME}"

# Remove temporary directory
rm -rf "${EXPORT_PATH}"

log "Export complete: ${ARCHIVE_FILE}"

# Output summary
echo ""
echo "Export Complete"
echo "==============="
echo "User ID: ${USER_ID}"
echo "Archive: ${ARCHIVE_FILE}"
echo "Size: $(du -sh "${ARCHIVE_FILE}" | awk '{print $1}')"
echo ""
echo "This export contains all personal data for the user."
echo "Handle in accordance with GDPR requirements."
