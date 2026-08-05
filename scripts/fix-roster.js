/**
 * Fix roster issues:
 * 1. Change "Pattaya" school to correct Thai name for Kunchai Christian school
 * 2. Reset ALL participant codes to 4-digit numeric (1000-9999)
 *
 * Usage: node scripts/fix-roster.js [--dry-run]
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

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

const dryRun = process.argv.includes('--dry-run')
const BASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!BASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(BASE_URL, SERVICE_KEY)

async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log('  ROSTER FIX: School names + 4-digit numeric codes')
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('='.repeat(60))

  // 1. Load all sessions (paginated to avoid 1000-row limit)
  let allSessions = []
  let page = 0
  const PAGE_SIZE = 1000
  while (true) {
    const { data, error: pageErr } = await supabase
      .from('competition_sessions')
      .select('participant_id, participant_code, name, school, subject, level, status')
      .order('name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (pageErr) { console.error('Failed to load sessions:', pageErr.message); process.exit(1) }
    if (!data || data.length === 0) break
    allSessions.push(...data)
    if (data.length < PAGE_SIZE) break
    page++
  }
  const error = null

  if (error) { console.error('Failed to load sessions:', error.message); process.exit(1) }
  console.log(`\n  Total sessions: ${allSessions.length}`)

  // 2. Fix school names: "Pattaya" → "โรงเรียนกุลชาติคริสเตียน" (Kunchai Christian School in Thai)
  const pattayaSessions = allSessions.filter(s => s.school === 'Pattaya')
  console.log(`\n  Sessions with "Pattaya" school: ${pattayaSessions.length}`)

  if (pattayaSessions.length > 0) {
    // Show what will change
    const uniqueNames = [...new Set(pattayaSessions.map(s => s.name))].slice(0, 10)
    console.log(`  Sample students: ${uniqueNames.join(', ')}`)

    if (!dryRun) {
      const pattayaIds = pattayaSessions.map(s => s.participant_id)
      for (let i = 0; i < pattayaIds.length; i += 200) {
        const batch = pattayaIds.slice(i, i + 200)
        const { error: updateErr } = await supabase
          .from('competition_sessions')
          .update({ school: 'โรงเรียนกุญชัยคริสเตียน' })
          .in('participant_id', batch)
        if (updateErr) console.error(`  Batch ${i} school update error:`, updateErr.message)
      }
      console.log(`  ✓ Fixed ${pattayaSessions.length} sessions: Pattaya → โรงเรียนกุญชัยคริสเตียน`)
    } else {
      console.log(`  [dry-run] Would fix ${pattayaSessions.length} sessions`)
    }
  }

  // 2b. Delete SimStudent entries
  const simSessions = allSessions.filter(s => s.name && s.name.startsWith('SimStudent'))
  console.log(`\n  SimStudent sessions to delete: ${simSessions.length}`)
  if (simSessions.length > 0 && !dryRun) {
    const simIds = simSessions.map(s => s.participant_id)
    // Delete submissions first
    for (let i = 0; i < simIds.length; i += 200) {
      const batch = simIds.slice(i, i + 200)
      await supabase.from('submissions').delete().in('participant_id', batch)
    }
    // Delete sessions
    for (let i = 0; i < simIds.length; i += 200) {
      const batch = simIds.slice(i, i + 200)
      const { error: delErr } = await supabase
        .from('competition_sessions')
        .delete()
        .in('participant_id', batch)
      if (delErr) console.error(`  Batch ${i} delete error:`, delErr.message)
    }
    console.log(`  ✓ Deleted ${simSessions.length} SimStudent sessions`)
    // Remove from allSessions for code fixing
    const simIdSet = new Set(simIds)
    allSessions.splice(0, allSessions.length, ...allSessions.filter(s => !simIdSet.has(s.participant_id)))
    console.log(`  Remaining sessions: ${allSessions.length}`)
  } else if (simSessions.length > 0) {
    console.log(`  [dry-run] Would delete ${simSessions.length} SimStudent sessions`)
  }

  // 3. Fix participant codes: all must be 4-digit numeric (1000-9999)
  // Group by participant_code to handle both subjects for the same student
  const codeToSessions = new Map()
  for (const s of allSessions) {
    if (!codeToSessions.has(s.participant_code)) codeToSessions.set(s.participant_code, [])
    codeToSessions.get(s.participant_code).push(s)
  }

  const uniqueCodes = [...codeToSessions.keys()]
  const numericPattern = /^\d{4}$/
  const badCodes = uniqueCodes.filter(c => !numericPattern.test(c))
  const goodCodes = new Set(uniqueCodes.filter(c => numericPattern.test(c)))

  console.log(`\n  Unique participant codes: ${uniqueCodes.length}`)
  console.log(`  Already 4-digit numeric: ${goodCodes.size}`)
  console.log(`  Need fixing: ${badCodes.length}`)

  if (badCodes.length > 0) {
    console.log(`\n  Bad codes (sample):`)
    badCodes.slice(0, 20).forEach(c => {
      const sessions = codeToSessions.get(c)
      console.log(`    ${c} → ${sessions[0].name} (${sessions.length} sessions)`)
    })

    // Generate new 4-digit codes avoiding existing ones
    const usedCodes = new Set(goodCodes)
    const newCodeMap = new Map()

    for (const oldCode of badCodes) {
      let newCode
      do {
        newCode = String(1000 + Math.floor(Math.random() * 9000))
      } while (usedCodes.has(newCode))
      usedCodes.add(newCode)
      newCodeMap.set(oldCode, newCode)
    }

    console.log(`\n  Code remapping (sample):`)
    let count = 0
    for (const [old, nw] of newCodeMap) {
      if (count++ >= 15) { console.log(`    ... and ${newCodeMap.size - 15} more`); break }
      const name = codeToSessions.get(old)[0].name
      console.log(`    ${old} → ${nw}  (${name})`)
    }

    if (!dryRun) {
      let fixed = 0
      for (const [oldCode, newCode] of newCodeMap) {
        const sessions = codeToSessions.get(oldCode)
        const ids = sessions.map(s => s.participant_id)
        const { error: codeErr } = await supabase
          .from('competition_sessions')
          .update({ participant_code: newCode })
          .in('participant_id', ids)
        if (codeErr) {
          console.error(`  Error updating ${oldCode} → ${newCode}:`, codeErr.message)
        } else {
          fixed += sessions.length
        }
      }
      console.log(`\n  ✓ Fixed ${fixed} session records (${newCodeMap.size} unique codes)`)
    } else {
      const totalSessions = badCodes.reduce((sum, c) => sum + codeToSessions.get(c).length, 0)
      console.log(`\n  [dry-run] Would fix ${totalSessions} session records (${badCodes.length} unique codes)`)
    }
  }

  // 4. Final verification
  if (!dryRun) {
    const { data: verify } = await supabase
      .from('competition_sessions')
      .select('participant_code, school')

    if (verify) {
      const stillBadCodes = verify.filter(s => !numericPattern.test(s.participant_code))
      const stillPattaya = verify.filter(s => s.school === 'Pattaya')
      console.log(`\n  VERIFICATION:`)
      console.log(`    Non-4-digit codes remaining: ${stillBadCodes.length}`)
      console.log(`    "Pattaya" schools remaining: ${stillPattaya.length}`)
      if (stillBadCodes.length === 0 && stillPattaya.length === 0) {
        console.log(`    ✓ ALL CLEAN`)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('  Done.\n')
}

main().catch(e => { console.error('Script failed:', e); process.exit(1) })
