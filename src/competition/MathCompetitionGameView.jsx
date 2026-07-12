import { useState, useEffect, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Award, Star, Sparkles, Download, RefreshCw, AlertTriangle, Timer, CheckCircle, Loader2 } from 'lucide-react'
import { playSFX } from '../utils/audioPlayer'
import { fireConfetti } from '../utils/confetti'
import MathQuestion from '../components/practice/MathQuestion'
import PracticeTimerDisplay from '../components/practice/PracticeTimer'
import FullscreenBtn from '../components/FullscreenBtn'

const MathQuestionArea = memo(function MathQuestionArea({ current, answered, onCorrect, onWrong }) {
  return (
    <motion.div
      key={current.question_id}
      className="flex items-center justify-center"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.12 }}
    >
      <MathQuestion current={current} onCorrect={onCorrect} onWrong={onWrong} answered={answered} />
    </motion.div>
  )
})

export default function MathCompetitionGameView({ engine, level, isDark = false }) {
  const {
    orderedQuestions,
    timeLeft,
    recordAnswer,
    finish,
    isSyncing,
    isOffline,
    isSubmitting,
    phase,
    validatedScore,
    rank,
    submitError,
    session,
    competitionState
  } = engine

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [downloadingCert, setDownloadingCert] = useState(false)

  const total = orderedQuestions.length
  const current = orderedQuestions[currentIndex]

  useEffect(() => {
    if (engine.questionsAnswered > 0 && currentIndex === 0) {
      setCurrentIndex(Math.min(engine.questionsAnswered, total - 1))
    }
  }, [])

  const goToNext = useCallback(() => {
    if (currentIndex >= total - 1) {
      finish()
      return
    }
    setCurrentIndex(prev => prev + 1)
    setAnswered(false)
  }, [currentIndex, total, finish])

  const handleCorrect = useCallback(() => {
    if (answered) return
    setAnswered(true)
    recordAnswer(current.question_id, String(current.correctAnswer), true)
    try { fireConfetti() } catch {}
    playSFX('correct.wav')
    setTimeout(goToNext, 300)
  }, [answered, current, recordAnswer, goToNext])

  const handleWrong = useCallback(() => {
    if (answered) return
    setAnswered(true)
    recordAnswer(current.question_id, '', false)
    playSFX('wrong.wav')
    setTimeout(goToNext, 500)
  }, [answered, current, recordAnswer, goToNext])

  useEffect(() => {
    if (phase === 'completed' && validatedScore != null) {
      try { fireConfetti() } catch {}
      setTimeout(() => { try { fireConfetti() } catch {} }, 800)
      setTimeout(() => { try { fireConfetti() } catch {} }, 1600)
    }
  }, [phase, validatedScore])

  const handleDownloadCertificate = async () => {
    if (validatedScore == null || !session) return
    setDownloadingCert(true)
    try {
      const { downloadCertificate } = await import('./generateCertificate')
      await downloadCertificate({
        name: session.name,
        rank: rank ?? undefined,
        score: validatedScore,
        totalQuestions: total,
        level: level,
        school: session.school || null,
        country: session.country || null,
        eventName: (competitionState && competitionState.round_label) || 'Math Competition',
        competitionId: (competitionState && competitionState.competition_id) || 'Wonderkids'
      })
    } catch (err) {
      console.error('Failed to compile certificate:', err)
    } finally {
      setDownloadingCert(false)
    }
  }

  if (phase === 'completed') {
    const scoreVal = validatedScore ?? engine.currentScore ?? 0
    const pct = total > 0 ? Math.round((scoreVal / total) * 100) : 0
    const tier = pct >= 100 ? 'gold' : pct >= 80 ? 'emerald' : pct >= 60 ? 'silver' : 'bronze'

    const tierColors = {
      gold: {
        text: 'text-amber-500',
        bg: 'from-amber-400 to-yellow-500',
        shadow: 'shadow-amber-500/20',
        gradient: isDark ? 'from-amber-950/40 via-[#0e1224] to-orange-950/40' : 'from-amber-50 via-white to-orange-50',
        title: '🥇 Perfect Score!',
        desc: 'Math Legend Status'
      },
      emerald: {
        text: 'text-emerald-500',
        bg: 'from-emerald-400 to-green-500',
        shadow: 'shadow-emerald-500/20',
        gradient: isDark ? 'from-emerald-950/40 via-[#0e1224] to-indigo-950/40' : 'from-emerald-50 via-white to-indigo-50',
        title: '⭐ Outstanding!',
        desc: 'Math Extraordinaire'
      },
      silver: {
        text: 'text-indigo-500',
        bg: 'from-indigo-400 to-purple-500',
        shadow: 'shadow-indigo-500/20',
        gradient: isDark ? 'from-indigo-950/40 via-[#0e1224] to-purple-950/40' : 'from-indigo-50 via-white to-purple-50',
        title: '🥈 Brilliant!',
        desc: 'Splendid Performance'
      },
      bronze: {
        text: 'text-rose-500',
        bg: 'from-rose-400 to-orange-500',
        shadow: 'shadow-rose-500/20',
        gradient: isDark ? 'from-rose-950/40 via-[#0e1224] to-orange-950/40' : 'from-rose-50 via-white to-orange-50',
        title: '🥉 Great Effort!',
        desc: 'Keep Growing'
      }
    }[tier]

    const maxTime = competitionState?.duration_seconds || 300
    const timeSpent = Math.max(0, maxTime - (timeLeft || 0))
    const formattedTime = `${Math.floor(timeSpent / 60)}m ${String(timeSpent % 60).padStart(2, '0')}s`

    return (
      <motion.div
        className={`w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-br ${tierColors.gradient} px-3 py-4 sm:px-4 sm:py-8 relative overflow-hidden`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className={`absolute top-1/10 left-1/10 w-48 h-48 rounded-full blur-2xl pointer-events-none ${isDark ? 'bg-teal-500/10' : 'bg-teal-200/20'}`} />
        <div className={`absolute bottom-1/10 right-1/10 w-72 h-72 rounded-full blur-3xl pointer-events-none ${isDark ? 'bg-amber-500/10' : 'bg-amber-200/20'}`} />

        <motion.div
          initial={{ scale: 0.93, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className={`w-full max-w-md landscape:max-w-2xl backdrop-blur-xl border rounded-3xl p-5 sm:p-8 text-center relative z-10 ${isDark ? 'bg-[#0e1224]/70 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]' : 'bg-white/70 border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.06)]'}`}
        >
          <div className="flex flex-col landscape:grid landscape:grid-cols-2 gap-4 sm:gap-6 items-center landscape:items-stretch text-center landscape:text-left">
            <div className="flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
                className={`w-20 h-20 sm:w-24 sm:h-24 landscape:w-14 landscape:h-14 rounded-full bg-gradient-to-br ${tierColors.bg} flex items-center justify-center mx-auto mb-3.5 landscape:mb-2 shadow-lg ${tierColors.shadow}`}
              >
                {tier === 'gold' && <Trophy className="w-10 h-10 sm:w-12 sm:h-12 landscape:w-7 landscape:h-7 text-white animate-float" />}
                {tier === 'emerald' && <Star className="w-10 h-10 sm:w-12 sm:h-12 landscape:w-7 landscape:h-7 text-white fill-current animate-float" />}
                {tier === 'silver' && <Award className="w-10 h-10 sm:w-12 sm:h-12 landscape:w-7 landscape:h-7 text-white animate-float" />}
                {tier === 'bronze' && <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 landscape:w-7 landscape:h-7 text-white animate-float" />}
              </motion.div>

              {session?.name && (
                <p className={`text-sm sm:text-base landscape:text-xs font-black mb-1 landscape:mb-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>{session.name}{session.nickname ? ` (${session.nickname})` : ''}</p>
              )}
              <h2 className="text-[10px] font-black text-teal-500 uppercase tracking-widest leading-none landscape:hidden">Competition Complete</h2>
              <h1 className={`text-xl sm:text-2xl landscape:text-base font-black mt-1.5 landscape:mt-0.5 tracking-tight leading-tight ${tierColors.text}`}>
                {tierColors.title}
              </h1>
              <p className="text-xs text-slate-400 font-bold mt-1 landscape:mt-0 landscape:text-[10px]">{tierColors.desc}</p>

              <div className="relative w-36 h-36 landscape:w-24 landscape:h-24 mt-3 landscape:mt-1 flex items-center justify-center">
                <svg className="w-36 h-36 landscape:w-24 landscape:h-24 transform -rotate-90" viewBox="0 0 144 144">
                  <circle cx="72" cy="72" r="62" stroke={isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(241, 245, 249, 0.9)'} strokeWidth="10" fill="transparent" />
                  <motion.circle
                    cx="72" cy="72" r="62"
                    stroke="url(#mathRadialGradient)"
                    strokeWidth="10" strokeDasharray="390"
                    initial={{ strokeDashoffset: 390 }}
                    animate={{ strokeDashoffset: 390 * (1 - pct / 100) }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    strokeLinecap="round" fill="transparent"
                  />
                  <defs>
                    <linearGradient id="mathRadialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#14B8A6" />
                      <stop offset="50%" stopColor="#0EA5E9" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute text-center">
                  <span className={`text-3xl landscape:text-xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{scoreVal}</span>
                  <span className="text-slate-400 text-[10px] sm:text-xs font-bold block mt-0.5 leading-none">out of {total}</span>
                </div>
              </div>
            </div>

            <div className={`flex flex-col justify-center border-t pt-4 landscape:border-t-0 landscape:border-l landscape:pl-5 sm:landscape:pl-6 landscape:pt-0 gap-4 ${isDark ? 'border-white/10 landscape:border-white/10' : 'border-slate-100 landscape:border-slate-200/50'}`}>
              <div className="grid grid-cols-2 gap-3 landscape:gap-2">
                <div className={`rounded-xl p-2.5 sm:p-3 landscape:p-2 shadow-inner text-center ${isDark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200/50'}`}>
                  <div className="flex items-center justify-center gap-1.5 text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    Accuracy
                  </div>
                  <p className={`text-lg sm:text-xl landscape:text-base font-black font-mono mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{pct}%</p>
                </div>
                <div className={`rounded-xl p-2.5 sm:p-3 landscape:p-2 shadow-inner text-center ${isDark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200/50'}`}>
                  <div className="flex items-center justify-center gap-1.5 text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider">
                    <Timer className="w-3.5 h-3.5 text-teal-500" />
                    Time Spent
                  </div>
                  <p className={`text-lg sm:text-xl landscape:text-base font-black font-mono mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{formattedTime}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <motion.button
                  onClick={handleDownloadCertificate}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={downloadingCert || !validatedScore}
                  className="w-full py-3.5 landscape:py-2.5 bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-black rounded-xl text-sm landscape:text-xs shadow-[0_4px_12px_rgba(20,184,166,0.2)] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {downloadingCert ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Compiling...</>
                  ) : !validatedScore ? (
                    <><Download className="w-4 h-4" /> No score to download</>
                  ) : (
                    <><Download className="w-4 h-4" /> View math certificate</>
                  )}
                </motion.button>
                <p className="text-slate-400 text-[9px] sm:text-[10px] font-bold leading-normal mt-1 text-center landscape:text-left">
                  Your final math score has been captured by the competition registry.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {submitError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 bg-[#060814]/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
            >
              <div className="w-full max-w-sm sm:max-w-md bg-white border-2 border-rose-200 rounded-3xl shadow-2xl p-5 text-center relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <AlertTriangle className="w-7 h-7 text-rose-500 animate-wiggle" />
                </div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight leading-tight">Sync Connection Lost</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                  We are having difficulty broadcasting your score.
                  <strong className="text-rose-600 block mt-0.5 font-black">Do NOT close this tab!</strong>
                </p>
                <div className="bg-slate-50 border border-slate-200/50 rounded-2xl py-2 px-4 my-4 text-center shadow-inner font-mono flex items-center justify-around">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Code</span>
                    <span className="text-xl font-black text-teal-600 tracking-wider uppercase block">{session?.participant_code}</span>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Score</span>
                    <span className="text-xl font-black text-slate-800 block">{scoreVal} / {total}</span>
                  </div>
                </div>
                <button
                  onClick={() => { finish() }}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-black rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Submission
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  if (!current) return null

  const progressPct = ((currentIndex + 1) / total) * 100
  const isTimeUp = timeLeft != null && timeLeft <= 0

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col bg-gradient-to-br from-teal-50 via-white to-cyan-50 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {isOffline && (
        <div className="shrink-0 relative z-20 bg-amber-500 text-white text-center text-[10px] font-black py-1 px-2 tracking-wide uppercase">
          Offline — answers saved locally, will sync when reconnected
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 shrink-0 relative z-10 bg-white/30 backdrop-blur-md border-b border-white/20">
        <span className="text-xs sm:text-sm lg:text-base font-bold text-teal-600 shrink-0">Math · Level {level}</span>
        <div className="flex-1 h-1.5 sm:h-2 lg:h-2.5 bg-teal-100 rounded-full overflow-hidden min-w-6">
          <motion.div
            className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full"
            animate={{ width: `${progressPct}%` }}
          />
        </div>
        <PracticeTimerDisplay timeLeft={timeLeft} />
        <div className="flex gap-1 sm:gap-1.5 shrink-0 items-center">
          <FullscreenBtn />
          <span className={`w-2.5 h-2.5 rounded-full self-center ${isOffline ? 'bg-red-500' : isSyncing ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-500'}`}
            title={isOffline ? 'Offline' : isSyncing ? 'Syncing...' : 'Connected'} />
        </div>
      </div>

      <div className="flex items-center justify-between px-2 sm:px-3 lg:px-4 py-0.5 shrink-0 relative z-10">
        <span className="text-xs sm:text-sm lg:text-base font-bold text-teal-400">Q{currentIndex + 1}/{total}</span>
        <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Live
        </span>
      </div>

      <div className="flex-1 overflow-auto min-h-0 relative z-10">
        <div className="flex items-center justify-center min-h-full px-3 sm:px-4 lg:px-6 py-1">
          <AnimatePresence mode="wait">
            <MathQuestionArea
              current={current}
              answered={answered}
              onCorrect={handleCorrect}
              onWrong={handleWrong}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Submitting overlay */}
      <AnimatePresence>
        {isSubmitting && !isTimeUp && phase !== 'completed' && !submitError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 backdrop-blur-md flex flex-col items-center justify-center ${
              isDark ? 'bg-[#060814]/90 text-white' : 'bg-white/90 text-slate-900'
            }`}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isDark ? 'bg-teal-500/20 border-2 border-teal-500/40' : 'bg-teal-50 border-2 border-teal-200'
              }`}
            >
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </motion.div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Submitting Score...
            </h2>
            <p className={`text-xs font-bold mt-2 ${isDark ? 'text-teal-300' : 'text-teal-600'}`}>
              Hang tight, recording your answers
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTimeUp && phase !== 'completed' && !submitError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 backdrop-blur-md flex flex-col items-center justify-center ${
              isDark ? 'bg-[#060814]/90 text-white' : 'bg-white/90 text-slate-900'
            }`}
          >
            <div className={`absolute inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 animate-pulse ${isDark ? 'top-1/4' : 'top-[30%] landscape:top-[15%]'}`} />
            <div className={`absolute inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 animate-pulse ${isDark ? 'bottom-1/4' : 'bottom-[30%] landscape:bottom-[15%]'}`} />
            <div className={`w-14 h-14 landscape:w-12 landscape:h-12 rounded-full border flex items-center justify-center mb-3 landscape:mb-2 ${
              isDark ? 'bg-rose-500/10 border-rose-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'bg-rose-50 border-rose-200 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
            }`}>
              <Timer className="w-7 h-7 landscape:w-6 landscape:h-6 text-rose-500 animate-wiggle" />
            </div>
            <motion.h1
              initial={{ scale: 0.8, y: 15 }}
              animate={{ scale: [0.8, 1.1, 1], y: 0 }}
              className="text-3xl sm:text-4xl md:text-5xl landscape:text-2xl font-black text-rose-500 uppercase tracking-widest text-center"
            >
              TIME'S UP!
            </motion.h1>
            <p className={`font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs mt-2 landscape:mt-1 ${isDark ? 'text-teal-300' : 'text-teal-600'}`}>
              Calculating scores...
            </p>
            <div className={`mt-5 landscape:mt-3 flex items-center gap-2 font-bold text-xs px-4 py-2.5 border rounded-xl ${
              isDark ? 'text-slate-400 bg-slate-900/50 border-slate-800' : 'text-slate-500 bg-slate-100/80 border-slate-200'
            }`}>
              <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
              Securing math scores...
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
