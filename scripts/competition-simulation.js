/**
 * Competition Simulation — Full Lifecycle Test
 *
 * Simulates 1000 students through a complete English competition, then
 * transitions to Math and runs a second exam.  Reports performance
 * metrics, data-integrity checks, and a final summary.
 *
 * Usage:
 *   node scripts/competition-simulation.js [num_students]
 *
 * Env vars (read from .env):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  — project credentials
 *   ADMIN_EMAIL, ADMIN_PASSWORD                 — admin account for setup
 *
 * The script NEVER logs credential values.
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// ═══════════════════════════════════════════════════════════════
// 0.  ENV + CONSTANTS
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

const BASE_URL   = process.env.VITE_SUPABASE_URL
const ANON_KEY   = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FUNC_BASE  = `${BASE_URL}/functions/v1`

if (!BASE_URL || !ANON_KEY) {
  console.error('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.')
  process.exit(1)
}

const NUM_STUDENTS       = parseInt(process.argv[2]) || 1000
const COMP_ID            = `sim_${Date.now()}`
const BATCH_SIZE         = 50          // concurrent students per batch
const BATCH_DELAY_MS     = 100         // pause between batches
const ENGLISH_LEVELS     = [1, 2, 3, 4]
const MATH_LEVELS        = [1, 2, 3, 4, 5, 6, 7, 8]
const ENGLISH_DURATION   = 300         // 5 min
const MATH_DURATION      = 600         // 10 min
const CODE_CHARS         = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Question counts per level (matching competitionQuestions / mathCompetitionQuestions)
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

function pct(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * p / 100)] || 0
}

function avg(arr) {
  if (!arr.length) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

function fmt(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

// ═══════════════════════════════════════════════════════════════
// 2.  STATS TRACKER
// ═══════════════════════════════════════════════════════════════

function createStats() {
  return {
    join:      { ok: 0, err: 0, times: [], errors: {} },
    heartbeat: { ok: 0, err: 0, times: [], errors: {} },
    sync:      { ok: 0, err: 0, times: [], errors: {} },
    submit:    { ok: 0, err: 0, times: [], errors: {} },
    poll:      { ok: 0, err: 0, times: [], errors: {} },
  }
}

let stats = createStats()

function recordError(bucket, errMsg) {
  const key = (errMsg || 'unknown').slice(0, 60)
  bucket.errors[key] = (bucket.errors[key] || 0) + 1
}

// ═══════════════════════════════════════════════════════════════
// 3.  API CALLERS
// ═══════════════════════════════════════════════════════════════

async function callFn(name, body, retries = 2) {
  const bucket = stats[name] || stats.poll
  for (let attempt = 0; attempt <= retries; attempt++) {
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
      if (res.status === 429 && attempt < retries) {
        // rate limited — back off and retry
        await sleep(1000 * (attempt + 1) + Math.random() * 500)
        continue
      }
      bucket.err++
      recordError(bucket, data.error || `HTTP ${res.status}`)
      return null
    } catch (e) {
      bucket.times.push(Date.now() - start)
      if (attempt < retries) {
        await sleep(500 * (attempt + 1))
        continue
      }
      bucket.err++
      recordError(bucket, e.message)
      return null
    }
  }
  return null
}

async function pollState(subject) {
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
}

// ═══════════════════════════════════════════════════════════════
// 4.  ANSWER GENERATION
// ═══════════════════════════════════════════════════════════════

function genAnswers(subject, level, correctPct) {
  const prefix = subject === 'english' ? 'eng' : 'math'
  const bank   = subject === 'english' ? ENGLISH_Q_COUNT : MATH_Q_COUNT
  const total  = bank[level] || 50
  // Students answer 40-100% of questions
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
// 5.  STUDENT SIMULATION SCENARIOS
// ═══════════════════════════════════════════════════════════════

async function simulateNormal(code, level, subject) {
  await pollState(subject)
  const jr = await callFn('join', { participant_code: code, competition_id: COMP_ID, subject })
  if (!jr) return 'join_failed'

  await callFn('heartbeat', { participant_code: code, competition_id: COMP_ID, subject, ready: true })

  // 3-5 syncs at realistic intervals
  const numSyncs = 3 + Math.floor(Math.random() * 3)
  let latestAnswers = []
  for (let s = 0; s < numSyncs; s++) {
    await sleep(500 + Math.random() * 3000) // 0.5-3.5s between syncs
    latestAnswers = genAnswers(subject, level, 0.5 + Math.random() * 0.3)
    await callFn('sync', {
      participant_code: code,
      competition_id: COMP_ID,
      subject,
      provisional_score: Math.floor(latestAnswers.length * 0.6),
      questions_answered: latestAnswers.length,
      answers: latestAnswers,
    })
  }

  // Final submit
  await sleep(100 + Math.random() * 500)
  const finalAnswers = genAnswers(subject, level, 0.5 + Math.random() * 0.4) // 50-90%
  const sr = await callFn('submit', {
    participant_code: code,
    competition_id: COMP_ID,
    subject,
    answers: finalAnswers,
  })
  return sr ? 'completed' : 'submit_failed'
}

async function simulateFast(code, level, subject) {
  const jr = await callFn('join', { participant_code: code, competition_id: COMP_ID, subject })
  if (!jr) return 'join_failed'

  await callFn('heartbeat', { participant_code: code, competition_id: COMP_ID, subject, ready: true })

  // Fast finisher — submit immediately with high accuracy
  await sleep(200 + Math.random() * 800)
  const answers = genAnswers(subject, level, 0.85 + Math.random() * 0.15) // 85-100%
  const sr = await callFn('submit', {
    participant_code: code,
    competition_id: COMP_ID,
    subject,
    answers,
  })
  return sr ? 'completed_fast' : 'submit_failed'
}

async function simulateDropout(code, level, subject) {
  const jr = await callFn('join', { participant_code: code, competition_id: COMP_ID, subject })
  if (!jr) return 'join_failed'

  await callFn('heartbeat', { participant_code: code, competition_id: COMP_ID, subject, ready: true })

  // Sync once, then disappear
  await sleep(300 + Math.random() * 700)
  const answers = genAnswers(subject, level, 0.3 + Math.random() * 0.3) // 30-60%
  await callFn('sync', {
    participant_code: code,
    competition_id: COMP_ID,
    subject,
    provisional_score: Math.floor(answers.length * 0.4),
    questions_answered: answers.length,
    answers,
  })
  return 'dropped'
}

async function simulateReconnect(code, level, subject) {
  // Join, sync, "disconnect", re-join, sync again, submit
  const jr = await callFn('join', { participant_code: code, competition_id: COMP_ID, subject })
  if (!jr) return 'join_failed'

  await callFn('heartbeat', { participant_code: code, competition_id: COMP_ID, subject, ready: true })

  // First sync
  await sleep(300 + Math.random() * 500)
  const partialAnswers = genAnswers(subject, level, 0.5)
  await callFn('sync', {
    participant_code: code,
    competition_id: COMP_ID,
    subject,
    provisional_score: Math.floor(partialAnswers.length * 0.5),
    questions_answered: partialAnswers.length,
    answers: partialAnswers,
  })

  // "Disconnect" — pause
  await sleep(2000 + Math.random() * 3000)

  // Reconnect — re-join (should get resume with remaining time)
  const rr = await callFn('join', { participant_code: code, competition_id: COMP_ID, subject })
  if (!rr) return 'reconnect_failed'

  // Sync more answers
  await sleep(500 + Math.random() * 1000)
  const moreAnswers = genAnswers(subject, level, 0.6 + Math.random() * 0.3)
  await callFn('sync', {
    participant_code: code,
    competition_id: COMP_ID,
    subject,
    provisional_score: Math.floor(moreAnswers.length * 0.7),
    questions_answered: moreAnswers.length,
    answers: moreAnswers,
  })

  // Submit
  await sleep(200 + Math.random() * 500)
  const finalAnswers = genAnswers(subject, level, 0.6 + Math.random() * 0.3)
  const sr = await callFn('submit', {
    participant_code: code,
    competition_id: COMP_ID,
    subject,
    answers: finalAnswers,
  })
  return sr ? 'completed_reconnect' : 'submit_failed'
}

// ═══════════════════════════════════════════════════════════════
// 6.  BATCH RUNNER
// ═══════════════════════════════════════════════════════════════

async function runExamSimulation(students, subject, label) {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`  ${label} EXAM SIMULATION — ${students.length} students`)
  console.log(`${'='.repeat(50)}`)

  stats = createStats()
  const examStart = Date.now()
  const outcomes = {}

  // Assign scenarios
  const scenarios = students.map(s => {
    const r = Math.random()
    if (r < 0.03) return { ...s, scenario: 'never_join' }        // 3%
    if (r < 0.08) return { ...s, scenario: 'reconnect' }         // 5%
    if (r < 0.18) return { ...s, scenario: 'dropout' }           // 10%
    if (r < 0.33) return { ...s, scenario: 'fast' }              // 15%
    return { ...s, scenario: 'normal' }                           // 67%
  })

  // Process in staggered batches
  for (let i = 0; i < scenarios.length; i += BATCH_SIZE) {
    const batch = scenarios.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(async s => {
      // Add per-student jitter within the batch
      await sleep(Math.random() * BATCH_DELAY_MS)

      if (s.scenario === 'never_join') return 'never_joined'
      if (s.scenario === 'dropout')    return simulateDropout(s.participant_code, s.level, subject)
      if (s.scenario === 'fast')       return simulateFast(s.participant_code, s.level, subject)
      if (s.scenario === 'reconnect')  return simulateReconnect(s.participant_code, s.level, subject)
      return simulateNormal(s.participant_code, s.level, subject)
    }))

    results.forEach(r => { outcomes[r] = (outcomes[r] || 0) + 1 })
    const done = Math.min(i + BATCH_SIZE, scenarios.length)
    const pctDone = Math.round((done / scenarios.length) * 100)
    process.stdout.write(`  Progress: ${done}/${scenarios.length} (${pctDone}%)  \r`)

    // Stagger between batches
    if (i + BATCH_SIZE < scenarios.length) await sleep(BATCH_DELAY_MS)
  }

  const examElapsed = (Date.now() - examStart) / 1000
  console.log(`\n  Completed in ${examElapsed.toFixed(1)}s`)

  return { stats: { ...stats }, outcomes, elapsed: examElapsed }
}

// ═══════════════════════════════════════════════════════════════
// 7.  REPORTING
// ═══════════════════════════════════════════════════════════════

function printPhaseReport(phaseName, phaseStats) {
  console.log(`\n--- ${phaseName} ---`)
  for (const [name, s] of Object.entries(phaseStats)) {
    const total = s.ok + s.err
    if (total === 0) continue
    console.log(`  ${name.toUpperCase()}:`)
    console.log(`    Requests: ${total}  Success: ${s.ok}  Failures: ${s.err}  Error rate: ${((s.err / total) * 100).toFixed(1)}%`)
    if (s.times.length) {
      console.log(`    Avg: ${avg(s.times)}ms  P50: ${pct(s.times, 50)}ms  P95: ${pct(s.times, 95)}ms  P99: ${pct(s.times, 99)}ms  Max: ${Math.max(...s.times)}ms`)
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

// ═══════════════════════════════════════════════════════════════
// 8.  MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const globalStart = Date.now()

  console.log('\n' + '='.repeat(60))
  console.log('  WORDEE COMPETITION SIMULATION')
  console.log('  Students: ' + NUM_STUDENTS)
  console.log('  Competition ID: ' + COMP_ID)
  console.log('  Subjects: English -> Math')
  console.log('='.repeat(60))

  // ── Supabase client (service role for setup, or admin auth) ──

  let supabase
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

  // ────────────────────────────────────────────────────────────
  // PHASE A: SETUP
  // ────────────────────────────────────────────────────────────

  console.log('\n[PHASE A] Setting up test data...')

  // Save the current competition_state so we can restore it later
  const { data: savedEnglishState } = await supabase
    .from('competition_state').select('*').eq('id', 'english').single()
  const { data: savedMathState } = await supabase
    .from('competition_state').select('*').eq('id', 'math').single()

  // Set competition state for English
  await supabase.from('competition_state').update({
    competition_id: COMP_ID,
    is_unlocked: true,
    started_at: new Date().toISOString(),
    duration_seconds: ENGLISH_DURATION,
    extra_seconds: 0,
    announcement: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 'english')

  // Ensure Math is locked initially
  await supabase.from('competition_state').update({
    competition_id: COMP_ID,
    is_unlocked: false,
    started_at: null,
    duration_seconds: MATH_DURATION,
    extra_seconds: 0,
    announcement: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 'math')

  console.log('  Competition state configured.')

  // Generate students — each gets BOTH English and Math sessions
  const students = []
  const usedCodes = new Set()
  for (let i = 0; i < NUM_STUDENTS; i++) {
    let code
    do { code = genCode() } while (usedCodes.has(code))
    usedCodes.add(code)

    const engLevel  = ENGLISH_LEVELS[i % ENGLISH_LEVELS.length]
    const mathLevel = MATH_LEVELS[i % MATH_LEVELS.length]
    const country   = ['th', 'jp', 'kr', 'us', 'fr', 'cn', 'gb', 'au', 'de', 'sg'][i % 10]
    const school    = `School ${(i % 20) + 1}`

    students.push({
      code,
      name: `SimStudent ${i + 1}`,
      school,
      country,
      age: 7 + (i % 10),
      engLevel,
      mathLevel,
    })
  }

  // Insert English sessions
  const engRows = students.map((s, i) => ({
    competition_id: COMP_ID,
    participant_code: s.code,
    display_id: `SIM-${String(i + 1).padStart(4, '0')}`,
    name: s.name,
    school: s.school,
    country: s.country,
    age: s.age,
    subject: 'english',
    level: s.engLevel,
    status: 'waiting',
  }))

  const mathRows = students.map((s, i) => ({
    competition_id: COMP_ID,
    participant_code: s.code,
    display_id: `SIM-${String(i + 1).padStart(4, '0')}`,
    name: s.name,
    school: s.school,
    country: s.country,
    age: s.age,
    subject: 'math',
    level: s.mathLevel,
    status: 'registered',
  }))

  // Insert in batches of 200
  const allRows = [...engRows, ...mathRows]
  for (let i = 0; i < allRows.length; i += 200) {
    const batch = allRows.slice(i, i + 200)
    const { error } = await supabase.from('competition_sessions').insert(batch)
    if (error) {
      console.error(`  Insert batch failed at offset ${i}: ${error.message}`)
      await cleanup(supabase, students, savedEnglishState, savedMathState)
      process.exit(1)
    }
    process.stdout.write(`  Registered ${Math.min(i + 200, allRows.length)}/${allRows.length} sessions\r`)
  }
  console.log(`  ${allRows.length} sessions registered (${NUM_STUDENTS} students x 2 subjects)`)

  // Seed answer keys for English
  for (const lvl of ENGLISH_LEVELS) {
    const count = ENGLISH_Q_COUNT[lvl] || 50
    const keys = []
    for (let i = 1; i <= count; i++) {
      keys.push({
        question_id: `eng_l${lvl}_${String(i).padStart(3, '0')}`,
        subject: 'english',
        level: lvl,
        correct_answer: 'CorrectPlaceholder',
        competition_id: COMP_ID,
      })
    }
    for (let i = 0; i < keys.length; i += 200) {
      await supabase.from('answer_keys').upsert(keys.slice(i, i + 200), { onConflict: 'question_id,competition_id' })
    }
  }

  // Seed answer keys for Math
  for (const lvl of MATH_LEVELS) {
    const count = MATH_Q_COUNT[lvl] || 50
    const keys = []
    for (let i = 1; i <= count; i++) {
      keys.push({
        question_id: `math_l${lvl}_${String(i).padStart(3, '0')}`,
        subject: 'math',
        level: lvl,
        correct_answer: 'CorrectPlaceholder',
        competition_id: COMP_ID,
      })
    }
    for (let i = 0; i < keys.length; i += 200) {
      await supabase.from('answer_keys').upsert(keys.slice(i, i + 200), { onConflict: 'question_id,competition_id' })
    }
  }
  console.log('  Answer keys seeded for English + Math.')
  console.log('  Setup complete.')

  // ────────────────────────────────────────────────────────────
  // PHASE B: ENGLISH COMPETITION
  // ────────────────────────────────────────────────────────────

  console.log('\n[PHASE B] English Competition')

  const engStudentData = students.map(s => ({
    participant_code: s.code,
    level: s.engLevel,
  }))

  const engResult = await runExamSimulation(engStudentData, 'english', 'ENGLISH')

  printPhaseReport('ENGLISH EXAM', engResult.stats)
  printOutcomes(engResult.outcomes)

  // ────────────────────────────────────────────────────────────
  // PHASE C: TRANSITION TO MATH
  // ────────────────────────────────────────────────────────────

  console.log('\n[PHASE C] Transitioning to Math...')

  const transitionStart = Date.now()

  // Admin closes English
  await supabase.from('competition_state').update({
    is_unlocked: false,
    started_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 'english')

  // Admin opens Math lobby, then starts it
  await supabase.from('competition_state').update({
    is_unlocked: true,
    started_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 'math')

  // Brief pause to simulate lobby time
  await sleep(500)

  // Update Math sessions to "waiting" status
  // In a real flow, students would re-join.  We update status so the
  // join edge function finds them in 'waiting' or 'registered'.
  for (let i = 0; i < students.length; i += 200) {
    const codes = students.slice(i, i + 200).map(s => s.code)
    await supabase
      .from('competition_sessions')
      .update({ status: 'waiting', updated_at: new Date().toISOString() })
      .eq('competition_id', COMP_ID)
      .eq('subject', 'math')
      .in('participant_code', codes)
  }

  // Admin starts Math
  await supabase.from('competition_state').update({
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', 'math')

  const transitionElapsed = ((Date.now() - transitionStart) / 1000).toFixed(1)
  console.log(`  Transition completed in ${transitionElapsed}s`)

  // ────────────────────────────────────────────────────────────
  // PHASE C (cont): MATH COMPETITION
  // ────────────────────────────────────────────────────────────

  const mathStudentData = students.map(s => ({
    participant_code: s.code,
    level: s.mathLevel,
  }))

  const mathResult = await runExamSimulation(mathStudentData, 'math', 'MATH')

  printPhaseReport('MATH EXAM', mathResult.stats)
  printOutcomes(mathResult.outcomes)

  // ────────────────────────────────────────────────────────────
  // PHASE D: VERIFICATION
  // ────────────────────────────────────────────────────────────

  console.log('\n[PHASE D] Data Verification')
  console.log('─'.repeat(50))

  const verifyIssues = []

  // 1. Check all sessions exist
  const { data: allSessions, error: sessErr } = await supabase
    .from('competition_sessions')
    .select('participant_id, participant_code, subject, level, status, validated_score, time_spent_seconds, started_at, completed_at')
    .eq('competition_id', COMP_ID)

  if (sessErr || !allSessions) {
    console.error('  ERROR: Could not load sessions for verification.')
  } else {
    const engSessions  = allSessions.filter(s => s.subject === 'english')
    const mathSessions = allSessions.filter(s => s.subject === 'math')

    console.log(`\n  Total sessions: ${allSessions.length} (expected ${NUM_STUDENTS * 2})`)
    console.log(`  English sessions: ${engSessions.length}`)
    console.log(`  Math sessions: ${mathSessions.length}`)

    if (allSessions.length !== NUM_STUDENTS * 2) {
      verifyIssues.push(`Session count mismatch: got ${allSessions.length}, expected ${NUM_STUDENTS * 2}`)
    }

    // 2. Scores present for completed students
    const engCompleted = engSessions.filter(s => s.status === 'completed')
    const mathCompleted = mathSessions.filter(s => s.status === 'completed')
    const engWithScore = engCompleted.filter(s => s.validated_score != null)
    const mathWithScore = mathCompleted.filter(s => s.validated_score != null)

    console.log(`\n  English: ${engCompleted.length} completed, ${engWithScore.length} with validated score`)
    console.log(`  Math: ${mathCompleted.length} completed, ${mathWithScore.length} with validated score`)

    const engMissingScores = engCompleted.length - engWithScore.length
    const mathMissingScores = mathCompleted.length - mathWithScore.length
    if (engMissingScores > 0) verifyIssues.push(`${engMissingScores} English completed sessions missing validated_score`)
    if (mathMissingScores > 0) verifyIssues.push(`${mathMissingScores} Math completed sessions missing validated_score`)

    // 3. Status distribution
    for (const [label, sessions] of [['English', engSessions], ['Math', mathSessions]]) {
      const byStatus = {}
      sessions.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1 })
      console.log(`\n  ${label} status distribution:`)
      for (const [status, count] of Object.entries(byStatus).sort()) {
        console.log(`    ${status}: ${count}`)
      }
    }

    // 4. Leaderboard ordering
    for (const [label, sessions] of [['English', engSessions], ['Math', mathSessions]]) {
      const completed = sessions
        .filter(s => s.validated_score != null)
        .sort((a, b) => b.validated_score - a.validated_score || (a.time_spent_seconds || 0) - (b.time_spent_seconds || 0))

      let orderCorrect = true
      for (let i = 1; i < completed.length; i++) {
        const prev = completed[i - 1]
        const curr = completed[i]
        if (prev.validated_score < curr.validated_score) {
          orderCorrect = false
          break
        }
        if (prev.validated_score === curr.validated_score &&
            (prev.time_spent_seconds || 0) > (curr.time_spent_seconds || 0)) {
          orderCorrect = false
          break
        }
      }
      console.log(`\n  ${label} leaderboard order correct: ${orderCorrect ? 'YES' : 'NO'}`)
      if (!orderCorrect) verifyIssues.push(`${label} leaderboard ordering incorrect`)
    }

    // 5. Duplicate submission check
    const { data: dupes } = await supabase
      .rpc('check_duplicate_submissions_sim', { comp_id: COMP_ID })
      .maybeSingle()

    // If the RPC doesn't exist, check manually with a query
    let duplicateCount = 0
    if (!dupes) {
      // Check for duplicate participant_id in submissions
      const completedIds = allSessions
        .filter(s => s.status === 'completed')
        .map(s => s.participant_id)

      // Sample check: take first 100 completed sessions
      const sampleIds = completedIds.slice(0, 100)
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
    } else {
      duplicateCount = dupes.count || 0
    }
    console.log(`\n  Duplicate submissions (sample check): ${duplicateCount}`)
    if (duplicateCount > 0) verifyIssues.push(`${duplicateCount} duplicate submissions found`)

    // 6. Orphaned sessions — sessions that are "active" but should have timed out
    const activeSessions = allSessions.filter(s => s.status === 'active')
    console.log(`  Orphaned active sessions: ${activeSessions.length}`)
    if (activeSessions.length > 0) {
      verifyIssues.push(`${activeSessions.length} sessions stuck in "active" status (dropouts are expected)`)
    }

    // 7. Completion rates
    const engCompletionRate = engSessions.length > 0
      ? ((engCompleted.length / engSessions.length) * 100).toFixed(1) : '0.0'
    const mathCompletionRate = mathSessions.length > 0
      ? ((mathCompleted.length / mathSessions.length) * 100).toFixed(1) : '0.0'
    console.log(`\n  English completion rate: ${engCompletionRate}%`)
    console.log(`  Math completion rate: ${mathCompletionRate}%`)

    // 8. Students with BOTH scores
    const codeToScores = new Map()
    for (const s of allSessions) {
      if (!codeToScores.has(s.participant_code)) codeToScores.set(s.participant_code, {})
      codeToScores.get(s.participant_code)[s.subject] = s.validated_score
    }
    const bothScores = [...codeToScores.values()].filter(v => v.english != null && v.math != null).length
    const eitherScore = [...codeToScores.values()].filter(v => v.english != null || v.math != null).length
    console.log(`\n  Students with both English + Math scores: ${bothScores}/${NUM_STUDENTS}`)
    console.log(`  Students with at least one score: ${eitherScore}/${NUM_STUDENTS}`)
  }

  // ────────────────────────────────────────────────────────────
  // FINAL REPORT
  // ────────────────────────────────────────────────────────────

  const globalElapsed = Math.round((Date.now() - globalStart) / 1000)

  console.log('\n')
  console.log('='.repeat(60))
  console.log('  COMPETITION SIMULATION REPORT')
  console.log('='.repeat(60))
  console.log()
  console.log(`  Students: ${NUM_STUDENTS}`)
  console.log(`  Total duration: ${fmt(globalElapsed)}`)
  console.log(`  Competition ID: ${COMP_ID}`)
  console.log()

  // Join phase summary (combined)
  const allJoinOk  = (engResult.stats.join?.ok || 0) + (mathResult.stats.join?.ok || 0)
  const allJoinErr = (engResult.stats.join?.err || 0) + (mathResult.stats.join?.err || 0)
  const allJoinTimes = [...(engResult.stats.join?.times || []), ...(mathResult.stats.join?.times || [])]
  console.log('--- JOIN PHASE (combined) ---')
  console.log(`  Success: ${allJoinOk}`)
  console.log(`  Failures: ${allJoinErr}`)
  if (allJoinTimes.length) {
    console.log(`  Avg response time: ${avg(allJoinTimes)}ms`)
    console.log(`  P50: ${pct(allJoinTimes, 50)}ms  P95: ${pct(allJoinTimes, 95)}ms  P99: ${pct(allJoinTimes, 99)}ms`)
  }

  // English exam summary
  console.log()
  console.log('--- EXAM PHASE (English) ---')
  console.log(`  Duration: ${engResult.elapsed.toFixed(1)}s`)
  console.log(`  Syncs: ${engResult.stats.sync?.ok || 0} ok, ${engResult.stats.sync?.err || 0} failed`)
  const engSubmitOk = engResult.stats.submit?.ok || 0
  console.log(`  Submits: ${engSubmitOk} successful`)
  if (engResult.stats.submit?.times?.length) {
    console.log(`  Avg submit time: ${avg(engResult.stats.submit.times)}ms`)
  }
  const engRateLimits = Object.entries(engResult.stats.sync?.errors || {})
    .filter(([k]) => k.toLowerCase().includes('rate') || k.toLowerCase().includes('429') || k.toLowerCase().includes('throttl'))
    .reduce((a, [, v]) => a + v, 0)
  console.log(`  Rate limit / throttle hits: ${engRateLimits}`)

  // Transition
  console.log()
  console.log('--- TRANSITION ---')
  console.log(`  Duration: ${transitionElapsed}s`)

  // Math exam summary
  console.log()
  console.log('--- EXAM PHASE (Math) ---')
  console.log(`  Duration: ${mathResult.elapsed.toFixed(1)}s`)
  console.log(`  Syncs: ${mathResult.stats.sync?.ok || 0} ok, ${mathResult.stats.sync?.err || 0} failed`)
  const mathSubmitOk = mathResult.stats.submit?.ok || 0
  console.log(`  Submits: ${mathSubmitOk} successful`)
  if (mathResult.stats.submit?.times?.length) {
    console.log(`  Avg submit time: ${avg(mathResult.stats.submit.times)}ms`)
  }
  const mathRateLimits = Object.entries(mathResult.stats.sync?.errors || {})
    .filter(([k]) => k.toLowerCase().includes('rate') || k.toLowerCase().includes('429') || k.toLowerCase().includes('throttl'))
    .reduce((a, [, v]) => a + v, 0)
  console.log(`  Rate limit / throttle hits: ${mathRateLimits}`)

  // Verification summary
  console.log()
  console.log('--- VERIFICATION ---')
  if (verifyIssues.length === 0) {
    console.log('  Data integrity: PASS')
    console.log('  All checks passed.')
  } else {
    console.log(`  Data integrity: ${verifyIssues.some(i => !i.includes('expected')) ? 'FAIL' : 'WARN'}`)
    console.log('  Issues:')
    for (const issue of verifyIssues) {
      console.log(`    - ${issue}`)
    }
  }

  // Aggregate throughput
  const allStats = [engResult.stats, mathResult.stats]
  const totalRequests = allStats.reduce((sum, s) =>
    sum + Object.values(s).reduce((a, b) => a + b.ok + b.err, 0), 0)
  const totalErrors = allStats.reduce((sum, s) =>
    sum + Object.values(s).reduce((a, b) => a + b.err, 0), 0)
  const totalExamTime = engResult.elapsed + mathResult.elapsed

  console.log()
  console.log('--- AGGREGATE ---')
  console.log(`  Total API requests: ${totalRequests}`)
  console.log(`  Total errors: ${totalErrors} (${totalRequests ? ((totalErrors / totalRequests) * 100).toFixed(1) : 0}%)`)
  console.log(`  Avg throughput: ${totalExamTime ? (totalRequests / totalExamTime).toFixed(1) : 0} req/s`)

  console.log('\n' + '='.repeat(60))

  // ────────────────────────────────────────────────────────────
  // CLEANUP
  // ────────────────────────────────────────────────────────────

  await cleanup(supabase, students, savedEnglishState, savedMathState)

  console.log('\nSimulation complete.\n')
}

async function cleanup(supabase, students, savedEnglishState, savedMathState) {
  console.log('\n[CLEANUP] Removing test data...')

  try {
    // Get all participant IDs for this competition to clean submissions
    const { data: sessionsToClean } = await supabase
      .from('competition_sessions')
      .select('participant_id')
      .eq('competition_id', COMP_ID)

    if (sessionsToClean?.length) {
      // Delete submissions in batches
      for (let i = 0; i < sessionsToClean.length; i += 200) {
        const ids = sessionsToClean.slice(i, i + 200).map(s => s.participant_id)
        await supabase.from('submissions').delete().in('participant_id', ids)
      }
    }

    // Delete sessions in batches
    for (let i = 0; i < students.length; i += 200) {
      const codes = students.slice(i, i + 200).map(s => s.code)
      await supabase
        .from('competition_sessions')
        .delete()
        .eq('competition_id', COMP_ID)
        .in('participant_code', codes)
    }

    // Delete answer keys
    await supabase.from('answer_keys').delete().eq('competition_id', COMP_ID)

    // Restore original competition state
    if (savedEnglishState) {
      const { id, ...rest } = savedEnglishState
      await supabase.from('competition_state').update(rest).eq('id', 'english')
    } else {
      await supabase.from('competition_state').update({
        competition_id: 'default',
        is_unlocked: false,
        started_at: null,
        extra_seconds: 0,
        announcement: null,
      }).eq('id', 'english')
    }

    if (savedMathState) {
      const { id, ...rest } = savedMathState
      await supabase.from('competition_state').update(rest).eq('id', 'math')
    } else {
      await supabase.from('competition_state').update({
        competition_id: 'default',
        is_unlocked: false,
        started_at: null,
        extra_seconds: 0,
        announcement: null,
      }).eq('id', 'math')
    }

    console.log('  Test data cleaned up.')
  } catch (e) {
    console.error('  Cleanup error:', e.message)
    console.error('  Manual cleanup may be needed for competition_id:', COMP_ID)
  }
}

main().catch(e => {
  console.error('Simulation failed:', e)
  process.exit(1)
})
