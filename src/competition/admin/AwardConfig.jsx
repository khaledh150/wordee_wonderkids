import { useState } from 'react'
import { Settings, Trophy, Medal, Award, X, Minus, Plus } from 'lucide-react'

const STORAGE_KEY = 'wonderkids_award_tiers'

const TIERS = [
  { key: 'trophy', label: 'Trophy', icon: Trophy, color: 'text-amber-400', ring: 'ring-amber-500/30', iconBg: 'bg-amber-500/15' },
  { key: 'gold', label: 'Gold Medal', icon: Medal, color: 'text-yellow-400', ring: 'ring-yellow-500/30', iconBg: 'bg-yellow-500/15' },
  { key: 'silver', label: 'Silver Medal', icon: Medal, color: 'text-slate-300', ring: 'ring-slate-400/30', iconBg: 'bg-slate-400/15' },
  { key: 'bronze', label: 'Bronze Medal', icon: Medal, color: 'text-orange-400', ring: 'ring-orange-500/30', iconBg: 'bg-orange-500/15' },
]

export const DEFAULT_TIERS = { trophy: 3, gold: 5, silver: 5, bronze: 5 }
export const LARGE_CLASS_TIERS = { trophy: 3, gold: 12, silver: 12, bronze: 13 }
export const LARGE_CLASS_THRESHOLD = 18

export function getTiersForCount(count, customTiers) {
  if (customTiers) return customTiers
  return count > LARGE_CLASS_THRESHOLD ? LARGE_CLASS_TIERS : DEFAULT_TIERS
}

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
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${
        isDark ? 'bg-[#0f1629] text-white' : 'bg-white text-slate-900'
      }`}>
        <div className={`px-5 pt-5 pb-4 flex items-center justify-between ${
          isDark ? 'border-b border-white/5' : 'border-b border-slate-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight">Award Tiers</h2>
              <p className={`text-[11px] font-medium ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                Students per award type
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
              isDark ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-100 text-slate-400'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2.5">
          {ranges.map(r => {
            const Icon = r.icon
            return (
              <div key={r.key} className={`flex items-center gap-3 h-12 ${
                isDark ? '' : ''
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.iconBg}`}>
                  <Icon className={`w-4 h-4 ${r.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-bold ${isDark ? 'text-white/90' : 'text-slate-700'}`}>{r.label}</span>
                  <span className={`text-[10px] font-mono ml-2 ${isDark ? 'text-white/25' : 'text-slate-300'}`}>
                    {r.count > 0 ? `#${r.start}–${r.end}` : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => set(r.key, r.count - 1)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                      isDark ? 'bg-white/5 hover:bg-white/15 text-white/60' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className={`w-8 text-center text-base font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {r.count}
                  </span>
                  <button
                    onClick={() => set(r.key, r.count + 1)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                      isDark ? 'bg-white/5 hover:bg-white/15 text-white/60' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}

          <div className={`flex items-center gap-3 h-12 pt-1 ${
            isDark ? 'border-t border-white/5' : 'border-t border-slate-100'
          }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-white/5' : 'bg-slate-100'
            }`}>
              <Award className={`w-4 h-4 ${isDark ? 'text-white/30' : 'text-slate-400'}`} />
            </div>
            <span className={`text-sm font-bold flex-1 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>Certificate Only</span>
            <span className={`text-[10px] font-mono ${isDark ? 'text-white/25' : 'text-slate-300'}`}>
              #{cumulative + 1}+
            </span>
          </div>
        </div>

        <div className={`px-5 py-3.5 flex justify-end ${
          isDark ? 'border-t border-white/5 bg-white/[0.02]' : 'border-t border-slate-100 bg-slate-50/50'
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
