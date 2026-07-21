import { useState } from 'react'
import { Settings, Trophy, Medal, Award, X } from 'lucide-react'

const STORAGE_KEY = 'wonderkids_award_tiers'

const TIERS = [
  { key: 'trophy', label: 'Trophy', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  { key: 'gold', label: 'Gold Medal', icon: Medal, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { key: 'silver', label: 'Silver Medal', icon: Medal, color: 'text-slate-300', bg: 'bg-slate-400/10 border-slate-400/20' },
  { key: 'bronze', label: 'Bronze Medal', icon: Medal, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
]

export const DEFAULT_TIERS = { trophy: 3, gold: 3, silver: 3, bronze: 3 }

export function loadTiers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULT_TIERS, ...JSON.parse(saved) }
  } catch {}
  return { ...DEFAULT_TIERS }
}

export function saveTiers(tiers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers))
}

export function AwardConfigButton({ onClick, isDark }) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-xl border transition-all cursor-pointer shadow-md ${
        isDark
          ? 'bg-white/5 border-white/10 text-amber-400 hover:bg-white/10'
          : 'bg-slate-100 border-slate-200 text-amber-600 hover:bg-slate-200'
      }`}
      title="Award Tiers"
    >
      <Settings className="w-4 h-4" />
    </button>
  )
}

export default function AwardConfigModal({ tiers, onChange, isDark, onClose }) {
  function set(key, val) {
    const n = Math.max(0, Math.min(99, parseInt(val) || 0))
    const next = { ...tiers, [key]: n }
    onChange(next)
    saveTiers(next)
  }

  let cumulative = 0
  const ranges = TIERS.map(t => {
    const start = cumulative + 1
    const end = cumulative + tiers[t.key]
    cumulative = end
    return { ...t, start, end, count: tiers[t.key] }
  })

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 ${
        isDark ? 'bg-[#111827] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black">Award Tiers</h2>
              <p className={`text-xs font-semibold ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
                Set how many students get each award
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
          {ranges.map(r => {
            const Icon = r.icon
            return (
              <div key={r.key} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${r.bg}`}>
                <Icon className={`w-5 h-5 shrink-0 ${r.color}`} />
                <span className={`text-sm font-bold flex-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.label}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => set(r.key, r.count - 1)}
                    className={`w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center cursor-pointer transition-colors ${
                      isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >−</button>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={r.count}
                    onChange={e => set(r.key, e.target.value)}
                    className={`w-14 text-center text-lg font-black rounded-xl border py-1.5 ${
                      isDark ? 'bg-white/10 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    onClick={() => set(r.key, r.count + 1)}
                    className={`w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center cursor-pointer transition-colors ${
                      isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >+</button>
                </div>
                <span className={`text-xs font-mono w-12 text-right ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                  {r.count > 0 ? `#${r.start}–${r.end}` : 'off'}
                </span>
              </div>
            )
          })}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <Award className={`w-5 h-5 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <span className={`text-sm font-bold flex-1 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>Certificate</span>
            <span className={`text-xs font-mono ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
              #{cumulative + 1}+
            </span>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
