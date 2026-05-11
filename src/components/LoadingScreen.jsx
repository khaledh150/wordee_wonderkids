import { motion } from 'framer-motion'

export default function LoadingScreen() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-purple-50">
      <motion.div
        className="text-6xl"
        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        📚
      </motion.div>
      <p className="mt-4 text-xl font-bold text-purple-400">Loading...</p>
      <div className="mt-4 w-48 h-2 bg-purple-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
      </div>
    </div>
  )
}
