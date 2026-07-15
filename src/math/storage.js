const KEYS = {
  ANSWERS: 'mathwiz_answers',
  EXAM_PROGRESS: 'mathwiz_exam_progress',
}

function safeGet(key) {
  try {
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : null
  } catch { return null }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch { return false }
}

export function saveExamAnswers(examData) {
  safeSet(KEYS.ANSWERS, examData)
}

export function getExamAnswers() {
  return safeGet(KEYS.ANSWERS)
}

export function saveExamProgress(progress) {
  return safeSet(KEYS.EXAM_PROGRESS, progress)
}

export function getExamProgress() {
  return safeGet(KEYS.EXAM_PROGRESS)
}

export function clearExamProgress() {
  try { localStorage.removeItem(KEYS.EXAM_PROGRESS) } catch {}
}
