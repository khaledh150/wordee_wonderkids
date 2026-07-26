import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Monitor } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { isOnline } from './shared'

export default function LobbyPhase({ state, sessions, subject, isDark, autoPhase, updateState, loadSessions, onBackToSetup }) {
  const [confirmStart, setConfirmStart] = useState(false)

  const playUrl = `${window.location.origin}/play`

  const sorted = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const rank = s => s.ready ? 0 : isOnline(s) ? 1 : 2
      return rank(a) - rank(b)
    })
  }, [sessions])

  const onlineCount = sessions.filter(s => isOnline(s)).length

  const [startError, setStartError] = useState('')

  const handleStart = async () => {
    if (!confirmStart) {
      setConfirmStart(true)
      setStartError('')
      return
    }
    try {
      setConfirmStart(false)
      await updateState({ is_unlocked: true, started_at: new Date().toISOString() })
    } catch (err) {
      console.error('Start competition failed:', err)
      setStartError('Failed to start competition. Please try again.')
    }
  }

  const [confirmBack, setConfirmBack] = useState(false)

  const handleBack = () => {
    if (!confirmBack) {
      setConfirmBack(true)
      return
    }
    setConfirmBack(false)
    updateState({ is_unlocked: false }).then(onBackToSetup)
  }

  const card = isDark ? 'bg-[#0e1224]/50 border-white/10' : 'bg-white border-slate-200'
  const text = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-white/50' : 'text-slate-400'

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">

      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
          <h1 className={`text-3xl font-bold ${text}`}>Lobby Open</h1>
        </div>
        <p className={`text-lg ${textMuted}`}>
          {onlineCount} / {sessions.length} Connected
        </p>
      </div>

      <div className={`flex items-center gap-2 justify-center text-xs font-bold px-3 py-2 rounded-xl border ${
        isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-600'
      }`}>
        <Monitor className="w-4 h-4" />
        QR code is displayed on the projector screen for students to scan
      </div>

      <div className="flex items-center gap-4 justify-center">
        <div className={`rounded-xl border p-3 ${card}`}>
          <div className="rounded-lg bg-white p-2">
            <QRCodeSVG value={playUrl} size={100} />
          </div>
        </div>
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${textMuted}`}>Join URL</p>
          <p className={`font-mono text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{playUrl}</p>
        </div>
      </div>

      {sorted.length > 0 && (
        <div className={`rounded-2xl border p-5 ${card}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>
            Students ({sessions.length})
          </p>
          <div className="max-h-72 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <AnimatePresence mode="popLayout">
              {sorted.map((s, i) => {
                const online = isOnline(s)
                const statusLabel = s.ready ? 'Ready' : online ? 'Online' : 'Offline'
                const dotColor = s.ready ? 'bg-green-500' : online ? 'bg-green-400' : 'bg-slate-400'
                const dotGlow = (s.ready || online) ? 'shadow-[0_0_6px_rgba(34,197,94,0.6)]' : ''
                const labelColor = s.ready
                  ? (isDark ? 'text-green-400' : 'text-green-600')
                  : online
                    ? (isDark ? 'text-green-300' : 'text-green-500')
                    : textMuted
                return (
                  <motion.div
                    key={s.participant_id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${card}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotColor} ${dotGlow}`} />
                    <span className={`truncate flex-1 ${text}`}>{s.name}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider shrink-0 ${labelColor}`}>{statusLabel}</span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        {autoPhase === 'live' ? (
          <div className={`w-full max-w-md rounded-xl py-4 text-lg font-bold text-center ${
            isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            Competition is Live
          </div>
        ) : (
          <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              className={`w-full max-w-md rounded-xl py-4 text-lg font-bold text-white transition-colors cursor-pointer ${
                confirmStart
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {confirmStart ? 'TAP TO CONFIRM' : `START ${subject === 'math' ? 'MATHEMATICS' : 'ENGLISH SPELLING'} COMPETITION`}
            </motion.button>

            <AnimatePresence>
              {confirmStart && (
                <motion.button
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  onClick={() => { setConfirmStart(false); setStartError('') }}
                  className={`text-sm cursor-pointer ${textMuted} hover:underline`}
                >
                  Cancel
                </motion.button>
              )}
            </AnimatePresence>

            {startError && (
              <p className={`text-xs font-bold px-4 py-2 rounded-lg border ${
                isDark ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-amber-600 bg-amber-50 border-amber-200'
              }`}>{startError}</p>
            )}

            {!confirmBack ? (
              <button
                onClick={handleBack}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold mt-2 cursor-pointer border transition-all ${
                  isDark
                    ? 'text-slate-300 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    : 'text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200 hover:border-slate-300'
                }`}
              >
                <ArrowLeft size={14} />
                Cancel &amp; Back to Setup
              </button>
            ) : (
              <div className={`w-full max-w-md rounded-2xl border-2 p-5 text-center space-y-3 mt-2 ${
                isDark
                  ? 'bg-rose-950/30 border-rose-500/30'
                  : 'bg-rose-50 border-rose-200'
              }`}>
                <p className={`text-sm font-bold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                  Close the lobby and go back to setup?
                </p>
                <p className={`text-xs ${isDark ? 'text-rose-400/60' : 'text-rose-500/70'}`}>
                  Students will be disconnected from this session.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setConfirmBack(false)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border transition-all ${
                      isDark
                        ? 'text-slate-300 bg-white/5 border-white/10 hover:bg-white/10'
                        : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Keep Open
                  </button>
                  <button
                    onClick={handleBack}
                    className="px-4 py-2 rounded-xl text-sm font-bold cursor-pointer bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md"
                  >
                    Yes, Close Lobby
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
