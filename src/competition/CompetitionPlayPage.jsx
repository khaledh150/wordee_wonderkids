import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCompetitionEngine } from './useCompetitionEngine'
import { getCompetitionQuestions } from './competitionQuestions'
import { getVocabForLevel } from '../data/vocabulary'
import { playSFX } from '../utils/audioPlayer'
import { Lock, GraduationCap, Sparkles, CheckCircle2, AlertCircle, Loader2, Play, Trophy } from 'lucide-react'
import CompetitionGameView from './CompetitionGameView'

const CONCURRENCY = 5
const CACHE_NAME = 'wordee-competition-assets-v1'
const FLAG_CDN = 'https://flagcdn.com/w40'

function FlagIcon({ country }) {
  if (!country) return null
  return (
    <img
      src={`${FLAG_CDN}/${country.toLowerCase()}.png`}
      alt={country}
      className="w-6.5 h-4 object-cover rounded-sm inline-block shadow-sm"
      onError={e => { e.target.style.display = 'none' }}
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
  const [step, setStep] = useState('code') // code | waiting | active
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 })
  const [preloadDone, setPreloadDone] = useState(false)
  const [questions, setQuestions] = useState(null)
  
  // Cinematic transition state
  const [countdownActive, setCountdownActive] = useState(false)
  const [countdownNum, setCountdownNum] = useState(3)
  
  const competitionId = 'default'

  const engine = useCompetitionEngine({
    competitionId,
    subject: 'english',
    questions,
  })

  const { session, phase, competitionState, announcement, joinCompetition, startRace, markReady } = engine

  // If engine restored state, handle it with countdown safety
  useEffect(() => {
    if (session && questions == null) {
      setQuestions(getCompetitionQuestions(session.level))
    }
    if (phase === 'completed' && session) {
      setStep('active')
    } else if (phase === 'waiting' && session) {
      setStep('waiting')
    } else if (phase === 'active' && session) {
      if (step === 'waiting') {
        // Trigger cinematic countdown instead of snapping immediately!
        setCountdownActive(true)
      } else {
        setStep('active')
      }
    }
  }, [phase, session])

  // Handle countdown interval
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

  // Handle code submission
  async function handleCodeSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setError('')
    setLoading(true)
    try {
      const result = await joinCompetition(code.trim().toUpperCase())
      setQuestions(getCompetitionQuestions(result.level))
      if (result.completed) setStep('active')
      else if (result.resume) setStep('active')
      else setStep('waiting')
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.')
    }
    setLoading(false)
  }

  // Preload images + audio when entering lobby
  useEffect(() => {
    if (step !== 'waiting' || !session) return
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
  }, [step, session, markReady])

  // Start race — let engine handle the state, we follow
  async function handleStart() {
    try {
      await startRace()
    } catch (err) {
      setError(err.message || 'Failed to start')
    }
  }

  // Visual background blobs for rich theme
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
        className="absolute -bottom-40 -right-40 w-112 h-112 rounded-full bg-gradient-to-tr from-amber-200/30 to-rose-300/30 blur-3xl"
      />
    </div>
  )

  // ===== SCREENS =====

  // Code entry screen (Optimized for Portrait and Landscape viewports)
  if (step === 'code') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF5F0] via-[#EEF2F6] to-[#E5E9F0] p-3 sm:p-4 relative overflow-hidden">
        {renderBackgroundBlobs()}

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="w-full max-w-sm sm:max-w-md relative z-10"
        >
          <form
            onSubmit={handleCodeSubmit}
            className="w-full bg-white/70 backdrop-blur-xl -webkit-backdrop-blur-xl border border-white/40 rounded-3xl shadow-[0_20px_50px_rgba(31,38,135,0.08)] p-5 sm:p-8 text-center flex flex-col justify-center"
          >
            {/* Logo Icon (Compact on short landscape) */}
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-2 sm:mb-4 border border-indigo-100 shadow-inner landscape:w-9 landscape:h-9 landscape:mb-1.5">
              <Lock className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-500 animate-float landscape:w-4.5 landscape:h-4.5" />
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent tracking-tight landscape:text-lg">
              Competition Portal
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-4 sm:mb-6 font-medium landscape:mb-3.5 landscape:mt-0.5">
              Enter your unique spelling participant code
            </p>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  className="bg-rose-50 border border-rose-200/50 rounded-xl p-2.5 mb-4 text-left flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-[10px] sm:text-xs text-rose-700 font-bold leading-tight">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative mb-4 sm:mb-5 landscape:mb-3">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full text-center text-2xl sm:text-3xl font-mono font-black tracking-[0.4em] pl-[0.4em] bg-white border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-xl py-2.5 sm:py-3.5 outline-none shadow-sm uppercase transition-all landscape:py-1.5 landscape:text-xl"
                maxLength={6}
                autoFocus
                autoComplete="off"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.trim().length < 4}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-xl text-base sm:text-lg shadow-[0_4px_12px_rgba(79,70,229,0.2)] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all cursor-pointer landscape:py-2.5 landscape:text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 animate-spin" />
                  Entering...
                </span>
              ) : (
                'Enter Arena'
              )}
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  // Waiting room / lobby screen (Fully optimized side-by-side 2-column grid in landscape viewports)
  if (step === 'waiting' && session) {
    const isUnlocked = competitionState?.is_unlocked
    const canStart = isUnlocked && preloadDone

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF5F0] via-[#EEF2F6] to-[#E5E9F0] p-3 sm:p-4 relative overflow-hidden">
        {renderBackgroundBlobs()}

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="w-full max-w-md landscape:max-w-2xl relative z-10"
        >
          <div className="w-full bg-white/70 backdrop-blur-xl -webkit-backdrop-blur-xl border border-white/40 rounded-3xl shadow-[0_20px_50px_rgba(31,38,135,0.08)] p-5 sm:p-8 text-center flex flex-col">
            
            {/* Header capsule for Portrait (hidden in landscape to save height) */}
            <h2 className="text-xs font-black text-indigo-500 uppercase tracking-widest leading-none mb-4.5 landscape:hidden">
              Competition Lobby
            </h2>

            {/* Responsive side-by-side layout for Landscape mobile viewports */}
            <div className="flex flex-col landscape:grid landscape:grid-cols-2 gap-4 sm:gap-6 text-center landscape:text-left">
              
              {/* Left Column: Student profile card & Loading progress bar */}
              <div className="flex flex-col justify-between gap-3">
                {/* Student Avatar Card */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100/50 p-3.5 sm:p-4.5 relative overflow-hidden shadow-inner text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-md shrink-0">
                      {session.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-base sm:text-lg font-black text-slate-800 truncate leading-tight">{session.name}</p>
                        <FlagIcon country={session.country} />
                      </div>
                      {session.school && (
                        <p className="text-[10px] sm:text-xs text-indigo-600/80 font-bold flex items-center gap-1 mt-0.5 truncate">
                          <GraduationCap className="w-3.5 h-3.5" />
                          {session.school}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between border-t border-indigo-100/30 pt-2 px-0.5">
                    <span className="inline-block px-2 py-0.5 bg-indigo-500/10 text-indigo-600 text-[9px] sm:text-[10px] font-extrabold rounded-full border border-indigo-200/50 uppercase tracking-wider">
                      Level {session.level}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      Code: {session.participant_code}
                    </span>
                  </div>
                </div>

                {/* Asset Preload Meter */}
                {!preloadDone ? (
                  <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-3 sm:p-4 text-center shadow-sm">
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider">Caching Vocab</span>
                      <span className="text-[10px] font-black text-indigo-600 font-mono">
                        {preloadProgress.total ? Math.round((preloadProgress.loaded / preloadProgress.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-3 bg-slate-200/60 border border-slate-200 rounded-full p-0.5 overflow-hidden shadow-inner">
                      <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full"
                        animate={{ width: preloadProgress.total ? `${(preloadProgress.loaded / preloadProgress.total) * 100}%` : '0%' }}
                        transition={{ type: 'spring', damping: 20 }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold mt-1.5 flex items-center justify-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                      Loading Vocab ({preloadProgress.loaded}/{preloadProgress.total})
                    </p>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-center justify-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-wiggle" />
                    <div className="text-left">
                      <p className="text-[10px] sm:text-xs font-black text-emerald-800 uppercase tracking-widest">Assets Cached</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600/80 leading-none mt-0.5">Engine is fully ready</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Column: Live Announcements & Start/Lock Triggers */}
              <div className="flex flex-col justify-center gap-3 border-t border-slate-100 pt-4 landscape:border-t-0 landscape:border-l landscape:border-slate-200/50 landscape:pl-5 sm:landscape:pl-6 landscape:pt-0">
                {/* Live Announcements (Saves space on landscape) */}
                <AnimatePresence>
                  {announcement && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -6 }}
                      className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-left relative overflow-hidden"
                    >
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest leading-none">Coordinator Notice</p>
                          <p className="text-xs font-bold text-amber-950 mt-1 leading-normal max-h-[50px] overflow-y-auto">{announcement}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Waiting State spinner */}
                {!isUnlocked && (
                  <div className="py-2.5 text-center flex flex-col items-center justify-center flex-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center mb-2.5 relative shadow-inner landscape:w-10 landscape:h-10 landscape:mb-1.5">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-0 rounded-full border-t-2 border-indigo-400 border-r-2 border-transparent"
                      />
                      <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">Arena Door Locked</h3>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-semibold leading-normal max-w-[180px] mx-auto">
                      Game Master is currently preparing spelling pools. Please wait.
                    </p>
                  </div>
                )}

                {isUnlocked && !preloadDone && (
                  <div className="py-3 text-center flex items-center justify-center flex-1">
                    <p className="text-amber-600 font-extrabold text-xs flex items-center justify-center gap-1.5 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      Finalizing spelling configurations...
                    </p>
                  </div>
                )}

                {/* Giant Active Start Trigger */}
                {canStart && (
                  <div className="flex-1 flex items-center justify-center">
                    <motion.button
                      onClick={handleStart}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white text-lg sm:text-xl font-black rounded-2xl shadow-[0_6px_15px_rgba(16,185,129,0.25)] border-b-4 border-emerald-700 active:border-b-0 cursor-pointer transition-all flex items-center justify-center gap-2 tracking-wide landscape:py-2.5 landscape:text-base landscape:border-b-2"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      START RACE
                    </motion.button>
                  </div>
                )}
              </div>

            </div>

            {error && <p className="text-rose-500 text-[10px] font-bold mt-3 leading-tight bg-rose-50 p-2 rounded-xl border border-rose-200/50">{error}</p>}
          </div>
        </motion.div>
      </div>
    )
  }

  // Active game (handles countdown transition state or renders GameView)
  if (step === 'active' && session && questions) {
    return (
      <>
        {/* Cinematic E-Sports Countdown Transition Overlay (Compact landscape) */}
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
                  animate={{ 
                    scale: [0, 1.3, 1],
                    opacity: 1 
                  }}
                  exit={{ scale: 1.8, opacity: 0 }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 240, 
                    damping: 20,
                    duration: 0.7
                  }}
                  className={`text-7xl sm:text-8xl md:text-9xl font-black font-mono tracking-tight text-center drop-shadow-[0_10px_40px_rgba(99,102,241,0.4)] ${
                    countdownNum === 'GO!' 
                      ? 'bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-indigo-400 via-purple-400 to-rose-400 bg-clip-text text-transparent'
                  }`}
                >
                  {countdownNum}
                </motion.div>
              </AnimatePresence>
              
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 0.6, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-indigo-300 font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs mt-4"
              >
                Entering spelling arena
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        <CompetitionGameView engine={engine} level={session.level} />
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF5F0] text-indigo-400 font-bold gap-2.5">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      <span className="text-sm font-black">Entering spelling vault...</span>
    </div>
  )
}
