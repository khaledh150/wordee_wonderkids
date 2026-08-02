import { createContext, useContext, useState, useCallback, useRef } from 'react'
import Toast from './Toast'

const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const toastsRef = useRef(toasts)
  toastsRef.current = toasts

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message, type = 'success') => {
    const id = ++idCounter
    const duration = type === 'error' ? 5000 : 3000
    setToasts(prev => {
      const next = [...prev, { id, message, type }]
      return next.length > 3 ? next.slice(-3) : next
    })
    setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const api = useCallback({
    success: (msg) => toast(msg, 'success'),
    warning: (msg) => toast(msg, 'warning'),
    error: (msg) => toast(msg, 'error'),
    info: (msg) => toast(msg, 'info'),
  }, [toast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} type={t.type} message={t.message} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { success: () => {}, warning: () => {}, error: () => {}, info: () => {} }
  return ctx
}
