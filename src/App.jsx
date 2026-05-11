import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import SplashScreen from './components/SplashScreen'
import LevelSelect from './components/LevelSelect'
import ModeSelect from './components/ModeSelect'
import LoadingScreen from './components/LoadingScreen'
import { stopAll, clearIdleTimer } from './utils/audioPlayer'

const LearnMode = lazy(() => import('./components/LearnMode'))
const PracticeMode = lazy(() => import('./components/PracticeMode'))

export const APP_VERSION = '1.1.0'
const PRESERVED_KEYS = ['wordee_progress', 'last_wordee_version']

function parseHash() {
  const hash = window.location.hash.slice(1)
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const s = params.get('s')
  const l = params.get('l')
  if (!s) return null
  return { screen: s, level: l ? Number(l) : null }
}

function writeHash(screen, level) {
  let hash = `s=${screen}`
  if (level != null) hash += `&l=${level}`
  window.location.hash = hash
}

function App() {
  const [screen, setScreen] = useState(() => {
    const restored = parseHash()
    return restored ? restored.screen : 'splash'
  })
  const [selectedLevel, setSelectedLevel] = useState(() => {
    const restored = parseHash()
    return restored ? restored.level : null
  })
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
        const res = await fetch('/version.json?t=' + Date.now())
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
    const onFocus = () => checkForUpdate()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [])

  useEffect(() => {
    if (screen !== 'splash') writeHash(screen, selectedLevel)
  }, [screen, selectedLevel])

  useEffect(() => {
    const onHashChange = () => {
      const restored = parseHash()
      if (restored) {
        stopAll()
        clearIdleTimer()
        setSelectedLevel(restored.level)
        setScreen(restored.screen)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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
    <div className="w-full h-full overflow-hidden relative">
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
  )
}

export default App
