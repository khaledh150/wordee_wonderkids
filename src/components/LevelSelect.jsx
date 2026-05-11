import { motion } from 'framer-motion'
import { LEVELS } from '../data/vocabulary'
import logo from '../assets/logo.webp'
import { APP_VERSION } from '../App'
import FullscreenBtn from './FullscreenBtn'

const levelColors = ['bg-pink-400', 'bg-teal-400', 'bg-violet-400', 'bg-orange-400']
const levelShadows = ['shadow-pink-300', 'shadow-teal-300', 'shadow-violet-300', 'shadow-orange-300']

export default function LevelSelect({ onSelect }) {
  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-white to-purple-50 overflow-auto relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <FullscreenBtn className="absolute top-3 right-3 z-10" />

      <img src={logo} alt="Wordee" className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain mb-1" />
      <h1 className="text-2xl sm:text-3xl font-extrabold text-purple-700 mb-0.5">Wordee</h1>
      <p className="text-xs sm:text-sm text-purple-400 mb-3">Choose your level</p>

      <div className="flex flex-col gap-2.5 w-full max-w-sm">
        {LEVELS.map((level, i) => (
          <motion.button
            key={level.id}
            className={`${levelColors[i]} text-white rounded-2xl px-6 py-3 shadow-lg ${levelShadows[i]} flex items-center gap-4 active:scale-95 transition-transform w-full`}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelect(level.id)}
          >
            <span className="text-2xl sm:text-3xl">{level.emoji}</span>
            <div className="text-left">
              <div className="font-extrabold text-base sm:text-lg">{level.name}</div>
              <div className="text-xs sm:text-sm opacity-90">{level.subtitle}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-gray-400">v{APP_VERSION}</p>
    </motion.div>
  )
}
