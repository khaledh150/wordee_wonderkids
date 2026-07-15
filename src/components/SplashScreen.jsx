import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useLang } from '../i18n/LanguageContext'
import logo from '../assets/wonderkids_logo.webp'

const SYMBOLS = ['A', 'B', '3', '+', 'Z', 'a', '7', 'c', '×', 'w']
const COLORS = [
  'text-pink-400', 'text-purple-400', 'text-cyan-400', 'text-amber-400',
  'text-rose-400', 'text-violet-400', 'text-teal-400', 'text-orange-400',
  'text-pink-300', 'text-indigo-400',
]

function FloatingSymbol({ symbol, color, index, total }) {
  const angle = (index / total) * Math.PI * 2
  const radius = 100
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius

  return (
    <motion.span
      className={`absolute text-xl sm:text-2xl md:text-3xl font-bold ${color} opacity-40 select-none pointer-events-none`}
      style={{ fontFamily: 'cursive' }}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
      animate={{
        x,
        y,
        opacity: [0, 0.5, 0.3],
        scale: [0, 1.2, 1],
        rotate: [0, 360],
      }}
      transition={{
        duration: 2,
        delay: 0.3 + index * 0.1,
        ease: 'easeOut',
      }}
    >
      {symbol}
    </motion.span>
  )
}

export default function SplashScreen({ onDone }) {
  const { t } = useLang()
  useEffect(() => {
    const timer = setTimeout(onDone, 3000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <motion.div
      className="w-full min-h-screen-safe flex flex-col items-center justify-center bg-gradient-to-b from-pink-100 via-white to-cyan-50 px-4 py-6 phone-ls:py-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative flex items-center justify-center">
        {SYMBOLS.map((sym, i) => (
          <FloatingSymbol key={i} symbol={sym} color={COLORS[i]} index={i} total={SYMBOLS.length} />
        ))}

        <motion.img
          src={logo}
          alt="WonderKids"
          className="w-40 h-40 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-72 lg:h-72 phone-ls:w-28 phone-ls:h-28 object-contain drop-shadow-xl relative z-10"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        />
      </div>

      <motion.h1
        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl phone-ls:text-xl font-black mt-3 phone-ls:mt-1 pb-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent text-center leading-normal"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {t('app.splashTitle')}
      </motion.h1>
      <motion.p
        className="text-lg sm:text-xl md:text-2xl lg:text-3xl phone-ls:text-sm text-purple-400 mt-1 font-bold"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {t('app.splashSubtitle')}
      </motion.p>
      <motion.div
        className="mt-4 phone-ls:mt-2 flex gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-400"
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
          />
        ))}
      </motion.div>
      <motion.button
        className="mt-5 phone-ls:mt-2 px-10 md:px-14 py-3.5 md:py-4 phone-ls:px-6 phone-ls:py-2 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold rounded-full text-lg md:text-xl lg:text-2xl phone-ls:text-base shadow-lg active:scale-95 transition-transform"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.5 }}
        onClick={onDone}
        whileTap={{ scale: 0.9 }}
      >
        {t('app.letsGo')}
      </motion.button>
    </motion.div>
  )
}
