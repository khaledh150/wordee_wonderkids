import { useState, useRef, useCallback, useEffect } from 'react'

export function useTimer(durationSeconds, onTimeUp) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const rafRef = useRef(null)
  const startWallTime = useRef(null)
  const onTimeUpRef = useRef(onTimeUp)
  const firedRef = useRef(false)

  onTimeUpRef.current = onTimeUp

  const start = useCallback(() => {
    startWallTime.current = Date.now()
    firedRef.current = false
    setIsRunning(true)
  }, [])

  const stop = useCallback(() => {
    setIsRunning(false)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const getElapsedSeconds = useCallback(() => {
    if (!startWallTime.current) return 0
    return Math.round((Date.now() - startWallTime.current) / 1000)
  }, [])

  useEffect(() => {
    if (!isRunning) return

    function tick() {
      const elapsed = (Date.now() - startWallTime.current) / 1000
      const remaining = Math.max(0, durationSeconds - elapsed)
      setTimeLeft(Math.ceil(remaining))

      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true
        stop()
        onTimeUpRef.current?.()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isRunning, durationSeconds, stop])

  return { timeLeft, isRunning, start, stop, getElapsedSeconds }
}
