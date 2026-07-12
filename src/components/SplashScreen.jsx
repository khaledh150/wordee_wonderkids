import { motion } from 'framer-motion'
import { useEffect } from 'react'
import logo from '../assets/logo.webp'

const LETTER_SYMBOLS = ['A', 'B', 'C', 'Z', 'W', 'a', 'b', 'c', 'z', 'w']
const COLORS = [
  'text-pink-400', 'text-purple-400', 'text-cyan-400', 'text-amber-400',
  'text-rose-400', 'text-violet-400', 'text-teal-400', 'text-orange-400',
  'text-pink-300', 'text-indigo-400',
]

function FloatingSymbol({ symbol, color, index, total }) {
  const angle = (index / total) * Math.PI * 2
  const radius = 140
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius

  return (
    <motion.span
      className={`absolute text-2xl sm:text-3xl font-bold ${color} opacity-40 select-none pointer-events-none`}
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
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col items-center justify-center bg-gradient-to-b from-pink-100 via-white to-cyan-50 p-4 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative flex items-center justify-center">
        {LETTER_SYMBOLS.map((sym, i) => (
          <FloatingSymbol key={i} symbol={sym} color={COLORS[i]} index={i} total={LETTER_SYMBOLS.length} />
        ))}

        <motion.img
          src={logo}
          alt="English Spelling"
          className="w-40 h-40 sm:w-56 sm:h-56 md:w-72 md:h-72 object-contain drop-shadow-xl relative z-10"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        />
      </div>

      <motion.h1
        className="text-4xl sm:text-6xl md:text-7xl font-black mt-3 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        English Spelling
      </motion.h1>
      <motion.p
        className="text-lg sm:text-xl md:text-2xl text-purple-400 mt-1 font-bold"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Practice & Competition
      </motion.p>
      <motion.div
        className="mt-5 flex gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-400"
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
          />
        ))}
      </motion.div>
      <motion.button
        className="mt-5 px-10 py-3.5 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold rounded-full text-xl shadow-lg active:scale-95 transition-transform"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.5 }}
        onClick={onDone}
        whileTap={{ scale: 0.9 }}
      >
        Let's Go!
      </motion.button>
    </motion.div>
  )
}
