/**
 * Generate SQL INSERT statements for answer_keys from a JSON file.
 * Paste the output into Supabase SQL Editor — no service role key needed.
 *
 * Usage:
 *   node scripts/loadAnswerKeys.js <path-to-json> <competition_id>
 *
 * JSON format (array):
 *   [
 *     { "question_id": "eng_l1_001", "subject": "english", "level": 1, "correct_answer": "apple" },
 *     ...
 *   ]
 *
 * Example:
 *   node scripts/loadAnswerKeys.js scripts/examples/sample-answer-keys.json 2026-08-finals
 *   node scripts/loadAnswerKeys.js scripts/examples/sample-answer-keys.json 2026-08-finals > seed-answers.sql
 */

import { readFileSync } from 'fs'

function escapeSql(str) {
  return String(str).replace(/'/g, "''")
}

function main() {
  const [jsonPath, competitionId] = process.argv.slice(2)
  if (!jsonPath || !competitionId) {
    console.error('Usage: node scripts/loadAnswerKeys.js <path-to-json> <competition_id>')
    console.error('Example: node scripts/loadAnswerKeys.js scripts/examples/sample-answer-keys.json 2026-08-finals')
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
    console.error('JSON must be a non-empty array of answer key objects.')
    process.exit(1)
  }

  const rows = raw.map((item, i) => {
    if (!item.question_id || !item.subject || item.level == null || !item.correct_answer) {
      console.error(`Row ${i} missing required fields (question_id, subject, level, correct_answer):`, item)
      process.exit(1)
    }
    return item
  })

  console.log(`-- Answer keys for competition: ${competitionId}`)
  console.log(`-- Generated: ${new Date().toISOString()}`)
  console.log(`-- Total: ${rows.length} keys\n`)
  console.log(`INSERT INTO answer_keys (question_id, subject, level, correct_answer, competition_id)`)
  console.log(`VALUES`)

  const values = rows.map(r =>
    `  ('${escapeSql(r.question_id)}', '${escapeSql(r.subject)}', ${Number(r.level)}, '${escapeSql(r.correct_answer)}', '${escapeSql(competitionId)}')`
  )
  console.log(values.join(',\n'))
  console.log(`ON CONFLICT (question_id, competition_id) DO UPDATE SET`)
  console.log(`  correct_answer = EXCLUDED.correct_answer,`)
  console.log(`  subject = EXCLUDED.subject,`)
  console.log(`  level = EXCLUDED.level;`)

  console.error(`\n-- Done. ${rows.length} answer keys. Copy the SQL above into Supabase SQL Editor and run it.`)
}

main()
