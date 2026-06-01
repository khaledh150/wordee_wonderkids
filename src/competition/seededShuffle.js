// Mulberry32 — a simple, fast seeded PRNG
function mulberry32(seed) {
  let s = seed | 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Convert a UUID string to an integer seed
function uuidToSeed(uuid) {
  let hash = 0
  for (let i = 0; i < uuid.length; i++) {
    hash = ((hash << 5) - hash + uuid.charCodeAt(i)) | 0
  }
  return hash
}

// Fisher-Yates shuffle with a seeded PRNG — deterministic for a given participant_id
export function seededShuffle(items, participantId) {
  const rng = mulberry32(uuidToSeed(participantId))
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
