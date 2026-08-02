const MAX_ERRORS = 20
const STORAGE_KEY = 'wonderkids_errors'
let lastReportedAt = 0

function getErrors() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
}

function saveErrors(errors) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(errors.slice(-MAX_ERRORS))) } catch {}
}

export function reportError(error, context = '') {
  const entry = {
    message: error?.message || String(error),
    stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    context,
    ts: new Date().toISOString(),
    url: window.location.pathname,
  }
  const errors = getErrors()
  errors.push(entry)
  saveErrors(errors)
}

export function getRecentErrors() {
  return getErrors()
}

export function clearErrors() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
}
