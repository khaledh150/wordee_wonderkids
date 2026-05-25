import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Home, Volume2 } from 'lucide-react'
import FullscreenBtn from './FullscreenBtn'
import { getVocabForLevel, LEVELS } from '../data/vocabulary'
import { playWordVO, playCorrectEncouragement, playWrongEncouragement, playCelebration, stopAll, delay } from '../utils/audioPlayer'
import { trackWordPracticed, trackLevelCompleted } from '../utils/progress'
import { fireConfetti, fireCelebration as confettiCelebration } from '../utils/confetti'
import { preloadLevelImages } from '../utils/preloadImages'
import MultipleChoice from './practice/MultipleChoice'
import LetterDragDrop from './practice/LetterDragDrop'
import useSwipe from '../utils/useSwipe'

export default function PracticeMode({ level, onBack, onHome }) {
  const allVocab = getVocabForLevel(level)
  const levelData = LEVELS.find(l => l.id === level)
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [showResult, setShowResult] = useState(null)

  const shuffled = useMemo(() => {
    const arr = [...allVocab]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [allVocab])

  useEffect(() => {
    preloadLevelImages(allVocab)
  }, [allVocab])

  const current = shuffled[index]
  const isLast = index === shuffled.length - 1

  useEffect(() => {
    setAnswered(false)
    setShowResult(null)
    if (current) {
      delay(500).then(() => playWordVO(current.audio.split('/').pop()))
    }
  }, [index, current])

  const handleCorrect = useCallback(async () => {
    if (answered) return
    setAnswered(true)
    setShowResult('correct')
    trackWordPracticed(level, current.word, true)
    fireConfetti()
    await playCorrectEncouragement()
    await delay(800)
    if (isLast) {
      trackLevelCompleted(level, 'practice')
      confettiCelebration()
      await playCelebration()
      await delay(500)
      onBack()
    } else {
      setIndex(i => i + 1)
    }
  }, [answered, current, level, isLast, onBack])

  const handleWrong = useCallback(async () => {
    if (answered) return
    setShowResult('wrong')
    trackWordPracticed(level, current.word, false)
    await playWrongEncouragement()
    setShowResult(null)
  }, [answered, current, level])

  const handleSpeaker = useCallback(() => {
    if (current) playWordVO(current.audio.split('/').pop())
  }, [current])

  const skipNext = useCallback(() => {
    if (isLast) return
    stopAll()
    setIndex(i => i + 1)
  }, [isLast])

  const skipPrev = useCallback(() => {
    if (index === 0) return
    stopAll()
    setIndex(i => i - 1)
  }, [index])

  const swipeHandlers = useSwipe(skipNext, skipPrev)

  if (!current) return null

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      {...swipeHandlers}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1 shrink-0">
        <button onClick={() => { stopAll(); onBack() }} className="p-1.5 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform shrink-0">
          <ArrowLeft className="w-5 h-5 text-purple-500" />
        </button>
        <span className="text-sm font-bold text-pink-500 shrink-0">Practice · {levelData?.name}</span>
        <div className="flex-1 h-1.5 bg-pink-100 rounded-full overflow-hidden min-w-8">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full"
            animate={{ width: `${((index + 1) / shuffled.length) * 100}%` }}
          />
        </div>
        <div className="flex gap-1.5 shrink-0">
          <FullscreenBtn />
          <button onClick={() => { stopAll(); onHome() }} className="p-1.5 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
            <Home className="w-5 h-5 text-pink-500" />
          </button>
        </div>
      </div>

      {/* Question indicator */}
      <div className="px-3 shrink-0">
        <span className="text-sm font-bold text-pink-400">Q{index + 1}/{shuffled.length}</span>
      </div>

      {/* Flash overlay */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            className={`absolute inset-0 z-20 pointer-events-none ${showResult === 'correct' ? 'bg-green-400/20' : 'bg-red-400/20'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="flex items-center justify-center min-h-full px-2 py-1 gap-2 sm:gap-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="flex items-center justify-center gap-2 sm:gap-4 w-full max-w-5xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {/* Image with speaker */}
            <div className="relative bg-white rounded-2xl shadow-xl p-1.5 sm:p-2 shrink-0">
              <img
                src={current.image}
                alt=""
                className="w-28 h-28 sm:w-44 sm:h-44 md:w-64 md:h-64 object-contain rounded-xl"
                onError={(e) => { e.target.src = '/images/placeholder.svg' }}
                draggable={false}
              />
              <button
                onClick={handleSpeaker}
                className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 p-1.5 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full shadow-lg active:scale-90 transition-transform"
              >
                <Volume2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
              </button>
            </div>

            {/* Practice area */}
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
              {level === 1 ? (
                <MultipleChoice
                  current={current}
                  allVocab={allVocab}
                  onCorrect={handleCorrect}
                  onWrong={handleWrong}
                  answered={answered}
                />
              ) : (
                <LetterDragDrop
                  current={current}
                  level={level}
                  onCorrect={handleCorrect}
                  onWrong={handleWrong}
                  answered={answered}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
