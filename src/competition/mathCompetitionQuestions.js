import { getExamQuestions } from '../data/mathQuestionBank'
import { seededShuffle } from './seededShuffle'

export function getMathCompetitionQuestions(level, participantId) {
  const safeLevel = Math.max(1, Math.min(8, Math.floor(level)))
  const bank = getExamQuestions(safeLevel)
  return bank.map((q, i) => {
    const allChoices = [q.answer, ...q.distractors]
    const choices = participantId
      ? seededShuffle(allChoices, participantId + '_' + i)
      : allChoices
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
