import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCompetitionEngine } from './useCompetitionEngine'
import { getCompetitionQuestions } from './competitionQuestions'
import { getVocabForLevel } from '../data/vocabulary'
import { Lock, CheckCircle2, AlertCircle, Loader2, BookOpen, Calculator } from 'lucide-react'
import { enterFullscreen } from '../utils/useFullscreen'
import FullscreenBtn from '../components/FullscreenBtn'
import StudentAvatar from './admin/StudentAvatar'
import wonderkidsLogo from '../assets/wonderkids_logo.webp'
import { supabase } from './supabaseClient'
import CompetitionGameView from './CompetitionGameView'
const MathCompetitionGameView = lazy(() => import('./MathCompetitionGameView'))


const CONCURRENCY = 5
const CACHE_NAME = 'wordee-competition-assets-v1'
const FLAG_CDN = 'https://flagcdn.com/w40'

function FlagIcon({ country }) {
  const [failed, setFailed] = useState(false)
  if (!country) return null
  if (failed) return <span className="text-xs" title={country}>🌍</span>
  return (
    <img
      src={`${FLAG_CDN}/${country.toLowerCase()}.png`}
      alt={country}
      className="w-6.5 h-4 object-cover rounded-sm inline-block shadow-sm"
      onError={() => setFailed(true)}
    />
  )
}

async function cacheAsset(url) {
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(url)
      if (cached) return true
      const response = await fetch(url)
      if (response.ok) await cache.put(url, response)
      return true
    }
  } catch {}
  return false
}

function preloadAsset(url) {
  return new Promise(async (resolve) => {
    const cached = await cacheAsset(url)
    if (url.match(/\.(webp|png|jpg|jpeg|gif|svg)$/i)) {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    } else if (url.match(/\.(mp3|wav|ogg|aac)$/i)) {
      if (cached) { resolve(true); return }
      const audio = new Audio()
      audio.preload = 'auto'
      audio.oncanplaythrough = () => resolve(true)
      audio.onerror = () => resolve(false)
      audio.src = url
    } else {
      resolve(true)
    }
  })
}

async function preloadWithConcurrency(urls, onProgress) {
  const total = urls.length
  if (total === 0) { onProgress(0, 0); return }

  let loaded = 0
  const queue = [...urls]

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift()
      await preloadAsset(url)
      loaded++
      onProgress(loaded, total)
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker())
  await Promise.all(workers)
}


function loadPlayState(competitionId) {
  if (!competitionId) return null
  try {
    const raw = localStorage.getItem(`wordee_comp_${competitionId}`)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (saved.participantCode && saved.session) return saved
  } catch {}
  return null
}

export default function CompetitionPlayPage() {
  const [step, setStep] = useState('code') // code | subject | waiting | countdown | active
  const [selectedSubject, setSelectedSubject] = useState(null) // 'english' | 'math'
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [code, setCode] = useState('')
  const [verifiedCode, setVerifiedCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 })
  const [preloadDone, setPreloadDone] = useState(false)
  const [questions, setQuestions] = useState(null)

  const [countdownNum, setCountdownNum] = useState(3)
  const countdownDoneRef = useRef(false)
  const [autoStartMsg, setAutoStartMsg] = useState('Entering arena...')
  const [competitionId, setCompetitionId] = useState(null)
  const restoredRef = useRef(false)

  useEffect(() => {
    supabase.from('competition_state').select('competition_id').limit(1).single()
      .then(({ data }) => { if (data) setCompetitionId(data.competition_id) })
  }, [])

  useEffect(() => {
    if (!competitionId || restoredRef.current) return
    restoredRef.current = true
    const saved = loadPlayState(competitionId)
    if (saved?.participantCode && saved?.session?.subject) {
      setVerifiedCode(saved.participantCode)
      setSelectedSubject(saved.session.subject)
      if (saved.phase === 'active' || saved.phase === 'submitting') {
        restoredRef.current = 'auto-resume'
      }
    }
  }, [competitionId])

  useEffect(() => {
    const handler = (e) => {
      if (step === 'active' || step === 'waiting' || step === 'countdown') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [step])

  const engine = useCompetitionEngine({
    competitionId,
    subject: selectedSubject || 'english',
    questions,
  })

  const { session, phase, competitionState, announcement, joinCompetition, startRace, triggerStart, markReady, autoStarting, countdownReady } = engine

  // Progressive auto-start messages
  useEffect(() => {
    if (!autoStarting) { setAutoStartMsg('Entering arena...'); return }
    setAutoStartMsg('Entering arena...')
    const msgs = [
      [4000, 'Connecting to server...'],
      [8000, 'Almost there...'],
      [15000, 'Hang tight, loading...'],
      [25000, 'Still connecting...'],
    ]
    const timers = msgs.map(([delay, msg]) => setTimeout(() => setAutoStartMsg(msg), delay))
    return () => timers.forEach(clearTimeout)
  }, [autoStarting])

  const isDark = competitionState?.theme === 'dark'

  async function getQuestionsForSession(sub, level, participantId) {
    try {
      if (sub === 'math') {
        const { getMathCompetitionQuestions } = await import('./mathCompetitionQuestions')
        return getMathCompetitionQuestions(level, participantId)
      }
      return getCompetitionQuestions(level)
    } catch (err) {
      if (err.message?.includes('dynamically imported module') || err.message?.includes('MIME type')) {
        window.location.reload()
        return []
      }
      throw err
    }
  }

  useEffect(() => {
    if (session && questions == null) {
      getQuestionsForSession(selectedSubject, session.level, session.participant_id).then(setQuestions)
    }
    if (phase === 'completed' && session) {
      if (step === 'code' && !verifiedCode) return
      setStep('active')
    } else if (phase === 'waiting' && session) {
      if (step === 'code' && !verifiedCode) return
      if (restoredRef.current === 'auto-resume') {
        restoredRef.current = 'done'
        startRace()
        return
      }
      setStep('waiting')
    } else if (phase === 'active' && session) {
      // Engine is active (startRace succeeded) — go straight to questions
      if (step === 'countdown' || step === 'waiting') {
        setStep('active')
      }
    }
  }, [phase, session])

  // Countdown trigger: when engine signals countdownReady (admin started), show countdown BEFORE starting race
  useEffect(() => {
    if (!countdownReady || step !== 'waiting') return
    setStep('countdown')
  }, [countdownReady, step])

  // Countdown animation — runs the sequence, then calls triggerStart (which calls startRace on server)
  useEffect(() => {
    if (step !== 'countdown') { countdownDoneRef.current = false; return }
    countdownDoneRef.current = false
    setCountdownNum('GET READY!')
    const sequence = [3, 2, 1, 'GO!', null]
    let idx = 0
    const interval = setInterval(() => {
      const val = sequence[idx]
      if (val === null) {
        clearInterval(interval)
        countdownDoneRef.current = true
        triggerStart()
      } else {
        setCountdownNum(val)
        idx++
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [step, triggerStart])

  // Auto-transition: when student is on completed screen and admin opens a new lobby
  useEffect(() => {
    if (phase !== 'completed' || !verifiedCode) return
    let cancelled = false
    const check = async () => {
      try {
        const FUNC_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'
        const res = await fetch(`${FUNC_BASE}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participant_code: verifiedCode, competition_id: competitionId }),
        })
        if (cancelled) return
        if (!res.ok) return
        const data = await res.json()
        const subjects = data.subjects || []
        const otherSubjects = subjects.filter(s => s !== selectedSubject)
        if (otherSubjects.length > 0 && !cancelled) {
          const nextSubject = otherSubjects[0]
          setQuestions(null)
          setPreloadDone(false)
          setPreloadProgress({ loaded: 0, total: 0 })
          try { localStorage.removeItem(`wordee_comp_${competitionId}`) } catch {}
          handleSubjectSelect(nextSubject, verifiedCode)
        }
      } catch {}
    }
    check()
    const id = setInterval(check, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [phase, verifiedCode, selectedSubject, competitionId])

  async function handleCodeSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setError('')
    setLoading(true)
    try {
      enterFullscreen()
      const upperCode = code.trim().toUpperCase()
      const FUNC_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'
      const res = await fetch(`${FUNC_BASE}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_code: upperCode, competition_id: competitionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Invalid code. Please check and try again.')
        setLoading(false)
        return
      }
      const subjects = data.subjects || []
      setVerifiedCode(upperCode)
      setAvailableSubjects(subjects)
      if (subjects.length === 1) {
        handleSubjectSelect(subjects[0], upperCode)
      } else {
        setStep('subject')
        setLoading(false)
      }
    } catch (err) {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  async function handleSubjectSelect(subject, codeOverride) {
    const useCode = codeOverride || verifiedCode
    setSelectedSubject(subject)
    setError('')
    setLoading(true)
    try {
      enterFullscreen()
      const result = await joinCompetition(useCode, subject)
      const q = await getQuestionsForSession(subject, result.level, result.participant_id)
      setQuestions(q)
      if (result.completed) setStep('active')
      else if (result.resume) setStep('active')
      else setStep('waiting')
    } catch (err) {
      setError(err.message || 'Failed to join. Please try again.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (step !== 'waiting' || !session) return

    if (selectedSubject === 'math') {
      setPreloadDone(true)
      markReady()
      return
    }

    const vocab = getVocabForLevel(session.level)
    const urls = []
    for (const item of vocab) {
      if (item.image) urls.push(item.image)
      if (item.audio) urls.push(item.audio)
    }
    if (urls.length === 0) {
      setPreloadDone(true)
      markReady()
      return
    }

    setPreloadProgress({ loaded: 0, total: urls.length })

    preloadWithConcurrency(urls, (loaded, total) => {
      setPreloadProgress({ loaded, total })
      if (loaded >= total) {
        setPreloadDone(true)
        markReady()
      }
    })
  }, [step, session, markReady, selectedSubject])


  const renderBackgroundBlobs = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <motion.div
        animate={{
          x: [0, 80, -40, 0],
          y: [0, -50, 60, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-300/30 to-purple-400/30 blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -90, 50, 0],
          y: [0, 60, -80, 0],
          scale: [1, 0.8, 1.1, 1],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-40 -right-40 w-112 h-112 rounded-full bg-gradient-to-tr from-cyan-200/30 to-indigo-300/30 blur-3xl"
      />
    </div>
  )

  const isMath = selectedSubject === 'math'
  const subjectLabel = isMath ? 'math' : 'spelling'

  if (!competitionId) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center font-bold gap-2.5 ${isDark ? 'bg-[#060814] text-indigo-400' : 'bg-[#FFF5F0] text-indigo-400'}`}>
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    )
  }

  // ===== CODE ENTRY (first screen — gate) =====
  if (step === 'code') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-3 sm:p-4 relative overflow-hidden transition-colors ${
        isDark ? 'bg-[#060814]' : 'bg-gradient-to-br from-[#FFF5F0] via-[#EEF2F6] to-[#E5E9F0]'
      }`}>
        {renderBackgroundBlobs()}

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="w-full max-w-sm sm:max-w-md relative z-10"
        >
          <form
            onSubmit={handleCodeSubmit}
            className={`w-full backdrop-blur-xl border rounded-3xl shadow-[0_20px_50px_rgba(31,38,135,0.08)] p-5 sm:p-8 text-center flex flex-col justify-center transition-colors ${
              isDark ? 'bg-[#0e1224]/70 border-white/10' : 'bg-white/70 border-white/40'
            }`}
          >
            <img src={wonderkidsLogo} alt="Wonder Kids" className="w-16 h-16 sm:w-20 sm:h-20 object-contain mx-auto mb-1 sm:mb-3 landscape:w-12 landscape:h-12 landscape:mb-1 drop-shadow-lg" />

            <h1 className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tight landscape:text-lg ${
              isDark ? 'bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent'
            }`}>
              Competition Arena
            </h1>
            <p className={`text-xs sm:text-sm mt-1 mb-4 sm:mb-6 font-medium landscape:mb-3.5 landscape:mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Enter your participant code to join
            </p>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  className={`rounded-xl p-2.5 mb-4 text-left flex items-center gap-2 ${
                    isDark ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-200/50'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className={`text-[10px] sm:text-xs font-bold leading-tight ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative mb-4 sm:mb-5 landscape:mb-3">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                className={`w-full text-center text-3xl sm:text-4xl font-mono font-black tracking-[0.5em] pl-[0.5em] border-2 focus:ring-4 rounded-xl py-3 sm:py-4 outline-none shadow-sm transition-all landscape:py-2 landscape:text-2xl ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500 focus:ring-indigo-500/20'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-indigo-100'
                }`}
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                autoComplete="off"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.trim().length < 1}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-[0_4px_12px_rgba(79,70,229,0.2)] text-white font-black rounded-xl text-base sm:text-lg disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all cursor-pointer landscape:py-2.5 landscape:text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 animate-spin" />
                  Verifying...
                </span>
              ) : (
                'Join Competition'
              )}
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  // ===== SUBJECT SELECTION (only if registered for both) =====
  if (step === 'subject') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-3 sm:p-4 relative overflow-hidden transition-colors ${
        isDark ? 'bg-[#060814]' : 'bg-gradient-to-br from-[#FFF5F0] via-[#EEF2F6] to-[#E5E9F0]'
      }`}>
        {renderBackgroundBlobs()}

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="w-full max-w-sm sm:max-w-md relative z-10"
        >
          <div className={`w-full backdrop-blur-xl border rounded-3xl shadow-[0_20px_50px_rgba(31,38,135,0.08)] p-5 sm:p-8 text-center flex flex-col transition-colors ${
            isDark ? 'bg-[#0e1224]/70 border-white/10' : 'bg-white/70 border-white/40'
          }`}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setStep('code'); setCode(''); setVerifiedCode(''); setAvailableSubjects([]); setError('') }}
              className={`self-start flex items-center gap-1.5 text-xs font-bold mb-4 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-white bg-white/5 border-white/10 hover:bg-white/10'
                  : 'text-slate-500 hover:text-slate-800 bg-slate-100 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Change Code
            </motion.button>

            <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 border shadow-inner ${
              isDark ? 'bg-indigo-500/15 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'
            }`}>
              <Lock className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-500 animate-float" />
            </div>

            <h1 className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tight ${
              isDark ? 'bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent'
            }`}>
              Choose Subject
            </h1>
            <p className={`text-xs sm:text-sm mt-1 mb-5 sm:mb-7 font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Code verified — select your competition
            </p>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-indigo-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-bold">Joining...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {availableSubjects.includes('english') && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSubjectSelect('english')}
                    className={`relative flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                      isDark
                        ? 'bg-gradient-to-br from-pink-500/10 to-rose-500/10 border-pink-500/30 shadow-lg shadow-pink-500/5 hover:shadow-xl'
                        : 'bg-gradient-to-br from-pink-50 to-rose-50 border-pink-300 shadow-lg shadow-pink-200/30 hover:shadow-xl'
                    }`}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-md bg-gradient-to-br from-pink-400 to-rose-500">
                      <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <div>
                      <h3 className={`text-base sm:text-lg font-black tracking-tight ${isDark ? 'text-pink-300' : 'text-pink-700'}`}>English</h3>
                      <p className="text-[9px] sm:text-[10px] font-bold mt-0.5 text-pink-400">SPELLING</p>
                    </div>
                  </motion.button>
                )}

                {availableSubjects.includes('math') && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSubjectSelect('math')}
                    className={`relative flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                      isDark
                        ? 'bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border-teal-500/30 shadow-lg shadow-teal-500/5 hover:shadow-xl'
                        : 'bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-300 shadow-lg shadow-teal-200/30 hover:shadow-xl'
                    }`}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-md bg-gradient-to-br from-teal-400 to-cyan-500">
                      <Calculator className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <div>
                      <h3 className={`text-base sm:text-lg font-black tracking-tight ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>Math</h3>
                      <p className="text-[9px] sm:text-[10px] font-bold mt-0.5 text-teal-400">MATHEMATICS</p>
                    </div>
                  </motion.button>
                )}
              </div>
            )}

            {error && <p className={`text-[10px] font-bold mt-3 leading-tight p-2 rounded-xl border ${isDark ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-rose-500 bg-rose-50 border-rose-200/50'}`}>{error}</p>}
          </div>
        </motion.div>
      </div>
    )
  }

  // ===== WAITING / LOBBY =====
  if (step === 'waiting' && session) {
    const accentFrom = isMath ? 'from-teal-500' : 'from-indigo-500'
    const accentTo = isMath ? 'to-cyan-500' : 'to-purple-500'

    return (
      <div className={`min-h-[100dvh] max-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden transition-colors ${
        isDark ? 'bg-[#060814]' : 'bg-gradient-to-br from-[#FFF5F0] via-[#EEF2F6] to-[#E5E9F0]'
      }`}>
        {renderBackgroundBlobs()}

        <div className="fixed top-3 right-3 z-50">
          <FullscreenBtn />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="w-full max-w-[90vw] sm:max-w-sm relative z-10 flex flex-col items-center gap-5 sm:gap-7"
        >
          <StudentAvatar photoUrl={session.photo_url} name={session.name} size="xl" className="shadow-xl w-20 h-20 sm:w-24 sm:h-24" />

          <div className="text-center w-full">
            <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {session.nickname || session.name}
            </h1>
            {session.nickname && (
              <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{session.name}</p>
            )}
          </div>

          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r ${accentFrom} ${accentTo} shadow-lg`}>
            <span className="text-white font-black text-base sm:text-lg uppercase tracking-widest">Level {session.level}</span>
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="flex flex-col items-center gap-2 mt-2"
          >
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-xl ${
              isDark ? 'bg-emerald-500/20 border-4 border-emerald-400/40' : 'bg-emerald-500 border-4 border-emerald-400'
            }`}>
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <CheckCircle2 className={`w-10 h-10 sm:w-12 sm:h-12 ${isDark ? 'text-emerald-400' : 'text-white'}`} />
              </motion.div>
            </div>
            <p className={`text-lg sm:text-xl font-black uppercase tracking-[0.2em] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Ready</p>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // ===== COUNTDOWN (full-screen transition — matches projector style) =====
  if (step === 'countdown') {
    const isGo = countdownNum === 'GO!'
    const isReady = countdownNum === 'GET READY!'
    const isNumber = typeof countdownNum === 'number'

    const accentColor = isGo
      ? { glow: 'bg-emerald-500', text: isDark ? 'from-emerald-300 to-emerald-500' : 'from-emerald-600 to-emerald-800' }
      : isReady
      ? { glow: 'bg-amber-500', text: isDark ? 'from-amber-200 to-amber-500' : 'from-amber-600 to-orange-700' }
      : { glow: isMath ? 'bg-teal-500' : 'bg-indigo-500', text: isMath ? (isDark ? 'from-teal-200 to-cyan-500' : 'from-teal-600 to-cyan-800') : (isDark ? 'from-indigo-200 to-purple-500' : 'from-indigo-600 to-purple-800') }

    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center overflow-hidden ${isDark ? 'bg-[#070B18]' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'}`}>
        <div className={`absolute w-[500px] h-[500px] rounded-full blur-[200px] pointer-events-none ${accentColor.glow} ${isDark ? 'opacity-20' : 'opacity-10'}`} />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 0.7, y: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute top-6 z-20"
        >
          <div className={`flex items-center gap-2 border px-4 py-2 rounded-xl backdrop-blur-sm ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/60'}`}>
            {isMath
              ? <Calculator className={`w-4 h-4 ${isDark ? 'text-white/60' : 'text-slate-500'}`} />
              : <BookOpen className={`w-4 h-4 ${isDark ? 'text-white/60' : 'text-slate-500'}`} />
            }
            <span className={`text-sm font-black uppercase tracking-[0.15em] ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
              {isMath ? 'Mathematics' : 'English Spelling'}
            </span>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={countdownNum}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center"
          >
            {isNumber && (() => {
              const radius = 80
              const circumference = 2 * Math.PI * radius
              const strokeColor = isMath
                ? (isDark ? 'rgba(20,184,166,0.8)' : 'rgba(13,148,136,0.7)')
                : (isDark ? 'rgba(129,140,248,0.8)' : 'rgba(79,70,229,0.7)')
              return (
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 192 192">
                    <circle cx="96" cy="96" r={radius} fill="none"
                      stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
                      strokeWidth="3" />
                    <motion.circle cx="96" cy="96" r={radius} fill="none"
                      stroke={strokeColor}
                      strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: circumference }}
                      transition={{ duration: 1.5, ease: 'linear' }}
                    />
                  </svg>
                  <span className={`text-8xl font-black font-mono leading-none bg-gradient-to-b ${accentColor.text} bg-clip-text text-transparent relative z-10`}>
                    {countdownNum}
                  </span>
                </div>
              )
            })()}
            {isReady && (
              <div className="text-center">
                <motion.p
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className={`text-4xl sm:text-5xl font-black uppercase tracking-[0.12em] bg-gradient-to-b ${accentColor.text} bg-clip-text text-transparent`}
                >
                  GET READY
                </motion.p>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '8rem' }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className={`h-[2px] mx-auto mt-4 ${isDark ? 'bg-white/20' : 'bg-slate-300'}`}
                />
              </div>
            )}
            {isGo && (
              <>
                <motion.span
                  initial={{ scale: 0.3 }}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 0.8, times: [0, 0.5, 1] }}
                  className={`text-7xl sm:text-8xl font-black font-mono bg-gradient-to-b bg-clip-text text-transparent ${isDark ? 'from-emerald-300 to-green-500' : 'from-emerald-500 to-green-700'}`}
                >
                  GO!
                </motion.span>
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.5, opacity: 0.4 }}
                    animate={{ scale: 3, opacity: 0 }}
                    transition={{ duration: 1.2, delay: i * 0.15, ease: 'easeOut' }}
                    className={`absolute w-24 h-24 rounded-full border ${isDark ? 'border-emerald-500/30' : 'border-emerald-500/20'} pointer-events-none`}
                  />
                ))}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          className={`absolute bottom-8 text-xs font-bold uppercase tracking-[0.3em] ${isDark ? 'text-white/40' : 'text-slate-400'}`}
        >
          International Championship
        </motion.p>
      </div>
    )
  }

  // ===== ACTIVE GAME =====
  if (step === 'active' && session && questions) {
    return (
      <>
        {isMath ? (
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FFF5F0]"><Loader2 className="w-10 h-10 animate-spin text-teal-500" /></div>}>
            <MathCompetitionGameView engine={engine} level={session.level} isDark={isDark} />
          </Suspense>
        ) : (
          <CompetitionGameView engine={engine} level={session.level} isDark={isDark} />
        )}
      </>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center font-bold gap-2.5 transition-colors ${
      isDark ? 'bg-[#060814] text-indigo-400' : 'bg-[#FFF5F0] text-indigo-400'
    }`}>
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      <span className="text-sm font-black">Loading arena...</span>
    </div>
  )
}
