import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import { playSound } from './sound'

const STEPS = ['ready', '3', '2', '1', 'go']

export default function CountdownOverlay({ onComplete }) {
  const [step, setStep] = useState(0)
  const stableComplete = useCallback(onComplete, [])

  useEffect(() => {
    if (step >= STEPS.length) {
      stableComplete()
      return
    }
    const current = STEPS[step]
    if (current === 'go') playSound('countdownGo')
    else if (current !== 'ready') playSound('countdown')

    const delay = current === 'ready' ? 1200 : current === 'go' ? 800 : 1000
    const timer = setTimeout(() => setStep(step + 1), delay)
    return () => clearTimeout(timer)
  }, [step, stableComplete])

  const current = STEPS[step]
  if (step >= STEPS.length) return null

  const display = current === 'ready' ? 'Get Ready' : current === 'go' ? 'GO!' : current
  const colors = { ready: 'text-white', 3: 'text-primary', 2: 'text-orange', 1: 'text-red', go: 'text-green' }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-purple/90 to-primary/90 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className={`font-bold ${colors[current]} countdown-stroke ${current === 'ready' ? 'text-[min(12vw,5rem)]' : 'text-[min(30vw,12rem)]'}`}
        >
          {display}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
