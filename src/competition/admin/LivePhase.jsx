import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, AlertOctagon, Megaphone, ChevronDown, ChevronUp, TimerReset } from 'lucide-react'
import { fmt } from './shared'
import { supabase } from '../supabaseClient'

export default function LivePhase({ state, sessions, elapsed, subject, isDark, autoPhase, updateState, loadSessions }) {
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [announcementText, setAnnouncementText] = useState('')
  const [timeExtOpen, setTimeExtOpen] = useState(false)
  const autoTransitionRef = useRef(false)

  const totalDuration = (state.duration_seconds || 0) + (state.extra_seconds || 0)
  const remaining = elapsed != null ? totalDuration - elapsed : totalDuration

  const activeCount = sessions.filter(s => s.status === 'active').length
  const participantSessions = sessions.filter(s => s.status !== 'waiting' || s.ready)
  const allDone = participantSessions.length > 0 && participantSessions.every(s => s.status === 'completed')

  const formattedRemaining = remaining <= 0
    ? activeCount > 0 ? `TIME'S UP · ${activeCount} submitting` : "TIME'S UP"
    : `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`

  useEffect(() => { autoTransitionRef.current = false }, [subject])

  useEffect(() => {
    if (!allDone || autoTransitionRef.current) return
    autoTransitionRef.current = true
    const timeout = setTimeout(async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) {
          const FUNC_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'
          await fetch(`${FUNC_BASE}/finalize-stragglers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ competition_id: state.competition_id, subject }),
          }).catch(() => {})
        }
      } catch {}
      await updateState({ is_unlocked: false, started_at: null })
      await loadSessions()
    }, 3000)
    return () => clearTimeout(timeout)
  }, [allDone])

  const timerColor = remaining <= 0
    ? 'text-rose-500'
    : remaining < 30
      ? 'text-rose-500 animate-pulse'
      : remaining < 60
        ? 'text-amber-400'
        : isDark ? 'text-white' : 'text-slate-800'

  const completedCount = sessions.filter(s => s.status === 'completed').length
  const totalCount = sessions.length
  const remainingCount = totalCount - completedCount - activeCount

  const avgScore = useMemo(() => {
    const scores = sessions
      .filter(s => s.status === 'completed' || s.status === 'active')
      .map(s => s.validated_score ?? s.provisional_score)
      .filter(v => v != null)
    if (!scores.length) return '-'
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  }, [sessions])

  const scoreboard = useMemo(() => {
    const statusOrder = { active: 0, completed: 1, waiting: 2 }
    return [...sessions].sort((a, b) => {
      const oa = statusOrder[a.status] ?? 3
      const ob = statusOrder[b.status] ?? 3
      if (oa !== ob) return oa - ob
      const scoreA = a.validated_score ?? a.provisional_score ?? 0
      const scoreB = b.validated_score ?? b.provisional_score ?? 0
      if (scoreB !== scoreA) return scoreB - scoreA
      return (a.time_spent_seconds || 0) - (b.time_spent_seconds || 0)
    })
  }, [sessions])

  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const card = isDark ? 'bg-[#0e1224]/60 border-white/5' : 'bg-white border-slate-200'
  const textMuted = isDark ? 'text-white/50' : 'text-slate-500'

  const stats = [
    { label: 'Active', value: activeCount, color: 'text-blue-400', bg: isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200' },
    { label: 'Completed', value: completedCount, color: 'text-emerald-400', bg: isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200' },
    { label: 'Remaining', value: remainingCount, color: isDark ? 'text-slate-400' : 'text-slate-600', bg: isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200' },
    { label: 'Avg Score', value: avgScore, color: 'text-purple-400', bg: isDark ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50 border-purple-200' },
  ]

  const handleEmergencyStop = async () => {
    if (!window.confirm('End the competition immediately? Students still playing will be scored on their current answers.')) return
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (token) {
        const FUNC_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'
        await fetch(`${FUNC_BASE}/finalize-stragglers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ competition_id: state.competition_id, subject }),
        }).catch(() => {})
      }
    } catch {}
    await updateState({ is_unlocked: false, started_at: null })
    await loadSessions()
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 flex items-center justify-center">
            <div className={`text-5xl sm:text-7xl font-mono font-black tabular-nums tracking-tight ${timerColor}`}>
              {formattedRemaining}
            </div>
          </div>

          {autoPhase === 'live' && (
            <button
              onClick={handleEmergencyStop}
              className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <AlertOctagon className="w-4 h-4" />
              END NOW
            </button>
          )}
        </div>
      </div>

      <div className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <span className={`text-sm font-bold shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {completedCount} / {totalCount} Completed
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>{s.label}</p>
              <p className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`text-[10px] font-black uppercase tracking-widest sticky top-0 z-10 ${
                isDark ? 'text-slate-400 bg-[#0e1224] border-b border-white/5' : 'text-slate-500 bg-slate-50 border-b border-slate-200'
              }`}>
                <th className="px-4 py-3 w-14">Rank</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-center">Level</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">Time</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className={`text-sm font-semibold divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
              {scoreboard.map((s, i) => (
                <tr
                  key={s.participant_id || s.id}
                  className={`transition-colors ${
                    s.status === 'completed'
                      ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                      : s.status === 'active'
                        ? 'bg-blue-500/5 hover:bg-blue-500/10'
                        : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-black text-slate-500">{i + 1}</td>
                  <td className={`px-4 py-3 font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.name || s.student_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-black px-2 py-0.5 rounded border ${
                      isDark ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      L{s.level}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {s.validated_score ?? s.provisional_score ?? 0}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {s.status === 'completed' ? fmt(Math.min(s.time_spent_seconds || 0, totalDuration)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={s.status} lastSeenAt={s.last_seen_at} />
                  </td>
                </tr>
              ))}
              {scoreboard.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 font-bold">
                    No participants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {autoPhase === 'live' && (
        <div className={`rounded-2xl border ${card}`}>
          <button
            onClick={() => setTimeExtOpen(o => !o)}
            className={`w-full flex items-center justify-between px-5 py-3 text-sm font-bold cursor-pointer ${
              isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <TimerReset className="w-4 h-4 text-amber-500" />
              Time Extension
              {(state.extra_seconds || 0) > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                  isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>+{Math.round((state.extra_seconds || 0) / 60)}m added</span>
              )}
            </span>
            {timeExtOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {timeExtOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`px-5 pb-4 pt-1 flex gap-2 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                  {[1, 2, 5].map(m => (
                    <button
                      key={m}
                      onClick={() => updateState({ extra_seconds: (state.extra_seconds || 0) + m * 60 })}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer border ${
                        isDark
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                          : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      +{m} min
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className={`rounded-2xl border ${card}`}>
        <button
          onClick={() => setAnnouncementOpen(o => !o)}
          className={`w-full flex items-center justify-between px-5 py-3 text-sm font-bold cursor-pointer ${
            isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-500" />
            Announcement
            {state.announcement && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </span>
          {announcementOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {announcementOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={`px-5 pb-4 pt-1 space-y-3 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                {state.announcement && (
                  <div className={`rounded-lg px-3 py-2 flex items-center gap-2 text-xs border ${
                    isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0 animate-ping" />
                    <span className="truncate">Live: "{state.announcement}"</span>
                  </div>
                )}

                <textarea
                  value={announcementText}
                  onChange={e => setAnnouncementText(e.target.value)}
                  placeholder="Type announcement for all students..."
                  rows={2}
                  className={`w-full px-3 py-2 border rounded-xl text-sm resize-none transition-colors ${
                    isDark
                      ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500 focus:border-blue-500/50'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                  }`}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => updateState({ announcement: announcementText || null })}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                  >
                    Broadcast
                  </button>
                  <button
                    onClick={() => { setAnnouncementText(''); updateState({ announcement: null }) }}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                      isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StatusBadge({ status, lastSeenAt }) {
  const isOnline = lastSeenAt && (Date.now() - new Date(lastSeenAt).getTime()) < 45000
  let displayStatus = status
  if (status === 'waiting' && !isOnline) displayStatus = 'offline'
  if (status === 'active' && !isOnline) displayStatus = 'disconnected'

  const styles = {
    completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    active: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    waiting: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    offline: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    disconnected: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  }
  const labels = { completed: 'Done', active: 'Playing', waiting: 'Lobby', offline: 'Offline', disconnected: 'Disconnected' }
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${styles[displayStatus] || styles.offline}`}>
      {labels[displayStatus] || 'Offline'}
    </span>
  )
}
