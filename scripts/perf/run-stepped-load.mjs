#!/usr/bin/env node

import { performance } from 'node:perf_hooks';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TARGET_USER_ID = process.env.SPOTTER_PERF_USER_ID || '00000000-0000-0000-0000-000000000002';

const defaultSteps = parseSteps(process.env.PERF_STEPS || '1,5,10,20,40');
const requestsPerStep = parseInt(process.env.PERF_REQUESTS_PER_STEP || '200', 10);
const soakDurationSec = parseInt(process.env.PERF_SOAK_DURATION_SEC || '900', 10);
const mode = process.env.PERF_MODE || 'stepped';
const scenarioFilter = (process.env.PERF_SCENARIO || 'all').toLowerCase();

const scenarios = [
  {
    id: 'discovery',
    name: 'Discovery RPC',
    method: 'POST',
    path: '/rest/v1/rpc/discover_golfers',
    key: ANON_KEY,
    sloMs: { p95: 300, p99: 500 },
    body: () => ({
      p_user_id: TARGET_USER_ID,
      p_limit: 20,
      p_offset: 0,
      p_location: 'Phoenix',
    }),
  },
  {
    id: 'matching',
    name: 'Matching RPC',
    method: 'POST',
    path: '/rest/v1/rpc/get_top_matches',
    key: ANON_KEY,
    sloMs: { p95: 200, p99: 350 },
    body: () => ({
      p_user_id: TARGET_USER_ID,
      p_limit: 10,
      p_min_score: 0,
    }),
  },
  {
    id: 'rounds-rest',
    name: 'Rounds REST',
    method: 'GET',
    path: '/rest/v1/rounds?select=id,creator_id,course_id,scheduled_at,status,tier_id&status=in.(open,full)&limit=20',
    key: SERVICE_KEY,
    sloMs: { p95: 250, p99: 400 },
  },
].filter((scenario) => {
  if (scenarioFilter === 'all') return true;
  return scenario.id === scenarioFilter;
});

if (scenarios.length === 0) {
  console.error('No scenarios selected.');
  process.exit(1);
}

for (const scenario of scenarios) {
  if (!scenario.key) {
    console.warn(`Skipping ${scenario.id}: missing auth key in environment.`);
    continue;
  }

  const result =
    mode === 'soak'
      ? await runSoakScenario(scenario, soakDurationSec, defaultSteps.at(-1) || 10)
      : await runSteppedScenario(scenario, defaultSteps, requestsPerStep);

  printScenarioReport(result);
}

async function runSteppedScenario(scenario, steps, totalRequests) {
  const measurements = [];

  for (const concurrency of steps) {
    const samples = await runFixedRequestBatch(scenario, concurrency, totalRequests);
    measurements.push(summarizeStep(scenario, concurrency, totalRequests, samples));
  }

  return { scenario, mode: 'stepped', measurements };
}

async function runSoakScenario(scenario, durationSec, concurrency) {
  const startedAt = performance.now();
  const latencies = [];
  let successes = 0;
  let failures = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while ((performance.now() - startedAt) / 1000 < durationSec) {
      const sample = await executeRequest(scenario);
      latencies.push(sample.latencyMs);
      if (sample.ok) successes += 1;
      else failures += 1;
    }
  });

  await Promise.all(workers);

  return {
    scenario,
    mode: 'soak',
    measurements: [
      summarizeStep(scenario, concurrency, successes + failures, {
        latencies,
        successes,
        failures,
        wallTimeMs: performance.now() - startedAt,
      }),
    ],
  };
}

async function runFixedRequestBatch(scenario, concurrency, totalRequests) {
  const latencies = [];
  let successes = 0;
  let failures = 0;
  let issued = 0;
  const startedAt = performance.now();

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const requestIndex = issued;
      issued += 1;
      if (requestIndex >= totalRequests) return;

      const sample = await executeRequest(scenario);
      latencies.push(sample.latencyMs);
      if (sample.ok) successes += 1;
      else failures += 1;
    }
  });

  await Promise.all(workers);

  return {
    latencies,
    successes,
    failures,
    wallTimeMs: performance.now() - startedAt,
  };
}

async function executeRequest(scenario) {
  const startedAt = performance.now();
  const headers = {
    apikey: scenario.key,
    Authorization: `Bearer ${scenario.key}`,
    'Content-Type': 'application/json',
  };

  const init = {
    method: scenario.method,
    headers,
  };

  if (scenario.body) {
    init.body = JSON.stringify(scenario.body());
  }

  try {
    const response = await fetch(`${SUPABASE_URL}${scenario.path}`, init);
    await response.text();
    return {
      ok: response.ok,
      latencyMs: performance.now() - startedAt,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: performance.now() - startedAt,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeStep(scenario, concurrency, totalRequests, samples) {
  const latencies = [...samples.latencies].sort((a, b) => a - b);
  const throughput = samples.wallTimeMs > 0 ? (samples.successes + samples.failures) / (samples.wallTimeMs / 1000) : 0;
  const p50 = percentile(latencies, 50);
  const p90 = percentile(latencies, 90);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const errorRate = totalRequests > 0 ? samples.failures / totalRequests : 0;

  return {
    concurrency,
    totalRequests,
    successes: samples.successes,
    failures: samples.failures,
    errorRate,
    throughput,
    wallTimeMs: samples.wallTimeMs,
    latency: {
      p50,
      p90,
      p95,
      p99,
      min: latencies[0] ?? 0,
      max: latencies.at(-1) ?? 0,
    },
    sloBreached: p95 > scenario.sloMs.p95 || p99 > scenario.sloMs.p99 || errorRate > 0.01,
  };
}

function printScenarioReport(result) {
  const bottleneckStep = result.measurements.find((m) => m.sloBreached) || result.measurements.at(-1);
  const risk = classifyRisk(result.measurements);
  const capacityStep = [...result.measurements].reverse().find((m) => !m.sloBreached);
  const degradation = classifyDegradation(result.measurements);

  console.log('');
  console.log(`Risk Level: ${risk}`);
  console.log(`Scenario: ${result.scenario.name} (${result.mode})`);
  console.log(`Capacity Ceiling: ${capacityStep ? `${capacityStep.throughput.toFixed(2)} req/s at concurrency ${capacityStep.concurrency}` : '0 req/s before first SLO breach'}`);
  console.log(`Bottleneck Map: local-db-bound ${result.scenario.id} at concurrency ${bottleneckStep?.concurrency ?? 'n/a'} (inferred from SLO breach / error growth)`);
  console.log(`Degradation: ${degradation}`);
  console.log('');
  console.log('Concurrency | Req | Success | Fail | Err% | RPS | p50 | p90 | p95 | p99');
  for (const measurement of result.measurements) {
    console.log(
      [
        pad(measurement.concurrency, 11),
        pad(measurement.totalRequests, 3),
        pad(measurement.successes, 7),
        pad(measurement.failures, 4),
        pad((measurement.errorRate * 100).toFixed(2), 4),
        pad(measurement.throughput.toFixed(2), 5),
        pad(Math.round(measurement.latency.p50), 3),
        pad(Math.round(measurement.latency.p90), 3),
        pad(Math.round(measurement.latency.p95), 3),
        pad(Math.round(measurement.latency.p99), 3),
      ].join(' | ')
    );
  }
}

function classifyRisk(measurements) {
  const firstBreach = measurements.find((m) => m.sloBreached);
  if (!firstBreach) return 'GREEN';
  if (firstBreach.concurrency <= 1) return 'BLACK';
  if (firstBreach.concurrency <= 5) return 'RED';
  return 'YELLOW';
}

function classifyDegradation(measurements) {
  if (measurements.length < 3) return 'unknown';

  const slopes = [];
  for (let index = 1; index < measurements.length; index += 1) {
    const prev = measurements[index - 1];
    const current = measurements[index];
    const concurrencyDelta = current.concurrency - prev.concurrency;
    slopes.push((current.latency.p95 - prev.latency.p95) / Math.max(concurrencyDelta, 1));
  }

  const maxSlope = Math.max(...slopes);
  const minSlope = Math.min(...slopes);
  if (maxSlope > Math.max(minSlope * 3, 25)) return 'cliff';
  if (maxSlope > Math.max(minSlope * 1.75, 10)) return 'exponential';
  return 'linear';
}

function percentile(values, pct) {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.ceil((pct / 100) * values.length) - 1);
  return values[index];
}

function parseSteps(raw) {
  return raw
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function pad(value, width) {
  return String(value).padStart(width, ' ');
}
