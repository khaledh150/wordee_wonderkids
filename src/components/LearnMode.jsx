import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Home, Volume2 } from 'lucide-react'
import { getVocabForLevel, LEVELS } from '../data/vocabulary'
import { playWordVO, stopAll, delay, startIdleTimer, clearIdleTimer, resetIdleTimer } from '../utils/audioPlayer'
import { trackWordLearned, trackLevelCompleted } from '../utils/progress'
import { fireCelebration } from '../utils/confetti'
import { preloadLevelImages } from '../utils/preloadImages'
import useSwipe from '../utils/useSwipe'

export default function LearnMode({ level, onBack, onHome }) {
  const vocab = getVocabForLevel(level)
  const levelData = LEVELS.find(l => l.id === level)
  const [index, setIndex] = useState(0)
  const [showNav, setShowNav] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const navTimer = useRef(null)

  const current = vocab[index]
  const isFirst = index === 0
  const isLast = index === vocab.length - 1

  useEffect(() => {
    preloadLevelImages(vocab)
  }, [vocab])

  const playCurrentWord = useCallback(async () => {
    if (!current) return
    await delay(600)
    await playWordVO(current.audio.split('/').pop())
  }, [current])

  useEffect(() => {
    setImgLoaded(false)
    playCurrentWord()
    trackWordLearned(level, current?.word)
    startIdleTimer(() => {}, 20000)
    return () => clearIdleTimer()
  }, [index, level, current, playCurrentWord])

  useEffect(() => {
    if (isLast && index > 0) {
      trackLevelCompleted(level, 'learn')
    }
  }, [isLast, index, level])

  const showNavigation = useCallback(() => {
    setShowNav(true)
    resetIdleTimer()
    if (navTimer.current) clearTimeout(navTimer.current)
    navTimer.current = setTimeout(() => setShowNav(false), 3000)
  }, [])

  const goNext = useCallback(() => {
    stopAll()
    if (isLast) {
      fireCelebration()
      setTimeout(onBack, 1500)
    } else {
      setIndex(i => i + 1)
    }
  }, [isLast, onBack])

  const goPrev = useCallback(() => {
    stopAll()
    if (!isFirst) setIndex(i => i - 1)
  }, [isFirst])

  const handleSpeaker = useCallback(() => {
    resetIdleTimer()
    playCurrentWord()
  }, [playCurrentWord])

  const swipeHandlers = useSwipe(goNext, goPrev)

  if (!current) return null

  return (
    <motion.div
      className="w-full h-full flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={showNavigation}
      {...swipeHandlers}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
        <button onClick={onBack} className="p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5 text-purple-500" />
        </button>
        <div className="text-center">
          <span className="text-sm font-bold text-purple-500">Learn · {levelData?.name}</span>
          <div className="text-xs text-purple-300">{index + 1} / {vocab.length}</div>
        </div>
        <button onClick={onHome} className="p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
          <Home className="w-5 h-5 text-purple-500" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-3 shrink-0">
        <div className="w-full h-1.5 bg-purple-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full"
            animate={{ width: `${((index + 1) / vocab.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 100 }}
          />
        </div>
      </div>

      {/* Landscape content: image LEFT, word RIGHT */}
      <div className="flex-1 flex items-center justify-center px-4 py-2 min-h-0 gap-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="flex items-center justify-center gap-6 sm:gap-10 w-full max-w-4xl"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.25 }}
          >
            {/* Image frame - dominant and big */}
            <div className="relative bg-white rounded-3xl shadow-xl p-2 sm:p-3 shrink-0">
              {!imgLoaded && (
                <div className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 bg-purple-50 rounded-2xl animate-pulse" />
              )}
              <img
                src={current.image}
                alt={current.word}
                className={`w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 object-contain rounded-2xl ${imgLoaded ? '' : 'hidden'}`}
                onLoad={() => setImgLoaded(true)}
                onError={(e) => { e.target.src = '/images/placeholder.svg'; setImgLoaded(true) }}
                draggable={false}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleSpeaker() }}
                className="absolute top-1 right-1 sm:top-2 sm:right-2 p-2 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full shadow-lg active:scale-90 transition-transform"
              >
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            </div>

            {/* Word + Thai on the right */}
            <div className="flex flex-col items-start justify-center">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-purple-700 mb-2">
                {current.word}
              </h1>
              <p className="text-lg sm:text-2xl md:text-3xl text-purple-400 font-semibold">{current.thai}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows - show on tap */}
      <AnimatePresence>
        {showNav && (
          <>
            {!isFirst && (
              <motion.button
                className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-white/90 rounded-full shadow-xl active:scale-90 transition-transform z-10"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={goPrev}
              >
                <ArrowLeft className="w-6 h-6 text-purple-500" />
              </motion.button>
            )}
            <motion.button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-white/90 rounded-full shadow-xl active:scale-90 transition-transform z-10"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={goNext}
            >
              <ArrowRight className="w-6 h-6 text-purple-500" />
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
