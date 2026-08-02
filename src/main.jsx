import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

async function handleChunkError() {
  const key = 'chunk_reload'
  const count = parseInt(sessionStorage.getItem(key) || '0', 10)
  if (count >= 2) {
    sessionStorage.removeItem(key)
    return
  }
  sessionStorage.setItem(key, String(count + 1))
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map(r => r.unregister()))
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
  }
  window.location.reload()
}

window.addEventListener('error', (e) => {
  if (e.message?.includes('MIME type') || e.message?.includes('dynamically imported module')) {
    e.preventDefault()
    handleChunkError()
  }
})

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason)
  if (msg.includes('dynamically imported module') || msg.includes('MIME type') || msg.includes('Failed to fetch')) {
    e.preventDefault()
    handleChunkError()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
