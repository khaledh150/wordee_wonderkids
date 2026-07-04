import { Maximize, Minimize } from 'lucide-react'
import useFullscreen from '../utils/useFullscreen'

export default function FullscreenBtn({ className = '' }) {
  const { isFs, toggle, supported } = useFullscreen()

  if (!supported) return null

  return (
    <button
      onClick={toggle}
      aria-label={isFs ? 'Exit fullscreen' : 'Enter fullscreen'}
      className={`p-2 sm:p-2.5 lg:p-3 xl:p-3.5 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform ${className}`}
    >
      {isFs
        ? <Minimize className="w-5 h-5 sm:w-5.5 sm:h-5.5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-purple-500" />
        : <Maximize className="w-5 h-5 sm:w-5.5 sm:h-5.5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-purple-500" />
      }
    </button>
  )
}
