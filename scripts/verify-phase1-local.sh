#!/bin/bash
# ============================================================================
# Phase 1 Migration Verification Script (Local PostgreSQL)
# ============================================================================

set -e

echo "=========================================="
echo "Phase 1 Migration Verification"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

psql "$DATABASE_URL" << 'EOF'
\echo ''
\echo '=== Table Verification ==='
\echo ''

-- Check user_networking_preferences table
SELECT 
    'user_networking_preferences' as table_name,
    EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_networking_preferences'
    ) as exists;

\echo ''
\echo '=== Column Verification ==='
\echo ''

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'user_networking_preferences'
ORDER BY ordinal_position;

\echo ''
\echo '=== Tier Price Verification ==='
\echo ''

SELECT 
    slug,
    name,
    price_cents,
    billing_interval,
    description
FROM membership_tiers
ORDER BY display_order;

\echo ''
echo '=== Index Verification ==='
\echo ''

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'user_networking_preferences';

\echo ''
echo '=== Enum Verification ==='
\echo ''

SELECT 
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('networking_intent', 'preferred_group_size', 'cart_preference')
GROUP BY t.typname;

\echo ''
echo '=========================================='
echo 'Verification complete!'
echo '=========================================='
EOF
