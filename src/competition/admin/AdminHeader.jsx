import { Shield, LogOut, Sun, Moon, History, Activity, Monitor } from 'lucide-react'

const PHASE_LABELS = { setup: 'Setup', lobby: 'Lobby', live: 'Live', results: 'Results', podium: 'Podium' }
const PHASE_ORDER = ['setup', 'lobby', 'live', 'results', 'podium']

export default function AdminHeader({ subject, setSubject, phase, isDark, setTheme, onLogout, onPhaseClick, onDiagnostics, onModeLauncher }) {
  return (
    <header className={`border-b px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40 print:hidden transition-colors ${
      isDark ? 'bg-[#0e1224]/90 border-white/5 shadow-lg' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-white" />
          </div>
          <h1 className={`text-lg font-black tracking-tight ${
            isDark ? 'bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent' : 'text-slate-800'
          }`}>
            Competition Admin
          </h1>
        </div>

        <div className={`flex rounded-xl p-1 border ${
          isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
        }`}>
          {['english', 'math'].map(s => (
            <button
              key={s}
              onClick={() => { setSubject(s); onPhaseClick?.(null) }}
              className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                subject === s
                  ? 'bg-blue-600 text-white shadow-md'
                  : isDark ? 'text-slate-400 hover:text-white/80' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-1">
          {PHASE_ORDER.map((p, i) => (
            <div key={p} className="flex items-center">
              {i > 0 && <span className={`mx-1 text-xs ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>›</span>}
              <button
                onClick={() => onPhaseClick?.(p)}
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                  p === phase
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(phase)
                      ? isDark ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'
                      : isDark ? 'text-slate-600 hover:text-slate-400 hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                {PHASE_LABELS[p]}
              </button>
            </div>
          ))}
          <button
            onClick={() => onPhaseClick?.('history')}
            className={`ml-2 p-1.5 rounded-lg transition-colors cursor-pointer ${
              phase === 'history'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Session History"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onModeLauncher}
          className={`p-2 rounded-xl border cursor-pointer ${
            isDark ? 'bg-white/5 border-white/10 text-blue-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-blue-600 hover:bg-slate-200'
          }`}
          title="Open Views"
        >
          <Monitor className="w-4 h-4" />
        </button>
        <button
          onClick={onDiagnostics}
          className={`p-2 rounded-xl border cursor-pointer ${
            isDark ? 'bg-white/5 border-white/10 text-emerald-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-emerald-600 hover:bg-slate-200'
          }`}
          title="App Health Audit"
        >
          <Activity className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          className={`p-2 rounded-xl border cursor-pointer ${
            isDark ? 'bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={onLogout}
          className={`flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-xl border cursor-pointer ${
            isDark ? 'text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 border-rose-500/10' : 'text-rose-600 hover:bg-rose-50 border-rose-200'
          }`}
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit
        </button>
      </div>
    </header>
  )
}
