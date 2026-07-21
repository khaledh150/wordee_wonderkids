import { Shield, Gamepad2, Projector, Layers, X } from 'lucide-react'

const MODES = [
  { key: 'admin', label: 'Admin Dashboard', path: '/admin', icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' },
  { key: 'play', label: 'Student Play', path: '/play', icon: Gamepad2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20' },
  { key: 'projector', label: 'Projector View', path: '/projector', icon: Projector, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20' },
]

export default function ModeLauncher({ isDark, onClose }) {
  function openMode(path) {
    window.open(path, '_blank')
  }

  function openAll() {
    for (const m of MODES) {
      window.open(m.path, '_blank')
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-6 ${
        isDark ? 'bg-[#111827] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-black">Open Views</h2>
              <p className={`text-xs font-semibold ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
                Launch in new tabs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl cursor-pointer transition-colors ${
              isDark ? 'hover:bg-white/10 text-white/50' : 'hover:bg-slate-100 text-slate-400'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {MODES.map(m => {
            const Icon = m.icon
            return (
              <button
                key={m.key}
                onClick={() => { openMode(m.path); onClose() }}
                className={`flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all cursor-pointer ${m.bg}`}
              >
                <Icon className={`w-6 h-6 ${m.color}`} />
                <span className={`text-sm font-bold flex-1 text-left ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.label}</span>
                <span className={`text-xs font-mono ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{m.path}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          <button
            onClick={openAll}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            Open All Three
          </button>
        </div>
      </div>
    </div>
  )
}
