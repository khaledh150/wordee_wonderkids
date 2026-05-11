import { motion } from 'framer-motion'
import { LEVELS } from '../data/vocabulary'
import logo from '../assets/logo.webp'
import { APP_VERSION } from '../App'

const levelColors = ['bg-pink-400', 'bg-teal-400', 'bg-violet-400', 'bg-orange-400']
const levelShadows = ['shadow-pink-300', 'shadow-teal-300', 'shadow-violet-300', 'shadow-orange-300']

export default function LevelSelect({ onSelect }) {
  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-white to-purple-50 overflow-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <img src={logo} alt="Wordee" className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 object-contain mb-2" />
      <h1 className="text-3xl sm:text-4xl font-extrabold text-purple-700 mb-1">Wordee</h1>
      <p className="text-sm text-purple-400 mb-4">Choose your level</p>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {LEVELS.map((level, i) => (
          <motion.button
            key={level.id}
            className={`${levelColors[i]} text-white rounded-2xl px-6 py-4 shadow-lg ${levelShadows[i]} flex items-center gap-4 active:scale-95 transition-transform w-full`}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelect(level.id)}
          >
            <span className="text-3xl">{level.emoji}</span>
            <div className="text-left">
              <div className="font-extrabold text-lg">{level.name}</div>
              <div className="text-sm opacity-90">{level.subtitle}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-400">v{APP_VERSION}</p>
    </motion.div>
  )
}
