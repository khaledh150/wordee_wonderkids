/**
 * Generate SQL INSERT statements for competition_sessions from a roster JSON file.
 * Also outputs a codes manifest JSON (for printing sticker cards).
 * Paste the SQL output into Supabase SQL Editor — no service role key needed.
 *
 * Usage:
 *   node scripts/loadRoster.js <path-to-json> <competition_id>
 *   node scripts/loadRoster.js <path-to-json> <competition_id> > seed-roster.sql
 *
 * JSON format (array) — one row per student, both subject levels:
 *   [
 *     {
 *       "name": "Somchai K.",
 *       "display_id": "TH-001",
 *       "school": "Bangkok International School",
 *       "country": "th",
 *       "english_level": 2,
 *       "math_level": 1,
 *       "participant_code": ""  // leave blank to auto-generate 6-char code
 *     },
 *     ...
 *   ]
 */

import { readFileSync, writeFileSync } from 'fs'
import { randomBytes } from 'crypto'

function generateCode() {
  const n = randomBytes(2).readUInt16BE(0) % 10000
  return String(n).padStart(4, '0')
}

function escapeSql(str) {
  if (str == null) return 'NULL'
  return `'${String(str).replace(/'/g, "''")}'`
}

function main() {
  const [jsonPath, competitionId] = process.argv.slice(2)
  if (!jsonPath || !competitionId) {
    console.error('Usage: node scripts/loadRoster.js <path-to-json> <competition_id>')
    console.error('Example: node scripts/loadRoster.js scripts/examples/sample-roster.json 2026-08-finals')
    process.exit(1)
  }

  let raw
  try {
    raw = JSON.parse(readFileSync(jsonPath, 'utf8'))
  } catch (err) {
    console.error(`Failed to read/parse ${jsonPath}:`, err.message)
    process.exit(1)
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    console.error('JSON must be a non-empty array of participant objects.')
    process.exit(1)
  }

  const usedCodes = new Set()
  const participants = []
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!item.name) {
      console.error(`Row ${i} missing name:`, item)
      process.exit(1)
    }

    let code = item.participant_code?.trim()
    if (!code) {
      do { code = generateCode() } while (usedCodes.has(code))
    }
    usedCodes.add(code)

    const base = {
      competition_id: competitionId,
      participant_code: code,
      display_id: item.display_id || `${(item.country || 'XX').toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      name: item.name,
      school: item.school || null,
      country: item.country?.toLowerCase() || null,
    }

    if (item.english_level) {
      participants.push({ ...base, subject: 'english', level: Number(item.english_level) })
    }
    if (item.math_level) {
      participants.push({ ...base, subject: 'math', level: Number(item.math_level) })
    }
    if (!item.english_level && !item.math_level && item.subject && item.level) {
      participants.push({ ...base, subject: item.subject, level: Number(item.level) })
    }
  }

  // Output SQL to stdout
  console.log(`-- Roster for competition: ${competitionId}`)
  console.log(`-- Generated: ${new Date().toISOString()}`)
  console.log(`-- Total: ${participants.length} participants\n`)
  console.log(`INSERT INTO competition_sessions (competition_id, participant_code, display_id, name, school, country, subject, level)`)
  console.log(`VALUES`)

  const values = participants.map(p =>
    `  (${escapeSql(p.competition_id)}, ${escapeSql(p.participant_code)}, ${escapeSql(p.display_id)}, ${escapeSql(p.name)}, ${escapeSql(p.school)}, ${escapeSql(p.country)}, ${escapeSql(p.subject)}, ${p.level})`
  )
  console.log(values.join(',\n'))
  console.log(`ON CONFLICT (participant_code, competition_id, subject) DO UPDATE SET`)
  console.log(`  display_id = EXCLUDED.display_id,`)
  console.log(`  name = EXCLUDED.name,`)
  console.log(`  school = EXCLUDED.school,`)
  console.log(`  country = EXCLUDED.country,`)
  console.log(`  level = EXCLUDED.level;`)

  // Write codes manifest to a JSON file (for printCodes.js)
  const manifest = participants.map(p => ({
    name: p.name,
    display_id: p.display_id,
    school: p.school,
    country: p.country,
    subject: p.subject,
    level: p.level,
    participant_code: p.participant_code,
  }))

  const manifestPath = jsonPath.replace(/\.json$/, '') + '-codes.json'
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.error(`\nCode manifest saved to: ${manifestPath}`)
  console.error(`Use: node scripts/printCodes.js ${manifestPath} https://your-app.vercel.app/play`)
  console.error(`\nCopy the SQL above into Supabase SQL Editor and run it.`)
}

main()
