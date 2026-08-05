/**
 * k6 Realistic Competition Test — 600 Students, English → Math
 *
 * Simulates the ACTUAL student journey verified from source code:
 *
 *   HomeScreen → Competition button (polls every 5s) → /play → code entry →
 *   verify → join English → lobby (poll 5s+jitter, heartbeat 15s+jitter) →
 *   admin starts → countdown 5.5s → activation join →
 *   English exam (sync 8s+jitter first@3s, poll 30s+jitter, NO heartbeat) →
 *   auto-submit (0-5s jitter) → results screen (verify poll 8s) →
 *   auto-transition to Math → Math lobby → Math exam → final submit
 *
 * Edge case profiles:
 *   - 90% normal students
 *   - 5% disconnect mid-exam (offline 10-30s, then reconnect)
 *   - 3% late joiners (arrive 30-60s late)
 *   - 2% flaky connections (50% sync failure rate)
 *
 * Exam: 2 min per subject (sustained load proven at 5 min separately)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Core metrics
const errorRate = new Rate('errors');
const error5xx = new Counter('errors_5xx');
const error429 = new Counter('errors_429');
const totalReqs = new Counter('total_requests');

// Per-endpoint duration
const verifyDur = new Trend('verify_duration', true);
const joinDur = new Trend('join_duration', true);
const heartbeatDur = new Trend('heartbeat_duration', true);
const syncDur = new Trend('sync_duration', true);
const submitDur = new Trend('submit_duration', true);
const pollDur = new Trend('poll_duration', true);

// Transition-specific
const transVerifyDur = new Trend('transition_verify_duration', true);
const transJoinDur = new Trend('transition_join_duration', true);
const transitionTime = new Trend('transition_total_time', true);
const transitionErrors = new Counter('transition_errors');

// Phase timing
const lobbyWaitTime = new Trend('lobby_wait_time', true);
const examTime = new Trend('exam_active_time', true);
const resultsWaitTime = new Trend('results_wait_time', true);

const BASE_URL = __ENV.SUPABASE_URL || '';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const FUNC_BASE = `${BASE_URL}/functions/v1`;
const COMP_ID = __ENV.COMPETITION_ID || 'comp_realistic_test';
const EXAM_SECS = 120; // 2 minutes per subject
const LOBBY_WAIT_SECS = 15; // simulate admin waiting before starting
const RESULTS_WAIT_SECS = 20; // simulate admin waiting before opening next subject

export const options = {
  scenarios: {
    competition: {
      executor: 'per-vu-iterations',
      vus: 600,
      iterations: 1,
      maxDuration: '9m',
    },
  },
  thresholds: {
    errors: ['rate<0.15'],
    verify_duration: ['p(95)<3000'],
    join_duration: ['p(95)<5000'],
    sync_duration: ['p(95)<5000'],
    submit_duration: ['p(95)<5000'],
    transition_verify_duration: ['p(95)<5000'],
    transition_join_duration: ['p(95)<5000'],
    transition_total_time: ['p(95)<20000'],
  },
};

const HEADERS = { 'Content-Type': 'application/json' };
const REST_HEADERS = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` };

// Student behavior profiles
function getProfile(vuId) {
  const pct = (vuId % 100) / 100;
  if (pct < 0.05) return 'disconnector';  // 5% disconnect mid-exam
  if (pct < 0.08) return 'late_joiner';   // 3% join late
  if (pct < 0.10) return 'flaky';         // 2% flaky connection
  return 'normal';                         // 90% normal
}

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

function doPoll(subject) {
  const res = http.get(
    `${BASE_URL}/rest/v1/competition_state?id=eq.${subject}&select=is_unlocked,started_at,duration_seconds,theme,extra_seconds,transfer_mode`,
    { headers: REST_HEADERS }
  );
  totalReqs.add(1);
  pollDur.add(res.timings.duration);
  errorRate.add(res.status >= 500 || res.status === 429);
}

// ============================================================
// HOME SCREEN: poll competition_state every 5s waiting for unlock
// (simulated as a brief poll burst before code entry)
// ============================================================
function doHomeScreenPoll() {
  // Student opens app, sees locked Competition button
  // Polls every 5s checking is_unlocked — we simulate 1-3 polls
  const polls = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < polls; i++) {
    doPoll('english');
    sleep(5 + Math.random() * 1);
  }
}

// ============================================================
// LOBBY PHASE: poll every 5s+jitter, heartbeat every 15s+jitter
// NO sync during lobby. This matches useCompetitionEngine.js.
// ============================================================
function doLobbyWait(code, subject, waitSecs) {
  const lobbyStart = Date.now();
  const lobbyEnd = lobbyStart + waitSecs * 1000;
  let lastHb = 0;

  while (Date.now() < lobbyEnd) {
    // Poll competition_state every 5s + 0-2s jitter
    doPoll(subject);

    // Heartbeat every 15s + 0-2s jitter
    const now = Date.now();
    if (now - lastHb >= 15000 + Math.random() * 2000) {
      callFn('heartbeat', {
        participant_code: code,
        competition_id: COMP_ID,
        subject: subject,
        ready: true,
      }, heartbeatDur);
      lastHb = now;
    }

    sleep(5 + Math.random() * 2); // 5-7s between polls
  }

  lobbyWaitTime.add(Date.now() - lobbyStart);
}

// ============================================================
// ACTIVE EXAM:
//   - sync every 8s+jitter (first at 3s)
//   - poll every 30s+jitter (reduced frequency during active)
//   - NO heartbeat during active phase
// ============================================================
function doExam(code, subject, durationSecs, profile) {
  const examStart = Date.now();
  const examEnd = examStart + durationSecs * 1000;
  let questionsAnswered = 0;
  const answers = [];
  let lastSyncAt = examStart - 5000; // first sync effectively at ~3s
  let lastPollAt = examStart;
  let disconnectedAt = 0;
  let reconnectAfter = 0;

  // Disconnectors go offline after 30-60% of exam time
  if (profile === 'disconnector') {
    disconnectedAt = examStart + durationSecs * 1000 * (0.3 + Math.random() * 0.3);
    reconnectAfter = disconnectedAt + (10000 + Math.random() * 20000); // offline 10-30s
  }

  while (Date.now() < examEnd) {
    const now = Date.now();
    const isDisconnected = profile === 'disconnector' && now >= disconnectedAt && now < reconnectAfter;

    // "Answer" a question periodically (~every 3-5s tick with 30% chance)
    if (!isDisconnected && Math.random() < 0.3) {
      questionsAnswered++;
      answers.push({
        question_id: `${subject}_q${String(questionsAnswered).padStart(3, '0')}`,
        submitted_answer: 'test_answer',
      });
    }

    // Sync every 8s + 0-2s jitter (SYNC_INTERVAL = 8000, JITTER_MAX = 2000)
    if (!isDisconnected && now - lastSyncAt >= 8000 + Math.random() * 2000) {
      if (profile !== 'flaky' || Math.random() > 0.5) {
        callFn('sync', {
          participant_code: code,
          competition_id: COMP_ID,
          subject: subject,
          provisional_score: questionsAnswered,
          questions_answered: questionsAnswered,
          answers: answers,
        }, syncDur);
      }
      lastSyncAt = now;
    }

    // Poll every 30s + 0-2s jitter (ACTIVE_POLL_INTERVAL = 30000)
    if (!isDisconnected && now - lastPollAt >= 30000 + Math.random() * 2000) {
      doPoll(subject);
      lastPollAt = now;
    }

    sleep(2 + Math.random() * 2); // tick every 2-4s
  }

  examTime.add(Date.now() - examStart);

  // Auto-submit with 0-5s jitter (reduced from 15s to stay within server window)
  sleep(Math.random() * 5);

  // Submit
  callFn('submit', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: subject,
    answers: answers,
  }, submitDur);
}

// ============================================================
// RESULTS SCREEN: verify polling every 8s (waiting for next subject)
// This is where auto-transition or manual button would trigger.
// ============================================================
function doResultsWait(code, waitSecs) {
  const resultStart = Date.now();
  const resultEnd = resultStart + waitSecs * 1000;

  while (Date.now() < resultEnd) {
    callFn('verify', {
      participant_code: code,
      competition_id: COMP_ID,
    }, transVerifyDur);

    sleep(8 + Math.random() * 1); // 8-9s between verify polls
  }

  resultsWaitTime.add(Date.now() - resultStart);
}

// ============================================================
// MAIN FLOW — Full student journey from HomeScreen to final results
// ============================================================
export default function () {
  const code = `REAL_${__VU}`;
  const profile = getProfile(__VU);

  // ---- ARRIVAL: students arrive over different windows ----
  if (profile === 'late_joiner') {
    sleep(30 + Math.random() * 30); // late joiners arrive 30-60s late
  } else {
    sleep(Math.random() * 20); // normal students arrive over 20s
  }

  // ---- STEP 1: HomeScreen — poll competition_state for is_unlocked ----
  doHomeScreenPoll();

  // ---- STEP 2: Navigate to /play, fetch competition_id ----
  doPoll('english');
  sleep(0.5 + Math.random());

  // ---- STEP 3: Code entry + verify ----
  callFn('verify', {
    participant_code: code,
    competition_id: COMP_ID,
  }, verifyDur);
  sleep(0.3 + Math.random() * 0.5);

  // ---- STEP 4: Join English ----
  callFn('join', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: 'english',
  }, joinDur);

  // ---- STEP 5: Lobby wait (heartbeat + poll until admin starts) ----
  doLobbyWait(code, 'english', LOBBY_WAIT_SECS);

  // ---- STEP 6: Countdown (5.5s) then activation join ----
  sleep(5.5);
  callFn('join', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: 'english',
  }, joinDur);

  // ---- STEP 7: English exam ----
  doExam(code, 'english', EXAM_SECS, profile);

  // ---- STEP 8: Results screen — verify poll every 8s ----
  const transStart = Date.now();
  doResultsWait(code, RESULTS_WAIT_SECS);

  // ---- STEP 9: Transition to Math ----
  // Whether auto or manual, the end result is a join call
  callFn('join', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: 'math',
  }, transJoinDur);
  transitionTime.add(Date.now() - transStart);

  // ---- STEP 10: Math lobby wait ----
  doLobbyWait(code, 'math', LOBBY_WAIT_SECS);

  // ---- STEP 11: Countdown + activation join ----
  sleep(5.5);
  callFn('join', {
    participant_code: code,
    competition_id: COMP_ID,
    subject: 'math',
  }, joinDur);

  // ---- STEP 12: Math exam ----
  doExam(code, 'math', EXAM_SECS, profile);

  // ---- STEP 13: Final results — one verify poll ----
  callFn('verify', {
    participant_code: code,
    competition_id: COMP_ID,
  }, verifyDur);
}
