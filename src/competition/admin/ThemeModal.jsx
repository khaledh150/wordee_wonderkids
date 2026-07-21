import { Sun, Moon, X, Monitor, Gamepad2, Shield } from 'lucide-react'

const SECTIONS = [
  { key: 'admin', label: 'Admin Dashboard', icon: Shield, desc: 'This screen only' },
  { key: 'remote', label: 'Student & Projector', icon: Monitor, desc: 'Play page + projector screen' },
]

export default function ThemeModal({ adminTheme, remoteTheme, onAdminTheme, onRemoteTheme, onClose }) {
  const themes = { admin: adminTheme, remote: remoteTheme }
  const setters = { admin: onAdminTheme, remote: onRemoteTheme }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden ${
        adminTheme === 'dark' ? 'bg-[#0f1629] text-white' : 'bg-white text-slate-900'
      }`}>
        <div className={`px-5 pt-5 pb-3 flex items-center justify-between ${
          adminTheme === 'dark' ? 'border-b border-white/5' : 'border-b border-slate-100'
        }`}>
          <h2 className="text-base font-black">Theme Settings</h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
              adminTheme === 'dark' ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-100 text-slate-400'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {SECTIONS.map(s => {
            const Icon = s.icon
            const isDark = themes[s.key] === 'dark'
            const toggle = () => setters[s.key](isDark ? 'light' : 'dark')
            return (
              <div key={s.key} className={`flex items-center gap-3 px-3 py-3 rounded-xl ${
                adminTheme === 'dark' ? 'bg-white/5' : 'bg-slate-50'
              }`}>
                <Icon className={`w-4.5 h-4.5 shrink-0 ${adminTheme === 'dark' ? 'text-white/50' : 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${adminTheme === 'dark' ? 'text-white/90' : 'text-slate-700'}`}>{s.label}</div>
                  <div className={`text-[10px] ${adminTheme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{s.desc}</div>
                </div>
                <button
                  onClick={toggle}
                  className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-indigo-600'
                      : 'bg-amber-400'
                  }`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center transition-transform ${
                    isDark ? 'left-0.5' : 'translate-x-7'
                  }`}>
                    {isDark
                      ? <Moon className="w-3.5 h-3.5 text-indigo-600" />
                      : <Sun className="w-3.5 h-3.5 text-amber-500" />
                    }
                  </span>
                </button>
              </div>
            )
          })}
        </div>

        <div className={`px-5 py-3 flex justify-end ${
          adminTheme === 'dark' ? 'border-t border-white/5 bg-white/[0.02]' : 'border-t border-slate-100 bg-slate-50/50'
        }`}>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
