import { Maximize, Minimize } from 'lucide-react'
import useFullscreen from '../utils/useFullscreen'

export default function FullscreenBtn({ className = '' }) {
  const { isFs, toggle, supported } = useFullscreen()

  if (!supported) return null

  return (
    <button
      onClick={toggle}
      aria-label={isFs ? 'Exit fullscreen' : 'Enter fullscreen'}
      className={`p-1.5 sm:p-2 lg:p-2.5 xl:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform ${className}`}
    >
      {isFs
        ? <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 text-purple-500" />
        : <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 text-purple-500" />
      }
    </button>
  )
}
