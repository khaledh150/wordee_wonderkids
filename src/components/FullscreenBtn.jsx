import { Maximize, Minimize } from 'lucide-react'
import useFullscreen from '../utils/useFullscreen'

export default function FullscreenBtn({ className = '' }) {
  const { isFs, toggle, supported } = useFullscreen()

  if (!supported) return null

  return (
    <button
      onClick={toggle}
      aria-label={isFs ? 'Exit fullscreen' : 'Enter fullscreen'}
      className={`p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform ${className}`}
    >
      {isFs
        ? <Minimize className="w-4 h-4 text-purple-500" />
        : <Maximize className="w-4 h-4 text-purple-500" />
      }
    </button>
  )
}
