import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const goOff = () => { setOffline(true); setDismissed(false) }
    const goOn = () => { setTimeout(() => setOffline(false), 3000) }
    window.addEventListener('offline', goOff)
    window.addEventListener('online', goOn)
    return () => { window.removeEventListener('offline', goOff); window.removeEventListener('online', goOn) }
  }, [])

  if (!offline || dismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-amber-500 text-amber-950 text-center py-2 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-md">
      <WifiOff size={16} />
      <span>You're offline — some features may not work</span>
      <button onClick={() => setDismissed(true)} className="ml-2 text-amber-800 hover:text-amber-950 font-bold text-xs">&times;</button>
    </div>
  )
}
