import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { getVocabForLevel } from '../../data/vocabulary'
import { fmt } from './shared'

export default function ResultsPhase({ state, sessions, subject, isDark, updateState, loadSessions }) {
  const [levelFilter, setLevelFilter] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)

  const card = isDark ? 'bg-[#0e1224]/50 border-white/10' : 'bg-white border-slate-200'
  const text = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-white/50' : 'text-slate-400'

  const officialSorted = useMemo(() => {
    let list = sessions.filter(s => s.validated_score != null)
    if (levelFilter) list = list.filter(s => s.level === levelFilter)
    return list.sort((a, b) => b.validated_score - a.validated_score || a.time_spent_seconds - b.time_spent_seconds)
  }, [sessions, levelFilter])

  const levels = useMemo(() =>
    [...new Set(sessions.filter(s => s.validated_score != null).map(s => s.level))].sort((a, b) => a - b),
    [sessions]
  )

  const participantCount = sessions.filter(s => s.validated_score != null).length
  const avgScore = participantCount > 0
    ? (sessions.filter(s => s.validated_score != null).reduce((sum, s) => sum + s.validated_score, 0) / participantCount).toFixed(1)
    : '0.0'
  const topScore = participantCount > 0
    ? Math.max(...sessions.filter(s => s.validated_score != null).map(s => s.validated_score))
    : 0

  function exportCSV() {
    const h = ['Rank', 'Name', 'Display ID', 'School', 'Country', 'Level', 'Score', 'Time (s)']
    const r = officialSorted.map((s, i) => [i + 1, s.name, s.display_id, s.school || '', s.country || '', s.level, s.validated_score, s.time_spent_seconds])
    const csv = [h, ...r].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `results-${subject}.csv`
    a.click()
  }

  async function handleBatchDownload() {
    if (!officialSorted.length || batchProgress) return
    const { downloadBatchCertificates } = await import('../generateCertificate')
    const students = officialSorted.map((s, i) => ({ ...s, rank: i + 1, totalQuestions: getVocabForLevel(s.level).length }))
    setBatchProgress({ done: 0, total: students.length })
    await downloadBatchCertificates(students, state.round_label || 'International English Spelling & Math Championship', state.competition_id, (done, total) => setBatchProgress({ done, total }))
    setBatchProgress(null)
  }

  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    await supabase.from('competition_sessions').update({
      status: 'waiting',
      provisional_score: 0,
      validated_score: null,
      questions_answered: 0,
      time_spent_seconds: 0,
      ready: false,
      answers_snapshot: null,
      started_at: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    }).eq('competition_id', state.competition_id).eq('subject', subject)
    await updateState({ is_unlocked: false, extra_seconds: 0 })
    setConfirmReset(false)
    await loadSessions()
  }

  const summaryCards = [
    { label: 'Total Participants', value: participantCount, border: isDark ? 'border-slate-600' : 'border-slate-300' },
    { label: 'Average Score', value: avgScore, border: isDark ? 'border-purple-500/40' : 'border-purple-300' },
    { label: 'Top Score', value: topScore, border: isDark ? 'border-amber-500/40' : 'border-amber-300' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 print:hidden">
        {summaryCards.map(c => (
          <div key={c.label} className={`rounded-2xl border-2 p-5 text-center ${card} ${c.border}`}>
            <p className={`text-3xl font-black ${text}`}>{c.value}</p>
            <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${textMuted}`}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setLevelFilter(null)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              !levelFilter
                ? 'bg-blue-600 text-white shadow-md'
                : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {levels.map(lvl => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                levelFilter === lvl
                  ? 'bg-blue-600 text-white shadow-md'
                  : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              L{lvl}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className={`px-5 py-3 border font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
            }`}
          >
            Print Report
          </button>
          <button
            onClick={handleBatchDownload}
            disabled={batchProgress != null || !officialSorted.length}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            {batchProgress ? `Compiling ${batchProgress.done}/${batchProgress.total}...` : 'Download All Certificates'}
          </button>
        </div>
      </div>

      <div className={`border rounded-3xl overflow-hidden shadow-lg print:hidden transition-all duration-300 ${
        isDark ? 'bg-[#0e1224]/20 border-white/5' : 'bg-white border-slate-200'
      }`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`text-[10px] font-black uppercase tracking-widest border-b transition-colors ${
              isDark ? 'text-slate-400 bg-slate-950/20 border-white/5' : 'text-slate-500 bg-slate-100/80 border-slate-200'
            }`}>
              <th className="px-6 py-4">Rank</th>
              <th className="px-4 py-4">Name</th>
              <th className="px-4 py-4">School</th>
              <th className="px-4 py-4 text-center">Level</th>
              <th className="px-4 py-4 text-right">Score</th>
              <th className="px-4 py-4 text-right">Time</th>
              <th className="px-6 py-4 text-center">Certificate</th>
            </tr>
          </thead>
          <tbody className="divide-y font-semibold text-sm transition-colors divide-white/5">
            {officialSorted.map((s, i) => (
              <tr
                key={s.id}
                className={`transition-colors border-b ${
                  isDark ? 'border-white/5' : 'border-slate-100'
                } ${
                  i === 0
                    ? 'bg-amber-500/5 hover:bg-amber-500/10'
                    : i === 1
                      ? 'bg-slate-400/5 hover:bg-slate-400/10'
                      : i === 2
                        ? 'bg-amber-700/5 hover:bg-amber-700/10'
                        : isDark ? 'hover:bg-white/[0.01]' : 'hover:bg-slate-50/50'
                }`}
              >
                <td className="px-6 py-4 font-black text-base">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className={`px-4 py-4 font-bold ${text}`}>{s.name}</td>
                <td className={`px-4 py-4 text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.school || '-'}</td>
                <td className="px-4 py-4 text-center text-xs font-black">
                  <span className={`px-2 py-0.5 rounded border ${
                    isDark ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    L{s.level}
                  </span>
                </td>
                <td className={`px-4 py-4 text-right font-black text-base ${text}`}>{s.validated_score}</td>
                <td className={`px-4 py-4 text-right font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmt(s.time_spent_seconds)}</td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={async () => {
                      const { downloadCertificate } = await import('../generateCertificate')
                      await downloadCertificate({
                        name: s.name,
                        rank: i + 1,
                        score: s.validated_score,
                        totalQuestions: getVocabForLevel(s.level).length,
                        level: s.level,
                        school: s.school,
                        country: s.country,
                        eventName: state.round_label || 'International English Spelling & Math Championship',
                        competitionId: state.competition_id,
                      })
                    }}
                    className={`text-xs font-black uppercase px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isDark
                        ? 'text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border-indigo-500/20'
                        : 'text-indigo-600 hover:text-white hover:bg-indigo-500 bg-indigo-50 border-indigo-200 hover:border-indigo-500 shadow-sm'
                    }`}
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {!officialSorted.length && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-bold">
                  No sessions validated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center gap-2 pt-4 print:hidden">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleReset}
            className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all cursor-pointer ${
              confirmReset ? 'bg-red-600 animate-pulse' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {confirmReset ? 'TAP TO CONFIRM RESET' : 'New Round'}
          </motion.button>
          {confirmReset && (
            <button
              onClick={() => setConfirmReset(false)}
              className={`text-xs font-bold underline cursor-pointer ${textMuted} hover:${text}`}
            >
              Cancel
            </button>
          )}
        </div>
        <p className={`text-xs ${textMuted}`}>
          This resets all sessions back to waiting. Scores are cleared.
        </p>
      </div>

      <div className="hidden print:block bg-white text-black">
        {[...new Set(officialSorted.map(s => s.level))].sort((a, b) => a - b).map(lvl => {
          const lvlResults = officialSorted.filter(s => s.level === lvl)
          return (
            <div key={lvl} className="break-before-page first:break-before-auto p-8">
              <h1 className="text-2xl font-bold mb-1">Official Results — {subject.toUpperCase()} — Level {lvl}</h1>
              <p className="text-sm text-gray-500 mb-4">{state.competition_id} {state.round_label ? `— ${state.round_label}` : ''}</p>
              <table className="w-full text-base border-collapse">
                <thead>
                  <tr className="border-b-2 border-black text-sm uppercase font-bold">
                    <th className="px-3 py-2 text-left">Rank</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-center">Display ID</th>
                    <th className="px-3 py-2 text-left">School</th>
                    <th className="px-3 py-2 text-right">Score</th>
                    <th className="px-3 py-2 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {lvlResults.map((s, i) => (
                    <tr key={s.id} className="border-b border-gray-300">
                      <td className="px-3 py-2 font-bold">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold">{s.name}</td>
                      <td className="px-3 py-2 text-center font-mono text-gray-500">{s.display_id}</td>
                      <td className="px-3 py-2 text-gray-600">{s.school || '-'}</td>
                      <td className="px-3 py-2 text-right font-bold">{s.validated_score}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt(s.time_spent_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
