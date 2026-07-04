/**
 * Generate answer_keys SQL from the math question bank.
 * Imports the actual module to avoid fragile regex parsing.
 *
 * Usage:
 *   node scripts/generateMathAnswerKeys.js <competition_id>
 *   node scripts/generateMathAnswerKeys.js <competition_id> > seed-math-answers.sql
 */

import { questionBank } from '../src/data/mathQuestionBank.js'

function escapeSql(str) {
  return String(str).replace(/'/g, "''")
}

function main() {
  const competitionId = process.argv[2]
  if (!competitionId) {
    console.error('Usage: node scripts/generateMathAnswerKeys.js <competition_id>')
    process.exit(1)
  }

  const allRows = []

  for (const [levelId, questions] of Object.entries(questionBank)) {
    for (let i = 0; i < questions.length; i++) {
      allRows.push({
        question_id: `math_l${levelId}_${String(i + 1).padStart(3, '0')}`,
        subject: 'math',
        level: parseInt(levelId),
        correct_answer: String(questions[i].answer),
        competition_id: competitionId,
      })
    }
    console.error(`Level ${levelId}: ${questions.length} questions`)
  }

  console.log(`-- Math answer keys for competition: ${competitionId}`)
  console.log(`-- Generated from src/data/mathQuestionBank.js`)
  console.log(`-- Total: ${allRows.length} keys across ${Object.keys(questionBank).length} levels\n`)

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

  console.error(`Total: ${allRows.length} answer keys`)
}

main()
