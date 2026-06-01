import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Home, Volume2, ChevronRight } from 'lucide-react'
import FullscreenBtn from './FullscreenBtn'
import { getVocabForLevel, LEVELS } from '../data/vocabulary'
import { playWordVO, playSFX, stopAll } from '../utils/audioPlayer'
import { trackWordPracticed, trackLevelCompleted } from '../utils/progress'
import { fireConfetti } from '../utils/confetti'
import { preloadLevelImages } from '../utils/preloadImages'
import MultipleChoice from './practice/MultipleChoice'
import LetterDragDrop from './practice/LetterDragDrop'
import useSwipe from '../utils/useSwipe'
import PracticeTimerDisplay, { useTimer } from './practice/PracticeTimer'
import PracticeResults from './practice/PracticeResults'

const PRACTICE_DURATION_SEC = 5 * 60

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function PracticeMode({ level, onBack, onHome, mode = 'practice' }) {
  const isTest = mode === 'test'
  const allVocab = getVocabForLevel(level)
  const levelData = LEVELS.find(l => l.id === level)
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [questionWrongCount, setQuestionWrongCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const mountedRef = useRef(true)
  const finishedRef = useRef(false)
  const answeredRef = useRef(false)
  const indexRef = useRef(0)
  const shuffledRef = useRef(null)
  const timerRef = useRef(null)

  if (!shuffledRef.current) {
    shuffledRef.current = shuffleArray(allVocab)
  }
  const shuffled = shuffledRef.current
  const total = shuffled.length

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const handleTimeUp = useCallback(() => {
    finishedRef.current = true
    setFinished(true)
    stopAll()
  }, [])

  const timer = useTimer(PRACTICE_DURATION_SEC, handleTimeUp)
  timerRef.current = timer

  useEffect(() => {
    preloadLevelImages(allVocab)
    timer.start()
  }, [])

  const current = shuffled[index]

  useEffect(() => {
    answeredRef.current = false
    setAnswered(false)
    setQuestionWrongCount(0)
    if (current && !finishedRef.current) {
      playWordVO(current.audio.split('/').pop())
    }
  }, [index, current])

  function goToNext() {
    if (!mountedRef.current || finishedRef.current) return
    const idx = indexRef.current
    if (idx >= total - 1) {
      trackLevelCompleted(level, mode)
      timerRef.current.stop()
      finishedRef.current = true
      setFinished(true)
    } else {
      const next = idx + 1
      indexRef.current = next
      setIndex(next)
    }
  }

  const handleCorrect = useCallback(() => {
    if (answeredRef.current) return
    answeredRef.current = true
    setAnswered(true)
    setCorrectCount(c => c + 1)
    const word = shuffled[indexRef.current]
    if (word) trackWordPracticed(level, word.word, true)
    try { fireConfetti() } catch (e) { console.warn('confetti error', e) }
    if (finishedRef.current) return
    playSFX('correct.wav')
    setTimeout(goToNext, 300)
  }, [level, shuffled, total])

  const handleWrong = useCallback(() => {
    if (answeredRef.current || finishedRef.current) return
    setWrongCount(c => c + 1)
    setQuestionWrongCount(c => c + 1)
    const word = shuffled[indexRef.current]
    if (word) trackWordPracticed(level, word.word, false)
    playSFX('wrong.wav')
    if (isTest) {
      answeredRef.current = true
      setAnswered(true)
      setTimeout(goToNext, 500)
    }
  }, [level, shuffled, isTest])

  const handleSpeaker = useCallback(() => {
    if (current) playWordVO(current.audio.split('/').pop())
  }, [current])

  const skipNext = useCallback(() => {
    if (indexRef.current >= total - 1) return
    stopAll()
    const next = indexRef.current + 1
    indexRef.current = next
    setIndex(next)
  }, [total])

  const skipPrev = useCallback(() => {
    if (indexRef.current === 0) return
    stopAll()
    const prev = indexRef.current - 1
    indexRef.current = prev
    setIndex(prev)
  }, [])

  const swipeHandlers = useSwipe(skipNext, skipPrev)

  const handleTryAgain = useCallback(() => {
    shuffledRef.current = shuffleArray(allVocab)
    setCorrectCount(0)
    setWrongCount(0)
    setQuestionWrongCount(0)
    indexRef.current = 0
    setIndex(0)
    answeredRef.current = false
    setAnswered(false)
    finishedRef.current = false
    setFinished(false)
    timerRef.current.start()
  }, [allVocab])

  const modeLabel = isTest ? 'Test' : 'Practice'

  if (finished) {
    return (
      <PracticeResults
        correct={correctCount}
        wrong={wrongCount}
        total={total}
        timeTaken={timerRef.current.getElapsedSeconds()}
        totalTime={PRACTICE_DURATION_SEC}
        onHome={() => { stopAll(); onHome() }}
        onTryAgain={handleTryAgain}
      />
    )
  }

  if (!current) return null

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      {...swipeHandlers}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 xl:gap-4 px-2 sm:px-3 lg:px-4 xl:px-6 py-1 sm:py-1.5 lg:py-2 xl:py-3 shrink-0">
        <button onClick={() => { stopAll(); onBack() }} aria-label="Go back" className="p-1.5 sm:p-2 lg:p-2.5 xl:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform shrink-0">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-purple-500" />
        </button>
        <span className={`text-xs sm:text-sm lg:text-base xl:text-lg font-bold shrink-0 ${isTest ? 'text-orange-500' : 'text-pink-500'}`}>{modeLabel} · {levelData?.name}</span>
        <div className={`flex-1 h-1.5 sm:h-2 lg:h-2.5 xl:h-3 rounded-full overflow-hidden min-w-6 ${isTest ? 'bg-orange-100' : 'bg-pink-100'}`}>
          <motion.div
            className={`h-full rounded-full ${isTest ? 'bg-gradient-to-r from-orange-400 to-amber-400' : 'bg-gradient-to-r from-pink-400 to-rose-400'}`}
            animate={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <PracticeTimerDisplay timeLeft={timer.timeLeft} />
        <div className="flex gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
          <FullscreenBtn />
          <button onClick={() => { stopAll(); onHome() }} aria-label="Go home" className="p-1.5 sm:p-2 lg:p-2.5 xl:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
            <Home className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-pink-500" />
          </button>
        </div>
      </div>

      <div className="px-2 sm:px-3 lg:px-4 xl:px-6 shrink-0">
        <span className={`text-xs sm:text-sm lg:text-base xl:text-lg font-bold ${isTest ? 'text-orange-400' : 'text-pink-400'}`}>Q{index + 1}/{total}</span>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <div className="flex items-center justify-center min-h-full px-3 sm:px-4 lg:px-6 xl:px-10 py-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
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
                onClick={handleSpeaker}
                aria-label="Hear pronunciation"
                className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 lg:top-1.5 lg:right-1.5 xl:top-2 xl:right-2 p-1 sm:p-1.5 lg:p-2 xl:p-2.5 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full shadow-lg active:scale-90 transition-transform"
              >
                <Volume2 className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 text-white" />
              </button>
            </div>

            <div className="min-w-0 flex flex-col items-center justify-center">
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

      {!isTest && questionWrongCount > 0 && !answered && (
        <motion.button
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 0.7, x: 0 }}
          whileHover={{ opacity: 1 }}
          onClick={skipNext}
          aria-label="Next question"
          className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 p-2 active:scale-90 transition-transform z-10 hover:opacity-100"
        >
          <ChevronRight className="w-8 h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 text-pink-400" strokeWidth={3} />
        </motion.button>
      )}
    </motion.div>
  )
}
