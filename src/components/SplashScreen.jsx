import { motion } from 'framer-motion'
import { useEffect } from 'react'
import logo from '../assets/logo.webp'

export default function SplashScreen({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      className="w-full h-screen-safe flex flex-col items-center justify-center bg-gradient-to-b from-pink-100 via-white to-cyan-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.img
        src={logo}
        alt="English Spelling"
        className="w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 object-contain drop-shadow-xl"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
      />
      <motion.h1
        className="text-2xl sm:text-4xl md:text-5xl font-extrabold mt-2 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        English Spelling
      </motion.h1>
      <motion.p
        className="text-base sm:text-lg text-purple-400 mt-1 font-semibold"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Learn English Words
      </motion.p>
      <motion.div
        className="mt-4 flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-pink-400"
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
          />
        ))}
      </motion.div>
      <motion.button
        className="mt-4 px-6 py-2.5 bg-gradient-to-r from-pink-400 to-purple-400 text-white font-bold rounded-full text-base shadow-lg active:scale-95 transition-transform"
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
