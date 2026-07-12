import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'

export function useTimer(durationSeconds, onTimeUp) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const startTimeRef = useRef(null)
  const intervalRef = useRef(null)
  const firedRef = useRef(false)
  const onTimeUpRef = useRef(onTimeUp)
  onTimeUpRef.current = onTimeUp

  const start = useCallback(() => {
    startTimeRef.current = Date.now()
    firedRef.current = false
    setIsRunning(true)
  }, [])

  const stop = useCallback(() => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const getElapsedSeconds = useCallback(() => {
    if (!startTimeRef.current) return 0
    return Math.round((Date.now() - startTimeRef.current) / 1000)
  }, [])

  useEffect(() => {
    if (!isRunning) return
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const remaining = Math.max(0, durationSeconds - elapsed)
      setTimeLeft(Math.ceil(remaining))
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true
        clearInterval(intervalRef.current)
        intervalRef.current = null
        setIsRunning(false)
        onTimeUpRef.current?.()
      }
    }, 250)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning, durationSeconds])

  return { timeLeft, isRunning, start, stop, getElapsedSeconds }
}

export default function PracticeTimerDisplay({ timeLeft }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isWarning = timeLeft <= 60 && timeLeft > 30
  const isCritical = timeLeft <= 30
  const isUrgent = timeLeft <= 10

  const heartbeat = isCritical
    ? {
        scale: [1, isUrgent ? 1.25 : 1.15, 1],
        transition: { duration: isUrgent ? 0.4 : 0.7, repeat: Infinity, ease: 'easeInOut' },
      }
    : {}

  return (
    <motion.div
      animate={heartbeat.scale ? { scale: heartbeat.scale } : {}}
      transition={heartbeat.transition || {}}
      className={`flex items-center gap-0.5 sm:gap-1 font-bold text-xs sm:text-sm lg:text-base xl:text-lg tabular-nums ${isCritical ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-purple-500'}`}
      role="timer"
      aria-label={`${minutes} minutes ${seconds} seconds remaining`}
    >
      <Clock className={`w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 ${isCritical ? 'animate-spin' : ''}`} style={isCritical ? { animationDuration: isUrgent ? '1s' : '2s' } : {}} />
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </motion.div>
  )
}
