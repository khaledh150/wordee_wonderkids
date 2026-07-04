export function generateCode(existingCodes = []) {
  const used = new Set(existingCodes)
  let code
  let attempts = 0
  do {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000
    code = String(n).padStart(4, '0')
    if (++attempts > 100) throw new Error('Code space exhausted')
  } while (used.has(code))
  return code
}

export function isOnline(s) {
  return s.last_seen_at && (Date.now() - new Date(s.last_seen_at).getTime()) < 15_000
}

export function fmt(sec) {
  if (sec == null) return '-'
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
