import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '../i18n/LanguageContext'
import useSwipe from '../utils/useSwipe'
import { generateExam } from './mathEngine'
import { playSound } from './sound'
import { saveExamAnswers, saveExamProgress, getExamProgress, clearExamProgress } from './storage'
import { toggleFullscreen, isFullscreenActive, exitFullscreen } from '../utils/useFullscreen'
import { renderQuestion } from '../utils/fractionRenderer'
import CountdownOverlay from './CountdownOverlay'
import ExitConfirmDialog from './ExitConfirmDialog'
import logo from '../assets/wonderkids_logo.webp'
import { Clock, Globe, Maximize, Minimize, LogOut } from 'lucide-react'

export default function MathExam({ levelConfig: config, user, onFinish, onExit }) {
  const EXAM_DURATION_SEC = config.timeMinutes * 60
  const { t, lang, toggleLang } = useLang()

  const savedProgress = getExamProgress()
  const isResuming = savedProgress
    && savedProgress.level === config.level
    && savedProgress.user?.name === user?.name
    && savedProgress.questions?.length === config.questions

  if (savedProgress && !isResuming) clearExamProgress()

  const [phase, setPhase] = useState(isResuming ? 'exam' : 'countdown')
  const [questions] = useState(() => {
    if (isResuming) return savedProgress.questions
    return generateExam(config.level, config.questions)
  })
  const [currentIndex, setCurrentIndex] = useState(isResuming ? savedProgress.currentIndex : 0)
  const [answered, setAnswered] = useState(false)
  const [wrongPick, setWrongPick] = useState(null)
  const [isFull, setIsFull] = useState(false)
  const [displaySeconds, setDisplaySeconds] = useState(EXAM_DURATION_SEC)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const answersRef = useRef(isResuming ? (savedProgress.answers || {}) : {})
  const correctCountRef = useRef(0)
  const wrongCountRef = useRef(0)
  const deadlineRef = useRef(null)
  const intervalRef = useRef(null)
  const finishedRef = useRef(false)
  const saveTimeoutRef = useRef(null)
  const advanceTimeoutRef = useRef(null)

  function startCountdown(deadlineMs) {
    deadlineRef.current = deadlineMs
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000))
      setDisplaySeconds(remaining)
      if (remaining <= 0 && !finishedRef.current) {
        finishedRef.current = true
        clearInterval(intervalRef.current)
        playSound('timeWarning')
        finishExam()
      }
    }, 500)
  }

  useEffect(() => {
    if (isResuming && phase === 'exam') {
      const elapsedMs = (savedProgress.elapsedSeconds || 0) * 1000
      const deadline = Date.now() + (EXAM_DURATION_SEC * 1000 - elapsedMs)
      setDisplaySeconds(Math.max(0, Math.floor((deadline - Date.now()) / 1000)))
      startCountdown(deadline)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFull(isFullscreenActive())
    document.addEventListener('fullscreenchange', handler)
    document.addEventListener('webkitfullscreenchange', handler)
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {})
      }
    } catch {}
    return () => {
      document.removeEventListener('fullscreenchange', handler)
      document.removeEventListener('webkitfullscreenchange', handler)
      try {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock()
        }
      } catch {}
    }
  }, [])

  function getElapsedSeconds() {
    if (!deadlineRef.current) return 0
    const remaining = deadlineRef.current - Date.now()
    return Math.round((EXAM_DURATION_SEC * 1000 - Math.max(0, remaining)) / 1000)
  }

  function debouncedSave() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveExamProgress({
        level: config.level,
        user: { name: user?.name, code: user?.code },
        questions,
        answers: { ...answersRef.current },
        currentIndex,
        elapsedSeconds: getElapsedSeconds(),
      })
    }, 1000)
  }

  function finishExam() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
    clearExamProgress()
    const elapsed = getElapsedSeconds()
    const results = questions.map((q) => ({
      id: q.id,
      question: q.question,
      correctAnswer: q.correctAnswer,
      selectedAnswer: answersRef.current[q.id] ?? null,
      isCorrect: answersRef.current[q.id] === q.correctAnswer,
      isSkipped: answersRef.current[q.id] === undefined,
    }))

    const correct = results.filter((r) => r.isCorrect).length
    const wrong = results.filter((r) => !r.isCorrect && !r.isSkipped).length
    const skipped = results.filter((r) => r.isSkipped).length

    saveExamAnswers({
      user,
      level: config.level,
      totalQuestions: questions.length,
      correct,
      wrong,
      skipped,
      timeTaken: elapsed,
      totalTime: EXAM_DURATION_SEC,
      score: correct,
      accuracy: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
      results,
      completedAt: Date.now(),
    })

    playSound('complete')
    onFinish({
      user,
      level: config.level,
      totalQuestions: questions.length,
      correct,
      wrong,
      skipped,
      timeTaken: elapsed,
      totalTime: EXAM_DURATION_SEC,
      score: correct,
      accuracy: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
    })
  }

  function advanceToNext() {
    if (finishedRef.current) return
    if (currentIndex >= questions.length - 1) {
      finishExam()
    } else {
      const next = currentIndex + 1
      setCurrentIndex(next)
      setAnswered(false)
      setWrongPick(null)
      debouncedSave()
    }
  }

  function handleSelectAnswer(choice) {
    if (answered || finishedRef.current) return

    const isCorrect = choice === currentQuestion.correctAnswer

    answersRef.current[currentQuestion.id] = choice
    setAnswered(true)

    if (isCorrect) {
      playSound('correct')
      correctCountRef.current++
    } else {
      playSound('wrong')
      wrongCountRef.current++
      setWrongPick(choice)
    }

    debouncedSave()
    advanceTimeoutRef.current = setTimeout(advanceToNext, isCorrect ? 300 : 600)
  }

  function handleCountdownComplete() {
    setPhase('exam')
    const deadline = Date.now() + EXAM_DURATION_SEC * 1000
    setDisplaySeconds(EXAM_DURATION_SEC)
    startCountdown(deadline)
  }

  function handleExit() {
    setShowExitDialog(true)
  }

  function confirmExit() {
    setShowExitDialog(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
    clearExamProgress()
    exitFullscreen()
    onExit()
  }

  const swipeHandlers = useSwipe(() => {
    if (!answered && !finishedRef.current && currentIndex < questions.length - 1) {
      playSound('swipe')
      const next = currentIndex + 1
      setCurrentIndex(next)
      setAnswered(false)
      setWrongPick(null)
      debouncedSave()
    }
  }, null, 60)

  const currentQuestion = questions[currentIndex]
  const minutes = Math.floor(displaySeconds / 60)
  const seconds = displaySeconds % 60
  const isTimeWarning = displaySeconds <= 60
  const isTimeCritical = displaySeconds <= 30
  const questionProgress = ((currentIndex + 1) / questions.length) * 100
  const labels = ['A', 'B', 'C', 'D']

  if (phase === 'countdown') {
    return <CountdownOverlay onComplete={handleCountdownComplete} />
  }

  return (
    <div className="h-screen-safe flex flex-col overflow-hidden" {...swipeHandlers}>
      <div className="no-print shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-5 py-1.5 md:py-3">
        <img src={logo} alt="Wordee" className="h-7 md:h-10 w-auto shrink-0" />
        <span className="shrink-0 font-bold text-sm md:text-lg text-text">
          {t(`math.levels.level${config.level}`)}
        </span>
        <div className="flex-1 h-2 md:h-3 bg-white rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300"
            style={{ width: `${questionProgress}%` }}
          />
        </div>
        <div className={`flex items-center gap-1 font-bold text-lg md:text-xl tabular-nums ${isTimeCritical ? 'text-red animate-pulse' : isTimeWarning ? 'text-orange' : 'text-text'}`}>
          <Clock size={18} className="md:!w-6 md:!h-6" />
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
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
        <button
          onClick={handleExit}
          className="p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform text-red"
        >
          <LogOut size={18} className="md:!w-6 md:!h-6" />
        </button>
      </div>

      <div className="no-print flex items-center justify-between px-3 md:px-5 py-0.5 shrink-0">
        <span className="text-sm md:text-base font-bold text-text-light">
          Q{currentIndex + 1}/{questions.length}
        </span>
        <span className="inline-flex items-center bg-orange text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
          {t('math.mode.test')}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 sm:px-6 md:px-4 pb-6 -mt-6 sm:-mt-0 gap-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
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
                const isWrong = wrongPick === choice
                const showCorrect = answered && isCorrectChoice
                const dimmed = answered && !isCorrectChoice && !isWrong

                return (
                  <motion.button
                    key={`${currentQuestion.id}-${choice}-${i}`}
                    whileTap={!answered ? { scale: 0.95 } : {}}
                    animate={isWrong ? { x: [0, -6, 6, -6, 0] } : {}}
                    transition={{ duration: 0.25 }}
                    onClick={() => handleSelectAnswer(choice)}
                    disabled={answered}
                    className={`relative p-2 sm:p-3 md:p-4 lg:p-5 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg md:text-xl lg:text-2xl transition-all ${
                      showCorrect
                        ? 'bg-green text-white gummy-shadow-lg scale-[1.03]'
                        : isWrong
                          ? 'bg-red text-white'
                          : dimmed
                            ? 'bg-white/60 text-text-muted'
                            : 'bg-white text-text gummy-shadow hover:bg-bg gummy-press'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-1.5 text-[9px] sm:text-[10px] md:text-xs font-bold ${
                      showCorrect || isWrong ? 'text-white/60' : 'text-text-muted'
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

      <ExitConfirmDialog
        open={showExitDialog}
        onConfirm={confirmExit}
        onCancel={() => setShowExitDialog(false)}
      />
    </div>
  )
}
