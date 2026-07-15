import { motion } from 'framer-motion'
import { LEVELS } from '../data/vocabulary'
import { ArrowLeft, BookOpen, Gamepad2, ClipboardCheck } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import FullscreenBtn from './FullscreenBtn'

export default function ModeSelect({ level, onSelect, onBack }) {
  const { t } = useLang()
  const levelData = LEVELS.find(l => l.id === level)

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col items-center justify-center p-4 md:p-6 bg-gradient-to-br from-pink-50 via-white to-purple-50 relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <button
        onClick={onBack}
        aria-label="Back"
        className="absolute top-3 left-3 md:top-5 md:left-5 z-10 p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform"
      >
        <ArrowLeft size={20} className="text-text-light md:!w-6 md:!h-6" />
      </button>
      <div className="absolute top-3 right-3 md:top-5 md:right-5 z-10">
        <FullscreenBtn />
      </div>

      <motion.div
        className="text-5xl sm:text-6xl md:text-7xl mb-2 md:mb-3"
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {levelData?.emoji}
      </motion.div>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text mb-0.5">
        {levelData?.name}
      </h2>
      <p className="text-text-light font-medium text-sm md:text-base mb-6 md:mb-8">{levelData?.subtitle}</p>

      <div className="grid grid-cols-3 gap-3 md:gap-5 w-full max-w-sm sm:max-w-xl md:max-w-2xl">
        <motion.button
          className="flex flex-col items-center gap-2 md:gap-3 p-4 sm:p-6 md:p-8 rounded-3xl bg-gradient-to-br from-teal-400 to-cyan-400 text-white gummy-shadow gummy-press transition-all"
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => onSelect('learn')}
        >
          <BookOpen className="w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14" />
          <span className="text-lg sm:text-xl md:text-2xl font-bold">{t('english.learn')}</span>
          <span className="text-white/80 text-[11px] sm:text-sm md:text-base">{t('english.learnDesc')}</span>
        </motion.button>

        <motion.button
          className="flex flex-col items-center gap-2 md:gap-3 p-4 sm:p-6 md:p-8 rounded-3xl bg-gradient-to-br from-pink-400 to-rose-400 text-white gummy-shadow gummy-press transition-all"
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => onSelect('practice')}
        >
          <Gamepad2 className="w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14" />
          <span className="text-lg sm:text-xl md:text-2xl font-bold">{t('english.practice')}</span>
          <span className="text-white/80 text-[11px] sm:text-sm md:text-base">{t('english.practiceDesc')}</span>
        </motion.button>

        <motion.button
          className="flex flex-col items-center gap-2 md:gap-3 p-4 sm:p-6 md:p-8 rounded-3xl bg-gradient-to-br from-orange-400 to-amber-400 text-white gummy-shadow gummy-press transition-all"
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => onSelect('test')}
        >
          <ClipboardCheck className="w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14" />
          <span className="text-lg sm:text-xl md:text-2xl font-bold">{t('english.test')}</span>
          <span className="text-white/80 text-[11px] sm:text-sm md:text-base">{t('english.testDesc')}</span>
        </motion.button>
      </div>
    </motion.div>
  )
}
