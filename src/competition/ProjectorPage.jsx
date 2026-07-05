import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Timer, QrCode, Users, Loader2, ShieldAlert, LogIn, BookOpen, Calculator } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from './supabaseClient'
import { fireConfetti } from '../utils/confetti'
import logo from '../assets/wonderkids_logo.webp'

const FLAG_CDN = 'https://flagcdn.com/w40'
const PROJECTOR_FONT = "'Playfair Display', Georgia, 'Times New Roman', serif"

function FlagIcon({ country }) {
  const [failed, setFailed] = useState(false)
  if (!country) return null
  if (failed) return <span className="text-sm" title={country}>🌍</span>
  return (
    <img
      src={`${FLAG_CDN}/${country.toLowerCase()}.png`}
      alt={country}
      className="w-8 h-5.5 object-cover rounded-sm inline-block shadow-sm"
      onError={() => setFailed(true)}
    />
  )
}

function formatTime(seconds) {
  if (seconds == null) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ProjectorPage() {
  const [theme, setTheme] = useState('dark')
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [engState, setEngState] = useState(null)
  const [mathState, setMathState] = useState(null)
  const [sessions, setSessions] = useState([])
  const [displayLevel, setDisplayLevel] = useState(null)
  const [elapsed, setElapsed] = useState(null)
  const [showPodium, setShowPodium] = useState(false)
  const realtimeDebounceRef = useRef(null)

  const state = engState || mathState
  const competitionId = state?.competition_id

  const activeSubject = useMemo(() => {
    const engLive = engState?.is_unlocked && engState?.started_at
    const mathLive = mathState?.is_unlocked && mathState?.started_at
    if (engLive) return 'english'
    if (mathLive) return 'math'
    if (engState?.is_unlocked) return 'english'
    if (mathState?.is_unlocked) return 'math'
    const mathSessions = sessions.filter(s => s.subject === 'math')
    const hasMathActivity = mathSessions.some(s => s.status === 'completed' || s.status === 'active')
    if (hasMathActivity) return 'math'
    return 'english'
  }, [engState, mathState, sessions])

  const activeState = activeSubject === 'math' ? mathState : engState

  const subjectSessions = useMemo(
    () => sessions.filter(s => s.subject === activeSubject),
    [sessions, activeSubject]
  )

  const qrCode = useMemo(() => (
    <QRCodeSVG value={window.location.origin + '/play'} size={360} level="H" marginSize={0} />
  ), [])

  useEffect(() => {
    if (engState?.theme) setTheme(engState.theme)
    else if (mathState?.theme) setTheme(mathState.theme)
  }, [engState?.theme, mathState?.theme])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) setAuthed(true) })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    else setAuthed(true)
  }

  const loadStates = useCallback(async () => {
    const { data } = await supabase.from('competition_state').select('*').in('id', ['english', 'math'])
    if (data) {
      for (const d of data) {
        if (d.id === 'english') setEngState(d)
        if (d.id === 'math') setMathState(d)
      }
    }
  }, [])

  const loadSessions = useCallback(async () => {
    if (!competitionId) return
    const { data } = await supabase
      .from('competition_sessions')
      .select('participant_id, participant_code, display_id, competition_id, name, school, country, age, subject, level, status, provisional_score, validated_score, questions_answered, time_spent_seconds, ready, started_at, completed_at, updated_at, last_seen_at')
      .eq('competition_id', competitionId)
    if (data) setSessions(data)
  }, [competitionId])

  useEffect(() => { if (authed) loadStates() }, [authed, loadStates])
  useEffect(() => { if (authed) loadSessions() }, [loadSessions])

  useEffect(() => {
    if (!authed) return
    const id = setInterval(loadStates, 5000)
    return () => clearInterval(id)
  }, [authed, loadStates])

  useEffect(() => {
    if (!authed || !competitionId) return
    const channel = supabase.channel('projector-sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'competition_sessions',
        filter: `competition_id=eq.${competitionId}`,
      }, () => {
        clearTimeout(realtimeDebounceRef.current)
        realtimeDebounceRef.current = setTimeout(loadSessions, 1000)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [authed, competitionId, loadSessions])

  useEffect(() => {
    if (!activeState?.started_at || !activeState?.is_unlocked) { setElapsed(null); return }
    const start = new Date(activeState.started_at).getTime()
    const allDone = subjectSessions.length > 0 && subjectSessions.every(s => s.status === 'completed' || s.status === 'waiting')
    const anyCompleted = subjectSessions.some(s => s.status === 'completed')
    if (allDone && anyCompleted) {
      const lastDone = Math.max(...subjectSessions.filter(s => s.completed_at).map(s => new Date(s.completed_at).getTime()))
      setElapsed(Math.round((lastDone - start) / 1000))
      return
    }
    const id = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [activeState?.started_at, activeState?.is_unlocked, subjectSessions])

  const levels = [...new Set(subjectSessions.map(s => s.level))].sort((a, b) => a - b)
  const activeLevel = displayLevel || (levels.length > 0 ? levels.reduce((best, l) => {
    const count = subjectSessions.filter(s => s.level === l).length
    return count > subjectSessions.filter(s => s.level === best).length ? l : best
  }, levels[0]) : null)

  useEffect(() => {
    if (levels.length > 0) {
      const bestLevel = levels.reduce((best, l) => {
        const count = subjectSessions.filter(s => s.level === l).length
        return count > subjectSessions.filter(s => s.level === best).length ? l : best
      }, levels[0])
      setDisplayLevel(bestLevel)
    }
  }, [activeSubject])

  const levelSessions = subjectSessions.filter(s => s.level === activeLevel)

  const scored = levelSessions.filter(s => s.status === 'active' || s.status === 'completed')
  const unscored = levelSessions.filter(s => s.status !== 'active' && s.status !== 'completed')
  const sortedScored = [...scored].sort((a, b) => {
    const scoreA = a.validated_score ?? a.provisional_score ?? 0
    const scoreB = b.validated_score ?? b.provisional_score ?? 0
    if (scoreB !== scoreA) return scoreB - scoreA
    return (a.time_spent_seconds || 0) - (b.time_spent_seconds || 0)
  })
  const statusPriority = { waiting: 0, registered: 1 }
  const sortedUnscored = [...unscored].sort((a, b) => (statusPriority[a.status] ?? 2) - (statusPriority[b.status] ?? 2))
  const sorted = [...sortedScored, ...sortedUnscored]

  const allCompleted = levelSessions.length > 0 && levelSessions.every(s => s.status === 'completed')

  const podiumSorted = allCompleted
    ? [...levelSessions].sort((a, b) => {
        if (b.validated_score !== a.validated_score) return b.validated_score - a.validated_score
        return a.time_spent_seconds - b.time_spent_seconds
      })
    : []

  useEffect(() => {
    if (allCompleted && !showPodium) {
      const timer = setTimeout(() => {
        setShowPodium(true)
        try { fireConfetti() } catch {}
        setTimeout(() => { try { fireConfetti() } catch {} }, 1500)
        setTimeout(() => { try { fireConfetti() } catch {} }, 3000)
      }, 2000)
      return () => clearTimeout(timer)
    }
    if (!allCompleted && showPodium) setShowPodium(false)
  }, [allCompleted, showPodium])

  const isDark = theme === 'dark'

  const bg = isDark ? 'bg-[#060814]' : 'bg-slate-50'
  const text = isDark ? 'text-white' : 'text-slate-800'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'
  const cardBg = isDark ? 'bg-[#0e1224]/60 border-white/5' : 'bg-white border-slate-200'
  const isMathSubject = activeSubject === 'math'
  const subjectLabel = isMathSubject ? 'Mathematics' : 'English Spelling'
  const sc = {
    blob: isMathSubject
      ? (isDark ? 'bg-emerald-500/15' : 'bg-emerald-300/20')
      : (isDark ? 'bg-blue-500/15' : 'bg-blue-300/20'),
    badgeBg: isMathSubject
      ? (isDark ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-emerald-50 border-emerald-200')
      : (isDark ? 'bg-blue-500/10 border-blue-500/25' : 'bg-blue-50 border-blue-200'),
    badgeText: isMathSubject
      ? (isDark ? 'text-emerald-300' : 'text-emerald-700')
      : (isDark ? 'text-blue-300' : 'text-blue-700'),
    dot: isMathSubject ? 'bg-emerald-500' : 'bg-blue-500',
    dotPing: isMathSubject ? 'bg-emerald-400' : 'bg-blue-400',
    accent: isMathSubject
      ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
      : (isDark ? 'text-blue-400' : 'text-blue-600'),
    levelBadge: isMathSubject
      ? (isDark ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600')
      : (isDark ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'),
  }

  const formatElapsed = (sec) => {
    if (sec == null) return '--:--'
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  }

  // ── LOGIN ──
  if (!authed) {
    return (
      <div style={{ fontFamily: PROJECTOR_FONT }} className={`min-h-screen flex items-center justify-center relative overflow-hidden p-4 transition-colors ${isDark ? 'bg-[#060814] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
        <div className={`absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[150px] pointer-events-none ${isDark ? 'bg-blue-600/10' : 'bg-blue-500/5'}`} />
        <div className={`absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full blur-[150px] pointer-events-none ${isDark ? 'bg-indigo-600/10' : 'bg-indigo-500/5'}`} />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
          <form onSubmit={handleLogin} className={`backdrop-blur-xl border p-8 rounded-3xl shadow-2xl text-center transition-colors ${isDark ? 'bg-[#0e1224]/70 border-white/5' : 'bg-white/80 border-slate-200'}`}>
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-6 ${isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'}`}>
              <LogIn className={`w-8 h-8 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Projector Portal</h1>
            <p className={`text-sm mt-1 mb-6 font-semibold ${textMuted}`}>Sign in to broadcast the championship</p>
            <AnimatePresence>
              {authError && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 mb-5 text-left flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-300 font-bold leading-normal">{authError}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space-y-4 text-left">
              <div>
                <label className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ml-1 ${textDim}`}>Admin Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${isDark ? 'bg-slate-950 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-600 focus:bg-white'}`}
                  required />
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ml-1 ${textDim}`}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${isDark ? 'bg-slate-950 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-600 focus:bg-white'}`}
                  required />
              </div>
            </div>
            <button type="submit" className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-lg cursor-pointer transition-all active:scale-[0.98]">
              Initialize Arena
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  // ── LOADING ──
  if (!state) {
    return (
      <div style={{ fontFamily: PROJECTOR_FONT }} className={`min-h-screen flex flex-col items-center justify-center font-bold text-xl gap-3 ${bg} ${textMuted}`}>
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <span>Initializing broadcast...</span>
      </div>
    )
  }

  // ── Phase detection ──
  const hasActive = subjectSessions.some(s => s.status === 'active')
  const isLobby = activeState?.is_unlocked && !hasActive && !activeState?.started_at
  const isPreLobby = !activeState?.is_unlocked && !allCompleted

  // ── PRE-LOBBY SPLASH ──
  if (isPreLobby) {
    return (
      <div style={{ fontFamily: PROJECTOR_FONT }} className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden transition-colors ${bg} ${text}`}>
        {isDark ? (
          <>
            <motion.div animate={{ scale: [1, 1.3, 1], x: [0, 80, 0], y: [0, -60, 0] }} transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-60 -left-60 w-[600px] h-[600px] rounded-full blur-[200px] pointer-events-none bg-blue-600/15" />
            <motion.div animate={{ scale: [1, 0.8, 1.2, 1], x: [0, -70, 40, 0], y: [0, 50, -30, 0] }} transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none bg-purple-600/12" />
            <motion.div animate={{ scale: [1, 1.1, 0.9, 1], y: [0, -40, 20, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full blur-[160px] pointer-events-none bg-amber-500/8" />
          </>
        ) : (
          <>
            <div className="absolute -top-60 -left-60 w-[600px] h-[600px] rounded-full blur-[200px] pointer-events-none bg-blue-300/20" />
            <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none bg-indigo-300/15" />
          </>
        )}

        <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{ backgroundImage: 'linear-gradient(rgba(128,128,128,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,.15) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="text-center relative z-10 flex flex-col items-center px-8">
          <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 12 }}>
            <img src={logo} alt="Wonder Kids" className="w-48 sm:w-56 lg:w-64 object-contain mb-4 drop-shadow-2xl" />
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 12, delay: 0.2 }}>
            <h1 className={`text-6xl sm:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9] ${
              isDark ? 'bg-gradient-to-b from-white via-blue-100 to-blue-300/60 bg-clip-text text-transparent' : 'bg-gradient-to-b from-slate-800 via-indigo-800 to-indigo-600 bg-clip-text text-transparent'
            }`}>
              International
            </h1>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-[0.12em] mt-4 ${
              isDark ? 'bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent' : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent'
            }`}>
              English Spelling &amp; Math
            </h2>
            <h2 className={`text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-[0.08em] mt-1 ${
              isDark ? 'bg-gradient-to-r from-indigo-300 to-amber-300 bg-clip-text text-transparent' : 'bg-gradient-to-r from-indigo-700 via-purple-600 to-amber-600 bg-clip-text text-transparent'
            }`}>
              Championship
            </h2>
          </motion.div>

          {state.round_label && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className={`text-xl font-bold mt-8 tracking-wide ${textMuted}`}>
              {state.round_label}
            </motion.p>
          )}

          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1, duration: 1 }}
            className={`w-64 h-px mt-10 ${isDark ? 'bg-gradient-to-r from-transparent via-white/15 to-transparent' : 'bg-gradient-to-r from-transparent via-slate-300 to-transparent'}`} />

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ delay: 1.2, duration: 3, repeat: Infinity }}
            className={`mt-10 flex items-center gap-4 px-8 py-4 rounded-2xl border ${isDark ? 'border-white/10 bg-white/5 text-slate-200' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>
            <div className={`w-3 h-3 rounded-full animate-pulse ${isDark ? 'bg-amber-400' : 'bg-amber-500'}`} />
            <span className="text-lg font-black uppercase tracking-[0.25em]">Awaiting Launch</span>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
            className="flex items-center gap-8 mt-12 text-4xl">
            <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity }}>🥉</motion.span>
            <motion.span animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0.2 }}>🥈</motion.span>
            <motion.span animate={{ y: [0, -16, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.4 }} className="text-6xl">🏆</motion.span>
            <motion.span animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0.6 }}>🥈</motion.span>
            <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.8 }}>🥉</motion.span>
          </motion.div>
        </div>

      </div>
    )
  }

  // ── LOBBY ──
  if (isLobby) {
    const readyStudents = subjectSessions.filter(s => s.ready)

    return (
      <div style={{ fontFamily: PROJECTOR_FONT }} className={`min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden transition-colors ${bg} ${text}`}>
        {isDark ? (
          <>
            <motion.div animate={{ scale: [1, 1.2, 1], x: [0, 60, 0], y: [0, -40, 0] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none ${sc.blob}`} />
            <motion.div animate={{ scale: [1, 0.9, 1.1, 1], x: [0, -50, 30, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none bg-indigo-600/12" />
          </>
        ) : (
          <>
            <div className={`absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none ${sc.blob}`} />
            <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none bg-indigo-300/15" />
          </>
        )}

        <div className="text-center max-w-5xl w-full relative z-10 flex flex-col items-center">
          {/* Subject badge */}
          <motion.div initial={{ opacity: 0, scale: 0.5, y: -40 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', damping: 10, stiffness: 80 }}
            className="mb-4">
            <div className={`flex items-center gap-4 border px-8 py-4 rounded-2xl backdrop-blur-md shadow-lg ${sc.badgeBg}`}>
              <span className="relative flex h-4 w-4">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dotPing} opacity-75`} />
                <span className={`relative inline-flex h-4 w-4 rounded-full ${sc.dot}`} />
              </span>
              <span className={`text-lg font-black uppercase tracking-[0.2em] ${sc.badgeText}`}>
                {subjectLabel} — Join Now!
              </span>
              <span className="relative flex h-4 w-4">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dotPing} opacity-75`} />
                <span className={`relative inline-flex h-4 w-4 rounded-full ${sc.dot}`} />
              </span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className={`text-4xl sm:text-5xl font-black uppercase tracking-tight mb-1 ${isDark ? 'text-white' : 'bg-gradient-to-r from-indigo-700 via-purple-600 to-indigo-700 bg-clip-text text-transparent'}`}>
            International Championship
          </motion.h1>

          {activeState?.round_label && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 0.4 }}
              className={`text-lg font-bold mb-6 tracking-wide ${textMuted}`}>
              {activeState.round_label}
            </motion.p>
          )}

          {/* QR Code */}
          <motion.div initial={{ opacity: 0, scale: 0.6, rotateX: 30 }} animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 70, delay: 0.4 }}
            className={`backdrop-blur-xl border rounded-[32px] p-7 shadow-2xl relative overflow-hidden ${
              isDark ? 'bg-[#0e1224]/80 border-white/10' : 'bg-white border-slate-200'
            }`}>
            <div className="bg-white rounded-2xl p-4 shadow-inner">
              {qrCode}
            </div>
          </motion.div>

          {/* Scan instruction */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-6">
            <div className={`flex items-center gap-3 mb-1.5 ${sc.accent}`}>
              <QrCode className="w-5 h-5" />
              <p className="text-xl font-black tracking-tight">Scan to Enter the Arena</p>
              <QrCode className="w-5 h-5" />
            </div>
            <p className={`text-sm font-mono ${textDim}`}>{window.location.origin}/play</p>
          </motion.div>

          {/* Connected students */}
          {subjectSessions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-10 w-full">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Users className={`w-4 h-4 ${textDim}`} />
                <span className={`text-xs font-black uppercase tracking-widest ${textDim}`}>
                  Participants Ready: {readyStudents.length} / {subjectSessions.length}
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto px-4 max-h-[200px] overflow-y-auto projector-scroll">
                <AnimatePresence>
                  {[...subjectSessions].sort((a, b) => (b.ready ? 1 : 0) - (a.ready ? 1 : 0)).map((s, i) => (
                    <motion.div key={s.participant_id || s.id} layout
                      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className={`px-3.5 py-2 rounded-full border text-sm font-bold flex items-center gap-2 ${
                        s.ready
                          ? isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : isDark ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.ready ? 'bg-emerald-400 animate-pulse' : isDark ? 'bg-slate-500' : 'bg-slate-400'}`} />
                      {s.name}
                      <FlagIcon country={s.country} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </div>

      </div>
    )
  }

  // ── PODIUM ──
  if (showPodium && podiumSorted.length > 0) {
    const duration = activeState?.duration_seconds ?? 300
    const extra = activeState?.extra_seconds ?? 0
    const maxTime = duration + extra

    const podiumColors = isDark
      ? [
          'from-amber-400 via-yellow-500 to-orange-500 shadow-amber-500/20 border-amber-300/30',
          'from-sky-300 via-cyan-400 to-blue-500 shadow-sky-400/20 border-sky-300/30',
          'from-amber-600 via-amber-700 to-orange-800 shadow-amber-700/20 border-amber-600/30'
        ]
      : [
          'from-amber-300 via-yellow-400 to-yellow-500 shadow-amber-200/40 border-amber-200',
          'from-sky-200 via-blue-300 to-cyan-300 shadow-sky-200/40 border-sky-200',
          'from-orange-200 via-orange-300 to-amber-300 shadow-orange-200/40 border-orange-200'
        ]
    const podiumHeights = ['h-60 sm:h-64', 'h-48 sm:h-52', 'h-36 sm:h-40']
    const podiumLabels = ['1ST', '2ND', '3RD']
    const podiumOrder = [1, 0, 2]

    return (
      <div style={{ fontFamily: PROJECTOR_FONT }} className={`min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden transition-colors ${bg} ${text}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,rgba(0,0,0,0)_70%)] pointer-events-none" />

        {/* Level switcher + back button */}
        <div className="absolute top-6 right-6 z-20 flex items-center gap-4">
          {levels.length > 0 && (
            <div className={`flex gap-1 border rounded-2xl p-1.5 backdrop-blur-md shadow-lg ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
              {levels.map(l => (
                <button key={l} onClick={() => { setDisplayLevel(l); setShowPodium(true) }}
                  className={`px-4 py-2 rounded-xl font-black text-sm tracking-wider transition-all cursor-pointer ${
                    activeLevel === l
                      ? isMathSubject
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                        : 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                  }`}>
                  Level {l}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowPodium(false)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer font-black text-xs uppercase tracking-wider transition-all ${isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'}`}
            title="Back to leaderboard">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Leaderboard
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-14 relative z-10">
          <p className={`text-sm font-black uppercase tracking-[0.3em] mb-2 ${sc.accent}`}>
            {subjectLabel}
          </p>
          <h1 className={`text-5xl sm:text-6xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Level {activeLevel} Results
          </h1>
        </motion.div>

        <div className="flex items-end justify-center gap-6 sm:gap-12 w-full max-w-5xl relative z-10">
          {podiumOrder.map((idx, displayIdx) => {
            const student = podiumSorted[idx]
            if (!student) return null
            const cappedTime = Math.min(student.time_spent_seconds || 0, maxTime)
            return (
              <motion.div key={student.participant_id} className="flex flex-col items-center w-48 sm:w-56 text-center"
                initial={{ opacity: 0, y: 150 }} animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 18, stiffness: 80, delay: 0.5 + displayIdx * 0.5 }}>
                <div className="mb-4">
                  <FlagIcon country={student.country} />
                  <p className={`text-2xl sm:text-3xl font-black mt-2 leading-tight max-w-[220px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{student.name}</p>
                  {student.school && <p className={`text-sm font-bold mt-1 max-w-[200px] truncate ${textMuted}`}>{student.school}</p>}
                  <p className={`text-5xl sm:text-6xl font-black mt-3 font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{student.validated_score}</p>
                  <p className={`text-sm font-mono font-bold mt-1 ${textDim}`}>{formatTime(cappedTime)}</p>
                </div>
                <div className={`w-full ${podiumHeights[idx]} bg-gradient-to-t ${podiumColors[idx]} border rounded-t-2xl shadow-xl flex items-center justify-center relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-white/5 opacity-40 mix-blend-overlay" />
                  <span className={`text-2xl sm:text-3xl font-black uppercase tracking-wider relative z-10 ${isDark ? 'text-white/95' : 'text-slate-700'}`}>
                    {podiumLabels[idx]}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>

        {podiumSorted.length > 3 && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }}
            className={`mt-14 w-full max-w-3xl border rounded-3xl p-5 shadow-lg relative z-10 ${cardBg}`}>
            <table className="w-full text-base font-semibold">
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {podiumSorted.slice(3).map((s, i) => {
                  const cappedTime = Math.min(s.time_spent_seconds || 0, maxTime)
                  return (
                    <tr key={s.participant_id} className={isDark ? 'hover:bg-white/[0.01]' : 'hover:bg-slate-50'}>
                      <td className={`py-3 px-4 font-mono text-left font-bold w-12 text-lg ${textDim}`}>{i + 4}</td>
                      <td className="py-3 px-2 w-12 text-center"><FlagIcon country={s.country} /></td>
                      <td className={`py-3 px-4 font-black text-left text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.name}</td>
                      <td className={`py-3 px-4 text-left truncate max-w-[200px] ${textMuted}`}>{s.school || ''}</td>
                      <td className={`py-3 px-4 font-black text-right text-xl font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.validated_score}</td>
                      <td className={`py-3 px-4 font-mono text-right font-bold ${textDim}`}>{formatTime(cappedTime)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </motion.div>
        )}

      </div>
    )
  }

  // ── LIVE LEADERBOARD ──
  return (
    <div style={{ fontFamily: PROJECTOR_FONT }} className={`min-h-screen p-5 relative overflow-hidden flex flex-col transition-colors ${bg} ${text}`}>
      {isDark ? (
        <>
          <motion.div animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -30, 0] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[-30%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none bg-blue-600/8" />
          <motion.div animate={{ scale: [1, 0.9, 1.1, 1], x: [0, -40, 20, 0] }} transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none bg-indigo-600/8" />
        </>
      ) : (
        <>
          <motion.div animate={{ scale: [1, 1.15, 1], x: [0, 40, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[-30%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none bg-blue-300/15" />
          <motion.div animate={{ scale: [1, 0.9, 1.1, 1], x: [0, -30, 15, 0] }} transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none bg-indigo-300/10" />
        </>
      )}

      {/* Header */}
      <header className={`flex items-center justify-between mb-6 border px-5 py-3 rounded-2xl backdrop-blur-md relative z-10 shadow-sm ${cardBg}`}>
        <div className="flex items-center gap-3">
          {activeSubject === 'math'
            ? <Calculator className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            : <BookOpen className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          }
          <h1 className={`text-2xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {subjectLabel}
          </h1>
          {activeLevel != null && levels.length <= 1 && (
            <span className={`text-sm font-black px-2.5 py-1 rounded-lg border ${sc.levelBadge}`}>
              Level {activeLevel}
            </span>
          )}
          {activeState?.round_label && <span className={`text-xs font-bold uppercase tracking-wider ${textDim}`}>{activeState.round_label}</span>}
        </div>

        <div className="flex items-center gap-3">
          {levels.length > 0 && (
            <div className={`flex gap-1 border rounded-2xl p-1.5 backdrop-blur-md shadow-lg ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
              {levels.map(l => {
                const lvlSessions = subjectSessions.filter(s => s.level === l)
                const doneCount = lvlSessions.filter(s => s.status === 'completed').length
                const activeCount = lvlSessions.filter(s => s.status === 'active').length
                const hasActivity = activeCount > 0 || doneCount > 0
                return (
                  <button key={l} onClick={() => setDisplayLevel(l)}
                    className={`px-4 py-2 rounded-xl font-black text-sm tracking-wider transition-all cursor-pointer flex items-center gap-2.5 ${
                      activeLevel === l
                        ? isMathSubject
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                          : 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                        : isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                    }`}>
                    <span>Level {l}</span>
                    {hasActivity && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg ${
                        activeLevel === l
                          ? 'bg-white/20'
                          : doneCount === lvlSessions.length
                            ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                            : isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {activeCount > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-1 align-middle" />}
                        {doneCount}/{lvlSessions.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {elapsed != null && (
            <div className={`flex items-center gap-2 border rounded-xl px-3.5 py-1.5 font-mono ${
              isDark ? 'bg-rose-500/10 border-rose-500/25 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}>
              <Timer className="w-4 h-4" />
              <span className="text-lg font-black">{formatElapsed(elapsed)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Column headers */}
      <div className={`grid grid-cols-[3.5rem_3.5rem_1.5fr_1fr_5rem_5rem_5rem] gap-3 px-5 pr-6 py-1.5 text-[10px] font-black uppercase tracking-widest ${textDim}`}>
        <span>Rank</span>
        <span></span>
        <span>Participant</span>
        <span>School</span>
        <span className="text-right">Score</span>
        <span className="text-right">Time</span>
        <span className="text-right">Status</span>
      </div>

      {/* Rows */}
      <div className="flex-1 space-y-1.5 relative z-10 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 projector-scroll">
        <AnimatePresence mode="popLayout">
          {sorted.map((s) => {
            const hasScore = s.status === 'active' || s.status === 'completed'
            const scoredRank = hasScore ? sortedScored.indexOf(s) : -1

            const cardThemes = !hasScore
              ? isDark ? 'bg-white/[0.02] border-white/[0.03] opacity-50' : 'bg-slate-50 border-slate-200/40 opacity-50'
              : scoredRank === 0
                ? isDark
                  ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border-amber-400/40'
                  : 'bg-gradient-to-r from-yellow-100 via-amber-50 to-transparent border-amber-300'
              : scoredRank === 1
                ? isDark
                  ? 'bg-gradient-to-r from-sky-400/15 via-cyan-400/8 to-transparent border-sky-400/30'
                  : 'bg-gradient-to-r from-sky-100 via-blue-50 to-transparent border-sky-300'
              : scoredRank === 2
                ? isDark
                  ? 'bg-gradient-to-r from-orange-600/15 via-amber-700/5 to-transparent border-orange-500/30'
                  : 'bg-gradient-to-r from-orange-100 via-orange-50 to-transparent border-orange-300'
              : s.status === 'completed'
                ? isDark ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-emerald-50/50 border-emerald-200'
                : isDark ? 'bg-[#0e1224]/30 border-white/[0.03]' : 'bg-white border-slate-200/60'

            const rankColors = !hasScore ? textDim
              : scoredRank === 0
                ? isDark ? 'text-amber-400' : 'text-yellow-600'
              : scoredRank === 1
                ? isDark ? 'text-sky-300' : 'text-sky-600'
              : scoredRank === 2
                ? isDark ? 'text-orange-400' : 'text-orange-600'
              : textDim

            return (
              <motion.div key={s.participant_id} layout
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className={`grid grid-cols-[3.5rem_3.5rem_1.5fr_1fr_5rem_5rem_5rem] gap-3 items-center px-5 py-3.5 rounded-xl border font-bold ${cardThemes}`}>
                <span className={`text-2xl font-black font-mono ${rankColors}`}>
                  {!hasScore ? '—' : scoredRank < 3 ? ['🥇', '🥈', '🥉'][scoredRank] : scoredRank + 1}
                </span>
                <span><FlagIcon country={s.country} /></span>
                <span className={`font-black truncate text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.name}</span>
                <span className={`truncate text-sm ${textMuted}`}>{s.school || ''}</span>
                <span className={`text-right text-xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.validated_score ?? s.provisional_score}</span>
                <span className={`text-right font-mono text-sm ${textMuted}`}>{s.status === 'completed' ? formatTime(Math.min(s.time_spent_seconds || 0, (activeState?.duration_seconds ?? 300) + (activeState?.extra_seconds ?? 0))) : '—'}</span>
                <span className="text-right">
                  {(() => {
                    const isOnline = s.last_seen_at && (Date.now() - new Date(s.last_seen_at).getTime()) < 45000
                    if (s.status === 'completed') return (
                      <span className={`text-[10px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-lg ${
                        isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      }`}>Done</span>
                    )
                    if (s.status === 'active' && isOnline) return (
                      <span className={`text-[10px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-lg inline-flex items-center gap-1 ${
                        isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Playing
                      </span>
                    )
                    if (s.status === 'active' && !isOnline) return (
                      <span className={`text-[10px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-lg ${
                        isDark ? 'text-rose-400 bg-rose-500/10 border-rose-500/25' : 'text-rose-600 bg-rose-50 border-rose-200'
                      }`}>Disconnected</span>
                    )
                    if (s.status === 'waiting' && isOnline) return (
                      <span className={`text-[10px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-lg ${
                        isDark ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-amber-600 bg-amber-50 border-amber-200'
                      }`}>Lobby</span>
                    )
                    return (
                      <span className={`text-[10px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-lg ${
                        isDark ? 'text-slate-500 bg-white/5 border-white/10' : 'text-slate-400 bg-slate-100 border-slate-200'
                      }`}>Offline</span>
                    )
                  })()}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {sorted.length === 0 && (
          <div className={`flex flex-col items-center justify-center py-20 gap-2 ${textMuted}`}>
            <Users className="w-8 h-8" />
            <p className="text-xl font-bold uppercase tracking-wider">Waiting for students to join...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={`mt-4 px-5 py-3.5 border rounded-2xl flex items-center justify-between text-xs font-black uppercase tracking-widest relative z-10 ${cardBg} ${textDim}`}>
        <span className="flex items-center gap-2">
          <Trophy className={`w-4 h-4 ${sc.accent}`} />
          {levelSessions.filter(s => s.status === 'completed').length} / {levelSessions.length} Completed
        </span>
        <span>Level {activeLevel} • {subjectLabel}</span>
      </footer>
    </div>
  )
}
