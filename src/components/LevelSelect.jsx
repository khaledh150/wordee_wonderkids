import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { LEVELS } from '../data/vocabulary'
import FullscreenBtn from './FullscreenBtn'

const levelColors = [
  'from-rose-200 to-pink-300',
  'from-teal-300 to-cyan-400',
  'from-violet-300 to-purple-400',
  'from-orange-300 to-amber-400',
]

export default function LevelSelect({ onSelect, onBack }) {
  return (
    <motion.div
      className="w-full min-h-screen-safe flex flex-col items-center justify-center p-4 md:p-6 overflow-auto relative bg-gradient-to-br from-pink-50 via-white to-purple-50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="absolute top-3 right-3 md:top-5 md:right-5 z-10">
        <FullscreenBtn />
      </div>

      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-3 left-3 md:top-5 md:left-5 z-10 p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-text-light md:!w-6 md:!h-6" />
        </button>
      )}

      <div className="max-w-2xl md:max-w-3xl mx-auto w-full">
        <div className="text-center mb-4 md:mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text mb-1">English Spelling</h1>
          <p className="text-text-light text-sm md:text-base">Choose your level</p>
        </div>

        <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
          {LEVELS.map((level, i) => (
            <motion.button
              key={level.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(level.id)}
              className={`w-full text-left p-4 md:p-5 rounded-2xl md:rounded-3xl bg-gradient-to-br ${levelColors[i]} text-white gummy-shadow gummy-press transition-all`}
            >
              <div className="flex items-center gap-3 md:gap-4">
                <span className="text-3xl md:text-4xl">{level.emoji}</span>
                <div>
                  <div className="font-bold text-lg md:text-xl">{level.name}</div>
                  <div className="text-white/80 text-sm md:text-base font-medium">{level.subtitle}</div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
