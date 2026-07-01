import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ dialog, isDark }) {
  return (
    <AnimatePresence>
      {dialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#060814]/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={dialog.onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className={`rounded-3xl p-6 max-w-md w-full border shadow-2xl ${
              isDark ? 'bg-[#0e1224] border-white/10' : 'bg-white border-slate-200'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-blue-400" />
              </div>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {dialog.message}
              </p>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={dialog.onCancel}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={dialog.onConfirm}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
