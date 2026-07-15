import { motion } from 'framer-motion'
import { useLang } from '../i18n/LanguageContext'
import { levelConfig } from './mathEngine'
import { playSound } from './sound'
import { Printer, ArrowLeft } from 'lucide-react'
import FullscreenBtn from '../components/FullscreenBtn'

const levelNameKeys = [
  'math.levels.level1', 'math.levels.level2', 'math.levels.level3', 'math.levels.level4',
  'math.levels.level5', 'math.levels.level6', 'math.levels.level7', 'math.levels.level8',
]

export default function MathLevelSelect({ onSelectLevel, onPrint, onBack }) {
  const { t } = useLang()

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
        <button onClick={onBack} className="absolute top-3 left-3 md:top-5 md:left-5 z-10 p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform" aria-label="Back">
          <ArrowLeft size={20} className="text-text-light md:!w-6 md:!h-6" />
        </button>
      )}

      <div className="max-w-2xl md:max-w-3xl mx-auto w-full">
        <div className="text-center mb-4 md:mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text mb-1">{t('math.title')}</h1>
          <p className="text-text-light text-sm md:text-base">{t('math.levels.title')}</p>
        </div>
        <div className="grid gap-2.5 md:gap-3 grid-cols-2">
          {levelConfig.map((config, i) => (
            <motion.button
              key={config.level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { playSound('select'); onSelectLevel(config) }}
              className={`w-full text-left p-3 md:p-4 rounded-2xl bg-gradient-to-br ${config.color} text-white gummy-shadow gummy-press transition-all`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl md:text-3xl">{config.emoji}</span>
                <div>
                  <div className="font-bold text-sm md:text-base">{t(levelNameKeys[i])}</div>
                  <div className="text-white/80 text-xs md:text-sm font-medium">{config.questions} {t('math.levels.questions')}</div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={onPrint}
          className="mt-4 mx-auto flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-text-light font-medium gummy-shadow gummy-press hover:text-text transition-all"
        >
          <Printer size={18} />
          {t('math.print.printButton')}
        </motion.button>
      </div>
    </motion.div>
  )
}
