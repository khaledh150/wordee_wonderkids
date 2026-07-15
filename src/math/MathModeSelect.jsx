import { motion } from 'framer-motion'
import { useLang } from '../i18n/LanguageContext'
import { playSound } from './sound'
import { ArrowLeft, Gamepad2, ClipboardCheck, Clock, HelpCircle } from 'lucide-react'

const levelNameKeys = [
  'math.levels.level1', 'math.levels.level2', 'math.levels.level3', 'math.levels.level4',
  'math.levels.level5', 'math.levels.level6', 'math.levels.level7', 'math.levels.level8',
]

export default function MathModeSelect({ levelConfig: config, onSelectMode, onBack }) {
  const { t } = useLang()

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-auto relative h-screen-safe bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <button onClick={onBack} className="absolute top-3 left-3 md:top-5 md:left-5 z-10 p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform" aria-label="Back">
        <ArrowLeft size={20} className="text-text-light md:!w-6 md:!h-6" />
      </button>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="text-5xl sm:text-6xl md:text-7xl mb-2 md:mb-3">{config.emoji}</motion.div>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text mb-1">{t(levelNameKeys[config.level - 1])}</h2>
      <p className="flex items-center gap-1 text-text-muted text-xs md:text-sm mb-6 md:mb-8"><HelpCircle size={13} className="md:!w-4 md:!h-4" />{config.questions} {t('math.levels.questions')}</p>
      <div className="grid grid-cols-2 gap-4 md:gap-6 w-full max-w-sm sm:max-w-md md:max-w-lg">
        <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} whileTap={{ scale: 0.95 }}
          onClick={() => { playSound('select'); onSelectMode('practice') }}
          className="flex flex-col items-center gap-2 md:gap-3 p-5 sm:p-7 md:p-9 rounded-3xl bg-gradient-to-br from-teal-400 to-cyan-400 text-white gummy-shadow gummy-press transition-all">
          <Gamepad2 className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14" />
          <span className="text-lg sm:text-xl md:text-2xl font-bold">{t('math.mode.practice')}</span>
          <span className="text-white/80 text-xs sm:text-sm md:text-base">{t('math.mode.practiceDesc')}</span>
        </motion.button>
        <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} whileTap={{ scale: 0.95 }}
          onClick={() => { playSound('select'); onSelectMode('test') }}
          className="flex flex-col items-center gap-2 md:gap-3 p-5 sm:p-7 md:p-9 rounded-3xl bg-gradient-to-br from-orange-400 to-amber-400 text-white gummy-shadow gummy-press transition-all">
          <ClipboardCheck className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14" />
          <span className="text-lg sm:text-xl md:text-2xl font-bold">{t('math.mode.test')}</span>
          <span className="flex items-center gap-1 text-white/80 text-xs sm:text-sm md:text-base"><Clock size={13} className="md:!w-4 md:!h-4" />{config.timeMinutes} {t('math.levels.minutes')}</span>
        </motion.button>
      </div>
    </div>
  )
}
