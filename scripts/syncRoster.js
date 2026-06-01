/**
 * Sync competition-roster.json to Supabase.
 * Reads the local file, generates codes, and outputs SQL.
 *
 * Usage:
 *   node scripts/syncRoster.js [competition_id]
 *   node scripts/syncRoster.js default > sync.sql
 *
 * Then paste the SQL into Supabase SQL Editor, or pipe to the MCP tool.
 *
 * Edit competition-roster.json to add/remove students.
 * Run this script again to regenerate the SQL.
 */

import { readFileSync } from 'fs'
import { randomBytes } from 'crypto'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode() {
  const bytes = randomBytes(6)
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return code
}

function escapeSql(str) {
  if (str == null || str === '') return 'NULL'
  return `'${String(str).replace(/'/g, "''")}'`
}

function main() {
  const competitionId = process.argv[2] || 'default'

  let roster
  try {
    roster = JSON.parse(readFileSync('competition-roster.json', 'utf8'))
  } catch (err) {
    console.error('Failed to read competition-roster.json:', err.message)
    process.exit(1)
  }

  if (!Array.isArray(roster) || roster.length === 0) {
    console.error('competition-roster.json must be a non-empty array.')
    process.exit(1)
  }

  const usedCodes = new Set()
  const students = roster.map((s, i) => {
    let code
    do { code = generateCode() } while (usedCodes.has(code))
    usedCodes.add(code)
    return {
      code,
      display_id: `${(s.country || 'XX').toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      name: s.name,
      school: s.school || null,
      country: (s.country || '').toLowerCase() || null,
      subject: s.subject || 'english',
      level: s.level || 1,
    }
  })

  // Output SQL
  console.log(`-- Roster sync for competition: ${competitionId}`)
  console.log(`-- Source: competition-roster.json (${students.length} students)`)
  console.log(`-- Generated: ${new Date().toISOString()}\n`)

  console.log(`-- Clear existing students for this competition`)
  console.log(`DELETE FROM submissions WHERE participant_id IN (SELECT participant_id FROM competition_sessions WHERE competition_id = '${competitionId}');`)
  console.log(`DELETE FROM competition_sessions WHERE competition_id = '${competitionId}';\n`)

  console.log(`INSERT INTO competition_sessions (competition_id, participant_code, display_id, name, school, country, subject, level)`)
  console.log(`VALUES`)
  const values = students.map(s =>
    `  ('${competitionId}', '${s.code}', '${s.display_id}', ${escapeSql(s.name)}, ${escapeSql(s.school)}, ${escapeSql(s.country)}, '${s.subject}', ${s.level})`
  )
  console.log(values.join(',\n') + ';\n')

  // Print code list to stderr (visible even when stdout is piped)
  console.error(`\n=== PARTICIPANT CODES (${students.length} students) ===\n`)
  console.error('Code     | Name                | Level | School')
  console.error('-'.repeat(70))
  for (const s of students) {
    console.error(`${s.code} | ${(s.name || '').padEnd(19)} | L${s.level}    | ${s.school || '-'}`)
  }
  console.error('')
}

main()
