import { Maximize, Minimize } from 'lucide-react'
import useFullscreen from '../utils/useFullscreen'

export default function FullscreenBtn({ className = '' }) {
  const { isFs, toggle, supported } = useFullscreen()

  if (!supported) return null

  return (
    <button
      onClick={toggle}
      aria-label={isFs ? 'Exit fullscreen' : 'Enter fullscreen'}
      className={`p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform ${className}`}
    >
      {isFs
        ? <Minimize size={20} className="text-secondary md:!w-6 md:!h-6" />
        : <Maximize size={20} className="text-secondary md:!w-6 md:!h-6" />
      }
    </button>
  )
}
