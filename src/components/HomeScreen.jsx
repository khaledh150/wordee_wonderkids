import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Calculator, Trophy, Lock, Globe } from 'lucide-react'
import { supabase } from '../competition/supabaseClient'
import { useLang } from '../i18n/LanguageContext'
import { APP_VERSION } from '../App'
import FullscreenBtn from './FullscreenBtn'
import { enterFullscreen } from '../utils/useFullscreen'
import logo from '../assets/wonderkids_logo.webp'

export default function HomeScreen({ onPracticeEnglish, onPracticeMath, onCompetition }) {
  const { t, toggleLang } = useLang()
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    let mounted = true
    async function check() {
      try {
        const { data } = await supabase
          .from('competition_state')
          .select('is_unlocked')
          .in('id', ['english', 'math'])
        if (mounted && data) {
          setUnlocked(data.some(s => s.is_unlocked))
        }
      } catch {}
    }
    check()
    const id = setInterval(check, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const buttonBase = "w-full flex items-center justify-center gap-2.5 sm:gap-3 px-5 md:px-8 py-3.5 sm:py-4 phone-ls:py-2.5 md:py-5 font-extrabold text-base sm:text-lg phone-ls:text-base md:text-2xl rounded-2xl md:rounded-3xl gummy-shadow gummy-press active:scale-95 transition-transform cursor-pointer"

  return (
    <motion.div
      className="w-full min-h-screen-safe flex flex-col phone-ls:flex-row items-center justify-center bg-gradient-to-b from-pink-100 via-white to-cyan-50 px-4 pt-4 pb-10 sm:px-6 sm:pt-6 sm:pb-14 md:px-10 md:pt-8 md:pb-20 phone-ls:pt-6 phone-ls:pb-6 overflow-auto relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute top-3 right-3 md:top-5 md:right-5 flex items-center gap-2 z-10">
        <button
          onClick={toggleLang}
          className="p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform text-purple"
          aria-label="Toggle Language"
        >
          <Globe size={20} className="md:!w-6 md:!h-6" />
        </button>
        <FullscreenBtn />
      </div>

      <motion.img
        src={logo}
        alt="WonderKids"
        className="h-44 sm:h-52 md:h-64 phone-ls:h-[45vh] w-auto drop-shadow-xl phone-ls:mr-8"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      />

      <div className="flex flex-col gap-2.5 sm:gap-3 md:gap-4 mt-3 sm:mt-4 md:mt-6 phone-ls:mt-0 w-full max-w-xs sm:max-w-sm md:max-w-md">
        <motion.button
          onClick={() => { enterFullscreen(); onPracticeEnglish() }}
          className={`${buttonBase} bg-gradient-to-r from-pink-400 to-purple-500 text-white`}
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.95 }}
        >
          <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
          {t('home.practiceEnglish')}
        </motion.button>

        <motion.button
          onClick={() => { enterFullscreen(); onPracticeMath() }}
          className={`${buttonBase} bg-gradient-to-r from-teal-400 to-cyan-500 text-white`}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          whileTap={{ scale: 0.95 }}
        >
          <Calculator className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
          {t('home.practiceMath')}
        </motion.button>

        <motion.button
          onClick={unlocked ? onCompetition : undefined}
          className={`${buttonBase} ${
            unlocked
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white animate-pulse'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileTap={unlocked ? { scale: 0.95 } : {}}
        >
          {unlocked ? (
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
          ) : (
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
          )}
          {t('home.competition')}
        </motion.button>

        {!unlocked && (
          <motion.p
            className="text-center text-xs sm:text-sm text-slate-400 font-medium -mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {t('home.locked')}
          </motion.p>
        )}
      </div>

      <div className="absolute bottom-2 md:bottom-4 left-0 right-0 px-4 md:px-6 flex items-center justify-between">
        <motion.p
          className="text-[9px] sm:text-[10px] md:text-xs text-text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1 }}
        >
          © 2026 Wonder Kids CO., LTD. All rights reserved.
        </motion.p>
        <motion.p
          className="text-[9px] sm:text-[10px] md:text-xs text-text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1 }}
        >
          v{APP_VERSION}
        </motion.p>
      </div>
    </motion.div>
  )
}
