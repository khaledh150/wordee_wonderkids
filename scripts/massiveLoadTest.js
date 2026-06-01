/**
 * Massive load test: 1000 students, full lifecycle, realistic scenarios.
 *
 * Scenarios per student:
 * - 70% normal: join → heartbeat → sync x3 → submit (mix of correct/wrong)
 * - 15% fast finisher: join → submit immediately (all correct or mostly correct)
 * - 10% slow/dropout: join → sync x1 → never submit (signal lost)
 * - 5% never join: registered but never connect
 *
 * Usage: node scripts/massiveLoadTest.js [num_students] [competition_id]
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

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
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const NUM_STUDENTS = parseInt(process.argv[2]) || 100
const COMP_ID = process.argv[3] || 'loadtest'
const LEVELS = [1, 2, 3, 4]
const QUESTIONS_PER_LEVEL = { 1: 174, 2: 100, 3: 98, 4: 104 }
const BATCH_SIZE = 25

function genCode() {
  const bytes = randomBytes(6)
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return code
}

const stats = { join: { ok: 0, err: 0, times: [] }, heartbeat: { ok: 0, err: 0, times: [] }, sync: { ok: 0, err: 0, times: [] }, submit: { ok: 0, err: 0, times: [] }, poll: { ok: 0, err: 0, times: [] } }

async function callFn(name, body) {
  const start = Date.now()
  try {
    const res = await fetch(`${FUNC_BASE}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    stats[name].times.push(Date.now() - start)
    if (res.ok) { stats[name].ok++; return data }
    else { stats[name].err++; return null }
  } catch { stats[name].err++; stats[name].times.push(Date.now() - start); return null }
}

async function pollState() {
  const start = Date.now()
  try {
    await fetch(`${BASE_URL}/rest/v1/competition_state?id=eq.english&select=is_unlocked`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } })
    stats.poll.times.push(Date.now() - start)
    stats.poll.ok++
  } catch { stats.poll.err++; stats.poll.times.push(Date.now() - start) }
}

function genAnswers(level, correctPct) {
  const count = QUESTIONS_PER_LEVEL[level] || 50
  const numToAnswer = Math.floor(count * (0.3 + Math.random() * 0.7))
  const answers = []
  for (let i = 1; i <= numToAnswer; i++) {
    const qid = `eng_l${level}_${String(i).padStart(3, '0')}`
    const isCorrect = Math.random() < correctPct
    answers.push({ question_id: qid, submitted_answer: isCorrect ? 'CorrectPlaceholder' : 'WrongAnswer' })
  }
  return answers
}

async function simulateNormal(code, level) {
  await pollState()
  const jr = await callFn('join', { participant_code: code, competition_id: COMP_ID })
  if (!jr) return 'join_failed'
  await callFn('heartbeat', { participant_code: code, competition_id: COMP_ID, ready: true })

  // 3 syncs with progressive answers
  for (let s = 1; s <= 3; s++) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300))
    const answers = genAnswers(level, 0.6)
    await callFn('sync', { participant_code: code, competition_id: COMP_ID, provisional_score: Math.floor(answers.length * 0.6), questions_answered: answers.length, answers })
  }

  await new Promise(r => setTimeout(r, 100 + Math.random() * 200))
  const answers = genAnswers(level, 0.5 + Math.random() * 0.4)
  const sr = await callFn('submit', { participant_code: code, competition_id: COMP_ID, answers })
  return sr ? 'completed' : 'submit_failed'
}

async function simulateFast(code, level) {
  await callFn('join', { participant_code: code, competition_id: COMP_ID })
  await callFn('heartbeat', { participant_code: code, competition_id: COMP_ID, ready: true })
  const answers = genAnswers(level, 0.85 + Math.random() * 0.15)
  const sr = await callFn('submit', { participant_code: code, competition_id: COMP_ID, answers })
  return sr ? 'completed_fast' : 'submit_failed'
}

async function simulateDropout(code, level) {
  await callFn('join', { participant_code: code, competition_id: COMP_ID })
  await callFn('heartbeat', { participant_code: code, competition_id: COMP_ID, ready: true })
  const answers = genAnswers(level, 0.4)
  await callFn('sync', { participant_code: code, competition_id: COMP_ID, provisional_score: Math.floor(answers.length * 0.4), questions_answered: answers.length, answers })
  return 'dropped'
}

function p(arr, pct) { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length * pct / 100)] || 0 }

async function main() {
  console.log(`\n🚀 MASSIVE LOAD TEST: ${NUM_STUDENTS} students\n`)
  console.log(`Competition ID: ${COMP_ID}`)

  const supabase = createClient(BASE_URL, ANON_KEY)

  // Phase 1: Setup — create competition state + participants
  console.log('\n📋 Phase 1: Setting up test data...')

  // Use auth to set up (need admin token)
  const { data: authData } = await supabase.auth.signInWithPassword({ email: 'admin@wordee.app', password: 'WordeeAdmin2026!' })
  if (!authData?.session) { console.error('Admin login failed'); process.exit(1) }

  // Create/update competition state
  await supabase.from('competition_state').upsert({ id: 'english', competition_id: COMP_ID, is_unlocked: true, duration_seconds: 300, extra_seconds: 0 }, { onConflict: 'id' })

  // Generate participants
  const students = []
  for (let i = 0; i < NUM_STUDENTS; i++) {
    const level = LEVELS[i % LEVELS.length]
    students.push({
      competition_id: COMP_ID,
      participant_code: genCode(),
      display_id: `LT-${String(i + 1).padStart(4, '0')}`,
      name: `Student ${i + 1}`,
      school: `School ${(i % 20) + 1}`,
      country: ['th', 'jp', 'kr', 'us', 'fr', 'cn', 'gb', 'au', 'de', 'sg'][i % 10],
      subject: 'english',
      level,
    })
  }

  // Insert in batches
  for (let i = 0; i < students.length; i += 100) {
    const batch = students.slice(i, i + 100)
    const { error } = await supabase.from('competition_sessions').insert(batch)
    if (error) { console.error(`Insert batch ${i} failed:`, error.message); process.exit(1) }
    process.stdout.write(`  Registered ${Math.min(i + 100, students.length)}/${students.length}\r`)
  }
  console.log(`  ✅ ${students.length} participants registered`)

  // Seed answer keys for this competition
  for (const lvl of LEVELS) {
    const count = QUESTIONS_PER_LEVEL[lvl]
    const keys = []
    for (let i = 1; i <= count; i++) {
      keys.push({ question_id: `eng_l${lvl}_${String(i).padStart(3, '0')}`, subject: 'english', level: lvl, correct_answer: 'CorrectPlaceholder', competition_id: COMP_ID })
    }
    for (let i = 0; i < keys.length; i += 100) {
      await supabase.from('answer_keys').upsert(keys.slice(i, i + 100), { onConflict: 'question_id,competition_id' })
    }
  }
  console.log('  ✅ Answer keys seeded')

  // Phase 2: Run the simulation
  console.log('\n🏁 Phase 2: Running simulation...\n')
  const startTime = Date.now()
  const outcomes = { completed: 0, completed_fast: 0, dropped: 0, never_joined: 0, join_failed: 0, submit_failed: 0 }

  // Assign scenarios
  const scenarios = students.map((s, i) => {
    const r = Math.random()
    if (r < 0.05) return { ...s, scenario: 'never_join' }
    if (r < 0.15) return { ...s, scenario: 'dropout' }
    if (r < 0.30) return { ...s, scenario: 'fast' }
    return { ...s, scenario: 'normal' }
  })

  // Process in batches
  for (let i = 0; i < scenarios.length; i += BATCH_SIZE) {
    const batch = scenarios.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(async s => {
      if (s.scenario === 'never_join') return 'never_joined'
      if (s.scenario === 'dropout') return simulateDropout(s.participant_code, s.level)
      if (s.scenario === 'fast') return simulateFast(s.participant_code, s.level)
      return simulateNormal(s.participant_code, s.level)
    }))
    results.forEach(r => { outcomes[r] = (outcomes[r] || 0) + 1 })
    const pct = Math.round(((i + batch.length) / scenarios.length) * 100)
    process.stdout.write(`  Progress: ${i + batch.length}/${scenarios.length} (${pct}%)\r`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n\n✅ Simulation complete in ${elapsed}s\n`)

  // Phase 3: Results
  console.log('=== OUTCOMES ===')
  for (const [k, v] of Object.entries(outcomes)) console.log(`  ${k}: ${v}`)

  console.log('\n=== API PERFORMANCE ===\n')
  for (const [name, s] of Object.entries(stats)) {
    const total = s.ok + s.err
    if (total === 0) continue
    console.log(`${name.toUpperCase()}:`)
    console.log(`  Requests: ${total}  OK: ${s.ok}  Errors: ${s.err}  Error rate: ${((s.err / total) * 100).toFixed(1)}%`)
    console.log(`  p50: ${p(s.times, 50)}ms  p95: ${p(s.times, 95)}ms  p99: ${p(s.times, 99)}ms  Max: ${Math.max(...s.times)}ms`)
    console.log()
  }

  const totalReqs = Object.values(stats).reduce((a, s) => a + s.ok + s.err, 0)
  const totalErrs = Object.values(stats).reduce((a, s) => a + s.err, 0)
  console.log(`TOTAL: ${totalReqs} requests, ${totalErrs} errors (${((totalErrs / totalReqs) * 100).toFixed(1)}%)`)
  console.log(`Throughput: ${(totalReqs / parseFloat(elapsed)).toFixed(1)} req/s`)

  // Phase 4: Data integrity check
  console.log('\n=== DATA INTEGRITY ===\n')
  const { data: sessions } = await supabase.from('competition_sessions').select('status, validated_score, level').eq('competition_id', COMP_ID)
  const byStatus = {}
  sessions.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1 })
  console.log('Session statuses:', byStatus)

  const completed = sessions.filter(s => s.status === 'completed')
  console.log(`Completed with score: ${completed.filter(s => s.validated_score != null).length}/${completed.length}`)
  console.log(`Average score (completed): ${completed.length ? (completed.reduce((a, s) => a + (s.validated_score || 0), 0) / completed.length).toFixed(1) : 'N/A'}`)

  const { count: subCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).in('participant_id', sessions.filter(s => s.status === 'completed').map(s => s.participant_id || '').slice(0, 100))
  console.log(`Submission audit rows (sample): ${subCount}`)

  // Cleanup
  console.log('\n🧹 Cleaning up test data...')
  await supabase.from('submissions').delete().in('participant_id', sessions.map(s => s.participant_id || ''))

  // Delete in batches (can't delete 1000 at once reliably)
  for (let i = 0; i < students.length; i += 100) {
    const codes = students.slice(i, i + 100).map(s => s.participant_code)
    await supabase.from('competition_sessions').delete().eq('competition_id', COMP_ID).in('participant_code', codes)
  }
  await supabase.from('answer_keys').delete().eq('competition_id', COMP_ID)
  await supabase.from('competition_state').update({ competition_id: 'default', is_unlocked: false, extra_seconds: 0 }).eq('id', 'english')

  console.log('✅ Test data cleaned up\n')
}

main().catch(e => { console.error('Test failed:', e); process.exit(1) })
