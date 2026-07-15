import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '../i18n/LanguageContext'
import { LogOut } from 'lucide-react'

export default function ExitConfirmDialog({ open, onConfirm, onCancel }) {
  const { t } = useLang()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm md:max-w-md gummy-shadow-lg text-center"
          >
            <div className="w-14 h-14 md:w-18 md:h-18 rounded-full bg-red/10 flex items-center justify-center mx-auto mb-4 md:mb-5">
              <LogOut className="w-7 h-7 md:w-9 md:h-9 text-red" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-text mb-2">{t('math.exam.exitTitle')}</h3>
            <p className="text-text-light text-sm md:text-base mb-6 md:mb-7">{t('math.exam.exitMessage')}</p>
            <div className="flex gap-3 md:gap-4">
              <button onClick={onCancel} className="flex-1 py-3 md:py-4 rounded-2xl font-bold md:text-lg text-text-light bg-bg gummy-shadow gummy-press active:scale-95 transition-all">{t('common.cancel')}</button>
              <button onClick={onConfirm} className="flex-1 py-3 md:py-4 rounded-2xl font-bold md:text-lg text-white bg-gradient-to-r from-red to-red-dark gummy-shadow gummy-press active:scale-95 transition-all">{t('math.exam.exitConfirm')}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
