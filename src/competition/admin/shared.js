export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export function isOnline(s) {
  return s.last_seen_at && (Date.now() - new Date(s.last_seen_at).getTime()) < 15_000
}

export function fmt(sec) {
  if (sec == null) return '-'
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
