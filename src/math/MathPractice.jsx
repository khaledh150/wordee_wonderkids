import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '../i18n/LanguageContext'
import useSwipe from '../utils/useSwipe'
import { generateExam } from './mathEngine'
import { playSound } from './sound'
import { toggleFullscreen, isFullscreenActive, exitFullscreen } from '../utils/useFullscreen'
import { renderQuestion } from '../utils/fractionRenderer'
import ExitConfirmDialog from './ExitConfirmDialog'
import { ArrowLeft, Globe, Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react'

export default function MathPractice({ levelConfig: config, onExit }) {
  const { t, lang, toggleLang } = useLang()

  const [questions] = useState(() => generateExam(config.level, config.questions))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [picked, setPicked] = useState({})
  const [wrongFlash, setWrongFlash] = useState(null)
  const [isFull, setIsFull] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [direction, setDirection] = useState(1)
  const flashTimeoutRef = useRef(null)

  const currentQuestion = questions[currentIndex]

  const goNext = useCallback(() => {
    if (currentIndex >= questions.length - 1) return
    playSound('swipe')
    setDirection(1)
    setWrongFlash(null)
    setCurrentIndex(i => i + 1)
  }, [currentIndex, questions.length])

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return
    playSound('swipe')
    setDirection(-1)
    setWrongFlash(null)
    setCurrentIndex(i => i - 1)
  }, [currentIndex])

  const swipeHandlers = useSwipe(goNext, goPrev, 60)

  const isAnswered = picked[currentQuestion.id] !== undefined

  function handlePick(choice) {
    if (isAnswered) return

    const isCorrect = choice === currentQuestion.correctAnswer
    if (isCorrect) {
      playSound('correct')
    } else {
      playSound('wrong')
      setWrongFlash(choice)
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
      flashTimeoutRef.current = setTimeout(() => setWrongFlash(null), 600)
    }
    setPicked(p => ({ ...p, [currentQuestion.id]: choice }))

    if (currentIndex < questions.length - 1) {
      const delay = isCorrect ? 400 : 700
      setTimeout(() => {
        setDirection(1)
        setWrongFlash(null)
        setCurrentIndex(i => i + 1)
      }, delay)
    }
  }

  function handleExit() {
    setShowExitDialog(true)
  }

  function confirmExit() {
    setShowExitDialog(false)
    exitFullscreen()
    onExit()
  }

  const questionProgress = ((currentIndex + 1) / questions.length) * 100
  const labels = ['A', 'B', 'C', 'D']

  return (
    <div className="h-screen-safe flex flex-col overflow-hidden relative" {...swipeHandlers}>
      {/* Header */}
      <div className="no-print shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-5 py-1.5 md:py-3">
        <button
          onClick={handleExit}
          className="p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-text-light md:!w-6 md:!h-6" />
        </button>
        <span className="shrink-0 font-bold text-sm md:text-lg text-text">
          {t(`math.levels.level${config.level}`)}
        </span>
        <div className="flex-1 h-2 md:h-3 bg-white rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300"
            style={{ width: `${questionProgress}%` }}
          />
        </div>
        <button
          onClick={toggleLang}
          className="p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform text-purple"
        >
          <Globe size={18} className="md:!w-6 md:!h-6" />
        </button>
        <button
          onClick={() => { toggleFullscreen(); setIsFull(!isFull) }}
          className="p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform text-secondary"
        >
          {isFull ? <Minimize size={18} className="md:!w-6 md:!h-6" /> : <Maximize size={18} className="md:!w-6 md:!h-6" />}
        </button>
      </div>

      <div className="no-print flex items-center justify-between px-3 md:px-5 py-0.5 shrink-0">
        <span className="text-sm md:text-base font-bold text-secondary">
          Q{currentIndex + 1}/{questions.length}
        </span>
        <span className="inline-flex items-center bg-amber-400 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
          {t('math.mode.practice')}
        </span>
      </div>

      {/* Question area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-10 sm:px-6 md:px-4 pb-6 -mt-6 sm:-mt-0 gap-1">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentQuestion.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-[17rem] sm:max-w-md md:max-w-lg lg:max-w-xl"
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl p-2 sm:p-4 md:p-5 lg:p-7 gummy-shadow-lg mb-1.5 sm:mb-3 text-center">
              <p className="text-lg sm:text-2xl md:text-3xl lg:text-5xl font-bold text-text leading-snug break-words">
                {renderQuestion(lang === 'en' && currentQuestion.questionEn ? currentQuestion.questionEn : currentQuestion.question)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 sm:gap-2 md:gap-3">
              {currentQuestion.choices.map((choice, i) => {
                const isCorrectChoice = choice === currentQuestion.correctAnswer
                const isWrongFlash = wrongFlash === choice
                const userPicked = picked[currentQuestion.id]
                const showCorrect = isAnswered && isCorrectChoice
                const showWrong = isAnswered && userPicked === choice && !isCorrectChoice
                const dimmed = isAnswered && !isCorrectChoice && !showWrong

                return (
                  <motion.button
                    key={`${currentQuestion.id}-${choice}-${i}`}
                    whileTap={!isAnswered ? { scale: 0.95 } : {}}
                    animate={isWrongFlash ? { x: [0, -6, 6, -6, 0] } : {}}
                    transition={{ duration: 0.25 }}
                    onClick={() => handlePick(choice)}
                    disabled={isAnswered}
                    className={`relative p-2 sm:p-3 md:p-4 lg:p-5 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg md:text-xl lg:text-2xl transition-all ${
                      showCorrect
                        ? 'bg-green text-white gummy-shadow-lg scale-[1.03]'
                        : showWrong || isWrongFlash
                          ? 'bg-red text-white'
                          : dimmed
                            ? 'bg-white/60 text-text-muted'
                            : 'bg-white text-text gummy-shadow hover:bg-bg gummy-press'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-1.5 text-[9px] sm:text-[10px] md:text-xs font-bold ${
                      showCorrect || showWrong || isWrongFlash ? 'text-white/60' : 'text-text-muted'
                    }`}>
                      {labels[i]}
                    </span>
                    {choice}
                  </motion.button>
                )
              })}
            </div>

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Side arrows */}
      <button
        onClick={goPrev}
        disabled={currentIndex === 0}
        className="fixed left-1 md:left-3 top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-white/80 backdrop-blur-sm text-text-light gummy-shadow disabled:opacity-20 hover:bg-white active:scale-95 transition-all"
        aria-label="Previous"
      >
        <ChevronLeft size={22} className="md:!w-7 md:!h-7" />
      </button>
      <button
        onClick={goNext}
        disabled={currentIndex >= questions.length - 1}
        className="fixed right-1 md:right-3 top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-white/80 backdrop-blur-sm text-text-light gummy-shadow disabled:opacity-20 hover:bg-white active:scale-95 transition-all"
        aria-label="Next"
      >
        <ChevronRight size={22} className="md:!w-7 md:!h-7" />
      </button>

      <ExitConfirmDialog
        open={showExitDialog}
        onConfirm={confirmExit}
        onCancel={() => setShowExitDialog(false)}
      />
    </div>
  )
}
