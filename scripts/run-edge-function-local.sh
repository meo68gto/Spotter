#!/bin/bash
# ============================================================================
# Phase 1 Edge Function Local Development Script
# ============================================================================
# Runs the onboarding-phase1 edge function locally using Deno
# For local development only — production uses Supabase Edge Functions

set -e

cd "$(dirname "$0")/.."

FUNCTION_NAME="onboarding-phase1"
FUNCTION_DIR="apps/functions/supabase/functions/${FUNCTION_NAME}"

echo "=========================================="
echo "Phase 1 Edge Function: ${FUNCTION_NAME}"
echo "=========================================="
echo ""

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo "Deno is not installed. Installing..."
    curl -fsSL https://deno.land/install.sh | sh
    export PATH="$HOME/.deno/bin:$PATH"
fi

# Check function exists
if [ ! -f "${FUNCTION_DIR}/index.ts" ]; then
    echo "Error: Function not found at ${FUNCTION_DIR}/index.ts"
    exit 1
fi

echo "Running function locally..."
echo ""
echo "Function: ${FUNCTION_NAME}"
echo "Port: 54321 (default)"
echo ""
echo "To test, send POST requests to:"
echo "  http://localhost:54321/functions/v1/${FUNCTION_NAME}"
echo ""
echo "Required headers:"
echo "  Authorization: Bearer <your-jwt-token>"
echo "  Content-Type: application/json"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Set environment variables if .env exists
if [ -f ".env.local" ]; then
    echo "Loading environment from .env.local..."
    export $(grep -v '^#' .env.local | xargs)
elif [ -f ".env" ]; then
    echo "Loading environment from .env..."
    export $(grep -v '^#' .env | xargs)
fi

# Run the function with Deno
cd "${FUNCTION_DIR}"
deno run --allow-all --watch index.ts
