import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Home, Volume2, VolumeX } from 'lucide-react'
import { getVocabForLevel, LEVELS } from '../data/vocabulary'
import { playWordVO, playCorrectEncouragement, playWrongEncouragement, playCelebration, stopAll, delay, toggleMute, isVOMuted } from '../utils/audioPlayer'
import { trackWordPracticed, trackLevelCompleted } from '../utils/progress'
import { fireConfetti, fireCelebration as confettiCelebration } from '../utils/confetti'
import MultipleChoice from './practice/MultipleChoice'
import LetterDragDrop from './practice/LetterDragDrop'

export default function PracticeMode({ level, onBack, onHome }) {
  const allVocab = getVocabForLevel(level)
  const levelData = LEVELS.find(l => l.id === level)
  const [index, setIndex] = useState(0)
  const [muted, setMuted] = useState(isVOMuted())
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

  if (!current) return null

  return (
    <motion.div
      className="w-full h-full flex flex-col bg-gradient-to-b from-pink-50 via-white to-purple-50 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <button onClick={() => { stopAll(); onBack() }} className="p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5 text-purple-500" />
        </button>
        <div className="text-center">
          <span className="text-sm font-bold text-pink-500">Practice · {levelData?.name}</span>
          <div className="text-xs text-pink-300">{index + 1} / {shuffled.length}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMuted(toggleMute())} className="p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
            {muted ? <VolumeX className="w-5 h-5 text-gray-400" /> : <Volume2 className="w-5 h-5 text-pink-500" />}
          </button>
          <button onClick={() => { stopAll(); onHome() }} className="p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
            <Home className="w-5 h-5 text-pink-500" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 shrink-0">
        <div className="w-full h-2 bg-pink-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full"
            animate={{ width: `${((index + 1) / shuffled.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Flash overlay for correct/wrong */}
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

      {/* Practice content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="w-full max-w-lg flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {/* Image with speaker */}
            <div className="relative bg-white rounded-3xl shadow-xl p-3 mb-4">
              <img
                src={current.image}
                alt=""
                className="w-40 h-40 sm:w-52 sm:h-52 object-contain rounded-2xl"
                onError={(e) => { e.target.src = '/images/placeholder.svg' }}
                draggable={false}
              />
              <button
                onClick={handleSpeaker}
                className="absolute top-2 right-2 p-2 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full shadow-lg active:scale-90 transition-transform"
              >
                <Volume2 className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Level-specific practice */}
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
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
