import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, ArrowRight, Table, Trophy } from 'lucide-react'
import { supabase, SUBJECTS } from '../supabaseClient'
import { getVocabForLevel } from '../../data/vocabulary'
import { fmt } from './shared'
import AwardConfigModal, { AwardConfigButton, loadTiers } from './AwardConfig'
import { mathGradeLabel } from '../mathGradeLabels'

const mathQuestionCountCache = {}

function getEnglishTotal(level) {
  return getVocabForLevel(level).length
}

export default function ResultsPhase({ state, sessions, subject, isDark, updateState, loadSessions, onSwitchSubject, onShowPodium, readOnly }) {
  const [levelFilter, setLevelFilter] = useState(null)
  const maxTime = (state.duration_seconds || 300) + (state.extra_seconds || 0)
  const [excelExporting, setExcelExporting] = useState(false)
  const [csvExporting, setCsvExporting] = useState(false)
  const [mathCounts, setMathCounts] = useState(mathQuestionCountCache)
  const [otherSubjectDone, setOtherSubjectDone] = useState(false)
  const [awardTiers, setAwardTiers] = useState(loadTiers)
  const [showAwardConfig, setShowAwardConfig] = useState(false)

  const otherSubject = subject === SUBJECTS.ENGLISH ? SUBJECTS.MATH : SUBJECTS.ENGLISH

  useEffect(() => {
    if (!state) return
    supabase
      .from('competition_sessions')
      .select('status', { count: 'exact', head: true })
      .eq('competition_id', state.competition_id)
      .eq('subject', otherSubject)
      .neq('status', 'completed')
      .then(({ count }) => {
        supabase
          .from('competition_sessions')
          .select('status', { count: 'exact', head: true })
          .eq('competition_id', state.competition_id)
          .eq('subject', otherSubject)
          .then(({ count: total }) => {
            setOtherSubjectDone(total > 0 && count === 0)
          })
      })
  }, [state?.competition_id, otherSubject])

  useEffect(() => {
    if (subject !== 'math' || Object.keys(mathQuestionCountCache).length > 0) return
    import('../../data/mathQuestionBank').then(({ getExamQuestions }) => {
      for (let l = 1; l <= 8; l++) {
        try { mathQuestionCountCache[l] = getExamQuestions(l).length } catch {}
      }
      setMathCounts({ ...mathQuestionCountCache })
    }).catch(() => {})
  }, [subject])

  function getTotalQuestions(level) {
    if (subject === 'math') return mathCounts[level] || 20
    return getEnglishTotal(level)
  }

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

  const otherLabel = otherSubject === 'math' ? 'Mathematics' : 'English Spelling'

  async function exportExcelResults() {
    if (excelExporting || !state) return
    setExcelExporting(true)
    try {
      const { exportFromTemplate } = await import('./exportResults')
      await exportFromTemplate(subject, state.competition_id, awardTiers, new Date().toISOString())
    } catch (err) {
      console.error('Excel export failed:', err)
    } finally {
      setExcelExporting(false)
    }
  }

  async function exportCSVResults() {
    if (csvExporting || !state) return
    setCsvExporting(true)
    try {
      const { exportCSVForCanva } = await import('./exportResults')
      await exportCSVForCanva(subject, state.competition_id, awardTiers, new Date().toISOString())
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setCsvExporting(false)
    }
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
              {subject === 'math' ? mathGradeLabel(lvl) : `L${lvl}`}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <AwardConfigButton onClick={() => setShowAwardConfig(true)} isDark={isDark} />
          <button
            onClick={exportExcelResults}
            disabled={excelExporting}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Table className="w-4 h-4" />
            {excelExporting ? 'Exporting...' : 'Excel'}
          </button>
          <button
            onClick={exportCSVResults}
            disabled={csvExporting}
            className="px-5 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            {csvExporting ? 'Exporting...' : 'CSV (Canva)'}
          </button>
        </div>
      </div>

      {showAwardConfig && (
        <AwardConfigModal tiers={awardTiers} onChange={setAwardTiers} isDark={isDark} onClose={() => setShowAwardConfig(false)} />
      )}

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
              <th className="px-4 py-4 text-center">{subject === 'math' ? 'Grade' : 'Level'}</th>
              <th className="px-4 py-4 text-right">Score</th>
              <th className="px-6 py-4 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y font-semibold text-sm transition-colors divide-white/5">
            {officialSorted.map((s, i) => (
              <tr
                key={s.participant_id}
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
                    {subject === 'math' ? mathGradeLabel(s.level) : `L${s.level}`}
                  </span>
                </td>
                <td className={`px-4 py-4 text-right font-black text-base ${text}`}>
                  {s.validated_score}
                  <span className={`text-xs font-semibold ml-1 ${textMuted}`}>/ {s.questions_answered || getTotalQuestions(s.level)}</span>
                </td>
                <td className={`px-6 py-4 text-right font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmt(Math.min(s.time_spent_seconds || 0, maxTime))}</td>
              </tr>
            ))}
            {!officialSorted.length && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-bold">
                  No sessions validated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-col items-center gap-4 pt-4 print:hidden">
          {onShowPodium && participantCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onShowPodium}
              className="w-full max-w-md px-8 py-4 rounded-xl font-black text-base uppercase tracking-wider text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              Show Podium
            </motion.button>
          )}

          {onSwitchSubject && !otherSubjectDone && participantCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onSwitchSubject(otherSubject)}
              className="w-full max-w-md px-8 py-4 rounded-xl font-black text-base uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              Proceed to {otherLabel}
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          )}

        </div>
      )}

      <div className="hidden print:block bg-white text-black">
        {[...new Set(officialSorted.map(s => s.level))].sort((a, b) => a - b).map(lvl => {
          const lvlResults = officialSorted.filter(s => s.level === lvl)
          return (
            <div key={lvl} className="break-before-page first:break-before-auto p-8">
              <h1 className="text-2xl font-bold mb-1">Official Results — {subject.toUpperCase()} — {subject === 'math' ? mathGradeLabel(lvl) : `Level ${lvl}`}</h1>
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
                    <tr key={s.participant_id} className="border-b border-gray-300">
                      <td className="px-3 py-2 font-bold">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold">{s.name}</td>
                      <td className="px-3 py-2 text-center font-mono text-gray-500">{s.display_id}</td>
                      <td className="px-3 py-2 text-gray-600">{s.school || '-'}</td>
                      <td className="px-3 py-2 text-right font-bold">{s.validated_score} / {s.questions_answered || getTotalQuestions(s.level)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt(Math.min(s.time_spent_seconds || 0, maxTime))}</td>
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
