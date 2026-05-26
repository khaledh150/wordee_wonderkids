import { useState, useEffect, useRef, useCallback } from 'react'
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
        setIsRunning(false)
        onTimeUpRef.current?.()
      }
    }, 500)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning, durationSeconds])

  return { timeLeft, isRunning, start, stop, getElapsedSeconds }
}

export default function PracticeTimerDisplay({ timeLeft }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isWarning = timeLeft <= 60 && timeLeft > 30
  const isCritical = timeLeft <= 30

  return (
    <div className={`flex items-center gap-1 font-bold text-sm tabular-nums ${isCritical ? 'text-red-500 animate-pulse' : isWarning ? 'text-orange-500' : 'text-purple-500'}`}>
      <Clock className="w-3.5 h-3.5" />
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  )
}
