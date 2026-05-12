import { useState, useCallback, useEffect } from 'react'

export function enterFullscreen() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) return
    const el = document.documentElement
    const req = el.requestFullscreen || el.webkitRequestFullscreen
    if (req) req.call(el).catch(() => {})
  } catch {}
}

export default function useFullscreen() {
  const [isFs, setIsFs] = useState(!!(document.fullscreenElement || document.webkitFullscreenElement))

  useEffect(() => {
    const onChange = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen
      if (exit) exit.call(document).catch(() => {})
    } else {
      enterFullscreen()
    }
  }, [])

  return { isFs, toggle }
}
