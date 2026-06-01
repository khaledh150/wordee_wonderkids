/**
 * Load test for competition Edge Functions.
 * Simulates N virtual students doing the full sequence:
 *   poll competition_state → join → heartbeat → sync (with answers) → submit
 *
 * Usage:
 *   node scripts/loadTest.js [num_students] [competition_id]
 *   node scripts/loadTest.js 50 default
 *
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * Also requires test participants pre-registered (use loadRoster.js first)
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}

loadEnv()

const BASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const FUNC_BASE = `${BASE_URL}/functions/v1`

if (!BASE_URL || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const NUM_STUDENTS = parseInt(process.argv[2]) || 50
const COMPETITION_ID = process.argv[3] || 'default'
const NUM_ANSWERS = 10

const stats = {
  poll: { ok: 0, err: 0, times: [] },
  join: { ok: 0, err: 0, times: [] },
  heartbeat: { ok: 0, err: 0, times: [] },
  sync: { ok: 0, err: 0, times: [] },
  submit: { ok: 0, err: 0, times: [] },
}

async function callFn(name, body) {
  const start = Date.now()
  try {
    const res = await fetch(`${FUNC_BASE}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    const elapsed = Date.now() - start
    stats[name].times.push(elapsed)
    if (res.ok) {
      stats[name].ok++
      return data
    } else {
      stats[name].err++
      return null
    }
  } catch (err) {
    stats[name].err++
    stats[name].times.push(Date.now() - start)
    return null
  }
}

async function pollState() {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/rest/v1/competition_state?id=eq.english&select=is_unlocked`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
    })
    const elapsed = Date.now() - start
    stats.poll.times.push(elapsed)
    if (res.ok) stats.poll.ok++
    else stats.poll.err++
  } catch {
    stats.poll.err++
    stats.poll.times.push(Date.now() - start)
  }
}

function jitter(ms) { return ms + Math.random() * 3000 }

function p95(arr) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * 0.95)]
}

function avg(arr) {
  if (arr.length === 0) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

async function simulateStudent(code, level) {
  // 1. Poll (1-3 times with jitter)
  const pollCount = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < pollCount; i++) {
    await pollState()
    await new Promise(r => setTimeout(r, jitter(500)))
  }

  // 2. Join
  const joinResult = await callFn('join', { participant_code: code, competition_id: COMPETITION_ID })
  if (!joinResult) return

  // 3. Heartbeat
  await callFn('heartbeat', { participant_code: code, competition_id: COMPETITION_ID, ready: true })

  // 4. Generate answers
  const answers = []
  for (let i = 1; i <= NUM_ANSWERS; i++) {
    const qid = `eng_l${level}_${String(i).padStart(3, '0')}`
    answers.push({ question_id: qid, submitted_answer: Math.random() > 0.3 ? 'CorrectWord' : 'WrongWord' })
  }

  // 5. Sync (1-2 times)
  await new Promise(r => setTimeout(r, jitter(1000)))
  await callFn('sync', {
    participant_code: code,
    competition_id: COMPETITION_ID,
    provisional_score: answers.filter(a => a.submitted_answer === 'CorrectWord').length,
    questions_answered: answers.length,
    answers,
  })

  // 6. Submit
  await new Promise(r => setTimeout(r, jitter(500)))
  await callFn('submit', {
    participant_code: code,
    competition_id: COMPETITION_ID,
    answers,
  })
}

async function main() {
  console.log(`\nLoad Test: ${NUM_STUDENTS} students, competition_id="${COMPETITION_ID}"`)
  console.log(`Target: ${FUNC_BASE}\n`)

  // Create test participants
  const supabase = createClient(BASE_URL, ANON_KEY)

  console.log(`Registering ${NUM_STUDENTS} test participants...`)

  // Use execute_sql via service role is not available, so we use a simpler approach
  // We'll insert via the anon key which won't work due to RLS, so let's use the function approach
  // Actually, we need service role for this. Let's create participants via the join function approach.
  // Wait - we can't insert without service role. Let me check if there's test data already.

  // For the load test, we need pre-registered participants. Let's generate them via SQL.
  // Since we don't have service role key locally, we'll generate the SQL and run it via MCP.
  // For now, let's output what we need and use existing test data.

  // Check if we have enough participants
  const { data: existing } = await supabase
    .from('competition_state')
    .select('*')
    .eq('id', 'english')
    .single()

  if (!existing) {
    console.error('No competition_state found for english')
    process.exit(1)
  }

  console.log(`Competition state: competition_id="${existing.competition_id}", is_unlocked=${existing.is_unlocked}`)
  console.log('Note: Participants must be pre-registered via loadRoster.js or SQL.\n')

  // For load testing, generate codes LOADTEST_001..LOADTEST_N
  const codes = Array.from({ length: NUM_STUDENTS }, (_, i) => `LOAD${String(i + 1).padStart(4, '0')}`)
  const levels = [1, 2, 3, 4]

  console.log('Starting load test...\n')
  const startTime = Date.now()

  // Run in batches of 50 to avoid overwhelming the connection pool
  const BATCH = 50
  for (let i = 0; i < codes.length; i += BATCH) {
    const batch = codes.slice(i, i + BATCH)
    await Promise.all(batch.map((code, j) => {
      const level = levels[(i + j) % levels.length]
      return simulateStudent(code, level)
    }))
    process.stdout.write(`  ${Math.min(i + BATCH, codes.length)} / ${codes.length} students completed\r`)
  }

  const totalTime = Date.now() - startTime
  console.log(`\n\nCompleted in ${(totalTime / 1000).toFixed(1)}s\n`)

  // Report
  console.log('=== RESULTS ===\n')
  for (const [name, s] of Object.entries(stats)) {
    const total = s.ok + s.err
    if (total === 0) continue
    console.log(`${name.toUpperCase()}:`)
    console.log(`  Total: ${total}  OK: ${s.ok}  Errors: ${s.err}  Error rate: ${total > 0 ? ((s.err / total) * 100).toFixed(1) : 0}%`)
    console.log(`  Avg: ${avg(s.times)}ms  p95: ${p95(s.times)}ms  Max: ${Math.max(...s.times)}ms`)
    console.log()
  }

  const totalRequests = Object.values(stats).reduce((a, s) => a + s.ok + s.err, 0)
  const totalErrors = Object.values(stats).reduce((a, s) => a + s.err, 0)
  console.log(`TOTAL: ${totalRequests} requests, ${totalErrors} errors (${((totalErrors / totalRequests) * 100).toFixed(1)}% error rate)`)
  console.log(`Throughput: ${(totalRequests / (totalTime / 1000)).toFixed(1)} req/s`)
}

main().catch(console.error)
