import { useState, useCallback, useEffect } from 'react'

export default function useFullscreen() {
  const [isFs, setIsFs] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    } else {
      const el = document.documentElement
      ;(el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)
    }
  }, [])

  return { isFs, toggle }
}
