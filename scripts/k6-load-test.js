/**
 * k6 Load Test for WonderKids Competition Edge Functions
 *
 * Simulates the full student flow: verify → join → heartbeat → sync → submit
 * Tests edge function latency, error rates, and Supabase free-tier limits.
 *
 * Usage:
 *   k6 run scripts/k6-load-test.js                        # default 30 VUs
 *   k6 run --vus 100 --duration 60s scripts/k6-load-test.js  # 100 virtual users for 60s
 *   k6 run --vus 200 --duration 120s scripts/k6-load-test.js # stress test at 200
 *
 * Environment variables (set in .env or pass via -e):
 *   SUPABASE_URL      - Supabase project URL
 *   SUPABASE_ANON_KEY - Supabase anon/public key
 *   COMPETITION_ID    - Active competition ID (optional, fetched if not set)
 *
 * NOTE: This test uses fake participant codes (LOADTEST_xxx) that don't exist
 * in the database. It measures response times and error HANDLING, not successful
 * competition flow. For a full flow test, pre-register participants first.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const verifyDuration = new Trend('verify_duration', true);
const joinDuration = new Trend('join_duration', true);
const heartbeatDuration = new Trend('heartbeat_duration', true);
const syncDuration = new Trend('sync_duration', true);
const pollDuration = new Trend('poll_duration', true);
const totalRequests = new Counter('total_requests');

// Config — override with k6 CLI flags
export const options = {
  vus: 30,
  duration: '30s',
  thresholds: {
    errors: ['rate<0.1'],          // <10% error rate
    verify_duration: ['p(95)<2000'], // p95 under 2s
    join_duration: ['p(95)<2000'],
    heartbeat_duration: ['p(95)<1500'],
    sync_duration: ['p(95)<2000'],
    poll_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.SUPABASE_URL || '';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const FUNC_BASE = `${BASE_URL}/functions/v1`;
const COMPETITION_ID = __ENV.COMPETITION_ID || 'comp_loadtest';

const HEADERS = {
  'Content-Type': 'application/json',
};

const REST_HEADERS = {
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
};

function callFn(name, body, metric) {
  const res = http.post(`${FUNC_BASE}/${name}`, JSON.stringify(body), { headers: HEADERS });
  totalRequests.add(1);
  if (metric) metric.add(res.timings.duration);
  const success = res.status >= 200 && res.status < 500;
  errorRate.add(!success);
  return { res, ok: res.status >= 200 && res.status < 300 };
}

// Each VU simulates one student's full lifecycle
export default function () {
  const vuId = __VU;
  const iter = __ITER;
  const code = `LOADTEST_${vuId}_${iter}`;

  // 1. Poll competition_state (REST API)
  const pollRes = http.get(
    `${BASE_URL}/rest/v1/competition_state?id=eq.english&select=is_unlocked,started_at,duration_seconds,theme`,
    { headers: REST_HEADERS }
  );
  totalRequests.add(1);
  pollDuration.add(pollRes.timings.duration);
  check(pollRes, { 'poll status 200': (r) => r.status === 200 });
  errorRate.add(pollRes.status !== 200);

  sleep(0.5 + Math.random() * 1.5);

  // 2. Verify participant code
  const { res: verifyRes } = callFn('verify', {
    participant_code: code,
    competition_id: COMPETITION_ID,
  }, verifyDuration);
  check(verifyRes, {
    'verify responds': (r) => r.status > 0,
    'verify not rate-limited': (r) => r.status !== 429,
  });

  sleep(0.3 + Math.random());

  // 3. Join competition
  const { res: joinRes, ok: joinOk } = callFn('join', {
    participant_code: code,
    competition_id: COMPETITION_ID,
    subject: 'english',
  }, joinDuration);
  check(joinRes, {
    'join responds': (r) => r.status > 0,
  });

  sleep(0.5 + Math.random());

  // 4. Heartbeat (ready signal)
  const { res: hbRes } = callFn('heartbeat', {
    participant_code: code,
    competition_id: COMPETITION_ID,
    subject: 'english',
    ready: true,
  }, heartbeatDuration);
  check(hbRes, {
    'heartbeat responds': (r) => r.status > 0,
  });

  sleep(1 + Math.random() * 2);

  // 5. Sync progress
  const answers = [];
  for (let i = 1; i <= 5; i++) {
    answers.push({
      question_id: `eng_l1_${String(i).padStart(3, '0')}`,
      submitted_answer: Math.random() > 0.3 ? 'apple' : 'banana',
    });
  }
  const { res: syncRes } = callFn('sync', {
    participant_code: code,
    competition_id: COMPETITION_ID,
    subject: 'english',
    provisional_score: 3,
    questions_answered: 5,
    answers: answers,
  }, syncDuration);
  check(syncRes, {
    'sync responds': (r) => r.status > 0,
  });

  sleep(1 + Math.random() * 2);

  // 6. Second poll (simulates ongoing state checking)
  const pollRes2 = http.get(
    `${BASE_URL}/rest/v1/competition_state?id=eq.english&select=is_unlocked,started_at,duration_seconds,theme`,
    { headers: REST_HEADERS }
  );
  totalRequests.add(1);
  pollDuration.add(pollRes2.timings.duration);
  errorRate.add(pollRes2.status !== 200);

  sleep(0.5 + Math.random());
}
