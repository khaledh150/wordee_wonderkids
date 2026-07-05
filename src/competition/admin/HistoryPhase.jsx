import { useState, useEffect } from 'react'
import { ArrowLeft, Calendar, Users } from 'lucide-react'
import { supabase } from '../supabaseClient'
import ResultsPhase from './ResultsPhase'

export default function HistoryPhase({ isDark, onBack }) {
  const [history, setHistory] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detailSubject, setDetailSubject] = useState('english')
  const [detailSessions, setDetailSessions] = useState([])
  const [detailState, setDetailState] = useState(null)

  const card = isDark ? 'bg-[#0e1224]/50 border-white/10' : 'bg-white border-slate-200'
  const text = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-white/50' : 'text-slate-400'

  useEffect(() => {
    supabase
      .from('competition_history')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return setHistory([])
        Promise.all(data.map(async h => {
          const { count } = await supabase
            .from('competition_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', h.competition_id)
          return { ...h, participantCount: count || 0 }
        })).then(setHistory)
      })
  }, [])

  useEffect(() => {
    if (!selected) return
    supabase
      .from('competition_sessions')
      .select('*')
      .eq('competition_id', selected.competition_id)
      .eq('subject', detailSubject)
      .then(({ data }) => setDetailSessions(data || []))
    setDetailState({
      competition_id: selected.competition_id,
      round_label: selected.round_label,
    })
  }, [selected, detailSubject])

  if (!history) {
    return (
      <div className="flex justify-center py-12">
        <div className={`animate-spin w-8 h-8 border-4 border-t-transparent rounded-full ${isDark ? 'border-blue-500' : 'border-blue-600'}`} />
      </div>
    )
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setSelected(null); setDetailSessions([]) }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer ${
              isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Back to History
          </button>
          <div className={`flex rounded-xl p-1 border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            {['english', 'math'].map(s => (
              <button
                key={s}
                onClick={() => setDetailSubject(s)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  detailSubject === s
                    ? 'bg-blue-600 text-white shadow-md'
                    : isDark ? 'text-slate-400 hover:text-white/80' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <span className={`text-sm font-bold ${textMuted}`}>
            {selected.round_label || selected.competition_id}
          </span>
        </div>
        <ResultsPhase
          state={detailState}
          sessions={detailSessions}
          subject={detailSubject}
          isDark={isDark}
          readOnly
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer ${
            isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h2 className={`text-xl font-black ${text}`}>Session History</h2>
      </div>

      {history.length === 0 ? (
        <p className={`text-center py-12 font-bold ${textMuted}`}>No sessions recorded yet.</p>
      ) : (
        <div className="grid gap-3">
          {history.map(h => (
            <button
              key={h.competition_id}
              onClick={() => { setSelected(h); setDetailSubject('english') }}
              className={`w-full text-left border rounded-2xl p-5 transition-all cursor-pointer ${card} hover:shadow-lg ${
                isDark ? 'hover:border-blue-500/30' : 'hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-black text-base ${text}`}>
                    {h.round_label || 'Untitled Session'}
                  </p>
                  <p className={`text-xs font-mono mt-1 ${textMuted}`}>{h.competition_id}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-1.5 text-sm font-bold ${textMuted}`}>
                    <Users className="w-4 h-4" />
                    {h.participantCount}
                  </div>
                  <div className={`flex items-center gap-1.5 text-sm font-bold ${textMuted}`}>
                    <Calendar className="w-4 h-4" />
                    {new Date(h.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
