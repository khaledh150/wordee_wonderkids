/**
 * Competition Simulation — Full Lifecycle Test
 *
 * Simulates students through a complete English + Math competition
 * with REALISTIC timing. Each exam is 5 minutes (300s real) compressed
 * to ~15s wall-clock. Students answer at 1-3 seconds per question,
 * sync every 8-12 seconds, and most hit the time limit before finishing
 * all 200 questions. Reports performance metrics and data integrity.
 *
 * Designed for Supabase FREE TIER constraints:
 *   - Edge function concurrency: ~25
 *   - API rate limit: ~500 req/min
 *   - DB connections: ~60 via pooler
 *   - Realtime: 200 concurrent connections
 *
 * The script runs a TIERED approach automatically:
 *   Tier 1: 10 students (smoke test)
 *   Tier 2: 50 students
 *   Tier 3: 100 students
 *   Tier 4: 200 students (likely practical max)
 * It reports results at each tier and stops if a tier fails badly.
 *
 * Usage:
 *   node scripts/competition-simulation.js [options]
 *
 * Options:
 *   --students N     Number of students (default: 50, max recommended: 200)
 *   --tier           Run tiered mode: 10 -> 50 -> 100 -> 200 (overrides --students)
 *   --compress N     Time compression factor (default: 1 = real time, 20 = 20x faster)
 *   --dry-run        Validate script logic without hitting Supabase
 *   --skip-cleanup   Leave test data in the DB for manual inspection
 *
 * Env vars (read from .env):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  — project credentials
 *   ADMIN_EMAIL, ADMIN_PASSWORD                 — admin account for setup
 *   SUPABASE_SERVICE_ROLE_KEY                   — alternative to admin auth
 *
 * The script NEVER logs credential values.
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// ═══════════════════════════════════════════════════════════════
// 0.  ENV + CLI PARSING
// ═══════════════════════════════════════════════════════════════

function loadEnv() {
  try {
    const lines = readFileSync('.env', 'utf8').split('\n')
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const key = t.slice(0, eq).trim()
      const val = t.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}
loadEnv()

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { students: 50, tier: false, dryRun: false, skipCleanup: false, compress: 0 }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--students' && args[i + 1]) { opts.students = parseInt(args[i + 1]); i++ }
    else if (args[i] === '--compress' && args[i + 1]) { opts.compress = parseInt(args[i + 1]); i++ }
    else if (args[i] === '--tier') opts.tier = true
    else if (args[i] === '--dry-run') opts.dryRun = true
    else if (args[i] === '--skip-cleanup') opts.skipCleanup = true
    else if (!args[i].startsWith('--') && !isNaN(args[i])) opts.students = parseInt(args[i])
  }
  return opts
}

const CLI = parseArgs()

const BASE_URL    = process.env.VITE_SUPABASE_URL
const ANON_KEY    = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FUNC_BASE   = `${BASE_URL}/functions/v1`

if (!CLI.dryRun && (!BASE_URL || !ANON_KEY)) {
  console.error('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (or use --dry-run).')
  process.exit(1)
}

// Push to the limit — max out edge function concurrency
const MAX_CONCURRENT     = 24         // 24 of 25 edge func slots (leave 1 for admin/projector)
const BATCH_DELAY_MS     = 200        // pause between batches
const BACKOFF_BASE_MS    = 1000       // initial backoff on 429
const MAX_RETRIES        = 3          // retries per request
const ENGLISH_LEVELS     = [1, 2, 3, 4]
const MATH_LEVELS        = [1, 2, 3, 4, 5, 6, 7, 8]
const ENGLISH_DURATION   = 300        // 5 min
const MATH_DURATION      = 600        // 10 min
const CODE_CHARS         = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Question counts per level
const ENGLISH_Q_COUNT = { 1: 174, 2: 100, 3: 98, 4: 104 }
const MATH_Q_COUNT    = { 1: 200, 2: 200, 3: 200, 4: 200, 5: 200, 6: 200, 7: 200, 8: 200 }

// ═══════════════════════════════════════════════════════════════
// 1.  HELPERS
// ═══════════════════════════════════════════════════════════════

function genCode() {
  const bytes = randomBytes(6)
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return code
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function percentile(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * p / 100)] || 0
}

function avg(arr) {
  if (!arr.length) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

// ═══════════════════════════════════════════════════════════════
// 2.  STATS TRACKER
// ═══════════════════════════════════════════════════════════════

function createStats() {
  return {
    join:      { ok: 0, err: 0, times: [], errors: {}, rateLimits: 0 },
    heartbeat: { ok: 0, err: 0, times: [], errors: {}, rateLimits: 0 },
    sync:      { ok: 0, err: 0, times: [], errors: {}, rateLimits: 0 },
    submit:    { ok: 0, err: 0, times: [], errors: {}, rateLimits: 0 },
    poll:      { ok: 0, err: 0, times: [], errors: {}, rateLimits: 0 },
  }
}

let stats = createStats()

function recordError(bucket, errMsg) {
  const key = (errMsg || 'unknown').slice(0, 80)
  bucket.errors[key] = (bucket.errors[key] || 0) + 1
}

// ═══════════════════════════════════════════════════════════════
// 3.  API CALLERS (with rate-limit awareness + concurrency semaphore)
// ═══════════════════════════════════════════════════════════════

// Semaphore to limit concurrent HTTP requests (all 500 students run in parallel
// but only MAX_CONCURRENT requests hit Supabase at once)
let activeRequests = 0
const requestQueue = []
function acquireSlot() {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++
    return Promise.resolve()
  }
  return new Promise(resolve => requestQueue.push(resolve))
}
function releaseSlot() {
  activeRequests--
  if (requestQueue.length > 0) {
    activeRequests++
    requestQueue.shift()()
  }
}

async function callFn(name, body) {
  if (CLI.dryRun) {
    const bucket = stats[name] || stats.poll
    bucket.ok++
    bucket.times.push(Math.random() * 100 + 50)
    return { participant_id: 'dry-run-id', remaining: 300, ok: true, validated_score: 0 }
  }

  const bucket = stats[name] || stats.poll
  await acquireSlot()
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const start = Date.now()
      try {
        const res = await fetch(`${FUNC_BASE}/${name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const elapsed = Date.now() - start
        bucket.times.push(elapsed)
        const data = await res.json().catch(() => ({}))

        if (res.ok) {
          bucket.ok++
          return data
        }

        if (res.status === 429) {
          bucket.rateLimits++
          if (attempt < MAX_RETRIES) {
            const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt) + Math.random() * 500
            await sleep(backoff)
            continue
          }
        }

        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await sleep(BACKOFF_BASE_MS * (attempt + 1) + Math.random() * 300)
          continue
        }

        bucket.err++
        recordError(bucket, data.error || `HTTP ${res.status}`)
        return null
      } catch (e) {
        bucket.times.push(Date.now() - start)
        if (attempt < MAX_RETRIES) {
          await sleep(500 * (attempt + 1))
          continue
        }
        bucket.err++
        recordError(bucket, e.message)
        return null
      }
    }
    return null
  } finally {
    releaseSlot()
  }
}

async function pollState(subject) {
  if (CLI.dryRun) { stats.poll.ok++; stats.poll.times.push(30); return }
  await acquireSlot()
  try {
    const start = Date.now()
    try {
      await fetch(`${BASE_URL}/rest/v1/competition_state?id=eq.${subject}&select=is_unlocked,started_at`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      })
      stats.poll.times.push(Date.now() - start)
      stats.poll.ok++
    } catch {
      stats.poll.times.push(Date.now() - start)
      stats.poll.err++
    }
  } finally {
    releaseSlot()
  }
}

// ═══════════════════════════════════════════════════════════════
// 4.  ANSWER GENERATION
// ═══════════════════════════════════════════════════════════════

function genAnswers(subject, level, correctPct) {
  const prefix = subject === 'english' ? 'eng' : 'math'
  const bank   = subject === 'english' ? ENGLISH_Q_COUNT : MATH_Q_COUNT
  const total  = bank[level] || 50
  const numToAnswer = Math.floor(total * (0.4 + Math.random() * 0.6))
  const answers = []
  for (let i = 1; i <= numToAnswer; i++) {
    const qid = `${prefix}_l${level}_${String(i).padStart(3, '0')}`
    const isCorrect = Math.random() < correctPct
    answers.push({
      question_id: qid,
      submitted_answer: isCorrect ? 'CorrectPlaceholder' : 'WrongAnswer',
    })
  }
  return answers
}

// ═══════════════════════════════════════════════════════════════
// 5.  BATCH RUNNER (respects free-tier concurrency)
// ═══════════════════════════════════════════════════════════════

async function runExamSimulation(students, subject, compId, label, supabase) {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`  ${label} EXAM SIMULATION  (${students.length} students)`)
  console.log(`  Real exam: ${REAL_EXAM_DURATION}s (${REAL_EXAM_DURATION/60}min) | Compressed: ~${Math.round(SIM_EXAM_DURATION)}s wall-clock | Factor: ${TIME_COMPRESSION_FACTOR}x`)
  console.log(`${'='.repeat(50)}`)

  // Set started_at NOW — right before students begin, not during setup.
  // Add 120s extra buffer so join burst doesn't eat into exam time.
  if (!CLI.dryRun && supabase) {
    console.log(`  Setting ${subject} started_at NOW (with 120s extra buffer)...`)
    await supabase.from('competition_state').update({
      started_at: new Date().toISOString(),
      extra_seconds: 120,
      updated_at: new Date().toISOString(),
    }).eq('id', subject)
  }

  stats = createStats()
  currentStudentCount = students.length
  const examStart = Date.now()
  const outcomes = {}

  // ALL students participate — no dropouts, no disconnects, everyone plays.
  // Distribution by skill level:
  // ~55% average: 5-8s per question, get through 40-60, moderate accuracy
  // ~15% slow: 10-15s per question, only 20-30 questions, lower accuracy
  // ~10% serious: fast + careful, ~120-170 questions, high accuracy (the winners)
  // ~10% fast_guess: rush, ~75-100 questions, low accuracy
  // ~10% clicker: tap through all 200 randomly, can finish before time, mostly wrong
  const scenarios = students.map(s => {
    const r = Math.random()
    if (r < 0.10) return { ...s, scenario: 'clicker' }
    if (r < 0.20) return { ...s, scenario: 'fast_guess' }
    if (r < 0.30) return { ...s, scenario: 'serious' }
    if (r < 0.45) return { ...s, scenario: 'slow' }
    return { ...s, scenario: 'average' }
  })

  // All students run concurrently (like a real competition — everyone starts together).
  // Each student's scenario is mostly sleep() with periodic API calls.
  // API calls are throttled via the semaphore in callFn to respect free-tier limits.
  // Students join in staggered waves (realistic — not everyone clicks at the same instant).
  let completedCount = 0
  const allPromises = scenarios.map(async (s, idx) => {
    // Stagger joins: students arrive over 5-15 seconds (real time, compressed)
    const joinDelayReal = Math.random() * 10
    await sleep((joinDelayReal / TIME_COMPRESSION_FACTOR) * 1000 + Math.random() * 200)

    const result = await runStudentScenario(s, subject, compId)
    completedCount++
    if (completedCount % 10 === 0 || completedCount === scenarios.length) {
      const pctDone = Math.round((completedCount / scenarios.length) * 100)
      process.stdout.write(`  Progress: ${completedCount}/${scenarios.length} (${pctDone}%)  \r`)
    }
    return result
  })

  const results = await Promise.all(allPromises)
  results.forEach(r => { outcomes[r] = (outcomes[r] || 0) + 1 })

  const examElapsed = (Date.now() - examStart) / 1000
  console.log(`\n  Completed in ${examElapsed.toFixed(1)}s`)

  return { stats: { ...stats }, outcomes, elapsed: examElapsed }
}

async function runStudentScenario(s, subject, compId) {
  const code = s.participant_code
  const level = s.level

  if (s.scenario === 'dropout')    return _dropout(code, level, subject, compId)
  if (s.scenario === 'reconnect')  return _reconnect(code, level, subject, compId)
  if (s.scenario === 'clicker')    return _clicker(code, level, subject, compId)
  if (s.scenario === 'serious')    return _serious(code, level, subject, compId)
  if (s.scenario === 'fast_guess') return _fastGuess(code, level, subject, compId)
  if (s.scenario === 'slow')       return _slow(code, level, subject, compId)
  return _average(code, level, subject, compId)
}

// ── TIME COMPRESSION ──
// Real exam = 300s (5 min). By default runs in REAL TIME (factor=1).
// Use --compress N to speed up (e.g. --compress 20 => 300s becomes ~15s).
const TIME_COMPRESSION_FACTOR = CLI.compress || 1
const REAL_EXAM_DURATION = 300 // 5 minutes in seconds
const SIM_EXAM_DURATION = REAL_EXAM_DURATION / TIME_COMPRESSION_FACTOR

// Build progressive answer arrays simulating real-time answering
function buildProgressiveAnswers(subject, level, numAnswered, correctPct) {
  const prefix = subject === 'english' ? 'eng' : 'math'
  const bank = subject === 'english' ? ENGLISH_Q_COUNT : MATH_Q_COUNT
  const total = bank[level] || 200
  const count = Math.min(total, numAnswered)
  const answers = []
  for (let i = 1; i <= count; i++) {
    const qid = `${prefix}_l${level}_${String(i).padStart(3, '0')}`
    answers.push({
      question_id: qid,
      submitted_answer: Math.random() < correctPct ? 'CorrectPlaceholder' : 'WrongAnswer',
    })
  }
  return answers
}

// Sync frequency — push 500 students to the LIMIT.
// Real app syncs every 8-10s. For 500 students that's ~50-63 syncs/second sustained.
// At 24 concurrent slots, ~350ms each = ~69/second throughput. Right at the edge.
let currentStudentCount = 50
function getSyncsPerStudent() {
  if (currentStudentCount <= 50) return 25 + Math.floor(Math.random() * 6)   // ~25-30 syncs (~10s)
  if (currentStudentCount <= 100) return 20 + Math.floor(Math.random() * 6)  // ~20-25 syncs (~13s)
  if (currentStudentCount <= 200) return 15 + Math.floor(Math.random() * 4)  // ~15-18 syncs (~18s)
  if (currentStudentCount <= 500) return 10 + Math.floor(Math.random() * 5)  // ~10-14 syncs (~23s)
  return 5 + Math.floor(Math.random() * 3)                                   // ~5-7 for 1000+
}

// Helper: run a student through the exam with periodic syncs
async function _runExamLoop(code, level, subject, compId, secsPerQuestion, correctPct, totalRealTime, finishEarly) {
  await pollState(subject)
  const jr = await callFn('join', { participant_code: code, competition_id: compId, subject })
  if (!jr) return 'join_failed'
  await callFn('heartbeat', { participant_code: code, competition_id: compId, subject, ready: true })

  const bank = subject === 'english' ? ENGLISH_Q_COUNT : MATH_Q_COUNT
  const totalQuestions = bank[level] || 200
  const numSyncs = getSyncsPerStudent()
  const syncIntervalReal = totalRealTime / (numSyncs + 1)
  const syncIntervalSim = (syncIntervalReal / TIME_COMPRESSION_FACTOR) * 1000

  let realElapsed = 0
  let questionsAnswered = 0

  for (let syncIdx = 0; syncIdx < numSyncs; syncIdx++) {
    await sleep(syncIntervalSim + Math.random() * 200)
    realElapsed += syncIntervalReal
    if (realElapsed > totalRealTime) realElapsed = totalRealTime

    questionsAnswered = Math.min(totalQuestions, Math.floor(realElapsed / secsPerQuestion))

    if (finishEarly && questionsAnswered >= totalQuestions) {
      const answers = buildProgressiveAnswers(subject, level, questionsAnswered, correctPct)
      const sr = await callFn('submit', {
        participant_code: code, competition_id: compId, subject, answers,
      })
      return sr ? 'completed_early' : 'submit_failed'
    }

    const answers = buildProgressiveAnswers(subject, level, questionsAnswered, correctPct)
    await callFn('sync', {
      participant_code: code, competition_id: compId, subject,
      provisional_score: answers.filter(a => a.submitted_answer === 'CorrectPlaceholder').length,
      questions_answered: answers.length, answers,
    })
  }

  // Wait remaining time, then auto-submit
  const remainingSim = ((totalRealTime - realElapsed) / TIME_COMPRESSION_FACTOR) * 1000
  if (remainingSim > 0) await sleep(remainingSim + Math.random() * 300)
  questionsAnswered = Math.min(totalQuestions, Math.floor(totalRealTime / secsPerQuestion))

  const finalAnswers = buildProgressiveAnswers(subject, level, questionsAnswered, correctPct)
  const sr = await callFn('submit', {
    participant_code: code, competition_id: compId, subject,
    answers: finalAnswers,
  })
  return sr ? 'completed_timeout' : 'submit_failed'
}

// ── STUDENT TYPES ──

// Average student (60%): 5-8s per question, gets through 37-60 questions, 40-65% accuracy
async function _average(code, level, subject, compId) {
  const secsPerQ = 5 + Math.random() * 3
  const accuracy = 0.4 + Math.random() * 0.25
  return _runExamLoop(code, level, subject, compId, secsPerQ, accuracy, REAL_EXAM_DURATION, false)
}

// Slow/struggling student (13%): 10-15s per question, only 20-30 questions, 25-45% accuracy
async function _slow(code, level, subject, compId) {
  const secsPerQ = 10 + Math.random() * 5
  const accuracy = 0.25 + Math.random() * 0.2
  return _runExamLoop(code, level, subject, compId, secsPerQ, accuracy, REAL_EXAM_DURATION, false)
}

// Serious/competitive student (10%): ~1.8-2.5s per question, ~120-170 questions, 70-90% accuracy
// These are the top scorers — fast AND accurate
async function _serious(code, level, subject, compId) {
  const secsPerQ = 1.8 + Math.random() * 0.7
  const accuracy = 0.7 + Math.random() * 0.2
  return _runExamLoop(code, level, subject, compId, secsPerQ, accuracy, REAL_EXAM_DURATION, false)
}

// Clicker student (5%): ~1-1.5s per question, finishes all 200 before time, 15-25% accuracy
// Just tapping through randomly — can finish early
async function _clicker(code, level, subject, compId) {
  const secsPerQ = 1.0 + Math.random() * 0.5
  const accuracy = 0.15 + Math.random() * 0.1
  return _runExamLoop(code, level, subject, compId, secsPerQ, accuracy, REAL_EXAM_DURATION, true)
}

// Fast guesser (5%): ~3-4s per question, ~75-100 questions, 20-35% accuracy
// Faster than average but not as reckless as clickers
async function _fastGuess(code, level, subject, compId) {
  const secsPerQ = 3 + Math.random() * 1
  const accuracy = 0.2 + Math.random() * 0.15
  return _runExamLoop(code, level, subject, compId, secsPerQ, accuracy, REAL_EXAM_DURATION, false)
}

// Dropout student (5%): joins, answers for 30-120 real seconds, then disappears
async function _dropout(code, level, subject, compId) {
  await pollState(subject)
  const jr = await callFn('join', { participant_code: code, competition_id: compId, subject })
  if (!jr) return 'join_failed'
  await callFn('heartbeat', { participant_code: code, competition_id: compId, subject, ready: true })

  const secsPerQ = 5 + Math.random() * 5
  const accuracy = 0.3 + Math.random() * 0.3
  const dropoutReal = 30 + Math.random() * 90

  // One sync before dropping
  const syncReal = dropoutReal * (0.4 + Math.random() * 0.3)
  await sleep((syncReal / TIME_COMPRESSION_FACTOR) * 1000)
  const answered = Math.floor(syncReal / secsPerQ)
  const answers = buildProgressiveAnswers(subject, level, answered, accuracy)
  await callFn('sync', {
    participant_code: code, competition_id: compId, subject,
    provisional_score: answers.filter(a => a.submitted_answer === 'CorrectPlaceholder').length,
    questions_answered: answers.length, answers,
  })

  return 'dropped'
}

// Reconnect student (2%): loses connection mid-exam, rejoins, finishes at timeout
async function _reconnect(code, level, subject, compId) {
  await pollState(subject)
  const jr = await callFn('join', { participant_code: code, competition_id: compId, subject })
  if (!jr) return 'join_failed'
  await callFn('heartbeat', { participant_code: code, competition_id: compId, subject, ready: true })

  const secsPerQ = 4 + Math.random() * 4
  const accuracy = 0.4 + Math.random() * 0.3
  const disconnectReal = 60 + Math.random() * 60

  // Sync before disconnect
  await sleep((disconnectReal / TIME_COMPRESSION_FACTOR) * 1000)
  const answeredBefore = Math.floor(disconnectReal / secsPerQ)
  const partialAnswers = buildProgressiveAnswers(subject, level, answeredBefore, accuracy)
  await callFn('sync', {
    participant_code: code, competition_id: compId, subject,
    provisional_score: partialAnswers.filter(a => a.submitted_answer === 'CorrectPlaceholder').length,
    questions_answered: partialAnswers.length, answers: partialAnswers,
  })

  // Offline for 20-40 real seconds
  const offlineReal = 20 + Math.random() * 20
  await sleep((offlineReal / TIME_COMPRESSION_FACTOR) * 1000)

  const rr = await callFn('join', { participant_code: code, competition_id: compId, subject })
  if (!rr) return 'reconnect_failed'

  // Continue until exam ends
  const resumeReal = disconnectReal + offlineReal
  const remainingReal = Math.max(0, REAL_EXAM_DURATION - resumeReal)

  if (remainingReal > 10) {
    await sleep((remainingReal / TIME_COMPRESSION_FACTOR) * 1000)
  }

  const totalAnswered = Math.floor(REAL_EXAM_DURATION / secsPerQ)
  const finalAnswers = buildProgressiveAnswers(subject, level, totalAnswered, accuracy)
  const sr = await callFn('submit', {
    participant_code: code, competition_id: compId, subject,
    answers: finalAnswers,
  })
  return sr ? 'completed_reconnect' : 'submit_failed'
}

// ═══════════════════════════════════════════════════════════════
// 6.  REPORTING
// ═══════════════════════════════════════════════════════════════

function printPhaseReport(phaseName, phaseStats) {
  console.log(`\n--- ${phaseName} ---`)
  for (const [name, s] of Object.entries(phaseStats)) {
    const total = s.ok + s.err
    if (total === 0) continue
    console.log(`  ${name.toUpperCase()}:`)
    console.log(`    Requests: ${total}  Success: ${s.ok}  Failures: ${s.err}  Error rate: ${((s.err / total) * 100).toFixed(1)}%`)
    if (s.rateLimits > 0) console.log(`    Rate limit hits (429): ${s.rateLimits}`)
    if (s.times.length) {
      console.log(`    Avg: ${avg(s.times)}ms  P50: ${percentile(s.times, 50)}ms  P95: ${percentile(s.times, 95)}ms  P99: ${percentile(s.times, 99)}ms  Max: ${Math.max(...s.times)}ms`)
    }
    if (Object.keys(s.errors).length) {
      console.log(`    Error types:`)
      for (const [err, count] of Object.entries(s.errors)) {
        console.log(`      - "${err}": ${count}`)
      }
    }
  }
}

function printOutcomes(outcomes) {
  console.log('  Outcomes:')
  for (const [k, v] of Object.entries(outcomes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${v}`)
  }
}

function getTierHealth(result) {
  const totalReqs = Object.values(result.stats).reduce((a, s) => a + s.ok + s.err, 0)
  const totalErrs = Object.values(result.stats).reduce((a, s) => a + s.err, 0)
  const totalRateLimits = Object.values(result.stats).reduce((a, s) => a + s.rateLimits, 0)
  const errorRate = totalReqs > 0 ? (totalErrs / totalReqs) * 100 : 0
  return { totalReqs, totalErrs, totalRateLimits, errorRate }
}

// ═══════════════════════════════════════════════════════════════
// 7.  DATA VERIFICATION
// ═══════════════════════════════════════════════════════════════

async function verifyData(supabase, compId, numStudents) {
  console.log('\n[VERIFICATION] Checking data integrity...')
  console.log('-'.repeat(50))

  const issues = []

  if (CLI.dryRun) {
    console.log('  (dry-run mode — skipping database verification)')
    return issues
  }

  const { data: allSessions, error: sessErr } = await supabase
    .from('competition_sessions')
    .select('participant_id, participant_code, subject, level, status, validated_score, time_spent_seconds, started_at, completed_at')
    .eq('competition_id', compId)

  if (sessErr || !allSessions) {
    console.error('  ERROR: Could not load sessions for verification.')
    issues.push('Could not load sessions')
    return issues
  }

  const engSessions  = allSessions.filter(s => s.subject === 'english')
  const mathSessions = allSessions.filter(s => s.subject === 'math')

  console.log(`\n  Total sessions: ${allSessions.length} (expected ${numStudents * 2})`)
  console.log(`  English: ${engSessions.length}  Math: ${mathSessions.length}`)

  if (allSessions.length !== numStudents * 2) {
    issues.push(`Session count mismatch: got ${allSessions.length}, expected ${numStudents * 2}`)
  }

  // Scores for completed sessions
  for (const [label, sessions] of [['English', engSessions], ['Math', mathSessions]]) {
    const completed = sessions.filter(s => s.status === 'completed')
    const withScore = completed.filter(s => s.validated_score != null)
    const missing = completed.length - withScore.length

    console.log(`\n  ${label}: ${completed.length} completed, ${withScore.length} with score`)
    if (missing > 0) issues.push(`${missing} ${label} completed sessions missing validated_score`)

    // Status distribution
    const byStatus = {}
    sessions.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1 })
    console.log(`  ${label} statuses: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(', ')}`)

    // Leaderboard ordering
    const ranked = sessions
      .filter(s => s.validated_score != null)
      .sort((a, b) => b.validated_score - a.validated_score || (a.time_spent_seconds || 0) - (b.time_spent_seconds || 0))

    let orderOk = true
    for (let i = 1; i < ranked.length; i++) {
      if (ranked[i - 1].validated_score < ranked[i].validated_score) { orderOk = false; break }
      if (ranked[i - 1].validated_score === ranked[i].validated_score &&
          (ranked[i - 1].time_spent_seconds || 0) > (ranked[i].time_spent_seconds || 0)) { orderOk = false; break }
    }
    console.log(`  ${label} leaderboard order: ${orderOk ? 'CORRECT' : 'INCORRECT'}`)
    if (!orderOk) issues.push(`${label} leaderboard ordering incorrect`)
  }

  // Duplicate submissions (sample)
  const completedIds = allSessions.filter(s => s.status === 'completed').map(s => s.participant_id)
  const sampleIds = completedIds.slice(0, 50)
  let duplicateCount = 0
  if (sampleIds.length > 0) {
    const { data: subs } = await supabase
      .from('submissions')
      .select('participant_id, question_id')
      .in('participant_id', sampleIds)
    if (subs) {
      const seen = new Set()
      for (const s of subs) {
        const key = `${s.participant_id}:${s.question_id}`
        if (seen.has(key)) duplicateCount++
        seen.add(key)
      }
    }
  }
  console.log(`\n  Duplicate submissions (sample of ${sampleIds.length}): ${duplicateCount}`)
  if (duplicateCount > 0) issues.push(`${duplicateCount} duplicate submissions found`)

  // Orphaned active sessions (expected from dropouts)
  const activeCount = allSessions.filter(s => s.status === 'active').length
  console.log(`  Orphaned active sessions: ${activeCount} (dropout students — expected)`)

  // Students with both scores
  const codeToScores = new Map()
  for (const s of allSessions) {
    if (!codeToScores.has(s.participant_code)) codeToScores.set(s.participant_code, {})
    codeToScores.get(s.participant_code)[s.subject] = s.validated_score
  }
  const bothScores = [...codeToScores.values()].filter(v => v.english != null && v.math != null).length
  console.log(`  Students with both scores: ${bothScores}/${numStudents}`)

  return issues
}

// ═══════════════════════════════════════════════════════════════
// 8.  SETUP + CLEANUP
// ═══════════════════════════════════════════════════════════════

async function setupCompetition(supabase, compId, students) {
  // Save current state for restoration
  const { data: savedEng } = await supabase
    .from('competition_state').select('*').eq('id', 'english').single()
  const { data: savedMath } = await supabase
    .from('competition_state').select('*').eq('id', 'math').single()

  // Set English to unlocked but NOT started yet (started_at set later, right before exam)
  await supabase.from('competition_state').update({
    competition_id: compId,
    is_unlocked: true,
    started_at: null,
    duration_seconds: ENGLISH_DURATION,
    extra_seconds: 0,
    announcement: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 'english')

  // Math locked initially
  await supabase.from('competition_state').update({
    competition_id: compId,
    is_unlocked: false,
    started_at: null,
    duration_seconds: MATH_DURATION,
    extra_seconds: 0,
    announcement: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 'math')

  // Generate sessions for both subjects
  const allRows = []
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const displayId = `SIM-${String(i + 1).padStart(4, '0')}`
    allRows.push({
      competition_id: compId,
      participant_code: s.code,
      display_id: displayId,
      name: s.name,
      school: s.school,
      country: s.country,
      age: s.age,
      subject: 'english',
      level: s.engLevel,
      status: 'waiting',
    })
    allRows.push({
      competition_id: compId,
      participant_code: s.code,
      display_id: displayId,
      name: s.name,
      school: s.school,
      country: s.country,
      age: s.age,
      subject: 'math',
      level: s.mathLevel,
      status: 'registered',
    })
  }

  // Insert in batches
  for (let i = 0; i < allRows.length; i += 200) {
    const batch = allRows.slice(i, i + 200)
    const { error } = await supabase.from('competition_sessions').insert(batch)
    if (error) {
      console.error(`  Insert failed at offset ${i}: ${error.message}`)
      return { savedEng, savedMath, ok: false }
    }
  }

  // Seed answer keys
  for (const lvl of ENGLISH_LEVELS) {
    const count = ENGLISH_Q_COUNT[lvl] || 50
    const keys = []
    for (let i = 1; i <= count; i++) {
      keys.push({
        question_id: `eng_l${lvl}_${String(i).padStart(3, '0')}`,
        subject: 'english', level: lvl,
        correct_answer: 'CorrectPlaceholder',
        competition_id: compId,
      })
    }
    for (let i = 0; i < keys.length; i += 200) {
      await supabase.from('answer_keys').upsert(keys.slice(i, i + 200), { onConflict: 'question_id,competition_id' })
    }
  }
  for (const lvl of MATH_LEVELS) {
    const count = MATH_Q_COUNT[lvl] || 50
    const keys = []
    for (let i = 1; i <= count; i++) {
      keys.push({
        question_id: `math_l${lvl}_${String(i).padStart(3, '0')}`,
        subject: 'math', level: lvl,
        correct_answer: 'CorrectPlaceholder',
        competition_id: compId,
      })
    }
    for (let i = 0; i < keys.length; i += 200) {
      await supabase.from('answer_keys').upsert(keys.slice(i, i + 200), { onConflict: 'question_id,competition_id' })
    }
  }

  return { savedEng, savedMath, ok: true }
}

async function transitionToMath(supabase, compId, students) {
  await supabase.from('competition_state').update({
    is_unlocked: false, started_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 'english')

  await supabase.from('competition_state').update({
    is_unlocked: true, started_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 'math')

  await sleep(300)

  // Update math sessions to waiting
  for (let i = 0; i < students.length; i += 200) {
    const codes = students.slice(i, i + 200).map(s => s.code)
    await supabase
      .from('competition_sessions')
      .update({ status: 'waiting', updated_at: new Date().toISOString() })
      .eq('competition_id', compId)
      .eq('subject', 'math')
      .in('participant_code', codes)
  }

  // started_at for math is set by runExamSimulation right before exam begins
}

async function cleanupCompetition(supabase, compId, students, savedEng, savedMath) {
  if (CLI.skipCleanup) {
    console.log('  --skip-cleanup: test data left in database.')
    console.log(`  Competition ID: ${compId}`)
    return
  }

  console.log('\n[CLEANUP] Removing test data...')
  try {
    // Delete submissions
    const { data: sessionsToClean } = await supabase
      .from('competition_sessions')
      .select('participant_id')
      .eq('competition_id', compId)

    if (sessionsToClean?.length) {
      for (let i = 0; i < sessionsToClean.length; i += 200) {
        const ids = sessionsToClean.slice(i, i + 200).map(s => s.participant_id)
        await supabase.from('submissions').delete().in('participant_id', ids)
      }
    }

    // Delete sessions
    for (let i = 0; i < students.length; i += 200) {
      const codes = students.slice(i, i + 200).map(s => s.code)
      await supabase.from('competition_sessions').delete()
        .eq('competition_id', compId).in('participant_code', codes)
    }

    // Delete answer keys
    await supabase.from('answer_keys').delete().eq('competition_id', compId)

    // Restore state
    if (savedEng) {
      const { id, ...rest } = savedEng
      await supabase.from('competition_state').update(rest).eq('id', 'english')
    } else {
      await supabase.from('competition_state').update({
        competition_id: 'default', is_unlocked: false, started_at: null,
        extra_seconds: 0, announcement: null,
      }).eq('id', 'english')
    }
    if (savedMath) {
      const { id, ...rest } = savedMath
      await supabase.from('competition_state').update(rest).eq('id', 'math')
    } else {
      await supabase.from('competition_state').update({
        competition_id: 'default', is_unlocked: false, started_at: null,
        extra_seconds: 0, announcement: null,
      }).eq('id', 'math')
    }

    console.log('  Test data cleaned up.')
  } catch (e) {
    console.error(`  Cleanup error: ${e.message}`)
    console.error(`  Manual cleanup may be needed. Competition ID: ${compId}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// 9.  RUN A SINGLE TIER
// ═══════════════════════════════════════════════════════════════

async function runTier(supabase, numStudents) {
  const compId = `sim_${Date.now()}_${numStudents}`
  const tierStart = Date.now()

  console.log('\n' + '#'.repeat(60))
  console.log(`  TIER: ${numStudents} STUDENTS`)
  console.log('#'.repeat(60))

  // Generate student data
  const usedCodes = new Set()
  const students = []
  for (let i = 0; i < numStudents; i++) {
    let code
    do { code = genCode() } while (usedCodes.has(code))
    usedCodes.add(code)
    students.push({
      code,
      name: `SimStudent ${i + 1}`,
      school: `School ${(i % 20) + 1}`,
      country: ['th', 'jp', 'kr', 'us', 'fr', 'cn', 'gb', 'au', 'de', 'sg'][i % 10],
      age: 7 + (i % 10),
      engLevel: ENGLISH_LEVELS[i % ENGLISH_LEVELS.length],
      mathLevel: MATH_LEVELS[i % MATH_LEVELS.length],
    })
  }

  let savedEng = null, savedMath = null

  if (!CLI.dryRun) {
    console.log('\n  Setting up...')
    const setup = await setupCompetition(supabase, compId, students)
    savedEng = setup.savedEng
    savedMath = setup.savedMath
    if (!setup.ok) {
      console.error('  Setup failed. Aborting tier.')
      return { success: false, numStudents }
    }
    console.log(`  ${numStudents * 2} sessions + answer keys created.`)
  } else {
    console.log('\n  [dry-run] Skipping database setup.')
  }

  // --- ENGLISH ---
  const engStudentData = students.map(s => ({ participant_code: s.code, level: s.engLevel }))
  const engResult = await runExamSimulation(engStudentData, 'english', compId, 'ENGLISH', supabase)
  printPhaseReport('ENGLISH EXAM', engResult.stats)
  printOutcomes(engResult.outcomes)

  // Check health before proceeding
  const engHealth = getTierHealth(engResult)
  if (engHealth.errorRate > 30) {
    console.log(`\n  WARNING: English error rate ${engHealth.errorRate.toFixed(1)}% is too high.`)
    console.log('  This tier is hitting free-tier limits. Consider upgrading to Pro.')
    if (!CLI.dryRun) await cleanupCompetition(supabase, compId, students, savedEng, savedMath)
    return { success: false, numStudents, engResult, reason: 'high_error_rate' }
  }

  // --- TRANSITION ---
  console.log('\n  Transitioning to Math...')
  const transStart = Date.now()
  if (!CLI.dryRun) await transitionToMath(supabase, compId, students)
  else await sleep(100)
  const transElapsed = ((Date.now() - transStart) / 1000).toFixed(1)
  console.log(`  Transition: ${transElapsed}s`)

  // --- MATH ---
  const mathStudentData = students.map(s => ({ participant_code: s.code, level: s.mathLevel }))
  const mathResult = await runExamSimulation(mathStudentData, 'math', compId, 'MATH', supabase)
  printPhaseReport('MATH EXAM', mathResult.stats)
  printOutcomes(mathResult.outcomes)

  // --- VERIFICATION ---
  const issues = await verifyData(supabase, compId, numStudents)

  // --- CLEANUP ---
  if (!CLI.dryRun) await cleanupCompetition(supabase, compId, students, savedEng, savedMath)

  const tierElapsed = Math.round((Date.now() - tierStart) / 1000)
  const mathHealth = getTierHealth(mathResult)

  return {
    success: true,
    numStudents,
    engResult,
    mathResult,
    transElapsed,
    tierElapsed,
    issues,
    engHealth,
    mathHealth,
  }
}

// ═══════════════════════════════════════════════════════════════
// 10. MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const globalStart = Date.now()

  console.log('\n' + '='.repeat(60))
  console.log('  WORDEE COMPETITION SIMULATION')
  console.log('='.repeat(60))
  console.log()
  console.log(`  Mode: ${CLI.dryRun ? 'DRY RUN (no Supabase calls)' : 'LIVE'}`)
  console.log(`  Tier mode: ${CLI.tier ? 'YES (10 -> 50 -> 100 -> 200)' : 'NO'}`)
  if (!CLI.tier) console.log(`  Students: ${CLI.students}`)
  console.log(`  Time: ${TIME_COMPRESSION_FACTOR === 1 ? 'REAL TIME (5 min per exam)' : `${TIME_COMPRESSION_FACTOR}x compressed (~${Math.round(SIM_EXAM_DURATION)}s per exam)`}`)
  console.log(`  Max concurrent requests: ${MAX_CONCURRENT}`)
  console.log(`  Batch delay: ${BATCH_DELAY_MS}ms`)
  console.log()

  // Connect to Supabase
  let supabase = null
  if (!CLI.dryRun) {
    if (SERVICE_KEY) {
      supabase = createClient(BASE_URL, SERVICE_KEY)
    } else {
      supabase = createClient(BASE_URL, ANON_KEY)
      const adminEmail = process.env.ADMIN_EMAIL
      const adminPassword = process.env.ADMIN_PASSWORD
      if (!adminEmail || !adminPassword) {
        console.error('ERROR: Set ADMIN_EMAIL + ADMIN_PASSWORD (or SUPABASE_SERVICE_ROLE_KEY) for setup.')
        process.exit(1)
      }
      const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
        email: adminEmail, password: adminPassword,
      })
      if (authErr || !auth?.session) {
        console.error('ERROR: Admin login failed.')
        process.exit(1)
      }
    }
    console.log('  Connected to Supabase.')
  }

  // Determine tiers
  const tiers = CLI.tier ? [10, 50, 100, 200] : [CLI.students]
  const tierResults = []

  for (const numStudents of tiers) {
    const result = await runTier(supabase, numStudents)
    tierResults.push(result)

    if (!result.success) {
      console.log(`\n  Tier ${numStudents} failed. Stopping further tiers.`)
      break
    }

    // Brief cooldown between tiers to let Supabase recover
    if (CLI.tier && numStudents < tiers[tiers.length - 1]) {
      console.log('\n  Cooldown between tiers (5s)...')
      await sleep(5000)
    }
  }

  // ── FINAL SUMMARY ──

  const globalElapsed = Math.round((Date.now() - globalStart) / 1000)

  console.log('\n\n' + '='.repeat(60))
  console.log('  FINAL SIMULATION REPORT')
  console.log('='.repeat(60))
  console.log()
  console.log(`  Total duration: ${fmtTime(globalElapsed)}`)
  console.log(`  Mode: ${CLI.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log()

  for (const r of tierResults) {
    console.log(`  --- Tier: ${r.numStudents} students ---`)
    console.log(`    Status: ${r.success ? 'PASSED' : `FAILED${r.reason ? ' (' + r.reason + ')' : ''}`}`)

    if (r.success && r.engResult) {
      const eh = r.engHealth
      const mh = r.mathHealth
      console.log(`    English: ${eh.totalReqs} reqs, ${eh.totalErrs} errors (${eh.errorRate.toFixed(1)}%), ${eh.totalRateLimits} rate limits`)
      console.log(`    Math:    ${mh.totalReqs} reqs, ${mh.totalErrs} errors (${mh.errorRate.toFixed(1)}%), ${mh.totalRateLimits} rate limits`)
      console.log(`    Duration: ${fmtTime(r.tierElapsed)}`)
      if (r.issues?.length) {
        console.log(`    Issues:`)
        r.issues.forEach(i => console.log(`      - ${i}`))
      } else {
        console.log(`    Data integrity: PASS`)
      }
    }
    console.log()
  }

  // Free tier advice
  const lastSuccess = tierResults.filter(r => r.success).pop()
  const firstFail   = tierResults.find(r => !r.success)

  console.log('--- FREE TIER ASSESSMENT ---')
  if (lastSuccess) {
    console.log(`  Max successful tier: ${lastSuccess.numStudents} students`)
    const highRL = lastSuccess.engHealth?.totalRateLimits > 5 || lastSuccess.mathHealth?.totalRateLimits > 5
    if (highRL) {
      console.log(`  Note: Rate limiting was observed. This tier works but is at the edge.`)
    }
  }
  if (firstFail) {
    console.log(`  Failed at: ${firstFail.numStudents} students`)
    console.log(`  Recommendation: For ${firstFail.numStudents}+ concurrent students, upgrade to Supabase Pro.`)
    console.log(`  Pro plan provides: higher edge-function concurrency, more DB connections,`)
    console.log(`  and no API rate limits for your project's usage patterns.`)
  }
  if (!firstFail && lastSuccess) {
    console.log(`  All tiers passed. Free tier handled ${lastSuccess.numStudents} students successfully.`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('\nSimulation complete.\n')
}

main().catch(e => {
  console.error('Simulation failed:', e)
  process.exit(1)
})
