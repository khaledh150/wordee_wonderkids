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
      className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-white to-purple-50 overflow-auto relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <FullscreenBtn className="absolute top-3 right-3 z-10" />

      <div className="flex items-center gap-6 sm:gap-10 max-w-3xl w-full">
        {/* Logo side */}
        <div className="flex flex-col items-center shrink-0">
          <img src={logo} alt="Wordee" className="w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 object-contain" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-purple-700 mt-1">Wordee</h1>
          <p className="text-xs text-purple-400">Choose your level</p>
          <p className="mt-1 text-[10px] text-gray-400">v{APP_VERSION}</p>
        </div>

        {/* Level buttons */}
        <div className="flex flex-col gap-2.5 sm:gap-3 flex-1 min-w-0">
          {LEVELS.map((level, i) => (
            <motion.button
              key={level.id}
              className={`${levelColors[i]} text-white rounded-2xl px-5 py-3 sm:px-6 sm:py-4 shadow-lg ${levelShadows[i]} flex items-center gap-4 active:scale-95 transition-transform w-full`}
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
      </div>
    </motion.div>
  )
}
