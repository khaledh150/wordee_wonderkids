import { getExamQuestions } from '../data/mathQuestionBank'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function getMathCompetitionQuestions(level) {
  const safeLevel = Math.max(1, Math.min(8, Math.floor(level)))
  const bank = getExamQuestions(safeLevel)
  return bank.map((q, i) => {
    const choices = shuffle([q.answer, ...q.distractors])
    return {
      question_id: `math_l${safeLevel}_${String(i + 1).padStart(3, '0')}`,
      question: q.question,
      questionEn: q.questionEn || null,
      choices,
      correctAnswer: q.answer,
      correct_answer: String(q.answer),
    }
  })
}
