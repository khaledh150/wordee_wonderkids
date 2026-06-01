import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Volume2, Home } from 'lucide-react'
import { playWordVO, playSFX, stopAll } from '../utils/audioPlayer'
import { fireConfetti } from '../utils/confetti'
import MultipleChoice from '../components/practice/MultipleChoice'
import LetterDragDrop from '../components/practice/LetterDragDrop'
import PracticeTimerDisplay from '../components/practice/PracticeTimer'
import { getAllVocabForLevel } from './competitionQuestions'
import FullscreenBtn from '../components/FullscreenBtn'

const QuestionArea = memo(function QuestionArea({ current, level, allVocab, answered, onCorrect, onWrong, onSpeaker }) {
  return (
    <motion.div
      key={current.question_id}
      className="flex items-center justify-center gap-3 sm:gap-5 lg:gap-8 xl:gap-12"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.12 }}
    >
      <div className="relative bg-white rounded-2xl shadow-xl p-1 sm:p-1.5 lg:p-2 xl:p-3 shrink-0">
        <img
          src={current.image}
          alt=""
          className="w-24 h-24 sm:w-40 sm:h-40 md:w-56 md:h-56 lg:w-72 lg:h-72 xl:w-96 xl:h-96 object-contain rounded-xl"
          onError={(e) => { if (!e.target.dataset.fallback) { e.target.dataset.fallback = '1'; e.target.src = '/images/placeholder.svg' } }}
          draggable={false}
        />
        <button
          onClick={onSpeaker}
          aria-label="Hear pronunciation"
          className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 lg:top-1.5 lg:right-1.5 xl:top-2 xl:right-2 p-1 sm:p-1.5 lg:p-2 xl:p-2.5 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full shadow-lg active:scale-90 transition-transform"
        >
          <Volume2 className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 text-white" />
        </button>
      </div>
      <div className="min-w-0 flex flex-col items-center justify-center">
        {level <= 2 ? (
          <MultipleChoice current={current} allVocab={allVocab} onCorrect={onCorrect} onWrong={onWrong} answered={answered} />
        ) : (
          <LetterDragDrop current={current} level={level} onCorrect={onCorrect} onWrong={onWrong} answered={answered} />
        )}
      </div>
    </motion.div>
  )
})

export default function CompetitionGameView({ engine, level }) {
  const { orderedQuestions, timeLeft, questionsAnswered, recordAnswer, finish, isSyncing, hapticPulse, phase, validatedScore } = engine
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answered, setAnswered] = useState(false)
  const allVocab = useRef(getAllVocabForLevel(level)).current
  const total = orderedQuestions.length

  const current = orderedQuestions[currentIndex]

  useEffect(() => {
    if (current && phase === 'active') {
      const audioFile = current.audio.split('/').pop()
      playWordVO(audioFile)
    }
  }, [currentIndex, current, phase])

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
    recordAnswer(current.question_id, current.word, true)
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

  const handleSpeaker = useCallback(() => {
    if (current) {
      const audioFile = current.audio.split('/').pop()
      playWordVO(audioFile)
    }
  }, [current])

  useEffect(() => {
    if (phase === 'completed' && validatedScore != null) {
      try { fireConfetti() } catch {}
      setTimeout(() => { try { fireConfetti() } catch {} }, 800)
      setTimeout(() => { try { fireConfetti() } catch {} }, 1600)
    }
  }, [phase, validatedScore])

  if (phase === 'completed') {
    const pct = total > 0 && validatedScore != null ? Math.round((validatedScore / total) * 100) : 0
    return (
      <motion.div
        className="w-full h-screen-safe flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50 px-3 py-2 sm:p-4 lg:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 xl:w-44 xl:h-44 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-xl"
        >
          <div className="text-center">
            <div className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white">{validatedScore ?? '...'}</div>
            <div className="text-white/80 text-[10px] sm:text-sm lg:text-base xl:text-lg font-medium">out of {total}</div>
          </div>
        </motion.div>

        <h1 className={`text-lg sm:text-2xl lg:text-3xl xl:text-4xl font-bold mt-2 sm:mt-3 ${pct >= 80 ? 'text-green-500' : pct >= 60 ? 'text-purple-500' : 'text-orange-500'}`}>
          {pct >= 100 ? 'Perfect!' : pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Great job!' : pct >= 40 ? 'Good try!' : 'Keep trying!'}
        </h1>
        <p className="text-purple-400 text-xs sm:text-sm lg:text-base mt-0.5">
          {validatedScore != null ? `${pct}% accuracy` : 'Submitting your answers...'}
        </p>

        <p className="text-gray-400 text-[10px] sm:text-xs mt-4">Your score has been recorded. You can close this page.</p>
      </motion.div>
    )
  }

  if (!current) return null

  const progressPct = ((currentIndex + 1) / total) * 100

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 xl:gap-4 px-2 sm:px-3 lg:px-4 xl:px-6 py-1 sm:py-1.5 lg:py-2 xl:py-3 shrink-0">
        <span className="text-xs sm:text-sm lg:text-base xl:text-lg font-bold text-orange-500 shrink-0">Competition · Level {level}</span>
        <div className="flex-1 h-1.5 sm:h-2 lg:h-2.5 xl:h-3 bg-orange-100 rounded-full overflow-hidden min-w-6">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full"
            animate={{ width: `${progressPct}%` }}
          />
        </div>
        <PracticeTimerDisplay timeLeft={timeLeft} />
        <div className="flex gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
          <FullscreenBtn />
          {isSyncing && (
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse self-center" title="Syncing..." />
          )}
        </div>
      </div>

      <div className="px-2 sm:px-3 lg:px-4 xl:px-6 shrink-0">
        <span className="text-xs sm:text-sm lg:text-base xl:text-lg font-bold text-orange-400">Q{currentIndex + 1}/{total}</span>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <div className="flex items-center justify-center min-h-full px-3 sm:px-4 lg:px-6 xl:px-10 py-1">
          <AnimatePresence mode="wait">
            <QuestionArea
              current={current}
              level={level}
              allVocab={allVocab}
              answered={answered}
              onCorrect={handleCorrect}
              onWrong={handleWrong}
              onSpeaker={handleSpeaker}
            />
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
