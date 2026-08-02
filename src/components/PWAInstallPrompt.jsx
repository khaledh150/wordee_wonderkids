import { useState, useEffect, useRef } from 'react'
import { Download, X } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false)
  const deferredRef = useRef(null)

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_install_dismissed')
    if (dismissed && Date.now() - Number(dismissed) < 30 * 24 * 60 * 60 * 1000) return

    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e) => {
      e.preventDefault()
      deferredRef.current = e
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredRef.current) return
    deferredRef.current.prompt()
    const result = await deferredRef.current.userChoice
    if (result.outcome === 'accepted') setShow(false)
    deferredRef.current = null
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('pwa_install_dismissed', String(Date.now()))
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9997] mx-auto max-w-sm bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral-400 to-pink-500 flex items-center justify-center shrink-0">
        <Download size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Install WonderKids</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Add to home screen for the best experience</p>
      </div>
      <button onClick={handleInstall} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shrink-0">
        Install
      </button>
      <button onClick={handleDismiss} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0">
        <X size={18} />
      </button>
    </div>
  )
}
