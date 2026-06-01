/**
 * Generate answer_keys SQL from the app's vocabulary data.
 * Each vocab word becomes a question — the correct_answer is the word itself.
 * question_id format: eng_l{level}_{index} (e.g., eng_l1_001)
 *
 * Usage:
 *   node scripts/generateAnswerKeys.js <competition_id>
 *   node scripts/generateAnswerKeys.js <competition_id> > seed-answers.sql
 */

// We can't import ESM from the app directly (it uses Vite's import.meta),
// so we inline the vocab words per level here.
// To regenerate: copy word lists from src/data/vocabulary.js

import { readFileSync } from 'fs'

function extractWords() {
  const src = readFileSync('src/data/vocabulary.js', 'utf8')
  const rawLevels = {}
  const parts = src.split(/^\s*(\d+):\s*\[/m)
  for (let i = 1; i < parts.length; i += 2) {
    const levelId = parseInt(parts[i])
    const block = parts[i + 1]
    const words = []
    let m
    const re = /w\((?:'([^']*)'|"([^"]*)")/g
    while ((m = re.exec(block)) !== null) {
      words.push(m[1] || m[2])
    }
    if (words.length > 0) rawLevels[levelId] = words
  }

  // Match getVocabForLevel logic: Level 1 includes Level 2 words
  const levels = {}
  for (const [id, words] of Object.entries(rawLevels)) {
    const lvl = parseInt(id)
    if (lvl === 1) {
      levels[1] = [...(rawLevels[1] || []), ...(rawLevels[2] || [])]
    } else {
      levels[lvl] = words
    }
  }
  return levels
}

function escapeSql(str) {
  return String(str).replace(/'/g, "''")
}

function main() {
  const competitionId = process.argv[2]
  if (!competitionId) {
    console.error('Usage: node scripts/generateAnswerKeys.js <competition_id>')
    process.exit(1)
  }

  const levels = extractWords()
  const allRows = []

  for (const [levelId, words] of Object.entries(levels)) {
    for (let i = 0; i < words.length; i++) {
      allRows.push({
        question_id: `eng_l${levelId}_${String(i + 1).padStart(3, '0')}`,
        subject: 'english',
        level: parseInt(levelId),
        correct_answer: words[i],
        competition_id: competitionId,
      })
    }
  }

  console.log(`-- Answer keys for competition: ${competitionId}`)
  console.log(`-- Generated from src/data/vocabulary.js`)
  console.log(`-- Total: ${allRows.length} keys across ${Object.keys(levels).length} levels\n`)

  console.log(`INSERT INTO answer_keys (question_id, subject, level, correct_answer, competition_id)`)
  console.log(`VALUES`)
  const values = allRows.map(r =>
    `  ('${escapeSql(r.question_id)}', '${escapeSql(r.subject)}', ${r.level}, '${escapeSql(r.correct_answer)}', '${escapeSql(r.competition_id)}')`
  )
  console.log(values.join(',\n'))
  console.log(`ON CONFLICT (question_id, competition_id) DO UPDATE SET`)
  console.log(`  correct_answer = EXCLUDED.correct_answer,`)
  console.log(`  subject = EXCLUDED.subject,`)
  console.log(`  level = EXCLUDED.level;`)

  // Summary
  for (const [levelId, words] of Object.entries(levels)) {
    console.error(`Level ${levelId}: ${words.length} words`)
  }
  console.error(`Total: ${allRows.length} answer keys`)
}

main()
