import { useRef, useCallback } from 'react'

export default function useSwipe(onSwipeLeft, onSwipeRight, threshold = 50) {
  const touchStart = useRef(null)
  const touchEnd = useRef(null)

  const onTouchStart = useCallback((e) => {
    if (!e.targetTouches?.length) return
    touchEnd.current = null
    touchStart.current = e.targetTouches[0].clientX
  }, [])

  const onTouchMove = useCallback((e) => {
    if (!e.targetTouches?.length) return
    touchEnd.current = e.targetTouches[0].clientX
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return
    const distance = touchStart.current - touchEnd.current
    if (Math.abs(distance) >= threshold) {
      if (distance > 0) onSwipeLeft?.()
      else onSwipeRight?.()
    }
    touchStart.current = null
    touchEnd.current = null
  }, [onSwipeLeft, onSwipeRight, threshold])

  return { onTouchStart, onTouchMove, onTouchEnd }
}
