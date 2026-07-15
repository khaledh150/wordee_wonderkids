import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import SplashScreen from './components/SplashScreen'
import HomeScreen from './components/HomeScreen'
import LevelSelect from './components/LevelSelect'
import ModeSelect from './components/ModeSelect'
import LoadingScreen from './components/LoadingScreen'
import { stopAll, clearIdleTimer } from './utils/audioPlayer'
import InAppBrowserGuard from './components/InAppBrowserGuard'
import { LanguageProvider } from './i18n/LanguageContext'
import { levelConfig } from './math/mathEngine'
import useVersionCheck from './hooks/useVersionCheck'

const LearnMode = lazy(() => import('./components/LearnMode'))
const PracticeMode = lazy(() => import('./components/PracticeMode'))
const AdminPage = lazy(() => import('./competition/AdminPage'))
const CompetitionPlayPage = lazy(() => import('./competition/CompetitionPlayPage'))
const ProjectorPage = lazy(() => import('./competition/ProjectorPage'))
const MathLevelSelect = lazy(() => import('./math/MathLevelSelect'))
const MathModeSelect = lazy(() => import('./math/MathModeSelect'))
const MathPractice = lazy(() => import('./math/MathPractice'))
const MathExam = lazy(() => import('./math/MathExam'))
const MathResults = lazy(() => import('./math/MathResults'))
const MathPrintExam = lazy(() => import('./math/MathPrintExam'))

export const APP_VERSION = '1.8.1'
const PRESERVED_KEYS = ['wordee_progress', 'last_wordee_version', 'wonderkids_language', 'mathwiz_answers', 'mathwiz_exam_progress']

function writeHash(screen, level, ml) {
  let hash = `s=${screen}`
  if (level != null) hash += `&l=${level}`
  if (ml != null) hash += `&ml=${ml}`
  window.location.hash = hash
}

function App() {
  if (window.location.pathname === '/admin') {
    return <LanguageProvider><Suspense fallback={<LoadingScreen />}><AdminPage /></Suspense></LanguageProvider>
  }
  if (window.location.pathname === '/play') {
    return <LanguageProvider><Suspense fallback={<LoadingScreen />}><CompetitionPlayPage /></Suspense></LanguageProvider>
  }
  if (window.location.pathname === '/projector') {
    return <LanguageProvider><Suspense fallback={<LoadingScreen />}><ProjectorPage /></Suspense></LanguageProvider>
  }

  const [screen, setScreen] = useState('splash')
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [mode, setMode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mathLevel, setMathLevel] = useState(null)
  const [mathExamResults, setMathExamResults] = useState(null)
  const [mathExamKey, setMathExamKey] = useState(0)

  useEffect(() => {
    try {
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
    } catch {}
  }, [])

  useVersionCheck()

  useEffect(() => {
    if (screen !== 'splash') writeHash(screen, selectedLevel, mathLevel?.level)
  }, [screen, selectedLevel, mathLevel])

  useEffect(() => {
    const onPopState = () => {
      const hash = window.location.hash.replace('#', '')
      const params = new URLSearchParams(hash)
      const s = params.get('s')
      if (s && s !== screen) {
        const l = params.get('l')
        if (l) setSelectedLevel(Number(l))
        const ml = params.get('ml')
        if (ml) {
          const config = levelConfig.find(c => c.level === Number(ml))
          if (config) setMathLevel(config)
        }
        setScreen(s)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [screen])

  const navigate = useCallback((to, opts = {}) => {
    stopAll()
    clearIdleTimer()
    if (opts.level !== undefined) setSelectedLevel(opts.level)
    if (opts.mode !== undefined) setMode(opts.mode)
    if (opts.mathLevel !== undefined) setMathLevel(opts.mathLevel)
    if (to === 'learn' || to === 'practice' || to === 'test') {
      setLoading(true)
      setTimeout(() => { setLoading(false); setScreen(to) }, 1200)
    } else {
      setScreen(to)
    }
  }, [])

  const goHome = useCallback(() => navigate('home'), [navigate])
  const goBack = useCallback(() => {
    if (screen === 'learn' || screen === 'practice' || screen === 'test') navigate('mode', { level: selectedLevel })
    else if (screen === 'mode') navigate('levels')
    else if (screen === 'levels') navigate('home')
    else if (screen === 'mathPractice' || screen === 'mathExam') navigate('mathMode')
    else if (screen === 'mathMode') navigate('mathLevels')
    else if (screen === 'mathLevels' || screen === 'mathResults' || screen === 'mathPrint') navigate('home')
    else navigate('home')
  }, [screen, selectedLevel, navigate])

  if (loading) return <LoadingScreen />

  return (
    <InAppBrowserGuard>
    <LanguageProvider>
    <div className="w-full min-h-screen-safe relative">
      <AnimatePresence mode="wait">
        {screen === 'splash' && (
          <SplashScreen key="splash" onDone={() => navigate('home')} />
        )}
        {screen === 'home' && (
          <HomeScreen
            key="home"
            onPracticeEnglish={() => navigate('levels')}
            onPracticeMath={() => navigate('mathLevels')}
            onCompetition={() => { window.location.href = '/play' }}
          />
        )}
        {screen === 'levels' && (
          <LevelSelect
            key="levels"
            onSelect={(lvl) => navigate('mode', { level: lvl })}
            onBack={() => navigate('home')}
          />
        )}
        {screen === 'mode' && (
          <ModeSelect
            key="mode"
            level={selectedLevel}
            onSelect={(m) => navigate(m, { mode: m })}
            onBack={() => navigate('levels')}
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
              mode="practice"
            />
          </Suspense>
        )}
        {screen === 'test' && (
          <Suspense fallback={<LoadingScreen />}>
            <PracticeMode
              key="test"
              level={selectedLevel}
              onBack={goBack}
              onHome={goHome}
              mode="test"
            />
          </Suspense>
        )}
        {screen === 'mathLevels' && (
          <Suspense fallback={<LoadingScreen />}>
            <MathLevelSelect
              key="mathLevels"
              onSelectLevel={(config) => { setMathLevel(config); navigate('mathMode') }}
              onPrint={() => navigate('mathPrint')}
              onBack={() => navigate('home')}
            />
          </Suspense>
        )}
        {screen === 'mathMode' && mathLevel && (
          <Suspense fallback={<LoadingScreen />}>
            <MathModeSelect
              key="mathMode"
              levelConfig={mathLevel}
              onSelectMode={(m) => {
                if (m === 'practice') navigate('mathPractice')
                else { setMathExamKey(k => k + 1); navigate('mathExam') }
              }}
              onBack={() => navigate('mathLevels')}
            />
          </Suspense>
        )}
        {screen === 'mathPractice' && mathLevel && (
          <Suspense fallback={<LoadingScreen />}>
            <MathPractice
              key={`mathPractice-${mathLevel.level}`}
              levelConfig={mathLevel}
              onExit={() => navigate('mathMode')}
            />
          </Suspense>
        )}
        {screen === 'mathExam' && mathLevel && (
          <Suspense fallback={<LoadingScreen />}>
            <MathExam
              key={`mathExam-${mathLevel.level}-${mathExamKey}`}
              levelConfig={mathLevel}
              onFinish={(results) => { setMathExamResults(results); navigate('mathResults') }}
              onExit={() => navigate('mathMode')}
            />
          </Suspense>
        )}
        {screen === 'mathResults' && mathExamResults && (
          <Suspense fallback={<LoadingScreen />}>
            <MathResults
              key="mathResults"
              examData={mathExamResults}
              onBackToHome={goHome}
              onTryAgain={() => { setMathExamKey(k => k + 1); navigate('mathExam') }}
            />
          </Suspense>
        )}
        {screen === 'mathPrint' && (
          <Suspense fallback={<LoadingScreen />}>
            <MathPrintExam
              key="mathPrint"
              onBack={() => navigate('mathLevels')}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
    </LanguageProvider>
    </InAppBrowserGuard>
  )
}

export default App
