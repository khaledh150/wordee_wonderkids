import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCompetitionEngine } from './useCompetitionEngine'
import { getCompetitionQuestions } from './competitionQuestions'
import { getVocabForLevel } from '../data/vocabulary'
import { playSFX } from '../utils/audioPlayer'
import { Lock, GraduationCap, Sparkles, CheckCircle2, AlertCircle, Loader2, Play, BookOpen, Calculator } from 'lucide-react'
import { enterFullscreen } from '../utils/useFullscreen'
import FullscreenBtn from '../components/FullscreenBtn'
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


export default function CompetitionPlayPage() {
  const [step, setStep] = useState('code') // code | subject | waiting | active
  const [selectedSubject, setSelectedSubject] = useState(null) // 'english' | 'math'
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [code, setCode] = useState('')
  const [verifiedCode, setVerifiedCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 })
  const [preloadDone, setPreloadDone] = useState(false)
  const [questions, setQuestions] = useState(null)

  const [countdownActive, setCountdownActive] = useState(false)
  const [countdownNum, setCountdownNum] = useState(3)
  const [competitionId, setCompetitionId] = useState(null)

  useEffect(() => {
    supabase.from('competition_state').select('competition_id').limit(1).single()
      .then(({ data }) => { if (data) setCompetitionId(data.competition_id) })
  }, [])

  const engine = useCompetitionEngine({
    competitionId,
    subject: selectedSubject || 'english',
    questions,
  })

  const { session, phase, competitionState, announcement, joinCompetition, startRace, markReady } = engine

  const isDark = competitionState?.theme === 'dark'

  async function getQuestionsForSession(sub, level, participantId) {
    if (sub === 'math') {
      const { getMathCompetitionQuestions } = await import('./mathCompetitionQuestions')
      return getMathCompetitionQuestions(level, participantId)
    }
    return getCompetitionQuestions(level)
  }

  useEffect(() => {
    if (session && questions == null) {
      getQuestionsForSession(selectedSubject, session.level, session.participant_id).then(setQuestions)
    }
    if (phase === 'completed' && session) {
      setStep('active')
    } else if (phase === 'waiting' && session) {
      setStep('waiting')
    } else if (phase === 'active' && session) {
      if (step === 'waiting') {
        setCountdownActive(true)
      } else {
        setStep('active')
      }
    }
  }, [phase, session])

  useEffect(() => {
    if (!countdownActive) return
    setCountdownNum(3)
    playSFX('correct.wav')
    let cur = 3
    const interval = setInterval(() => {
      cur -= 1
      if (cur === 0) {
        setCountdownNum('GO!')
        playSFX('correct.wav')
      } else if (cur < 0) {
        clearInterval(interval)
        setStep('active')
        setCountdownActive(false)
      } else {
        setCountdownNum(cur)
        playSFX('correct.wav')
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [countdownActive])

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
        if (!res.ok || cancelled) return
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
    const id = setInterval(check, 30000)
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

  const [starting, setStarting] = useState(false)

  async function handleStart() {
    if (starting) return
    setStarting(true)
    try {
      await startRace()
    } catch (err) {
      setError(err.message || 'Failed to start')
      setStarting(false)
    }
  }

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
              disabled={loading || code.trim().length < 4}
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
    const adminStarted = !!competitionState?.started_at
    const canStart = adminStarted && preloadDone

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-3 sm:p-4 relative overflow-hidden transition-colors ${
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
          className="w-full max-w-md landscape:max-w-2xl relative z-10"
        >
          <div className={`w-full backdrop-blur-xl border rounded-3xl shadow-[0_20px_50px_rgba(31,38,135,0.08)] p-5 sm:p-8 text-center flex flex-col transition-colors ${
            isDark ? 'bg-[#0e1224]/70 border-white/10' : 'bg-white/70 border-white/40'
          }`}>

            <h2 className={`text-xs font-black ${isMath ? 'text-teal-500' : 'text-indigo-500'} uppercase tracking-widest leading-none mb-4.5 landscape:hidden`}>
              {isMath ? 'Math' : 'Spelling'} Competition Lobby
            </h2>

            <div className="flex flex-col landscape:grid landscape:grid-cols-2 gap-4 sm:gap-6 text-center landscape:text-left">

              <div className="flex flex-col justify-between gap-3">
                <div className={`bg-gradient-to-br ${isDark ? (isMath ? 'from-teal-950/50 to-cyan-950/50 border-teal-800/30' : 'from-indigo-950/50 to-purple-950/50 border-indigo-800/30') : (isMath ? 'from-teal-50 to-cyan-50 border-teal-100/50' : 'from-indigo-50 to-purple-50 border-indigo-100/50')} rounded-2xl border p-3.5 sm:p-4.5 relative overflow-hidden shadow-inner text-left`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${isMath ? 'from-teal-500 to-cyan-600' : 'from-indigo-500 to-purple-600'} text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-md shrink-0`}>
                      {session.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-base sm:text-lg font-black truncate leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{session.name}</p>
                        <FlagIcon country={session.country} />
                      </div>
                      {session.school && (
                        <p className={`text-[10px] sm:text-xs ${isMath ? 'text-teal-600/80' : 'text-indigo-600/80'} font-bold flex items-center gap-1 mt-0.5 truncate`}>
                          <GraduationCap className="w-3.5 h-3.5" />
                          {session.school}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={`mt-3 flex items-center justify-between border-t pt-2 px-0.5 ${isDark ? 'border-white/10' : 'border-indigo-100/30'}`}>
                    <span className={`inline-block px-2 py-0.5 ${isMath ? 'bg-teal-500/10 text-teal-600 border-teal-200/50' : 'bg-indigo-500/10 text-indigo-600 border-indigo-200/50'} text-[9px] sm:text-[10px] font-extrabold rounded-full border uppercase tracking-wider`}>
                      Level {session.level}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Code: {session.participant_code}
                    </span>
                  </div>
                </div>

                {selectedSubject === 'english' && !preloadDone ? (
                  <div className={`rounded-2xl border p-3 sm:p-4 text-center shadow-sm ${isDark ? 'bg-slate-900 border-slate-700/50' : 'bg-slate-50 border-slate-200/50'}`}>
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                      <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Caching Vocab</span>
                      <span className="text-[10px] font-black text-indigo-600 font-mono">
                        {preloadProgress.total ? Math.round((preloadProgress.loaded / preloadProgress.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className={`h-3 border rounded-full p-0.5 overflow-hidden shadow-inner ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200/60 border-slate-200'}`}>
                      <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full"
                        animate={{ width: preloadProgress.total ? `${(preloadProgress.loaded / preloadProgress.total) * 100}%` : '0%' }}
                        transition={{ type: 'spring', damping: 20 }}
                      />
                    </div>
                    <p className={`text-[9px] font-bold mt-1.5 flex items-center justify-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                      Loading Vocab ({preloadProgress.loaded}/{preloadProgress.total})
                    </p>
                  </div>
                ) : (
                  <div className={`rounded-2xl p-3 flex items-center justify-center gap-2.5 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-wiggle" />
                    <div className="text-left">
                      <p className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>Ready</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600/80 leading-none mt-0.5">Engine is fully ready</p>
                    </div>
                  </div>
                )}
              </div>

              <div className={`flex flex-col justify-center gap-3 border-t pt-4 landscape:border-t-0 landscape:border-l landscape:pl-5 sm:landscape:pl-6 landscape:pt-0 ${isDark ? 'border-white/10 landscape:border-white/10' : 'border-slate-100 landscape:border-slate-200/50'}`}>
                <AnimatePresence>
                  {announcement && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -6 }}
                      className={`rounded-2xl p-3 text-left relative overflow-hidden ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}
                    >
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[9px] font-black uppercase tracking-widest leading-none ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>Coordinator Notice</p>
                          <p className={`text-xs font-bold mt-1 leading-normal max-h-[50px] overflow-y-auto ${isDark ? 'text-amber-200' : 'text-amber-950'}`}>{announcement}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-2">
                  {!canStart ? (
                    <>
                      <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center relative ${isDark ? 'bg-slate-800 border-2 border-slate-700' : 'bg-slate-100 border-2 border-slate-200'}`}>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                          className={`absolute inset-0 rounded-full border-t-2 border-r-2 border-transparent ${isDark ? 'border-t-slate-500' : 'border-t-slate-400'}`}
                        />
                        <Lock className={`w-8 h-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      </div>
                      <div className="text-center">
                        <h3 className={`text-sm sm:text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {!preloadDone ? 'Loading...' : 'Waiting for Admin'}
                        </h3>
                        <p className={`text-[10px] sm:text-xs mt-1 font-semibold leading-normal max-w-[200px] mx-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {!preloadDone ? `Finalizing ${subjectLabel} configurations...` : 'The competition will be unlocked shortly.'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <motion.button
                        onClick={handleStart}
                        disabled={starting}
                        whileHover={starting ? {} : { scale: 1.08 }}
                        whileTap={starting ? {} : { scale: 0.92 }}
                        className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full text-white font-black text-xl sm:text-2xl uppercase tracking-wider shadow-[0_0_30px_rgba(34,197,94,0.5)] cursor-pointer relative flex items-center justify-center border-4 ${starting ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-300' : 'bg-gradient-to-br from-green-500 to-green-700 border-green-400'}`}
                      >
                        {!starting && (
                          <>
                            <motion.div
                              animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                              className="absolute inset-0 rounded-full bg-green-500/40"
                            />
                            <motion.div
                              animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                              className="absolute inset-0 rounded-full bg-green-500/20"
                            />
                          </>
                        )}
                        <motion.div
                          animate={starting ? { rotate: 360 } : { scale: [1, 1.05, 1] }}
                          transition={starting ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                          className="relative z-10 flex flex-col items-center"
                        >
                          {starting ? (
                            <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-lg" />
                          ) : (
                            <>
                              <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current drop-shadow-lg" />
                              <span className="text-xs sm:text-sm mt-0.5 drop-shadow-lg">START</span>
                            </>
                          )}
                        </motion.div>
                      </motion.button>
                      <p className={`text-[10px] sm:text-xs font-bold animate-pulse ${isDark ? 'text-green-400' : 'text-green-500'}`}>
                        {starting ? 'Entering arena...' : 'Tap to begin!'}
                      </p>
                    </>
                  )}
                </div>
              </div>

            </div>

            {error && <p className={`text-[10px] font-bold mt-3 leading-tight p-2 rounded-xl border ${isDark ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-rose-500 bg-rose-50 border-rose-200/50'}`}>{error}</p>}
          </div>
        </motion.div>
      </div>
    )
  }

  // ===== ACTIVE GAME =====
  if (step === 'active' && session && questions) {
    return (
      <>
        <AnimatePresence>
          {countdownActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#060814] flex flex-col items-center justify-center text-white"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.12)_0%,rgba(0,0,0,0)_60%)] pointer-events-none" />

              <AnimatePresence mode="wait">
                <motion.div
                  key={countdownNum}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.3, 1], opacity: 1 }}
                  exit={{ scale: 1.8, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 20, duration: 0.7 }}
                  className={`text-7xl sm:text-8xl md:text-9xl font-black font-mono tracking-tight text-center drop-shadow-[0_10px_40px_rgba(99,102,241,0.4)] ${
                    countdownNum === 'GO!'
                      ? 'bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent'
                      : `bg-gradient-to-r ${isMath ? 'from-teal-400 via-cyan-400 to-blue-400' : 'from-indigo-400 via-purple-400 to-rose-400'} bg-clip-text text-transparent`
                  }`}
                >
                  {countdownNum}
                </motion.div>
              </AnimatePresence>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 0.6, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`${isMath ? 'text-teal-300' : 'text-indigo-300'} font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs mt-4`}
              >
                Entering {subjectLabel} arena
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

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
