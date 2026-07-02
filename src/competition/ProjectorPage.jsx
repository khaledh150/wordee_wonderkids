import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Award, Star, Timer, QrCode, Users, Loader2, ShieldAlert, CheckCircle, TrendingUp, LogIn } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from './supabaseClient'
import { fireConfetti } from '../utils/confetti'

const FLAG_CDN = 'https://flagcdn.com/w40'

function FlagIcon({ country }) {
  if (!country) return null
  return (
    <img
      src={`${FLAG_CDN}/${country.toLowerCase()}.png`}
      alt={country}
      className="w-8 h-5.5 object-cover rounded-sm inline-block shadow-sm"
      onError={e => { e.target.style.display = 'none' }}
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

  const [state, setState] = useState(null)
  const [sessions, setSessions] = useState([])
  const [subject] = useState('english')
  const [displayLevel, setDisplayLevel] = useState(null)
  const [elapsed, setElapsed] = useState(null)
  const [showPodium, setShowPodium] = useState(false)
  const channelRef = useRef(null)
  const realtimeDebounceRef = useRef(null)

  // Sync theme from DB state (admin controls it)
  useEffect(() => {
    if (state?.theme) setTheme(state.theme)
  }, [state?.theme])

  // Auth check
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

  // Load state
  const loadState = useCallback(async () => {
    const { data } = await supabase
      .from('competition_state')
      .select('*')
      .eq('id', subject)
      .single()
    if (data) setState(data)
  }, [subject])

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!state) return
    const { data } = await supabase
      .from('competition_sessions')
      .select('*')
      .eq('competition_id', state.competition_id)
      .eq('subject', subject)
    if (data) setSessions(data)
  }, [state, subject])

  useEffect(() => { if (authed) loadState() }, [authed, loadState])
  useEffect(() => { if (authed) loadSessions() }, [loadSessions])

  // Poll state every 5s
  useEffect(() => {
    if (!authed) return
    const id = setInterval(loadState, 5000)
    return () => clearInterval(id)
  }, [authed, loadState])

  // Realtime subscription
  useEffect(() => {
    if (!authed || !state) return
    const channel = supabase.channel('projector-sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'competition_sessions',
        filter: `competition_id=eq.${state.competition_id}`,
      }, () => {
        clearTimeout(realtimeDebounceRef.current)
        realtimeDebounceRef.current = setTimeout(loadSessions, 1000)
      })
      .subscribe()
    channelRef.current = channel
    return () => supabase.removeChannel(channel)
  }, [authed, state?.competition_id, loadSessions])

  // Elapsed timer
  useEffect(() => {
    if (!state?.started_at || !state?.is_unlocked) { setElapsed(null); return }
    const start = new Date(state.started_at).getTime()
    const allDone = sessions.length > 0 && sessions.every(s => s.status === 'completed' || s.status === 'waiting')
    const anyCompleted = sessions.some(s => s.status === 'completed')
    if (allDone && anyCompleted) {
      const lastDone = Math.max(...sessions.filter(s => s.completed_at).map(s => new Date(s.completed_at).getTime()))
      setElapsed(Math.round((lastDone - start) / 1000))
      return
    }
    const id = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [state?.started_at, state?.is_unlocked, sessions])

  // Get available levels
  const levels = [...new Set(sessions.map(s => s.level))].sort((a, b) => a - b)

  // Determine which level to show
  const activeLevel = state?.active_level || displayLevel || (levels[0] ?? null)

  // Auto-rotate levels every 15s if no admin-pinned level
  useEffect(() => {
    if (state?.active_level || levels.length <= 1) return
    let idx = levels.indexOf(displayLevel) || 0
    const timer = setInterval(() => {
      idx = (idx + 1) % levels.length
      setDisplayLevel(levels[idx])
    }, 15000)
    return () => clearInterval(timer)
  }, [state?.active_level, levels.length, displayLevel])

  // Filter and sort for current level — show ALL students
  const levelSessions = sessions.filter(s => s.level === activeLevel)
  const sorted = [...levelSessions].sort((a, b) => {
    if (b.provisional_score !== a.provisional_score) return b.provisional_score - a.provisional_score
    return a.time_spent_seconds - b.time_spent_seconds
  })

  // Check if all completed for podium
  const allCompleted = levelSessions.length > 0 && levelSessions.every(s => s.status === 'completed')

  // Podium data (by validated_score)
  const podiumSorted = allCompleted
    ? [...levelSessions].sort((a, b) => {
        if (b.validated_score !== a.validated_score) return b.validated_score - a.validated_score
        return a.time_spent_seconds - b.time_spent_seconds
      })
    : []

  // Trigger podium reveal — reset when not all completed (e.g. admin reset)
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

  const formatElapsed = (sec) => {
    if (sec == null) return '--:--'
    return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`
  }

  // 1. PROJECTOR GATEWAY LOGIN
  if (!authed) {
    return (
      <div className={`min-h-screen flex items-center justify-center relative overflow-hidden p-4 transition-colors duration-300 ${
        isDark ? 'bg-[#060814] text-slate-100' : 'bg-[#f1f5f9] text-slate-800'
      }`}>
        {/* Dynamic backdrop glows */}
        <div className={`absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[150px] pointer-events-none transition-colors ${
          isDark ? 'bg-blue-600/10' : 'bg-blue-500/5'
        }`} />
        <div className={`absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full blur-[150px] pointer-events-none transition-colors ${
          isDark ? 'bg-indigo-600/10' : 'bg-indigo-500/5'
        }`} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <form 
            onSubmit={handleLogin} 
            className={`backdrop-blur-xl -webkit-backdrop-blur-xl border p-8 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.15)] text-center transition-colors ${
              isDark ? 'bg-[#0e1224]/70 border-white/5' : 'bg-white/80 border-slate-200'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-6 shadow-inner ${
              isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'
            }`}>
              <LogIn className={`w-8 h-8 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>

            <h1 className={`text-2xl font-black tracking-tight transition-colors ${
              isDark ? 'bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent' : 'text-slate-800'
            }`}>
              Projector Portal
            </h1>
            <p className={`text-sm mt-1 mb-6 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sign in to broadcast the championship</p>

            <AnimatePresence>
              {authError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 mb-5 text-left flex items-start gap-2.5"
                >
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-300 font-bold leading-normal">{authError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4 text-left">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5 ml-1">Admin Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="your@email.com" 
                  className={`w-full px-4 py-3 rounded-xl border text-sm transition-colors focus:outline-none ${
                    isDark ? 'bg-slate-950 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-600 focus:bg-white'
                  }`} 
                  required 
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5 ml-1">Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className={`w-full px-4 py-3 rounded-xl border text-sm transition-colors focus:outline-none ${
                    isDark ? 'bg-slate-950 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-600 focus:bg-white'
                  }`} 
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-lg cursor-pointer transition-all active:scale-[0.98]"
            >
              Initialize Arena
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  // Loading Session
  if (!state) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center font-bold text-xl gap-3 transition-colors ${
        isDark ? 'bg-[#060814] text-slate-400' : 'bg-[#f1f5f9] text-slate-600'
      }`}>
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <span>Broadcasting network settings...</span>
      </div>
    )
  }

  // Derive phase for projector
  const hasActive = sessions.some(s => s.status === 'active')
  const isLobby = state.is_unlocked && !hasActive
  const isPreLobby = !state.is_unlocked && !allCompleted

  // 2A. CHAMPIONSHIP SPLASH — idle screen before admin opens lobby
  if (isPreLobby) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500 ${
        isDark ? 'bg-[#030712] text-white' : 'bg-[#f1f5f9] text-slate-800'
      }`}>
        {/* Animated gradient orbs */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], x: [0, 80, 0], y: [0, -60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-60 -left-60 w-[600px] h-[600px] rounded-full blur-[200px] pointer-events-none bg-blue-600/15"
        />
        <motion.div
          animate={{ scale: [1, 0.8, 1.2, 1], x: [0, -70, 40, 0], y: [0, 50, -30, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none bg-purple-600/12"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 0.9, 1], y: [0, -40, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full blur-[160px] pointer-events-none bg-amber-500/8"
        />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />

        <div className="text-center relative z-10 flex flex-col items-center px-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 border px-8 py-3 rounded-full mb-10 bg-white/5 border-white/10 backdrop-blur-md shadow-lg"
          >
            <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
              <Star className="w-5 h-5 text-amber-400" />
            </motion.div>
            <span className="text-sm font-black uppercase tracking-[0.25em] text-amber-300/90">International Championship</span>
            <motion.div animate={{ rotate: [0, -360] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
              <Star className="w-5 h-5 text-amber-400" />
            </motion.div>
          </motion.div>

          {/* Main title */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 12, delay: 0.4 }}
          >
            <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black uppercase tracking-tight leading-[0.85] bg-gradient-to-b from-white via-blue-100 to-blue-300/60 bg-clip-text text-transparent drop-shadow-2xl">
              International
            </h1>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-[0.15em] mt-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              English Spelling &
            </h2>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-[0.15em] mt-1 bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
              Math Championship
            </h2>
          </motion.div>

          {/* Subjects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-6 mt-12"
          >
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl border bg-blue-500/10 border-blue-500/20 backdrop-blur-sm">
              <span className="text-3xl">📝</span>
              <span className="text-lg font-black uppercase tracking-wider text-blue-300">English</span>
            </div>
            <div className="text-2xl font-black text-white/20">&</div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 backdrop-blur-sm">
              <span className="text-3xl">🔢</span>
              <span className="text-lg font-black uppercase tracking-wider text-emerald-300">Mathematics</span>
            </div>
          </motion.div>

          {/* Round label */}
          {state.round_label && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-2xl font-bold mt-8 text-slate-400 tracking-wide"
            >
              {state.round_label}
            </motion.p>
          )}

          {/* Decorative line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
            className="w-64 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mt-10"
          />

          {/* Waiting message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ delay: 1.5, duration: 3, repeat: Infinity }}
            className="mt-8 flex items-center gap-3 text-slate-500"
          >
            <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-[0.2em]">Awaiting Launch</span>
          </motion.div>

          {/* Trophy icons decoration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="flex items-center gap-8 mt-14 text-4xl"
          >
            <motion.span animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0 }}>🥉</motion.span>
            <motion.span animate={{ y: [0, -12, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0.3 }}>🥈</motion.span>
            <motion.span animate={{ y: [0, -16, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.6 }} className="text-5xl">🏆</motion.span>
            <motion.span animate={{ y: [0, -12, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0.3 }}>🥈</motion.span>
            <motion.span animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0 }}>🥉</motion.span>
          </motion.div>
        </div>
      </div>
    )
  }

  // 2B. LOBBY — admin opened it, show transition + QR code
  if (isLobby) {
    const readyStudents = sessions.filter(s => s.ready)

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden transition-colors duration-500 ${
        isDark ? 'bg-[#030712] text-white' : 'bg-[#f1f5f9] text-slate-800'
      }`}>
        {/* Animated gradient orbs */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 60, 0], y: [0, -40, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none bg-emerald-500/15"
        />
        <motion.div
          animate={{ scale: [1, 0.9, 1.1, 1], x: [0, -50, 30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none bg-blue-600/12"
        />

        <div className="text-center max-w-5xl w-full relative z-10 flex flex-col items-center">
          {/* Entry transition banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 10, stiffness: 80 }}
            className="mb-6"
          >
            <div className="flex items-center gap-4 border px-8 py-4 rounded-2xl bg-emerald-500/10 border-emerald-500/25 backdrop-blur-md shadow-lg shadow-emerald-500/5">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
              </span>
              <span className="text-lg font-black uppercase tracking-[0.2em] text-emerald-300">Competition is Open — Join Now!</span>
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
              </span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl sm:text-6xl font-black uppercase tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2"
          >
            International Championship
          </motion.h1>

          {state.round_label && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.5 }}
              className="text-xl font-bold mb-8 text-slate-400 tracking-wide"
            >
              {state.round_label}
            </motion.p>
          )}

          {/* QR Code — cinematic reveal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotateX: 30 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 70, delay: 0.5 }}
            className="backdrop-blur-xl border rounded-[36px] p-8 shadow-[0_30px_70px_rgba(0,0,0,0.4)] relative overflow-hidden bg-[#0e1224]/80 border-white/10"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.06)_0%,rgba(0,0,0,0)_60%)] pointer-events-none" />
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute -inset-1 rounded-[36px] blur-md -z-10 bg-gradient-to-r from-emerald-500/15 via-blue-500/15 to-indigo-500/15"
            />

            <div className="bg-white rounded-3xl p-5 shadow-2xl">
              <QRCodeSVG
                value={window.location.origin + '/play'}
                size={288}
                level="M"
                marginSize={0}
              />
            </div>
          </motion.div>

          {/* Scan instruction */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-8"
          >
            <div className="flex items-center gap-3 text-emerald-400 mb-2">
              <QrCode className="w-6 h-6 animate-pulse" />
              <p className="text-2xl font-black tracking-tight">Scan to Enter the Arena</p>
              <QrCode className="w-6 h-6 animate-pulse" />
            </div>
            <p className="text-base font-mono text-slate-500">{window.location.origin}/play</p>
          </motion.div>

          {/* Connected students roster */}
          {sessions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="mt-12 w-full"
            >
              <div className="flex items-center justify-center gap-2 mb-5">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Participants Ready: {readyStudents.length} / {sessions.length}
                </span>
              </div>

              <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto px-4 max-h-[160px] overflow-hidden">
                <AnimatePresence>
                  {sessions.map((s, i) => (
                    <motion.div
                      key={s.participant_id || s.id}
                      layout
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ delay: 1.3 + i * 0.04 }}
                      className={`px-4 py-2.5 rounded-full border text-sm font-black flex items-center gap-2 shadow-md ${
                        s.ready
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-white/5 border-white/5 text-slate-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.ready ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
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

  // 3. CINEMATIC STAGED PODIUM REVEAL (Theme compliant)
  if (showPodium && podiumSorted.length > 0) {
    const podiumColors = isDark 
      ? [
          'from-amber-400 via-yellow-500 to-orange-500 shadow-amber-500/20 border-amber-300/30',
          'from-slate-300 via-slate-400 to-slate-500 shadow-slate-400/20 border-slate-300/30',
          'from-amber-600 via-amber-700 to-orange-800 shadow-amber-700/20 border-amber-600/30'
        ]
      : [
          'from-amber-300 via-yellow-400 to-yellow-500 shadow-amber-200/40 border-amber-200',
          'from-slate-100 via-slate-200 to-slate-300 shadow-slate-200/40 border-slate-200',
          'from-orange-100 via-orange-200 to-orange-300 shadow-orange-200/40 border-orange-200'
        ]

    const podiumHeights = ['h-60 sm:h-64', 'h-48 sm:h-52', 'h-36 sm:h-40']
    const podiumLabels = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place']
    const podiumOrder = [1, 0, 2] // sequence: 2nd, 1st, 3rd

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#060814] text-white' : 'bg-[#f1f5f9] text-slate-800'
      }`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,rgba(0,0,0,0)_70%)] pointer-events-none" />
        
        <motion.h1 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-5xl sm:text-6xl font-black text-center uppercase tracking-tight mb-16 relative z-10 transition-colors ${
            isDark ? 'bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent' : 'text-slate-800'
          }`}
        >
          Level {activeLevel} Official Results
        </motion.h1>

        {/* Columns container */}
        <div className="flex items-end justify-center gap-6 sm:gap-10 w-full max-w-4xl relative z-10">
          {podiumOrder.map((idx, displayIdx) => {
            const student = podiumSorted[idx]
            if (!student) return null
            return (
              <motion.div
                key={student.participant_id}
                className="flex flex-col items-center w-40 sm:w-48 text-center"
                initial={{ opacity: 0, y: 150 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  type: 'spring',
                  damping: 18, 
                  stiffness: 80, 
                  delay: 0.5 + displayIdx * 0.5 
                }}
              >
                {/* Winner Card Hovering details */}
                <div className="mb-4">
                  <div className="relative inline-block">
                    <FlagIcon country={student.country} />
                  </div>
                  <p className={`text-xl sm:text-2xl font-black mt-2 leading-none truncate max-w-[150px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{student.name}</p>
                  {student.school && <p className="text-xs text-slate-400 font-bold mt-1 max-w-[140px] truncate">{student.school}</p>}
                  <p className={`text-4xl font-black mt-2 font-mono tracking-tight ${isDark ? 'bg-gradient-to-br from-white to-slate-300 bg-clip-text text-transparent' : 'text-slate-850'}`}>{student.validated_score}</p>
                  <p className="text-xs text-slate-500 font-mono font-bold mt-0.5">{formatTime(student.time_spent_seconds)}</p>
                </div>

                {/* Columns */}
                <div className={`w-full ${podiumHeights[idx]} bg-gradient-to-t ${podiumColors[idx]} border rounded-t-2xl shadow-xl flex items-center justify-center relative overflow-hidden border-white/10`}>
                  <div className="absolute inset-0 bg-white/5 opacity-40 mix-blend-overlay animate-pulse" />
                  <span className={`text-xl sm:text-2xl font-black uppercase tracking-wider relative z-10 ${isDark ? 'text-white/95' : 'text-slate-800'}`}>
                    {podiumLabels[idx].split(' ')[1]}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Lower Ranks List below podium columns */}
        {podiumSorted.length > 3 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2 }}
            className={`mt-16 w-full max-w-2xl border rounded-3xl p-5 shadow-lg relative z-10 transition-colors ${
              isDark ? 'bg-[#0e1224]/30 border-white/5' : 'bg-white border-slate-200'
            }`}
          >
            <table className="w-full text-sm font-semibold">
              <tbody className="divide-y divide-white/5">
                {podiumSorted.slice(3).map((s, i) => (
                  <tr key={s.participant_id} className={`transition-colors ${isDark ? 'hover:bg-white/[0.01]' : 'hover:bg-slate-50/60'}`}>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-left font-bold w-12">{i + 4}</td>
                    <td className="py-2.5 px-2 w-12 text-center"><FlagIcon country={s.country} /></td>
                    <td className={`py-2.5 px-4 font-bold text-left ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.name}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-left truncate max-w-[200px]">{s.school || ''}</td>
                    <td className={`py-2.5 px-4 font-black text-right text-base font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.validated_score}</td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-right text-xs font-bold">{formatTime(s.time_spent_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </div>
    )
  }

  // 4. LIVE LEADERBOARD ARENA BOARD (E-Sports Tournament View with Light/Dark Themes)
  return (
    <div className={`min-h-screen p-6 relative overflow-hidden flex flex-col transition-colors duration-300 ${
      isDark ? 'bg-[#060814] text-white' : 'bg-[#f1f5f9] text-slate-800'
    }`}>
      {/* Background ambient lighting */}
      <div className={`absolute top-[-30%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none transition-colors ${
        isDark ? 'bg-blue-600/5' : 'bg-blue-500/3'
      }`} />
      <div className={`absolute bottom-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none transition-colors ${
        isDark ? 'bg-indigo-600/5' : 'bg-indigo-500/3'
      }`} />

      {/* Header section */}
      <header className={`flex items-center justify-between mb-8 border px-6 py-4.5 rounded-3xl backdrop-blur-md -webkit-backdrop-blur-md relative z-10 shadow-md transition-colors ${
        isDark ? 'bg-[#0e1224]/30 border-white/5' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-6">
          <div>
            <h1 className={`text-3xl font-black uppercase tracking-tight leading-none transition-colors ${
              isDark ? 'bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent' : 'text-slate-850'
            }`}>
              Championship Arena
            </h1>
            {state.round_label && <p className="text-slate-450 text-sm font-bold mt-1.5 uppercase tracking-wider">{state.round_label}</p>}
          </div>
          
          {elapsed != null && (
            <div className={`border rounded-2xl px-5 py-2 flex items-center gap-3.5 shadow-inner transition-colors ${
              isDark ? 'bg-rose-500/10 border-rose-500/25 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">Elapsed</p>
                <p className="text-2xl font-mono font-black leading-none mt-1">{formatElapsed(elapsed)}</p>
              </div>
              <Timer className="w-5 h-5 animate-pulse" />
            </div>
          )}
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-4">
          <div className={`flex border rounded-xl p-1 relative z-10 shadow-inner transition-colors ${
            isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
          }`}>
            {levels.map(l => (
              <button
                key={l}
                onClick={() => setDisplayLevel(l)}
                className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  activeLevel === l 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : isDark 
                      ? 'text-slate-400 hover:text-white/80' 
                      : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Level {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Leaderboard layout rows */}
      <div className="flex-1 space-y-2 relative z-10">
        <div className="grid grid-cols-[4rem_4rem_1.5fr_1fr_6rem_6rem_6rem] gap-4 px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
          <span>Rank</span>
          <span>Region</span>
          <span>Participant Name</span>
          <span>School Registry</span>
          <span className="text-right">Live Score</span>
          <span className="text-right">Speed</span>
          <span className="text-right">Progress</span>
        </div>
        
        <div className="space-y-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {sorted.map((s, i) => {
              const liveState = s.status === 'active'
              
              // Top 3 specific card configurations based on active theme
              const cardThemes = i === 0 
                ? isDark
                  ? 'bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border-amber-500/40 shadow-amber-500/5'
                  : 'bg-gradient-to-r from-yellow-100 to-yellow-50/50 border-yellow-350 shadow-yellow-100/30'
                : i === 1 
                  ? isDark
                    ? 'bg-gradient-to-r from-slate-400/10 via-slate-500/5 to-transparent border-slate-400/30 shadow-slate-400/5'
                    : 'bg-gradient-to-r from-slate-100 to-slate-50/50 border-slate-350 shadow-slate-100/30'
                  : i === 2 
                    ? isDark
                      ? 'bg-gradient-to-r from-amber-700/15 via-amber-800/5 to-transparent border-amber-600/30 shadow-amber-700/5'
                      : 'bg-gradient-to-r from-orange-100/80 to-orange-50/50 border-orange-350 shadow-orange-100/30'
                    : s.status === 'completed'
                      ? isDark 
                        ? 'bg-emerald-500/5 border-emerald-500/20' 
                        : 'bg-emerald-50/30 border-emerald-200'
                      : isDark
                        ? 'bg-[#0e1224]/30 border-transparent hover:bg-white/[0.01]'
                        : 'bg-white border-slate-200/60 shadow-[0_4px_15px_rgba(0,0,0,0.01)] hover:bg-slate-50/50'

              const rankTextColors = i === 0 
                ? isDark ? 'text-amber-400' : 'text-yellow-600'
                : i === 1 
                  ? isDark ? 'text-slate-300' : 'text-slate-500'
                  : i === 2 
                    ? isDark ? 'text-amber-600' : 'text-orange-700'
                    : 'text-slate-500'

              return (
                <motion.div
                  key={s.participant_id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className={`grid grid-cols-[4rem_4rem_1.5fr_1fr_6rem_6rem_6rem] gap-4 items-center px-6 py-4.5 rounded-2xl border text-base font-black ${cardThemes}`}
                >
                  <span className={`text-2xl font-black ${rankTextColors} font-mono`}>
                    {i + 1}
                  </span>
                  <span><FlagIcon country={s.country} /></span>
                  <span className={`font-black truncate text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.name}</span>
                  <span className={`truncate text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.school || ''}</span>
                  <span className={`text-right text-2xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.provisional_score}</span>
                  <span className={`text-right font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatTime(s.time_spent_seconds)}</span>
                  <span className="text-right">
                    {s.status === 'completed' ? (
                      <span className={`text-xs font-black uppercase tracking-widest border px-2.5 py-1 rounded-lg ${
                        isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      }`}>Done</span>
                    ) : (
                      <span className={`text-xs font-black uppercase tracking-widest border px-2.5 py-1 rounded-lg flex items-center justify-center gap-1 ${
                        isDark ? 'text-blue-400 bg-blue-500/10 border-blue-500/25' : 'text-blue-600 bg-blue-50 border-blue-200'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                        Live
                      </span>
                    )}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
              <Users className="w-8 h-8 animate-float text-slate-600" />
              <p className="text-xl font-bold uppercase tracking-wider">Waiting for students to join...</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer stats bar */}
      <footer className={`mt-8 px-6 py-4.5 border rounded-3xl flex items-center justify-between text-xs font-black uppercase tracking-widest relative z-10 shadow-md transition-colors ${
        isDark ? 'bg-[#0e1224]/30 border-white/5 text-slate-500' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        <span className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-500" />
          Progress: {levelSessions.filter(s => s.status === 'completed').length} / {levelSessions.length} Completed
        </span>
        <span className={`${isDark ? 'text-slate-400' : 'text-slate-650'}`}>Level {activeLevel} Broadcasting</span>
        {elapsed != null && <span className="font-mono text-rose-500 text-sm font-black">{formatElapsed(elapsed)}</span>}
      </footer>
    </div>
  )
}
