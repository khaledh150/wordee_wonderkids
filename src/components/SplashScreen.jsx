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
      className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-pink-100 via-white to-cyan-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.img
        src={logo}
        alt="Wordee"
        className="w-48 h-48 sm:w-64 sm:h-64 object-contain drop-shadow-xl"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
      />
      <motion.h1
        className="text-3xl sm:text-5xl font-extrabold mt-4 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Wordee
      </motion.h1>
      <motion.p
        className="text-lg sm:text-xl text-purple-400 mt-2 font-semibold"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Learn English Words
      </motion.p>
      <motion.div
        className="mt-8 flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-3 h-3 rounded-full bg-pink-400"
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
          />
        ))}
      </motion.div>
      <motion.button
        className="mt-6 px-8 py-3 bg-gradient-to-r from-pink-400 to-purple-400 text-white font-bold rounded-full text-lg shadow-lg active:scale-95 transition-transform"
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
