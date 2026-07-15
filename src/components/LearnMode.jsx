import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Home, Volume2, ChevronLeft, ChevronRight, RotateCcw, PartyPopper } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import { getVocabForLevel, LEVELS } from '../data/vocabulary'
import { playWordVO, stopAll } from '../utils/audioPlayer'
import { trackWordLearned, trackLevelCompleted } from '../utils/progress'
import { fireCelebration, cancelCelebration } from '../utils/confetti'
import { preloadLevelImages } from '../utils/preloadImages'
import useSwipe from '../utils/useSwipe'
import FullscreenBtn from './FullscreenBtn'

export default function LearnMode({ level, onBack, onHome }) {
  const { t } = useLang()
  const vocab = getVocabForLevel(level)
  const levelData = LEVELS.find(l => l.id === level)
  const [index, setIndex] = useState(0)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [completed, setCompleted] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; cancelCelebration() }
  }, [])

  const current = vocab[index]
  const isFirst = index === 0
  const isLast = index === vocab.length - 1

  useEffect(() => { preloadLevelImages(vocab) }, [vocab])

  const autoAdvanceRef = useRef(null)

  const goNext = useCallback(() => {
    clearTimeout(autoAdvanceRef.current)
    stopAll()
    if (isLast) {
      fireCelebration()
      setCompleted(true)
    } else {
      setIndex(i => i + 1)
    }
  }, [isLast])

  const goPrev = useCallback(() => {
    clearTimeout(autoAdvanceRef.current)
    stopAll()
    if (!isFirst) setIndex(i => i - 1)
  }, [isFirst])

  useEffect(() => {
    setImgLoaded(false)
    clearTimeout(autoAdvanceRef.current)
    if (current) {
      playWordVO(current.audio.split('/').pop()).then(() => {
        if (!mountedRef.current) return
        autoAdvanceRef.current = setTimeout(() => {
          if (mountedRef.current) goNext()
        }, 3000)
      })
      trackWordLearned(level, current.word)
    }
    return () => clearTimeout(autoAdvanceRef.current)
  }, [index, level, current, goNext])

  useEffect(() => {
    if (isLast && index > 0) trackLevelCompleted(level, 'learn')
  }, [isLast, index, level])

  const handleSpeaker = useCallback(() => {
    if (current) playWordVO(current.audio.split('/').pop())
  }, [current])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  const swipeHandlers = useSwipe(goNext, goPrev)

  const handlePlayAgain = useCallback(() => {
    cancelCelebration()
    setIndex(0)
    setCompleted(false)
  }, [])

  if (completed) {
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
          className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center shadow-xl"
        >
          <PartyPopper className="w-10 h-10 sm:w-14 sm:h-14 lg:w-18 lg:h-18 text-white" />
        </motion.div>
        <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-purple-700 mt-3">{t('english.lessonComplete')}</h1>
        <p className="text-purple-400 text-sm sm:text-base lg:text-lg mt-1">{t('english.learnedWords').replace('{count}', vocab.length).replace('{level}', levelData?.name)}</p>

        <button
          onClick={() => { stopAll(); onHome() }}
          aria-label="Back to home"
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 lg:bottom-8 lg:left-8 flex items-center gap-1.5 px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 lg:py-3.5 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold rounded-full shadow-lg active:scale-95 transition-transform text-sm sm:text-base lg:text-lg z-20"
        >
          <Home className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
          {t('common.home')}
        </button>
        <button
          onClick={handlePlayAgain}
          aria-label="Play again"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 lg:bottom-8 lg:right-8 flex items-center gap-1.5 px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 lg:py-3.5 bg-white border-2 border-purple-300 text-purple-600 font-bold rounded-full shadow-md active:scale-95 transition-transform text-sm sm:text-base lg:text-lg z-20"
        >
          <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          {t('english.playAgain')}
        </button>
      </motion.div>
    )
  }

  if (!current) return null

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      {...swipeHandlers}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 xl:gap-4 px-2 sm:px-3 lg:px-4 xl:px-6 py-1 sm:py-1.5 lg:py-2 xl:py-3 shrink-0">
        <button onClick={onBack} aria-label="Go back" className="p-1.5 sm:p-2 lg:p-2.5 xl:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform shrink-0">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-purple-500" />
        </button>
        <span className="text-xs sm:text-sm lg:text-base xl:text-lg font-bold text-purple-500 shrink-0">{t('english.learn')} · {levelData?.name}</span>
        <div className="flex-1 h-1.5 sm:h-2 lg:h-2.5 xl:h-3 bg-purple-100 rounded-full overflow-hidden min-w-6" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={vocab.length}>
          <motion.div
            className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full"
            animate={{ width: `${((index + 1) / vocab.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 100 }}
          />
        </div>
        <div className="flex gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
          <FullscreenBtn />
          <button onClick={onHome} aria-label="Go home" className="p-1.5 sm:p-2 lg:p-2.5 xl:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
            <Home className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-purple-500" />
          </button>
        </div>
      </div>

      <div className="px-2 sm:px-3 lg:px-4 xl:px-6 shrink-0">
        <span className="text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-purple-400">{index + 1}/{vocab.length}</span>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <div className="flex items-center justify-center min-h-full px-4 py-2 gap-4 sm:gap-8 xl:gap-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              className="flex items-center justify-center gap-4 sm:gap-8 xl:gap-12"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
            >
              <div className="relative bg-white rounded-3xl shadow-xl p-2 sm:p-3 lg:p-4 xl:p-5 shrink-0">
                {!imgLoaded && (
                  <div className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 xl:w-[28rem] xl:h-[28rem] bg-purple-50 rounded-2xl animate-pulse" />
                )}
                <img
                  src={current.image}
                  alt={current.word}
                  className={`w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 xl:w-[28rem] xl:h-[28rem] object-contain rounded-2xl ${imgLoaded ? '' : 'hidden'}`}
                  onLoad={() => setImgLoaded(true)}
                  onError={(e) => { if (!e.target.dataset.fallback) { e.target.dataset.fallback = '1'; e.target.src = '/images/placeholder.svg' }; setImgLoaded(true) }}
                  draggable={false}
                />
                <button
                  onClick={handleSpeaker}
                  aria-label="Hear pronunciation"
                  className="absolute top-1 right-1 sm:top-2 sm:right-2 lg:top-3 lg:right-3 xl:top-4 xl:right-4 p-2 lg:p-2.5 xl:p-3 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full shadow-lg active:scale-90 transition-transform"
                >
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-white" />
                </button>
              </div>

              <div className="flex flex-col items-start justify-center min-w-0">
                <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-purple-700 mb-2 break-words">
                  {current.word}
                </h1>
                <p className="text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl text-purple-400 font-semibold">{current.thai}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {!isFirst && (
        <button
          aria-label="Previous word"
          className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 p-2 active:scale-90 transition-transform z-10 opacity-70 hover:opacity-100"
          onClick={goPrev}
        >
          <ChevronLeft className="w-8 h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 text-purple-400" strokeWidth={3} />
        </button>
      )}
      <button
        aria-label="Next word"
        className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 p-2 active:scale-90 transition-transform z-10 opacity-70 hover:opacity-100"
        onClick={goNext}
      >
        <ChevronRight className="w-8 h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 text-purple-400" strokeWidth={3} />
      </button>
    </motion.div>
  )
}
