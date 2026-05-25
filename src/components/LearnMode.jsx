import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Home, Volume2, ChevronLeft, ChevronRight } from 'lucide-react'
import { getVocabForLevel, LEVELS } from '../data/vocabulary'
import { playWordVO, stopAll, delay, startIdleTimer, clearIdleTimer, resetIdleTimer } from '../utils/audioPlayer'
import { trackWordLearned, trackLevelCompleted } from '../utils/progress'
import { fireCelebration } from '../utils/confetti'
import { preloadLevelImages } from '../utils/preloadImages'
import useSwipe from '../utils/useSwipe'
import FullscreenBtn from './FullscreenBtn'

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

  useEffect(() => { preloadLevelImages(vocab) }, [vocab])

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
    if (isLast && index > 0) trackLevelCompleted(level, 'learn')
  }, [isLast, index, level])

  const showNavigation = useCallback(() => {
    setShowNav(true)
    resetIdleTimer()
    if (navTimer.current) clearTimeout(navTimer.current)
    navTimer.current = setTimeout(() => setShowNav(false), 3000)
  }, [])

  const goNext = useCallback(() => {
    stopAll()
    if (isLast) { fireCelebration(); setTimeout(onBack, 1500) }
    else setIndex(i => i + 1)
  }, [isLast, onBack])

  const goPrev = useCallback(() => {
    stopAll()
    if (!isFirst) setIndex(i => i - 1)
  }, [isFirst])

  const handleSpeaker = useCallback(() => { resetIdleTimer(); playCurrentWord() }, [playCurrentWord])

  const swipeHandlers = useSwipe(goNext, goPrev)

  if (!current) return null

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={showNavigation}
      {...swipeHandlers}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0">
        <button onClick={onBack} className="p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform shrink-0">
          <ArrowLeft className="w-5 h-5 text-purple-500" />
        </button>
        <span className="text-sm font-bold text-purple-500 shrink-0">Learn · {levelData?.name}</span>
        <div className="flex-1 h-1.5 bg-purple-100 rounded-full overflow-hidden min-w-8">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full"
            animate={{ width: `${((index + 1) / vocab.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 100 }}
          />
        </div>
        <div className="flex gap-1.5 shrink-0">
          <FullscreenBtn />
          <button onClick={onHome} className="p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
            <Home className="w-5 h-5 text-purple-500" />
          </button>
        </div>
      </div>

      {/* Word indicator */}
      <div className="px-3 shrink-0">
        <span className="text-base font-bold text-purple-400">{index + 1}/{vocab.length}</span>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="flex items-center justify-center min-h-full px-4 py-2 gap-4 sm:gap-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              className="flex items-center justify-center gap-4 sm:gap-8 w-full max-w-4xl"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
            >
              {/* Image */}
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

              {/* Word + Thai */}
              <div className="flex flex-col items-start justify-center min-w-0">
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-purple-700 mb-2 break-words">
                  {current.word}
                </h1>
                <p className="text-base sm:text-xl md:text-2xl text-purple-400 font-semibold">{current.thai}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation arrows — transparent, no bg */}
      <AnimatePresence>
        {showNav && (
          <>
            {!isFirst && (
              <motion.button
                className="absolute left-1 top-1/2 -translate-y-1/2 p-2 active:scale-90 transition-transform z-10"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 0.7, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={goPrev}
              >
                <ChevronLeft className="w-8 h-8 text-purple-400" strokeWidth={3} />
              </motion.button>
            )}
            <motion.button
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 active:scale-90 transition-transform z-10"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 0.7, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={goNext}
            >
              <ChevronRight className="w-8 h-8 text-purple-400" strokeWidth={3} />
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
