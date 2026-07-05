import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Target, Home, RotateCcw } from 'lucide-react'
import { fireCelebration, cancelCelebration } from '../../utils/confetti'

export default function PracticeResults({ correct, wrong, total, timeTaken, totalTime, onHome, onTryAgain }) {
  const answered = correct + wrong
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
  const minutes = Math.floor(timeTaken / 60)
  const seconds = timeTaken % 60
  const allDone = answered >= total
  const timeUp = timeTaken >= totalTime

  useEffect(() => {
    if (accuracy >= 60) {
      const t = setTimeout(fireCelebration, 500)
      return () => { clearTimeout(t); cancelCelebration() }
    }
  }, [accuracy])

  const grade = accuracy === 100 ? { text: 'Perfect!', color: 'text-yellow-500' }
    : accuracy >= 80 ? { text: 'Excellent!', color: 'text-green-500' }
    : accuracy >= 60 ? { text: 'Great job!', color: 'text-purple-500' }
    : accuracy >= 40 ? { text: 'Good try!', color: 'text-orange-500' }
    : { text: 'Keep trying!', color: 'text-pink-500' }

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50 px-3 py-2 sm:p-4 lg:p-6 xl:p-8 overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 xl:w-44 xl:h-44 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-xl"
      >
        <div className="text-center">
          <div className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white">{correct}</div>
          <div className="text-white/80 text-[10px] sm:text-sm lg:text-base xl:text-lg font-medium">out of {answered}</div>
        </div>
      </motion.div>

      <h1 className={`text-lg sm:text-2xl lg:text-3xl xl:text-4xl font-bold mt-2 sm:mt-3 ${grade.color}`}>{grade.text}</h1>
      <p className="text-purple-400 text-xs sm:text-sm lg:text-base xl:text-lg mt-0.5">{allDone ? 'All questions done!' : timeUp ? "Time's up!" : 'Practice complete!'}</p>

      <div className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 xl:p-6 shadow-xl mt-3 sm:mt-4 w-full max-w-sm lg:max-w-md xl:max-w-lg">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 xl:gap-3">
          {[
            { icon: CheckCircle, label: 'Correct', value: correct, color: 'text-green-500', bg: 'bg-green-50' },
            { icon: XCircle, label: 'Wrong', value: wrong, color: 'text-red-500', bg: 'bg-red-50' },
            { icon: Clock, label: 'Time', value: `${minutes}:${String(seconds).padStart(2, '0')}`, color: 'text-purple-500', bg: 'bg-purple-50' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-1.5 sm:p-2 lg:p-3 xl:p-4 text-center`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 ${color} mx-auto mb-0.5`} />
              <div className={`text-base sm:text-lg lg:text-xl xl:text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-gray-400 text-[10px] sm:text-xs lg:text-sm xl:text-base">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-2 sm:mt-3 flex items-center justify-center gap-1.5 sm:gap-2 bg-purple-50 rounded-xl p-1.5 sm:p-2 xl:p-3">
          <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 text-purple-500" />
          <span className="text-purple-700 font-bold text-base sm:text-lg lg:text-xl xl:text-2xl">{accuracy}%</span>
          <span className="text-purple-400 text-xs sm:text-sm lg:text-base xl:text-lg">accuracy</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-3 sm:mt-4 w-full max-w-sm lg:max-w-md xl:max-w-lg">
        <button
          onClick={onHome}
          aria-label="Back to home"
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold rounded-full shadow-lg active:scale-95 transition-transform text-sm sm:text-base"
        >
          <Home className="w-4 h-4 sm:w-5 sm:h-5" />
          Home
        </button>
        {onTryAgain && (
          <button
            onClick={onTryAgain}
            aria-label="Try again"
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-3 bg-white border-2 border-purple-300 text-purple-600 font-bold rounded-full shadow-md active:scale-95 transition-transform text-sm sm:text-base"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            Try Again
          </button>
        )}
      </div>
    </motion.div>
  )
}
