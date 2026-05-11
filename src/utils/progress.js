const STORAGE_KEY = 'wordee_progress'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmpty()
    return JSON.parse(raw)
  } catch {
    return createEmpty()
  }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function createEmpty() {
  return { version: 1, levels: {}, words: {}, stats: { firstSessionAt: Date.now() } }
}

export function trackWordLearned(levelId, word) {
  const data = load()
  const key = `${levelId}_${word}`
  if (!data.words[key]) data.words[key] = { learnedAt: Date.now(), practiceCount: 0 }
  save(data)
}

export function trackWordPracticed(levelId, word, correct) {
  const data = load()
  const key = `${levelId}_${word}`
  if (!data.words[key]) data.words[key] = { learnedAt: Date.now(), practiceCount: 0 }
  data.words[key].practiceCount++
  if (correct) data.words[key].lastCorrectAt = Date.now()
  save(data)
}

export function trackLevelCompleted(levelId, mode) {
  const data = load()
  if (!data.levels[levelId]) data.levels[levelId] = {}
  data.levels[levelId][`${mode}CompletedAt`] = Date.now()
  data.levels[levelId][`${mode}Count`] = (data.levels[levelId][`${mode}Count`] || 0) + 1
  save(data)
}

export function getLevelProgress(levelId) {
  const data = load()
  return data.levels[levelId] || {}
}

export function getProgressSnapshot() {
  return load()
}
