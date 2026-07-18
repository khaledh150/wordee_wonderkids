import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLang } from '../i18n/LanguageContext'
import { fireConfetti } from '../utils/confetti'
import { CheckCircle, XCircle, MinusCircle, Clock, Target, Home, RotateCcw } from 'lucide-react'

function getGrade(accuracy, t) {
  if (accuracy === 100) return { text: t('math.results.perfect'), color: 'text-gold' }
  if (accuracy >= 80) return { text: t('math.results.excellent'), color: 'text-green' }
  if (accuracy >= 60) return { text: t('math.results.great'), color: 'text-secondary' }
  if (accuracy >= 40) return { text: t('math.results.good'), color: 'text-orange' }
  return { text: t('math.results.keepTrying'), color: 'text-primary' }
}

export default function MathResults({ examData, onBackToHome, onTryAgain }) {
  const { t } = useLang()
  const { correct, wrong, skipped, totalQuestions, timeTaken, accuracy } = examData
  const grade = getGrade(accuracy, t)

  useEffect(() => {
    if (accuracy >= 60) {
      const timer = setTimeout(fireConfetti, 500)
      return () => clearTimeout(timer)
    }
  }, [accuracy])

  const minutes = Math.floor(timeTaken / 60)
  const seconds = timeTaken % 60

  return (
    <div className="w-full min-h-screen-safe flex items-center justify-center p-3 md:p-6 overflow-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl md:max-w-4xl"
      >
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 items-center sm:items-start">
          {/* Left: Score circle + grade */}
          <div className="text-center shrink-0">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center gummy-shadow-lg mx-auto"
            >
              <div className="text-center">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">{correct}</div>
                <div className="text-white/80 text-xs sm:text-sm md:text-base font-medium">{t('math.results.outOf')} {totalQuestions}</div>
              </div>
            </motion.div>
            <h1 className={`text-lg sm:text-xl md:text-2xl font-bold mt-2 md:mt-3 ${grade.color}`}>{grade.text}</h1>
          </div>

          {/* Right: Stats + buttons */}
          <div className="flex-1 w-full">
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 gummy-shadow-lg">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                {[
                  { icon: CheckCircle, label: t('math.results.correct'), value: correct, color: 'text-green', bg: 'bg-green/10' },
                  { icon: XCircle, label: t('math.results.wrong'), value: wrong, color: 'text-red', bg: 'bg-red/10' },
                  { icon: MinusCircle, label: t('math.results.skipped'), value: skipped, color: 'text-text-muted', bg: 'bg-bg' },
                  { icon: Clock, label: t('math.results.timeTaken'), value: `${minutes}:${String(seconds).padStart(2, '0')}`, color: 'text-purple', bg: 'bg-purple/10' },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl md:rounded-2xl p-2 md:p-3 text-center`}>
                    <Icon size={20} className={`${color} mx-auto mb-0.5 md:!w-6 md:!h-6`} />
                    <div className={`text-lg md:text-xl font-bold ${color}`}>{value}</div>
                    <div className="text-text-muted text-[10px] md:text-xs">{label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 md:mt-4 flex items-center justify-center gap-2 bg-bg rounded-xl md:rounded-2xl p-2 md:p-3">
                <Target size={18} className="text-primary md:!w-6 md:!h-6" />
                <span className="text-text font-bold text-lg md:text-xl">{accuracy}%</span>
                <span className="text-text-light text-sm md:text-base">{t('math.results.accuracy')}</span>
              </div>
            </div>

            <div className="flex gap-3 md:gap-4 mt-3 md:mt-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onBackToHome}
                className="flex-1 flex items-center justify-center gap-2 py-3 md:py-4 rounded-2xl md:rounded-3xl bg-gradient-to-r from-primary to-primary-dark text-white font-bold md:text-lg gummy-shadow gummy-press"
              >
                <Home size={18} className="md:!w-5 md:!h-5" />
                {t('math.results.backToHome')}
              </motion.button>
              {onTryAgain && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onTryAgain}
                  className="flex-1 flex items-center justify-center gap-2 py-3 md:py-4 rounded-2xl md:rounded-3xl bg-white border-2 border-secondary text-secondary font-bold md:text-lg gummy-shadow gummy-press"
                >
                  <RotateCcw size={18} className="md:!w-5 md:!h-5" />
                  {t('math.results.tryAgain')}
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
