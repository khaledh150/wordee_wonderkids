import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import SplashScreen from './components/SplashScreen'
import LevelSelect from './components/LevelSelect'
import ModeSelect from './components/ModeSelect'
import LoadingScreen from './components/LoadingScreen'
import { stopAll, clearIdleTimer } from './utils/audioPlayer'
import InAppBrowserGuard from './components/InAppBrowserGuard'

const LearnMode = lazy(() => import('./components/LearnMode'))
const PracticeMode = lazy(() => import('./components/PracticeMode'))

export const APP_VERSION = '1.4.2'
const PRESERVED_KEYS = ['wordee_progress', 'last_wordee_version']

function writeHash(screen, level) {
  let hash = `s=${screen}`
  if (level != null) hash += `&l=${level}`
  window.location.hash = hash
}

function App() {
  const [screen, setScreen] = useState('splash')
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [mode, setMode] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const prev = localStorage.getItem('last_wordee_version')
    if (prev && prev !== APP_VERSION) {
      const preserved = {}
      PRESERVED_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v) preserved[k] = v })
      localStorage.clear()
      Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v))
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
      }
    }
    localStorage.setItem('last_wordee_version', APP_VERSION)
  }, [])

  useEffect(() => {
    async function checkForUpdate() {
      try {
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data.version && data.version !== APP_VERSION) {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations()
            for (const r of regs) await r.unregister()
          }
          if ('caches' in window) {
            const keys = await caches.keys()
            for (const k of keys) await caches.delete(k)
          }
          window.location.reload()
        }
      } catch {}
    }
    checkForUpdate()
    const id = setInterval(checkForUpdate, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate() }
    window.addEventListener('focus', checkForUpdate)
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); window.removeEventListener('focus', checkForUpdate); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  useEffect(() => {
    if (screen !== 'splash') writeHash(screen, selectedLevel)
  }, [screen, selectedLevel])

  const navigate = useCallback((to, opts = {}) => {
    stopAll()
    clearIdleTimer()
    if (opts.level !== undefined) setSelectedLevel(opts.level)
    if (opts.mode !== undefined) setMode(opts.mode)
    if (to === 'learn' || to === 'practice') {
      setLoading(true)
      setTimeout(() => { setLoading(false); setScreen(to) }, 1200)
    } else {
      setScreen(to)
    }
  }, [])

  const goHome = useCallback(() => navigate('levels'), [navigate])
  const goBack = useCallback(() => {
    if (screen === 'learn' || screen === 'practice') navigate('mode', { level: selectedLevel })
    else if (screen === 'mode') navigate('levels')
    else navigate('levels')
  }, [screen, selectedLevel, navigate])

  if (loading) return <LoadingScreen />

  return (
    <InAppBrowserGuard>
    <div className="w-full h-screen-safe overflow-hidden relative">
      <AnimatePresence mode="wait">
        {screen === 'splash' && (
          <SplashScreen key="splash" onDone={() => navigate('levels')} />
        )}
        {screen === 'levels' && (
          <LevelSelect
            key="levels"
            onSelect={(lvl) => navigate('mode', { level: lvl })}
          />
        )}
        {screen === 'mode' && (
          <ModeSelect
            key="mode"
            level={selectedLevel}
            onSelect={(m) => navigate(m, { mode: m })}
            onBack={goHome}
          />
        )}
        {screen === 'learn' && (
          <Suspense fallback={<LoadingScreen />}>
            <LearnMode
              key="learn"
              level={selectedLevel}
              onBack={goBack}
              onHome={goHome}
            />
          </Suspense>
        )}
        {screen === 'practice' && (
          <Suspense fallback={<LoadingScreen />}>
            <PracticeMode
              key="practice"
              level={selectedLevel}
              onBack={goBack}
              onHome={goHome}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
    </InAppBrowserGuard>
  )
}

export default App
