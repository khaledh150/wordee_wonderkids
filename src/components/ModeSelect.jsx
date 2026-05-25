import { motion } from 'framer-motion'
import { LEVELS } from '../data/vocabulary'
import { ArrowLeft, BookOpen, Gamepad2 } from 'lucide-react'
import FullscreenBtn from './FullscreenBtn'

export default function ModeSelect({ level, onSelect, onBack }) {
  const levelData = LEVELS.find(l => l.id === level)

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-white to-purple-50 relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="absolute top-3 left-3 flex gap-2">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-5 h-5 text-purple-500" />
        </button>
      </div>
      <FullscreenBtn className="absolute top-3 right-3" />

      <motion.div
        className="text-5xl mb-2"
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {levelData?.emoji}
      </motion.div>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-purple-700 mb-1">
        {levelData?.name}
      </h2>
      <p className="text-purple-400 font-semibold mb-8">{levelData?.subtitle}</p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm sm:max-w-lg">
        <motion.button
          className="flex-1 bg-gradient-to-br from-teal-400 to-cyan-400 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-teal-200 flex flex-col items-center gap-3 active:scale-95 transition-transform"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => onSelect('learn')}
        >
          <BookOpen className="w-10 h-10 sm:w-14 sm:h-14" />
          <span className="text-xl sm:text-2xl font-extrabold">Learn</span>
          <span className="text-sm opacity-90">See words & pictures</span>
        </motion.button>

        <motion.button
          className="flex-1 bg-gradient-to-br from-pink-400 to-rose-400 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-pink-200 flex flex-col items-center gap-3 active:scale-95 transition-transform"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => onSelect('practice')}
        >
          <Gamepad2 className="w-10 h-10 sm:w-14 sm:h-14" />
          <span className="text-xl sm:text-2xl font-extrabold">Practice</span>
          <span className="text-sm opacity-90">Test your knowledge</span>
        </motion.button>
      </div>
    </motion.div>
  )
}
