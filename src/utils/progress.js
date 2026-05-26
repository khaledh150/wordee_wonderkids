const STORAGE_KEY = 'wordee_progress'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmpty()
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return createEmpty()
    if (!data.words) data.words = {}
    if (!data.levels) data.levels = {}
    if (!data.stats) data.stats = { firstSessionAt: Date.now() }
    return data
  } catch {
    return createEmpty()
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    try {
      if (data.words && Object.keys(data.words).length > 500) {
        const entries = Object.entries(data.words)
        entries.sort((a, b) => (b[1].lastCorrectAt || b[1].learnedAt || 0) - (a[1].lastCorrectAt || a[1].learnedAt || 0))
        data.words = Object.fromEntries(entries.slice(0, 300))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      }
    } catch {}
  }
}

function createEmpty() {
  return { version: 1, levels: {}, words: {}, stats: { firstSessionAt: Date.now() } }
}

export function trackWordLearned(levelId, word) {
  if (!word) return
  const data = load()
  const key = `${levelId}_${word}`
  if (!data.words[key]) data.words[key] = { learnedAt: Date.now(), practiceCount: 0 }
  save(data)
}

export function trackWordPracticed(levelId, word, correct) {
  if (!word) return
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
