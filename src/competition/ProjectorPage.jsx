import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Award, Star, Timer, QrCode, Users, Loader2, ShieldAlert, CheckCircle, TrendingUp, Sparkles, LogIn } from 'lucide-react'
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
  const [theme, setTheme] = useState(() => localStorage.getItem('wordee_projector_theme') || 'dark')
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

  // Listen to cross-window or local storage changes from the Admin Dashboard in real-time
  useEffect(() => {
    const syncTheme = () => {
      const val = localStorage.getItem('wordee_projector_theme') || 'dark'
      setTheme(val)
    }
    window.addEventListener('storage', syncTheme)
    const timer = setInterval(syncTheme, 1000)
    return () => {
      window.removeEventListener('storage', syncTheme)
      clearInterval(timer)
    }
  }, [])

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
      }, () => loadSessions())
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
            <p className={`text-sm mt-1 mb-6 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sign in to broadcast spelling board</p>

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
                  placeholder="admin@arena.com" 
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

  // 2. PEDESTAL WAITING SCREEN (before round is unlocked)
  if (!state.is_unlocked && !showPodium) {
    const readyStudents = sessions.filter(s => s.ready)
    
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#060814] text-white' : 'bg-[#f1f5f9] text-slate-800'
      }`}>
        {/* Dynamic ambient particles */}
        <div className={`absolute inset-0 pointer-events-none transition-colors ${
          isDark ? 'bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,rgba(0,0,0,0)_70%)]' : 'bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.04)_0%,rgba(0,0,0,0)_70%)]'
        }`} />
        
        {/* Glowing floating blobs */}
        <motion.div
          animate={{
            scale: [1, 1.15, 0.9, 1],
            x: [0, 50, -30, 0],
            y: [0, -30, 40, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-colors ${
            isDark ? 'bg-indigo-500/10' : 'bg-indigo-500/5'
          }`}
        />

        <div className="text-center max-w-4xl w-full relative z-10 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`flex items-center gap-3.5 border px-6 py-2.5 rounded-2xl shadow-inner mb-4 transition-colors ${
              isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-slate-100/10'
            }`}
          >
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Live Spelling Arena</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-6xl sm:text-7xl font-black bg-gradient-to-r tracking-tight uppercase transition-colors ${
              isDark ? 'from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent' : 'text-slate-800'
            }`}
          >
            Wordee Competition
          </motion.h1>
          
          {state.round_label && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              className={`text-xl sm:text-2xl font-bold mt-2.5 mb-10 tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
            >
              {state.round_label}
            </motion.p>
          )}

          {/* QR Pedestal Container */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15, delay: 0.3 }}
            className={`backdrop-blur-xl -webkit-backdrop-blur-xl border rounded-[36px] p-8 shadow-[0_30px_70px_rgba(0,0,0,0.3)] relative overflow-hidden transition-colors ${
              isDark ? 'bg-[#0e1224]/80 border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,rgba(0,0,0,0)_60%)] pointer-events-none" />
            <div className={`absolute -inset-0.5 rounded-[36px] blur-sm opacity-50 -z-10 transition-colors ${
              isDark ? 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10' : 'bg-slate-200'
            }`} />

            <div className="bg-white rounded-3xl p-5 shadow-2xl relative">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/play')}`}
                alt="Scan to Spell"
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
              />
            </div>
          </motion.div>

          <div className="mt-8 flex items-center gap-2 text-indigo-500">
            <QrCode className="w-5 h-5 animate-pulse" />
            <p className="text-xl font-bold tracking-tight">Scan QR to Join Arena</p>
          </div>
          <p className="text-sm font-mono text-slate-500 mt-1">{window.location.origin}/play</p>

          {/* Connected Roster Cloud */}
          {sessions.length > 0 && (
            <div className="mt-14 w-full">
              <div className="flex items-center justify-center gap-2 mb-5">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Active Roster Ready: {readyStudents.length} / {sessions.length}
                </span>
              </div>
              
              {/* Drifting bubble roster */}
              <div className="flex flex-wrap justify-center gap-3.5 max-w-3xl mx-auto px-4 max-h-[140px] overflow-hidden">
                <AnimatePresence>
                  {sessions.map(s => (
                    <motion.div
                      key={s.participant_id}
                      layout
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className={`px-4.5 py-2.5 rounded-full border text-sm font-black flex items-center gap-2 shadow-md transition-colors ${
                        s.ready 
                          ? isDark 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : isDark
                            ? 'bg-white/5 border-white/5 text-slate-400'
                            : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.ready ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                      {s.name}
                      <FlagIcon country={s.country} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
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
              Wordee Arena
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
