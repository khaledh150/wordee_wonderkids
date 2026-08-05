/**
 * k6 Stress Test — 600 Concurrent Students, Full 5-Minute Exam
 *
 * Simulates realistic competition flow:
 *   1. Staggered lobby join (verify → join → heartbeat) over 30s
 *   2. 5-minute exam: sync every 8-11s, poll every 10-15s
 *   3. Final submit
 *
 * Usage:
 *   k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... -e SUBJECT=english scripts/k6-stress-600.js
 *   k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... -e SUBJECT=math    scripts/k6-stress-600.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Metrics
const errorRate = new Rate('errors');
const error5xx = new Counter('errors_5xx');
const error429 = new Counter('errors_429');
const verifyDur = new Trend('verify_duration', true);
const joinDur = new Trend('join_duration', true);
const heartbeatDur = new Trend('heartbeat_duration', true);
const syncDur = new Trend('sync_duration', true);
const pollDur = new Trend('poll_duration', true);
const totalReqs = new Counter('total_requests');
const syncCount = new Counter('sync_count');
const pollCount = new Counter('poll_count');

const SUBJECT = __ENV.SUBJECT || 'english';
const BASE_URL = __ENV.SUPABASE_URL || '';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const FUNC_BASE = `${BASE_URL}/functions/v1`;
const COMP_ID = __ENV.COMPETITION_ID || 'comp_stress_600';
const EXAM_SECS = 300; // 5 minutes

export const options = {
  scenarios: {
    exam: {
      executor: 'per-vu-iterations',
      vus: 600,
      iterations: 1,
      maxDuration: '8m',
    },
  },
  thresholds: {
    errors: ['rate<0.20'],
    verify_duration: ['p(95)<5000'],
    join_duration: ['p(95)<8000'],
    sync_duration: ['p(95)<8000'],
    poll_duration: ['p(95)<3000'],
  },
};

const HEADERS = { 'Content-Type': 'application/json' };
const REST_HEADERS = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` };

function callFn(name, body, metric) {
  const res = http.post(`${FUNC_BASE}/${name}`, JSON.stringify(body), { headers: HEADERS });
  totalReqs.add(1);
  if (metric) metric.add(res.timings.duration);

  if (res.status >= 500) error5xx.add(1);
  if (res.status === 429) error429.add(1);
  const isErr = res.status >= 500 || res.status === 429;
  errorRate.add(isErr);
  return { res, ok: res.status >= 200 && res.status < 400 };
}

function doPoll() {
  const res = http.get(
    `${BASE_URL}/rest/v1/competition_state?id=eq.${SUBJECT}&select=is_unlocked,started_at,duration_seconds,theme`,
    { headers: REST_HEADERS }
  );
  totalReqs.add(1);
  pollDur.add(res.timings.duration);
  pollCount.add(1);
  if (res.status >= 500) error5xx.add(1);
  if (res.status === 429) error429.add(1);
  errorRate.add(res.status >= 500 || res.status === 429);
}

export default function () {
  const code = `STRESS_${__VU}`;

  // --- Stagger join: spread over 30s to simulate lobby arrival ---
  sleep(Math.random() * 30);

  // --- Phase 1: Join lobby ---
  // 1a. Poll state
  doPoll();
  sleep(0.3 + Math.random() * 0.7);

  // 1b. Verify
  callFn('verify', { participant_code: code, competition_id: COMP_ID }, verifyDur);
  sleep(0.3 + Math.random() * 0.7);

  // 1c. Join
  callFn('join', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: SUBJECT,
  }, joinDur);
  sleep(0.3 + Math.random() * 0.5);

  // 1d. Heartbeat (ready)
  callFn('heartbeat', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: SUBJECT,
    ready: true,
  }, heartbeatDur);

  // --- Phase 2: Exam (5 minutes) ---
  const examStart = Date.now();
  const examEnd = examStart + EXAM_SECS * 1000;
  let questionsAnswered = 0;
  const answers = [];
  let lastSyncAt = Date.now();
  let lastPollAt = Date.now();
  const syncInterval = 8000 + Math.random() * 3000;   // 8-11s per student
  const pollInterval = 10000 + Math.random() * 5000;  // 10-15s per student

  while (Date.now() < examEnd) {
    const now = Date.now();

    // "Answer" a question every tick with 15% chance
    if (Math.random() < 0.15) {
      questionsAnswered++;
      answers.push({
        question_id: `${SUBJECT}_q${String(questionsAnswered).padStart(3, '0')}`,
        submitted_answer: 'test_answer',
      });
    }

    // Sync answers periodically
    if (now - lastSyncAt >= syncInterval) {
      callFn('sync', {
        participant_code: code,
        competition_id: COMP_ID,
        subject: SUBJECT,
        provisional_score: questionsAnswered,
        questions_answered: questionsAnswered,
        answers: answers,
      }, syncDur);
      syncCount.add(1);
      lastSyncAt = now;
    }

    // Poll state periodically
    if (now - lastPollAt >= pollInterval) {
      doPoll();
      lastPollAt = now;
    }

    // Tick every 2-4s (simulates student interaction pace)
    sleep(2 + Math.random() * 2);
  }

  // --- Phase 3: Final sync ---
  callFn('sync', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: SUBJECT,
    provisional_score: questionsAnswered,
    questions_answered: questionsAnswered,
    answers: answers,
    final: true,
  }, syncDur);
  syncCount.add(1);
}
