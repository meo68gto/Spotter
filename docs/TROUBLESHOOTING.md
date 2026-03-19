# Troubleshooting Guide

Common issues and solutions for Spotter development.

## Quick Diagnostics

Run this first:

```bash
pnpm smoke:local
```

This checks:
- Database connectivity
- Auth service
- Edge functions
- Realtime subscriptions

## Installation Issues

### pnpm install fails

**Symptom:**
```
ERR_PNPM_NO_MATCHING_VERSION
```

**Solution:**
```bash
# Clear cache
pnpm store prune

# Use correct Node version
nvm use 18

# Reinstall
rm -rf node_modules
pnpm install
```

### Docker not running

**Symptom:**
```
Cannot connect to Docker daemon
```

**Solution:**
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker

# Verify
docker ps
```

## Local Development Issues

### Supabase won't start

**Symptom:**
```
Error: port 54321 already in use
```

**Solution:**
```bash
# Find and kill process
lsof -ti:54321 | xargs kill -9

# Or use different port
supabase start --port 54331
```

**Symptom:**
```
Failed to start containers
```

**Solution:**
```bash
# Full reset
supabase stop --backup
docker system prune -a
supabase start
```

### Database connection refused

**Symptom:**
```
connection refused on port 54322
```

**Solution:**
```bash
# Check if running
docker ps | grep supabase

# Restart stack
supabase stop
supabase start

# Verify connection
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT 1"
```

### Edge functions not responding

**Symptom:**
```
404 Not Found on /functions/v1/...
```

**Solution:**
```bash
# Redeploy functions
supabase functions deploy

# Check function status
supabase functions list

# View logs
supabase functions logs <function-name>
```

## Mobile App Issues

### Metro bundler errors

**Symptom:**
```
Unable to resolve module
```

**Solution:**
```bash
# Clear caches
pnpm clean
watchman watch-del-all
rm -rf node_modules
rm -rf $TMPDIR/metro-*

# Reinstall
pnpm install
pnpm mobile:dev
```

**Symptom:**
```
Error: ENOSPC: System limit for number of file watchers reached
```

**Solution:**
```bash
# Linux only
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### iOS Simulator issues

**Symptom:**
```
Could not find iPhone X simulator
```

**Solution:**
```bash
# List available simulators
xcrun simctl list devices

# Boot specific device
xcrun simctl boot "iPhone 15"

# Or use Expo Go on physical device
```

**Symptom:**
```
Build failed: Unable to boot device
```

**Solution:**
```bash
# Reset simulator
xcrun simctl erase all

# Or use different simulator
pnpm mobile:dev --ios --device="iPhone 15 Pro"
```

### Android Emulator issues

**Symptom:**
```
Failed to install app
```

**Solution:**
```bash
# Wipe emulator data
# Android Studio → AVD Manager → Wipe Data

# Or use physical device
pnpm mobile:dev --android --device
```

**Symptom:**
```
Could not connect to development server
```

**Solution:**
```bash
# Check ADB
adb devices

# Reverse port
adb reverse tcp:8081 tcp:8081

# Restart
pnpm mobile:dev --android
```

## Authentication Issues

### OTP not received

**Symptom:**
No email received after requesting OTP

**Solution:**
```bash
# Check Inbucket (local email)
open http://localhost:54324

# Verify email service
supabase status

# Check logs
supabase logs auth
```

### Invalid token errors

**Symptom:**
```
JWT expired
```

**Solution:**
```bash
# Refresh session in app
# Or sign out and back in

# Check system time
date  # Should be accurate
```

## Database Issues

### Migration fails

**Symptom:**
```
Migration failed: relation already exists
```

**Solution:**
```bash
# Reset database (local only!)
supabase db reset

# Or fix specific migration
supabase migration repair --status reverted 001_failed_migration
```

### RLS policy errors

**Symptom:**
```
new row violates row-level security policy
```

**Solution:**
```bash
# Check policies
supabase db dump --data-only | grep "CREATE POLICY"

# Temporarily disable RLS (local only)
supabase db query "ALTER TABLE users DISABLE ROW LEVEL SECURITY;"
```

### Data not appearing

**Symptom:**
Query returns empty results

**Solution:**
```bash
# Check RLS
supabase db query "SELECT * FROM pg_policies WHERE tablename = 'users';"

# Verify data exists
supabase db query "SELECT COUNT(*) FROM users;"

# Check tier visibility
# Remember: same-tier visibility enforced
```

## API/Function Issues

### Function timeout

**Symptom:**
```
Function execution timed out after 10 seconds
```

**Solution:**
```typescript
// Add early returns
// Optimize database queries
// Use streaming for large responses

// Check for infinite loops
// Add pagination
```

### CORS errors

**Symptom:**
```
Access-Control-Allow-Origin header missing
```

**Solution:**
```typescript
// In function, add:
import { corsHeaders } from '../_shared/cors.ts';

return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

### Stripe webhook failures

**Symptom:**
```
Webhook signature verification failed
```

**Solution:**
```bash
# Verify webhook secret
supabase secrets get STRIPE_WEBHOOK_SECRET

# Check signature header is being passed
# Use raw body, not parsed JSON
```

## Testing Issues

### Tests fail intermittently

**Symptom:**
Flaky tests

**Solution:**
```bash
# Increase timeout
pnpm test -- --testTimeout=30000

# Run serially
pnpm test -- --runInBand

# Debug specific test
pnpm test -- --grep "test name" --verbose
```

### Database locked in tests

**Symptom:**
```
database is locked
```

**Solution:**
```bash
# Use separate test database
SUPABASE_TEST_DATABASE=true pnpm test

# Or reset between runs
pnpm db:reset:test
```

## Performance Issues

### App slow to load

**Symptom:**
Long initial load time

**Solution:**
```bash
# Check bundle size
cd apps/mobile
pnpm bundle:analyze

# Look for:
# - Large dependencies
# - Unnecessary imports
# - Duplicate code
```

### Database queries slow

**Symptom:**
API calls taking > 2 seconds

**Solution:**
```sql
-- Check for missing indexes
SELECT * FROM pg_indexes WHERE tablename = 'users';

-- Add index if needed
CREATE INDEX CONCURRENTLY idx_users_tier ON users(tier_id);

-- Analyze query
EXPLAIN ANALYZE SELECT * FROM users WHERE tier_id = '...';
```

### Memory issues

**Symptom:**
```
JavaScript heap out of memory
```

**Solution:**
```bash
# Increase Node memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Or in package.json
"scripts": {
  "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
}
```

## Environment Issues

### Environment variables not loading

**Symptom:**
```
process.env.XXX is undefined
```

**Solution:**
```bash
# Check .env file exists
cat .env.local

# Verify variable names
# Must start with EXPO_PUBLIC_ for mobile

# Restart dev server after changes
```

### Wrong environment

**Symptom:**
Connecting to production instead of local

**Solution:**
```bash
# Check current env
echo $SUPABASE_URL

# Switch to local
source .env.local

# Verify
pnpm smoke:local
```

## Build Issues

### EAS build fails

**Symptom:**
```
Build failed: Unknown error
```

**Solution:**
```bash
# Check logs
eas build:logs

# Verify credentials
eas credentials

# Clear and retry
eas build --clear-cache
```

### TypeScript errors

**Symptom:**
```
Type error: Property 'x' does not exist
```

**Solution:**
```bash
# Check types
pnpm typecheck

# Fix or add @ts-ignore with reason
// @ts-ignore - Known issue with library types
```

## Getting Help

### Gather Information

Before asking for help, collect:

```bash
# System info
node --version
pnpm --version
docker --version

# Project status
git status
git log --oneline -5

# Error logs
pnpm smoke:local 2>&1 | tee smoke.log

# Environment
env | grep -E "(SUPABASE|STRIPE|NODE)" | grep -v KEY
```

### Where to Ask

1. **Documentation**: Check `/docs` folder
2. **GitHub Issues**: Search existing issues
3. **Discord**: [Join community](https://discord.gg/spotter)
4. **Email**: dev@spotter.golf

### Reporting Bugs

Include:
- Steps to reproduce
- Expected vs actual behavior
- Error messages (full stack trace)
- Environment details
- Screenshots if applicable

## Emergency Fixes

### Nuclear Option

If nothing works:

```bash
# 1. Stop everything
pnpm local:stop
pkill -f node
pkill -f expo

# 2. Clean everything
rm -rf node_modules
rm -rf apps/mobile/node_modules
rm -rf packages/*/node_modules
pnpm store prune
docker system prune -a

# 3. Start fresh
pnpm install
pnpm local:up
pnpm mobile:dev
```

**Warning:** This removes all Docker containers and images!

## Prevention

### Best Practices

1. **Commit often** - Easy to revert
2. **Use branches** - Don't break main
3. **Run tests** - Before pushing
4. **Read errors** - Full stack traces help
5. **Check docs** - Most issues are documented

### Regular Maintenance

```bash
# Weekly
pnpm outdated
pnpm audit

# Monthly
pnpm store prune
docker system prune
```
