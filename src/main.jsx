import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e) {
  document.getElementById('root').innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#3D2C4E;text-align:center;padding:2rem"><div><h2>Oops!</h2><p>Please update your browser or try opening in Safari/Chrome.</p><p style="font-size:12px;color:#999">' + e.message + '</p></div></div>'
}
