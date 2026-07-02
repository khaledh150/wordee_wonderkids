import { getVocabForLevel } from '../data/vocabulary'

// Maps vocab items to competition question format.
// question_id matches the server's answer_keys format: eng_l{level}_{index}
// The correct_answer is the word itself (matched server-side).
export function getCompetitionQuestions(level) {
  const vocab = getVocabForLevel(level)
  return vocab.map((item, i) => ({
    question_id: `eng_l${level}_${String(i + 1).padStart(3, '0')}`,
    word: item.word,
    thai: item.thai,
    image: item.image,
    audio: item.audio,
  }))
}

// Get all vocab items for a level (needed by MultipleChoice for generating wrong choices)
export function getAllVocabForLevel(level) {
  return getVocabForLevel(level)
}
