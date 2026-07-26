import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Eye, EyeOff, XCircle } from 'lucide-react'
import StudentAvatar from './StudentAvatar'
import { fmt } from './shared'
import { mathGradeLabel } from '../mathGradeLabels'

export default function PodiumPhase({ state, sessions, subject, isDark, updateState, onEndCompetition, onProceedToSubject, otherSubjectPlayed }) {
  const [selectedLevel, setSelectedLevel] = useState(state?.podium_level || 1)

  useEffect(() => {
    if (state?.podium_level != null) setSelectedLevel(state.podium_level)
  }, [state?.podium_level])

  const levels = useMemo(() =>
    [...new Set(sessions.filter(s => s.validated_score != null).map(s => s.level))].sort((a, b) => a - b),
    [sessions]
  )

  const top3 = useMemo(() => {
    return sessions
      .filter(s => s.level === selectedLevel && s.validated_score != null)
      .sort((a, b) => b.validated_score - a.validated_score || a.time_spent_seconds - b.time_spent_seconds)
      .slice(0, 3)
  }, [sessions, selectedLevel])

  const isPodiumVisible = state?.podium_visible
  const isCurrentLevel = state?.podium_level === selectedLevel

  async function togglePodium() {
    try {
      if (isPodiumVisible && isCurrentLevel) {
        await updateState({ podium_visible: false })
      } else {
        await updateState({ podium_visible: true, podium_level: selectedLevel })
      }
    } catch (err) {
      console.error('Failed to toggle podium:', err)
    }
  }

  async function handleLevelChange(level) {
    setSelectedLevel(level)
    if (isPodiumVisible) {
      try {
        await updateState({ podium_level: level })
      } catch (err) {
        console.error('Failed to change podium level:', err)
      }
    }
  }

  const card = isDark ? 'bg-[#0e1224]/50 border-white/10' : 'bg-white border-slate-200'
  const text = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-white/50' : 'text-slate-400'
  const podiumColors = ['text-amber-400', 'text-sky-400', 'text-orange-400']
  const podiumLabels = ['1st Place', '2nd Place', '3rd Place']

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-6 ${card}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className={isDark ? 'w-6 h-6 text-amber-400' : 'w-6 h-6 text-amber-600'} />
            <h3 className={`text-xl font-black ${text}`}>Podium Control</h3>
            {isPodiumVisible && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                LIVE on Projector — {subject === 'math' ? mathGradeLabel(state.podium_level) : `Level ${state.podium_level}`}
              </span>
            )}
          </div>
        </div>

        {/* Level selector */}
        <div className="mb-6">
          <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${textMuted}`}>
            Select Level
          </label>
          <div className="flex gap-2 flex-wrap">
            {levels.map(l => {
              const count = sessions.filter(s => s.level === l && s.validated_score != null).length
              return (
                <button
                  key={l}
                  onClick={() => handleLevelChange(l)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
                    selectedLevel === l
                      ? 'bg-blue-600 text-white shadow-lg'
                      : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {subject === 'math' ? mathGradeLabel(l) : `Level ${l}`}
                  <span className={`ml-2 text-xs ${selectedLevel === l ? 'text-white/70' : textMuted}`}>({count})</span>
                </button>
              )
            })}
            {levels.length === 0 && (
              <p className={`text-sm ${textMuted}`}>No validated results yet.</p>
            )}
          </div>
        </div>

        {/* Show/Hide button */}
        <button
          onClick={togglePodium}
          disabled={top3.length === 0}
          className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl text-base font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
            isPodiumVisible && isCurrentLevel
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-900/30'
          }`}
        >
          {isPodiumVisible && isCurrentLevel ? (
            <><EyeOff className="w-5 h-5" /> Hide Podium</>
          ) : (
            <><Eye className="w-5 h-5" /> Show Podium on Projector</>
          )}
        </button>
      </motion.div>

      {/* Preview */}
      {top3.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className={`rounded-2xl border p-6 ${card}`}>
          <h4 className={`text-sm font-black uppercase tracking-wider mb-5 ${textMuted}`}>
            {subject === 'math' ? mathGradeLabel(selectedLevel) : `Level ${selectedLevel}`} — Top {top3.length}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {top3.map((s, i) => (
              <div key={s.participant_id}
                className={`flex flex-col items-center p-5 rounded-xl border transition-colors ${
                  isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                <span className={`text-3xl mb-2 ${podiumColors[i]}`}>
                  {['🥇', '🥈', '🥉'][i]}
                </span>
                <StudentAvatar photoUrl={s.photo_url} name={s.name} size="lg" className="mb-3" />
                <p className={`font-black text-lg text-center leading-tight ${text}`}>{s.name}</p>
                {s.school && <p className={`text-xs mt-1 ${textMuted}`}>{s.school}</p>}
                <p className={`text-2xl font-black font-mono mt-3 ${text}`}>{s.validated_score}</p>
                <p className={`text-xs font-mono ${textMuted}`}>{fmt(Math.min(s.time_spent_seconds || 0, (state.duration_seconds || 300) + (state.extra_seconds || 0)))}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${podiumColors[i]}`}>
                  {podiumLabels[i]}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* End / Proceed buttons */}
      <EndCompetitionButton
        subject={subject}
        isDark={isDark}
        onEndCompetition={onEndCompetition}
        onProceedToSubject={onProceedToSubject}
        otherSubjectPlayed={otherSubjectPlayed}
      />
    </div>
  )
}

function EndCompetitionButton({ subject, isDark, onEndCompetition, onProceedToSubject, otherSubjectPlayed }) {
  const [confirming, setConfirming] = useState(null)
  const [acting, setActing] = useState(false)
  const subjectLabel = subject === 'math' ? 'Mathematics' : 'English Spelling'
  const otherSubject = subject === 'math' ? 'english' : 'math'
  const otherLabel = subject === 'math' ? 'English Spelling' : 'Mathematics'

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="flex flex-col items-center gap-3 pt-4 w-full max-w-md mx-auto">

      {confirming === 'proceed' && (
        <div className={`w-full rounded-2xl border-2 p-5 text-center space-y-4 ${isDark ? 'bg-blue-950/30 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
          <p className={`font-bold text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
            End {subjectLabel} and open {otherLabel} lobby?
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setConfirming(null)}
              className={`px-5 py-2.5 font-bold text-sm rounded-xl cursor-pointer border transition-all ${
                isDark ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}>Cancel</button>
            <button disabled={acting} onClick={async () => { setActing(true); setConfirming(null); await onProceedToSubject(otherSubject); setActing(false) }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl cursor-pointer transition-all shadow-md disabled:opacity-50">
              {acting ? 'Processing...' : 'Yes, Proceed'}
            </button>
          </div>
        </div>
      )}

      {confirming === 'end' && (
        <div className={`w-full rounded-2xl border-2 p-5 text-center space-y-4 ${isDark ? 'bg-rose-950/30 border-rose-500/30' : 'bg-rose-50 border-rose-200'}`}>
          <p className={`font-bold text-sm ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
            End the entire session? Results will be saved to history.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setConfirming(null)}
              className={`px-5 py-2.5 font-bold text-sm rounded-xl cursor-pointer border transition-all ${
                isDark ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}>Cancel</button>
            <button disabled={acting} onClick={async () => { setActing(true); setConfirming(null); await onEndCompetition(); setActing(false) }}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl cursor-pointer transition-all shadow-md disabled:opacity-50">
              {acting ? 'Ending...' : 'Yes, End Session'}
            </button>
          </div>
        </div>
      )}

      {!confirming && (
        <div className="flex flex-col gap-3 w-full">
          {!otherSubjectPlayed && onProceedToSubject && (
            <button onClick={() => setConfirming('proceed')}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-base uppercase tracking-wider transition-all cursor-pointer border-2 ${
                isDark
                  ? 'text-blue-400 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10'
                  : 'text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100'
              }`}>
              Proceed to {otherLabel}
            </button>
          )}
          <button onClick={() => setConfirming('end')}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all cursor-pointer border ${
              isDark
                ? 'text-rose-400/70 border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:text-rose-400'
                : 'text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100 hover:text-rose-600'
            }`}>
            <XCircle className="w-4 h-4" />
            End Session
          </button>
        </div>
      )}
    </motion.div>
  )
}
