import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Target, Home } from 'lucide-react'
import { fireCelebration, cancelCelebration } from '../../utils/confetti'

export default function PracticeResults({ correct, wrong, total, timeTaken, totalTime, onHome }) {
  const answered = correct + wrong
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
  const minutes = Math.floor(timeTaken / 60)
  const seconds = timeTaken % 60

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
      className="w-full h-screen-safe flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="w-28 h-28 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-xl"
      >
        <div className="text-center">
          <div className="text-4xl font-bold text-white">{correct}</div>
          <div className="text-white/80 text-sm font-medium">out of {answered}</div>
        </div>
      </motion.div>

      <h1 className={`text-2xl font-bold mt-3 ${grade.color}`}>{grade.text}</h1>
      <p className="text-purple-400 text-sm mt-1">Time's up!</p>

      <div className="bg-white rounded-2xl p-4 shadow-xl mt-4 w-full max-w-sm">
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: CheckCircle, label: 'Correct', value: correct, color: 'text-green-500', bg: 'bg-green-50' },
            { icon: XCircle, label: 'Wrong', value: wrong, color: 'text-red-500', bg: 'bg-red-50' },
            { icon: Clock, label: 'Time', value: `${minutes}:${String(seconds).padStart(2, '0')}`, color: 'text-purple-500', bg: 'bg-purple-50' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-2 text-center`}>
              <Icon className={`w-5 h-5 ${color} mx-auto mb-0.5`} />
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-gray-400 text-xs">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 bg-purple-50 rounded-xl p-2">
          <Target className="w-4 h-4 text-purple-500" />
          <span className="text-purple-700 font-bold text-lg">{accuracy}%</span>
          <span className="text-purple-400 text-sm">accuracy</span>
        </div>
      </div>

      <button
        onClick={onHome}
        aria-label="Back to home"
        className="mt-6 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold rounded-full shadow-lg active:scale-95 transition-transform"
      >
        <Home className="w-5 h-5" />
        Back to Home
      </button>
    </motion.div>
  )
}
