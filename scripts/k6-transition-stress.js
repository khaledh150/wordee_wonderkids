/**
 * k6 Transition Stress Test — 600 Students, English → Math
 *
 * Simulates the REAL competition flow:
 *   1. Staggered join into English lobby (30s)
 *   2. English exam (2.5 min — sustained load already proven at 5 min)
 *   3. TRANSITION: all 600 students finish English and stampede into Math
 *      - Poll until Math available
 *      - Verify → Join → Heartbeat for Math
 *   4. Math exam (2.5 min)
 *
 * The critical stress point is step 3 — 600 verify+join calls within ~30s.
 * Exam duration shortened to 2.5 min (sustained load proven separately).
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

// Transition-specific metrics
const transVerifyDur = new Trend('transition_verify_duration', true);
const transJoinDur = new Trend('transition_join_duration', true);
const transHeartbeatDur = new Trend('transition_heartbeat_duration', true);
const transitionTime = new Trend('transition_total_time', true);
const transitionErrors = new Counter('transition_errors');

const BASE_URL = __ENV.SUPABASE_URL || '';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const FUNC_BASE = `${BASE_URL}/functions/v1`;
const COMP_ID = __ENV.COMPETITION_ID || 'comp_transition_test';
const EXAM_SECS = 150; // 2.5 minutes per subject (sustained load proven at 5 min)

export const options = {
  scenarios: {
    full_competition: {
      executor: 'per-vu-iterations',
      vus: 600,
      iterations: 1,
      maxDuration: '9m',
    },
  },
  thresholds: {
    errors: ['rate<0.20'],
    transition_verify_duration: ['p(95)<5000'],
    transition_join_duration: ['p(95)<5000'],
    transition_total_time: ['p(95)<15000'],
    sync_duration: ['p(95)<5000'],
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
  return { res, ok: res.status >= 200 && res.status < 400, status: res.status };
}

function doPoll(subject) {
  const res = http.get(
    `${BASE_URL}/rest/v1/competition_state?id=eq.${subject}&select=is_unlocked,started_at,duration_seconds,theme`,
    { headers: REST_HEADERS }
  );
  totalReqs.add(1);
  pollDur.add(res.timings.duration);
  errorRate.add(res.status >= 500 || res.status === 429);
  return res;
}

function doExam(code, subject, durationSecs) {
  const examEnd = Date.now() + durationSecs * 1000;
  let questionsAnswered = 0;
  const answers = [];
  let lastSyncAt = Date.now();
  let lastPollAt = Date.now();
  const syncInterval = 8000 + Math.random() * 3000;
  const pollInterval = 10000 + Math.random() * 5000;

  while (Date.now() < examEnd) {
    const now = Date.now();

    if (Math.random() < 0.15) {
      questionsAnswered++;
      answers.push({
        question_id: `${subject}_q${String(questionsAnswered).padStart(3, '0')}`,
        submitted_answer: 'test_answer',
      });
    }

    if (now - lastSyncAt >= syncInterval) {
      callFn('sync', {
        participant_code: code,
        competition_id: COMP_ID,
        subject: subject,
        provisional_score: questionsAnswered,
        questions_answered: questionsAnswered,
        answers: answers,
      }, syncDur);
      lastSyncAt = now;
    }

    if (now - lastPollAt >= pollInterval) {
      doPoll(subject);
      lastPollAt = now;
    }

    sleep(2 + Math.random() * 2);
  }

  // Final sync
  callFn('sync', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: subject,
    provisional_score: questionsAnswered,
    questions_answered: questionsAnswered,
    answers: answers,
    final: true,
  }, syncDur);
}

function joinSubject(code, subject, verifyMetric, joinMetric, hbMetric) {
  doPoll(subject);
  sleep(0.2 + Math.random() * 0.5);

  callFn('verify', { participant_code: code, competition_id: COMP_ID }, verifyMetric);
  sleep(0.2 + Math.random() * 0.5);

  callFn('join', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: subject,
  }, joinMetric);
  sleep(0.2 + Math.random() * 0.3);

  callFn('heartbeat', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: subject,
    ready: true,
  }, hbMetric);
}

export default function () {
  const code = `TRANS_${__VU}`;

  // ============================================
  // PHASE 1: Join English (stagger over 30s)
  // ============================================
  sleep(Math.random() * 30);
  joinSubject(code, 'english', verifyDur, joinDur, heartbeatDur);

  // ============================================
  // PHASE 2: English Exam (2.5 minutes)
  // ============================================
  doExam(code, 'english', EXAM_SECS);

  // ============================================
  // PHASE 3: TRANSITION — English done, move to Math
  // This is the critical stress point.
  // All 600 students finish within ~30s of each other
  // and stampede into Math verify/join.
  // ============================================
  const transStart = Date.now();

  // Brief pause simulating the "Competition Complete" screen
  // In the real app, students see their score for 2-5 seconds
  // then auto-transition kicks in via verify polling
  sleep(2 + Math.random() * 3);

  // Poll math state (checking if lobby is open)
  doPoll('math');
  sleep(0.5 + Math.random());

  // Transition: verify + join + heartbeat for Math
  // This is where the thundering herd hits
  const { ok: vOk } = callFn('verify', { participant_code: code, competition_id: COMP_ID }, transVerifyDur);
  if (!vOk) transitionErrors.add(1);
  sleep(0.2 + Math.random() * 0.5);

  const { ok: jOk } = callFn('join', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: 'math',
  }, transJoinDur);
  if (!jOk) transitionErrors.add(1);
  sleep(0.2 + Math.random() * 0.3);

  const { ok: hOk } = callFn('heartbeat', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: 'math',
    ready: true,
  }, transHeartbeatDur);
  if (!hOk) transitionErrors.add(1);

  transitionTime.add(Date.now() - transStart);

  // ============================================
  // PHASE 4: Math Exam (2.5 minutes)
  // ============================================
  doExam(code, 'math', EXAM_SECS);
}
