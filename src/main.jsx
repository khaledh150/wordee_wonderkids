import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

window.addEventListener('error', (e) => {
  if (e.message?.includes('MIME type') || e.message?.includes('dynamically imported module')) {
    e.preventDefault()
    if (!sessionStorage.getItem('chunk_reload')) {
      sessionStorage.setItem('chunk_reload', '1')
      window.location.reload()
    }
  }
})

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason)
  if (msg.includes('dynamically imported module') || msg.includes('MIME type') || msg.includes('Failed to fetch')) {
    e.preventDefault()
    if (!sessionStorage.getItem('chunk_reload')) {
      sessionStorage.setItem('chunk_reload', '1')
      window.location.reload()
    }
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
