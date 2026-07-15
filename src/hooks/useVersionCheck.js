import { useEffect } from 'react'
import { APP_VERSION } from '../App'

export default function useVersionCheck() {
  useEffect(() => {
    let checking = false
    async function checkForUpdate() {
      if (checking) return
      checking = true
      try {
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data.version && data.version !== APP_VERSION) {
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
      } catch {} finally { checking = false }
    }
    checkForUpdate()
    const id = setInterval(checkForUpdate, 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate() }
    window.addEventListener('focus', checkForUpdate)
    document.addEventListener('visibilitychange', onVisible)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          reg.update()
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing
            if (sw) sw.addEventListener('statechange', () => {
              if (sw.state === 'activated') checkForUpdate()
            })
          })
        }
      })
    }
    return () => { clearInterval(id); window.removeEventListener('focus', checkForUpdate); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
}
