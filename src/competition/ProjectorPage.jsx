import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabaseClient'
import { fireConfetti } from '../utils/confetti'

const FLAG_CDN = 'https://flagcdn.com/w40'

function FlagIcon({ country }) {
  if (!country) return null
  return (
    <img
      src={`${FLAG_CDN}/${country.toLowerCase()}.png`}
      alt={country}
      className="w-8 h-5 object-cover rounded-sm inline-block"
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
  const rotateRef = useRef(null)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) setAuthed(true) })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
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

  // Realtime
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
  }, [state?.active_level, levels.length])

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
      }, 2000)
      return () => clearTimeout(timer)
    }
    if (!allCompleted && showPodium) setShowPodium(false)
  }, [allCompleted, showPodium])

  // Login screen
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-xl w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white text-center mb-6">Projector Login</h1>
          {authError && <p className="text-red-400 text-sm mb-4 text-center">{authError}</p>}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-3 rounded-lg mb-3 bg-gray-700 text-white" required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 rounded-lg mb-4 bg-gray-700 text-white" required />
          <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Sign In</button>
        </form>
      </div>
    )
  }

  if (!state) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-500 text-2xl">Loading...</div>

  // BRANDED WAITING SCREEN (before unlock)
  if (!state.is_unlocked && !showPodium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 flex flex-col items-center justify-center text-white p-8">
        <div className="text-center max-w-2xl">
          <h1 className="text-6xl font-black mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Wordee Competition
          </h1>
          {state.round_label && (
            <p className="text-2xl text-gray-300 mb-8">{state.round_label}</p>
          )}
          <div className="bg-white rounded-3xl p-8 inline-block mb-6">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(window.location.origin + '/play')}`}
              alt="QR Code"
              className="w-72 h-72"
            />
          </div>
          <p className="text-xl text-gray-400 mb-2">Scan to join</p>
          <p className="text-sm text-gray-600">{window.location.origin}/play</p>
          {sessions.length > 0 && (
            <p className="mt-8 text-lg text-gray-400">
              {sessions.filter(s => s.ready).length} / {sessions.length} students ready
            </p>
          )}
        </div>
      </div>
    )
  }

  // PODIUM REVEAL
  if (showPodium && podiumSorted.length > 0) {
    const podiumColors = ['from-yellow-400 to-amber-500', 'from-gray-300 to-gray-400', 'from-amber-600 to-orange-700']
    const podiumHeights = ['h-48', 'h-36', 'h-28']
    const podiumLabels = ['1st', '2nd', '3rd']
    const podiumOrder = [1, 0, 2] // display: 2nd, 1st, 3rd

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 flex flex-col items-center justify-center text-white p-8">
        <motion.h1
          className="text-5xl font-black mb-12 text-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Level {activeLevel} — Official Results
        </motion.h1>
        <div className="flex items-end justify-center gap-6">
          {podiumOrder.map((idx, displayIdx) => {
            const student = podiumSorted[idx]
            if (!student) return null
            return (
              <motion.div
                key={student.participant_id}
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + displayIdx * 0.4 }}
              >
                <FlagIcon country={student.country} />
                <p className="text-xl font-bold mt-2">{student.name}</p>
                {student.school && <p className="text-sm text-gray-400">{student.school}</p>}
                <p className="text-3xl font-black mt-1">{student.validated_score}</p>
                <p className="text-xs text-gray-500">{formatTime(student.time_spent_seconds)}</p>
                <div className={`mt-4 w-32 ${podiumHeights[idx]} bg-gradient-to-t ${podiumColors[idx]} rounded-t-xl flex items-center justify-center`}>
                  <span className="text-3xl font-black text-white/90">{podiumLabels[idx]}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
        {/* Full ranked list below podium */}
        <motion.div
          className="mt-12 w-full max-w-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <table className="w-full text-sm">
            <tbody>
              {podiumSorted.slice(3).map((s, i) => (
                <tr key={s.participant_id} className="border-t border-gray-700">
                  <td className="py-2 px-3 text-gray-500 font-mono">{i + 4}</td>
                  <td className="py-2 px-3"><FlagIcon country={s.country} /></td>
                  <td className="py-2 px-3 font-medium">{s.name}</td>
                  <td className="py-2 px-3 text-gray-400">{s.school || ''}</td>
                  <td className="py-2 px-3 font-bold text-right">{s.validated_score}</td>
                  <td className="py-2 px-3 text-gray-500 font-mono text-right">{formatTime(s.time_spent_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    )
  }

  // LIVE F1 BOARD
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-black">Wordee Competition</h1>
            {state.round_label && <p className="text-gray-400">{state.round_label}</p>}
          </div>
          {elapsed != null && (
            <div className="bg-red-600/20 border border-red-500/30 rounded-xl px-5 py-2">
              <p className="text-xs text-red-400/60 uppercase tracking-wider">Elapsed</p>
              <p className="text-2xl font-mono font-black text-red-400">{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Level tabs */}
          {levels.map(l => (
            <button
              key={l}
              onClick={() => setDisplayLevel(l)}
              className={`px-4 py-2 rounded-lg font-bold text-lg transition-colors ${
                activeLevel === l ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Level {l}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="space-y-1">
        <div className="grid grid-cols-[4rem_3rem_1fr_1fr_5rem_5rem_5rem] gap-2 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
          <span>Rank</span>
          <span></span>
          <span>Name</span>
          <span>School</span>
          <span className="text-right">Score</span>
          <span className="text-right">Time</span>
          <span className="text-right">Status</span>
        </div>
        <AnimatePresence mode="popLayout">
          {sorted.map((s, i) => (
            <motion.div
              key={s.participant_id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className={`grid grid-cols-[4rem_3rem_1fr_1fr_5rem_5rem_5rem] gap-2 items-center px-4 py-3 rounded-xl text-lg ${
                i === 0 ? 'bg-gradient-to-r from-yellow-600/40 to-yellow-900/20 border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                : i === 1 ? 'bg-gradient-to-r from-gray-400/20 to-gray-600/10 border-2 border-gray-400/40 shadow-lg shadow-gray-400/10'
                : i === 2 ? 'bg-gradient-to-r from-amber-700/30 to-amber-900/15 border-2 border-amber-600/40 shadow-lg shadow-amber-600/10'
                : s.status === 'completed' ? 'bg-green-900/20 border border-green-700/20'
                : 'bg-gray-800/50 border border-transparent'
              }`}
            >
              <span className={`text-2xl font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                {i + 1}
              </span>
              <span><FlagIcon country={s.country} /></span>
              <span className="font-bold truncate">{s.name}</span>
              <span className="text-gray-400 truncate">{s.school || ''}</span>
              <span className="text-right text-2xl font-black">{s.provisional_score}</span>
              <span className="text-right font-mono text-gray-400">{formatTime(s.time_spent_seconds)}</span>
              <span className="text-right">
                {s.status === 'completed' ? (
                  <span className="text-green-400 text-sm font-semibold">DONE</span>
                ) : (
                  <span className="text-blue-400 text-sm">LIVE</span>
                )}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {sorted.length === 0 && (
          <p className="text-center text-gray-600 py-12 text-xl">Waiting for students...</p>
        )}
      </div>

      {/* Footer stats */}
      <div className="mt-6 flex justify-center gap-8 text-gray-500 text-lg">
        <span>{levelSessions.filter(s => s.status === 'completed').length} / {levelSessions.length} completed</span>
        <span>Level {activeLevel}</span>
        {elapsed != null && <span className="text-red-400/70 font-mono">{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>}
      </div>
    </div>
  )
}
