# Monitoring & Alerting Guide

## Overview

This document describes the monitoring and alerting setup for Spotter production environment.

## Health Check Endpoints

### Primary Health Endpoint

```
GET https://api.spotter.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-18T12:00:00Z",
  "version": "1.2.3",
  "checks": {
    "database": "ok",
    "functions": "ok",
    "storage": "ok"
  }
}
```

### Component Health Checks

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Overall system health | 200 OK |
| `/health/db` | Database connectivity | 200 OK |
| `/health/functions` | Edge functions status | 200 OK |
| `/health/storage` | Storage service status | 200 OK |

## Key Metrics to Monitor

### 1. Application Performance

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| API Response Time (p50) | < 200ms | 300ms | 500ms |
| API Response Time (p95) | < 500ms | 750ms | 1000ms |
| API Response Time (p99) | < 1000ms | 1500ms | 2000ms |
| Error Rate | < 0.1% | 1% | 5% |
| Throughput (req/min) | Baseline | -20% | -50% |

### 2. Database Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Connection Pool Usage | < 70% | 80% | 90% |
| Query Duration (p95) | < 100ms | 200ms | 500ms |
| Slow Queries | 0 | > 10/min | > 50/min |
| Replication Lag | < 1s | 5s | 10s |

### 3. Edge Functions

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Cold Start Time | < 500ms | 1000ms | 2000ms |
| Execution Time (p95) | < 1000ms | 2000ms | 5000ms |
| Error Rate | < 0.1% | 1% | 5% |
| Memory Usage | < 80% | 90% | 95% |

### 4. Business Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Payment Success Rate | > 98% | < 95% |
| Session Completion Rate | > 85% | < 70% |
| User Signup Conversion | > 30% | < 20% |
| Matching Success Rate | > 60% | < 40% |

## Alert Thresholds

### PagerDuty/Critical Alerts (Immediate Response)

- API completely down (> 5 minutes)
- Database connection failures
- Payment processing failures
- Error rate > 5%
- Security incident detected

### Warning Alerts (Business Hours Response)

- API response time p95 > 750ms
- Error rate > 1%
- Database connection pool > 80%
- Edge function error rate > 1%
- Disk usage > 80%

### Info Alerts (Next Day Review)

- API response time degradation
- Unusual traffic patterns
- Feature flag changes
- Deployment completions

## Monitoring Tools

### 1. Sentry (Error Tracking)

**URL:** https://sentry.io/organizations/spotter/

**Key Dashboards:**
- Error rate by release
- Performance trends
- User impact analysis

**Alerts:**
- New error types
- Error rate spikes
- Performance regression

### 2. PostHog (Analytics)

**URL:** https://app.posthog.com/project/YOUR_PROJECT

**Key Dashboards:**
- User funnel analysis
- Feature adoption
- Retention metrics

**Alerts:**
- Conversion rate drops
- Feature usage anomalies

### 3. Supabase Dashboard

**URL:** https://app.supabase.com/project/YOUR_PROJECT

**Key Metrics:**
- Database connections
- Storage usage
- Edge function invocations
- Real-time connections

**Alerts:**
- Connection pool exhaustion
- Storage quota approaching
- Function errors

### 4. Vercel Dashboard

**URL:** https://vercel.com/dashboard

**Key Metrics:**
- Build times
- Deployment status
- Edge function logs

**Alerts:**
- Build failures
- Deployment errors

### 5. Stripe Dashboard

**URL:** https://dashboard.stripe.com/

**Key Metrics:**
- Payment success rate
- Dispute rate
- Payout failures

**Alerts:**
- Webhook delivery failures
- Elevated dispute rate

## Alert Routing

### Severity Levels

| Severity | Channel | Response Time |
|----------|---------|---------------|
| P0 - Critical | PagerDuty + SMS + Email | 15 minutes |
| P1 - High | Slack #alerts + Email | 1 hour |
| P2 - Medium | Slack #alerts | 4 hours |
| P3 - Low | Slack #monitoring | 24 hours |

### Alert Channels

- **Slack:** #alerts (critical), #monitoring (info)
- **Email:** oncall@spotter.app
- **PagerDuty:** Primary on-call rotation
- **SMS:** Critical alerts only

## Runbook: Common Issues

### Issue: High Error Rate

**Symptoms:**
- Sentry showing spike in errors
- Users reporting issues

**Steps:**
1. Check `/health` endpoint
2. Review recent deployments
3. Check database connection pool
4. If needed, initiate rollback

### Issue: Slow API Responses

**Symptoms:**
- p95 response time > 500ms
- User complaints about slowness

**Steps:**
1. Check database query performance
2. Review slow query logs
3. Check for N+1 queries
4. Consider scaling if traffic spike

### Issue: Database Connection Pool Exhausted

**Symptoms:**
- "Too many connections" errors
- API requests failing

**Steps:**
1. Check active connections in Supabase dashboard
2. Identify connection leaks
3. Restart edge functions if needed
4. Contact Supabase support if persistent

### Issue: Payment Failures

**Symptoms:**
- Stripe webhook errors
- Failed payment notifications

**Steps:**
1. Check Stripe webhook endpoint
2. Verify webhook secret is correct
3. Check Stripe dashboard for errors
4. Retry failed webhooks if safe

## Dashboard URLs

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Sentry | https://sentry.io/spotter | Error tracking |
| PostHog | https://app.posthog.com/spotter | Analytics |
| Supabase | https://app.supabase.com/spotter | Database |
| Vercel | https://vercel.com/spotter | Web hosting |
| Stripe | https://dashboard.stripe.com/ | Payments |
| Status Page | https://status.spotter.app | Public status |

## Monitoring Checklist

### Daily

- [ ] Review Sentry error dashboard
- [ ] Check API response times
- [ ] Review payment success rate
- [ ] Check disk/storage usage

### Weekly

- [ ] Review performance trends
- [ ] Analyze slow queries
- [ ] Check error rate trends
- [ ] Review user feedback

### Monthly

- [ ] Capacity planning review
- [ ] Alert threshold tuning
- [ ] Dashboard optimization
- [ ] Runbook updates

## Escalation Path

1. **On-call Engineer** - First responder
2. **Tech Lead** - If issue unresolved in 30 minutes
3. **Engineering Manager** - If business impact significant
4. **Executive Team** - If service completely down > 1 hour
