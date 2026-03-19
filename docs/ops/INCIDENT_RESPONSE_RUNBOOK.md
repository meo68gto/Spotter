# Spotter Incident Response Runbook

## Quick Reference

| Severity | Response Time | Escalation |
|----------|--------------|------------|
| P0 - Critical | 15 minutes | Immediate |
| P1 - High | 1 hour | Within 30 min |
| P2 - Medium | 4 hours | Within 2 hours |
| P3 - Low | 24 hours | Next business day |

## Contact Information

- **Primary On-Call**: [Your contact]
- **Secondary**: [Secondary contact]
- **Escalation**: [Manager/Lead contact]

## Severity Definitions

### P0 - Critical
- Complete system outage
- Data loss or corruption
- Security breach
- Payment processing failure
- Authentication system down

### P1 - High
- Major feature degradation
- Performance issues affecting >50% users
- Database connectivity issues
- Stripe webhook failures
- Tier enforcement failures

### P2 - Medium
- Minor feature issues
- Performance degradation <50% users
- Non-critical function failures
- UI/UX issues

### P3 - Low
- Cosmetic issues
- Documentation errors
- Feature requests disguised as bugs

---

## Incident Response Procedures

### 1. Detection & Alerting

**Monitoring Sources:**
- Health endpoint: `GET /functions/v1/health`
- Error logs: `supabase/rest/v1/error_logs`
- Performance logs: `supabase/rest/v1/query_performance_logs`
- Stripe dashboard webhooks
- Daily.co dashboard

**Alert Channels:**
- Sentry alerts (if configured)
- Health check failures
- Error rate thresholds (>10 errors/hour)
- Slow query alerts (>5s response time)

### 2. Initial Response

```bash
# 1. Check system health
curl https://your-project.supabase.co/functions/v1/health | jq .

# 2. Check recent errors
psql $DATABASE_URL -c "SELECT * FROM get_error_summary(1);"

# 3. Check slow queries
psql $DATABASE_URL -c "SELECT * FROM get_slow_queries(1000);"

# 4. View function health
psql $DATABASE_URL -c "SELECT * FROM function_health_checks ORDER BY checked_at DESC LIMIT 10;"
```

### 3. Common Incident Types

#### 3.1 Database Connection Issues

**Symptoms:**
- Health check shows database as unhealthy
- Multiple functions returning 500 errors
- Connection timeout errors

**Response:**
```bash
# Check connection pool status
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check for locks
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE NOT granted;"

# Kill long-running queries if necessary
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"
```

**Escalation:** Contact Supabase support if issue persists >15 minutes

#### 3.2 Edge Function Failures

**Symptoms:**
- Specific function returning errors
- Increased error rate in logs
- Timeout errors

**Response:**
```bash
# Check function logs
supabase functions logs <function-name> --tail

# Redeploy specific function
supabase functions deploy <function-name>

# Rollback if needed
./scripts/ops/rollback.sh functions
```

#### 3.3 Stripe Webhook Failures

**Symptoms:**
- Payments not processing
- Subscription changes not reflecting
- Webhook delivery failures in Stripe dashboard

**Response:**
1. Check webhook endpoint: `GET /functions/v1/stripe-webhook`
2. Verify webhook secret is correct
3. Check Stripe dashboard for failed deliveries
4. Replay failed webhooks from Stripe dashboard
5. If persistent, regenerate webhook secret and update env var

#### 3.4 Same-Tier Enforcement Bypass

**Symptoms:**
- Users seeing profiles from other tiers
- Cross-tier connections being created
- Reports of visibility issues

**Response:**
```bash
# Verify RLS policies are active
psql $DATABASE_URL -c "SELECT * FROM pg_policies WHERE tablename = 'users';"

# Check enforcement logs
psql $DATABASE_URL -c "SELECT * FROM enforcement_logs WHERE allowed = false ORDER BY created_at DESC LIMIT 20;"

# Verify tier assignments
psql $DATABASE_URL -c "SELECT tier_id, COUNT(*) FROM users GROUP BY tier_id;"
```

**Immediate Action:**
- Disable affected features if breach is confirmed
- Run verification script: `./scripts/verify-same-tier-enforcement.sh`

#### 3.5 Performance Degradation

**Symptoms:**
- Slow response times
- Timeout errors
- High CPU/memory usage

**Response:**
```bash
# Check slow queries
psql $DATABASE_URL -c "SELECT * FROM get_slow_queries(1000);"

# Check table sizes
psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Check index usage
psql $DATABASE_URL -c "SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan DESC;"
```

**Mitigation:**
- Add missing indexes (see `20250319104000_performance_indexes.sql`)
- Kill long-running queries
- Scale database if needed (contact Supabase)

### 4. Communication

**Internal Communication:**
- Create incident channel (Slack/Discord)
- Post initial status within 5 minutes of detection
- Update every 30 minutes until resolved

**User Communication:**
- P0/P1: Post status page update immediately
- P2: Post status page update within 1 hour
- P3: No user communication required

**Status Page Template:**
```
**Incident Report: [Brief Description]**
Status: [Investigating/Identified/Monitoring/Resolved]
Impact: [User-facing impact]
Started: [Timestamp]
Update: [Latest information]

We are currently investigating [issue]. We will provide updates every 30 minutes.
```

### 5. Recovery Procedures

#### 5.1 Function Rollback
```bash
./scripts/ops/rollback.sh functions --yes
```

#### 5.2 Database Rollback
```bash
# WARNING: Only use for schema changes, not data issues
./scripts/ops/rollback.sh database --target <migration-id>
```

#### 5.3 Full System Rollback
```bash
./scripts/ops/rollback.sh full --yes
```

### 6. Post-Incident

**Required within 24 hours:**
1. Write incident summary
2. Identify root cause
3. Document lessons learned
4. Create action items to prevent recurrence

**Incident Summary Template:**
```markdown
# Incident Summary: [ID]

## Timeline
- [Time] - Issue detected
- [Time] - Response started
- [Time] - Root cause identified
- [Time] - Issue resolved
- [Time] - Monitoring confirmed stable

## Root Cause
[Description]

## Impact
- Users affected: [Number]
- Duration: [Time]
- Features affected: [List]

## Resolution
[Steps taken to resolve]

## Action Items
- [ ] [Action item with owner and due date]

## Lessons Learned
[What we learned and how to prevent recurrence]
```

---

## Emergency Contacts

### Supabase
- Status: https://status.supabase.com
- Support: https://supabase.com/dashboard/support

### Stripe
- Status: https://status.stripe.com
- Support: https://support.stripe.com

### Daily.co
- Status: https://status.daily.co
- Support: support@daily.co

### Vercel (if using)
- Status: https://www.vercel-status.com

---

## Runbook Maintenance

**Review Schedule:**
- Monthly: Review and update contact information
- Quarterly: Review procedures and update based on incidents
- Annually: Full review and drill

**Last Updated:** 2025-03-19
**Next Review:** 2025-04-19
