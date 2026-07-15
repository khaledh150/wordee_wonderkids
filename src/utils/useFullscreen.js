import { useState, useCallback, useEffect } from 'react'

const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
const supportsFullscreen = typeof document !== 'undefined' && !isIOS && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)

export function enterFullscreen() {
  if (!supportsFullscreen) return
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) return
    const el = document.documentElement
    const req = el.requestFullscreen || el.webkitRequestFullscreen
    if (req) req.call(el).catch(() => {})
  } catch {}
}

export function exitFullscreen() {
  if (!supportsFullscreen) return
  try {
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) return
    const exit = document.exitFullscreen || document.webkitExitFullscreen
    if (exit) exit.call(document).catch(() => {})
  } catch {}
}

export function isFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement)
}

export function toggleFullscreen() {
  if (isFullscreenActive()) {
    exitFullscreen()
  } else {
    enterFullscreen()
  }
}

export function requestFullscreen() {
  enterFullscreen()
}

export default function useFullscreen() {
  const [isFs, setIsFs] = useState(!!(typeof document !== 'undefined' && (document.fullscreenElement || document.webkitFullscreenElement)))

  useEffect(() => {
    if (!supportsFullscreen) return
    const onChange = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  const toggle = useCallback(() => {
    toggleFullscreen()
  }, [])

  return { isFs, toggle, supported: supportsFullscreen }
}
