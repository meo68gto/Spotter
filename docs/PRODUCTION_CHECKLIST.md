# Production Deployment Checklist

## Pre-Deployment Phase

### 1. Environment Preparation

- [ ] Production `.env.production` file created and validated
- [ ] All required secrets configured in GitHub Actions
- [ ] Database migration scripts reviewed and tested in staging
- [ ] Feature flags configured for production (enable/disable as needed)

### 2. Code Review

- [ ] All code changes reviewed and approved
- [ ] All tests passing (unit, integration, e2e)
- [ ] Security audit completed (no exposed secrets, proper input validation)
- [ ] Performance review completed (no N+1 queries, proper indexing)

### 3. Database Preparation

- [ ] Migrations reviewed for backwards compatibility
- [ ] Migration rollback script tested
- [ ] Database backup created and verified
- [ ] Index verification completed (see PERFORMANCE.md)

### 4. Infrastructure Review

- [ ] Supabase project resources adequate (connections, storage, etc.)
- [ ] Vercel deployment configuration verified
- [ ] Edge Functions deployment plan ready
- [ ] SSL certificates valid and not expiring soon

## Deployment Phase

### 1. Pre-Flight Checks

```bash
# Run these before deploying
./scripts/deploy-production.sh --dry-run
./scripts/verify-deployment.sh staging
./scripts/migrate-production.sh --dry-run
```

- [ ] Dry-run deployment completed successfully
- [ ] Staging environment verified
- [ ] Team notified of deployment window
- [ ] Rollback plan reviewed and ready

### 2. Database Migration

```bash
# Run database migrations first
./scripts/migrate-production.sh --backup-first
```

- [ ] Pre-migration backup completed
- [ ] Migrations applied successfully
- [ ] Post-migration verification passed
- [ ] Rollback point created

### 3. Application Deployment

```bash
# Deploy the application
./scripts/deploy-production.sh
```

- [ ] Code deployed via GitHub Actions
- [ ] Edge Functions deployed successfully
- [ ] Build artifacts generated
- [ ] Deployment logs reviewed for errors

### 4. Post-Deployment Verification

```bash
# Verify the deployment
./scripts/verify-deployment.sh production --verbose
```

- [ ] Health checks passing
- [ ] API response times acceptable (< 500ms)
- [ ] All edge functions responding
- [ ] SSL certificates valid
- [ ] Security headers present
- [ ] Feature flags functioning correctly

## Go-Live Checklist

### 1. Smoke Testing

- [ ] User registration flow works
- [ ] Login/logout works
- [ ] Core user journeys functional:
  - [ ] Matching discovery
  - [ ] Session booking
  - [ ] Payment processing
  - [ ] Chat functionality
  - [ ] Video calls (if enabled)

### 2. Payment Verification

- [ ] Stripe webhook endpoint responding
- [ ] Test payment succeeds
- [ ] Payout flow works for coaches
- [ ] Refund process functional

### 3. Monitoring Setup

- [ ] Sentry error tracking active
- [ ] PostHog analytics receiving events
- [ ] Supabase dashboard monitoring enabled
- [ ] Alert thresholds configured

### 4. Communication

- [ ] Team notified of successful deployment
- [ ] Status page updated (if applicable)
- [ ] Users notified of new features (if applicable)

## Post-Deployment Monitoring

### First Hour

- [ ] Error rates monitored (target: < 0.1%)
- [ ] API response times monitored (target: p95 < 500ms)
- [ ] Database connection pool monitored
- [ ] User feedback channels monitored

### First 24 Hours

- [ ] Daily health report reviewed
- [ ] No critical errors in Sentry
- [ ] Payment success rate > 95%
- [ ] Session completion rate normal

### First Week

- [ ] Performance metrics stable
- [ ] No increase in support tickets
- [ ] Database query performance acceptable
- [ ] Cost metrics within budget

## Rollback Criteria

**Immediate rollback if:**

- [ ] Error rate > 5%
- [ ] API completely unresponsive > 5 minutes
- [ ] Payment processing failing
- [ ] Data corruption detected
- [ ] Security breach suspected

**Rollback procedure:**

```bash
# Emergency rollback
./scripts/rollback-phase3.sh --to-version [PREVIOUS_VERSION]
```

## Security Checklist

- [ ] All environment variables use production values
- [ ] Stripe webhook secrets rotated
- [ ] JWT secrets rotated
- [ ] Database connection uses SSL/TLS
- [ ] API rate limiting enabled
- [ ] CORS configured correctly
- [ ] No debug logging in production
- [ ] No test data in production

## Documentation

- [ ] Deployment notes documented
- [ ] Any configuration changes noted
- [ ] Known issues documented
- [ ] Runbook updated

## Sign-Off

**Deployment Lead:** _________________ Date: _______

**QA Verification:** _________________ Date: _______

**Security Review:** _________________ Date: _______

**Go-Live Approval:** _________________ Date: _______

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Tech Lead | | |
| DevOps | | |
| Product Owner | | |
| On-Call Engineer | | |

## Quick Reference Commands

```bash
# Health check
curl https://api.spotter.app/health

# View logs
supabase functions logs --tail

# Database backup
supabase db dump --data-only > backup.sql

# Emergency rollback
./scripts/rollback-phase3.sh --to-version vPREVIOUS

# Full verification
./scripts/verify-deployment.sh production --verbose
```
