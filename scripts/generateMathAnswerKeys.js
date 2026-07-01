/**
 * Generate answer_keys SQL from the math question bank.
 * question_id format: math_l{level}_{index} (e.g., math_l1_001)
 *
 * Usage:
 *   node scripts/generateMathAnswerKeys.js <competition_id>
 *   node scripts/generateMathAnswerKeys.js <competition_id> > seed-math-answers.sql
 */

import { readFileSync } from 'fs'

function extractMathAnswers() {
  const src = readFileSync('src/data/mathQuestionBank.js', 'utf8')
  const levels = {}

  for (let level = 1; level <= 8; level++) {
    const re = new RegExp(`"${level}":\\s*\\[`)
    const match = re.exec(src)
    if (!match) continue

    const startIdx = match.index + match[0].length
    let depth = 1
    let i = startIdx
    while (i < src.length && depth > 0) {
      if (src[i] === '[') depth++
      else if (src[i] === ']') depth--
      i++
    }
    const block = src.slice(startIdx, i - 1)

    const answers = []
    const answerRe = /"answer":\s*(-?[\d.]+)/g
    let m
    while ((m = answerRe.exec(block)) !== null) {
      answers.push(m[1])
    }
    levels[level] = answers
  }
  return levels
}

function escapeSql(str) {
  return String(str).replace(/'/g, "''")
}

function main() {
  const competitionId = process.argv[2]
  if (!competitionId) {
    console.error('Usage: node scripts/generateMathAnswerKeys.js <competition_id>')
    process.exit(1)
  }

  const levels = extractMathAnswers()
  const allRows = []

  for (const [levelId, answers] of Object.entries(levels)) {
    for (let i = 0; i < answers.length; i++) {
      allRows.push({
        question_id: `math_l${levelId}_${String(i + 1).padStart(3, '0')}`,
        subject: 'math',
        level: parseInt(levelId),
        correct_answer: answers[i],
        competition_id: competitionId,
      })
    }
  }

  console.log(`-- Math answer keys for competition: ${competitionId}`)
  console.log(`-- Generated from src/data/mathQuestionBank.js`)
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

  for (const [levelId, answers] of Object.entries(levels)) {
    console.error(`Level ${levelId}: ${answers.length} questions`)
  }
  console.error(`Total: ${allRows.length} answer keys`)
}

main()
