import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
}

const COLORS = {
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
}

export default function Toast({ type, message, onDismiss }) {
  const [show, setShow] = useState(false)
  const Icon = ICONS[type] || Info

  useEffect(() => {
    requestAnimationFrame(() => setShow(true))
  }, [])

  const handleDismiss = () => {
    setShow(false)
    setTimeout(onDismiss, 200)
  }

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg min-w-[240px] max-w-[360px] transition-all duration-200 ${COLORS[type]} ${show ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}
    >
      <Icon size={18} className="shrink-0" />
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={handleDismiss} className="shrink-0 opacity-70 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  )
}
