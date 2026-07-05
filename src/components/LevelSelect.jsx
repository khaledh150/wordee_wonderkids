import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { LEVELS } from '../data/vocabulary'
import logo from '../assets/logo.webp'
import { APP_VERSION } from '../App'
import FullscreenBtn from './FullscreenBtn'
import { enterFullscreen } from '../utils/useFullscreen'

const levelColors = ['bg-pink-400', 'bg-teal-400', 'bg-violet-400', 'bg-orange-400']
const levelShadows = ['shadow-pink-300', 'shadow-teal-300', 'shadow-violet-300', 'shadow-orange-300']

export default function LevelSelect({ onSelect, onBack }) {
  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col items-center justify-center p-3 bg-gradient-to-br from-pink-50 via-white to-purple-50 overflow-auto relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <FullscreenBtn className="absolute top-3 right-3 z-10" />
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-3 left-3 z-10 flex items-center gap-1 px-3 py-2 rounded-xl text-purple-500 font-bold text-sm active:scale-95 transition-transform hover:bg-purple-50"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}

      <img src={logo} alt="English Spelling" className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 xl:w-44 xl:h-44 object-contain mb-0.5" />
      <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-extrabold text-purple-700 mb-0.5">English Spelling</h1>
      <p className="text-[11px] sm:text-xs lg:text-sm xl:text-base text-purple-400 mb-2 lg:mb-3">Choose your level</p>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 xl:gap-5 w-full max-w-2xl xl:max-w-4xl">
        {LEVELS.map((level, i) => (
          <motion.button
            key={level.id}
            className={`${levelColors[i]} text-white rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 lg:px-6 lg:py-5 xl:px-8 xl:py-6 shadow-lg ${levelShadows[i]} flex items-center gap-3 lg:gap-4 xl:gap-5 active:scale-95 transition-transform w-full`}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => { enterFullscreen(); onSelect(level.id) }}
          >
            <span className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">{level.emoji}</span>
            <div className="text-left">
              <div className="font-extrabold text-sm sm:text-base lg:text-lg xl:text-xl">{level.name}</div>
              <div className="text-[10px] sm:text-xs lg:text-sm xl:text-base opacity-90">{level.subtitle}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <p className="mt-2 text-[9px] sm:text-[10px] lg:text-xs text-gray-400">v{APP_VERSION} · © 2026 Wonder Kids CO., LTD. All rights reserved.</p>
    </motion.div>
  )
}
