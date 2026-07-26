import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Calendar, Users, BookOpen, Calculator, Clock, FileText, Table } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { getVocabForLevel } from '../../data/vocabulary'
import AwardConfigModal, { AwardConfigButton, loadTiers } from './AwardConfig'
import { mathGradeLabel } from '../mathGradeLabels'

const mathQuestionCountCache = {}

function fmt(sec) {
  if (sec == null) return '-'
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

function getEnglishTotal(level) {
  return getVocabForLevel(level).length
}

export default function HistoryPhase({ isDark, onBack }) {
  const [history, setHistory] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detailSubject, setDetailSubject] = useState('english')
  const [detailSessions, setDetailSessions] = useState([])
  const [levelFilter, setLevelFilter] = useState(null)
  const [mathCounts, setMathCounts] = useState(mathQuestionCountCache)
  const [excelExporting, setExcelExporting] = useState(false)
  const [csvExporting, setCsvExporting] = useState(false)
  const [awardTiers, setAwardTiers] = useState(loadTiers)
  const [showAwardConfig, setShowAwardConfig] = useState(false)

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
          const { data: sessions } = await supabase
            .from('competition_sessions')
            .select('subject, status, validated_score')
            .eq('competition_id', h.competition_id)
          const all = sessions || []
          const engSessions = all.filter(s => s.subject === 'english')
          const mathSessions = all.filter(s => s.subject === 'math')
          return {
            ...h,
            totalCount: all.length,
            engCount: engSessions.length,
            mathCount: mathSessions.length,
            engPlayed: engSessions.filter(s => s.status === 'completed').length,
            mathPlayed: mathSessions.filter(s => s.status === 'completed').length,
            hasEnglish: engSessions.length > 0,
            hasMath: mathSessions.length > 0,
          }
        })).then(results => setHistory(results.filter(h => h.totalCount > 0)))
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
  }, [selected, detailSubject])

  useEffect(() => {
    if (Object.keys(mathQuestionCountCache).length > 0) return
    import('../../data/mathQuestionBank').then(({ getExamQuestions }) => {
      for (let l = 1; l <= 8; l++) {
        try { mathQuestionCountCache[l] = getExamQuestions(l).length } catch {}
      }
      setMathCounts({ ...mathQuestionCountCache })
    }).catch(() => {})
  }, [])

  function getTotalQuestions(level) {
    if (detailSubject === 'math') return mathCounts[level] || 20
    return getEnglishTotal(level)
  }

  const officialSorted = useMemo(() => {
    let list = detailSessions.filter(s => s.validated_score != null)
    if (levelFilter) list = list.filter(s => s.level === levelFilter)
    return list.sort((a, b) => b.validated_score - a.validated_score || a.time_spent_seconds - b.time_spent_seconds)
  }, [detailSessions, levelFilter])

  const levels = useMemo(() =>
    [...new Set(detailSessions.filter(s => s.validated_score != null).map(s => s.level))].sort((a, b) => a - b),
    [detailSessions]
  )

  const participantCount = detailSessions.filter(s => s.validated_score != null).length
  const avgScore = participantCount > 0
    ? (detailSessions.filter(s => s.validated_score != null).reduce((sum, s) => sum + s.validated_score, 0) / participantCount).toFixed(1)
    : '0.0'
  const topScore = participantCount > 0
    ? Math.max(...detailSessions.filter(s => s.validated_score != null).map(s => s.validated_score))
    : 0

  const subjectLabel = detailSubject === 'math' ? 'Mathematics' : 'English Spelling'

  async function exportExcelResults() {
    if (excelExporting || !selected) return
    setExcelExporting(true)
    try {
      const { exportFromTemplate } = await import('./exportResults')
      await exportFromTemplate(detailSubject, selected.competition_id, awardTiers)
    } catch (err) {
      console.error('Excel export failed:', err)
    } finally {
      setExcelExporting(false)
    }
  }

  async function exportCSVResults() {
    if (csvExporting || !selected) return
    setCsvExporting(true)
    try {
      const { exportCSVForCanva } = await import('./exportResults')
      await exportCSVForCanva(detailSubject, selected.competition_id, awardTiers)
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setCsvExporting(false)
    }
  }


  // --- Loading state ---
  if (!history) {
    return (
      <div className="flex justify-center py-12">
        <div className={`animate-spin w-8 h-8 border-4 border-t-transparent rounded-full ${isDark ? 'border-blue-500' : 'border-blue-600'}`} />
      </div>
    )
  }

  // --- Detail view: scores for a selected session ---
  if (selected) {
    const sessionName = selected.round_label || formatSessionName(selected)
    const sessionDate = new Date(selected.created_at)

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => { setSelected(null); setDetailSessions([]); setLevelFilter(null) }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer ${
              isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {/* Session info banner */}
        <div className={`rounded-2xl border p-4 ${card}`}>
          <p className={`font-black text-lg ${text}`}>{sessionName}</p>
          <p className={`text-xs mt-1 ${textMuted}`}>
            {sessionDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            {' at '}
            {sessionDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            <span className="mx-2">·</span>
            <span className="font-mono">{selected.competition_id.slice(0, 8)}</span>
          </p>
        </div>

        {/* Subject tabs - large and clear */}
        <div className={`flex rounded-xl p-1 border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
          {[
            { key: 'english', label: 'English Spelling', icon: BookOpen, color: 'bg-blue-600', available: selected.hasEnglish },
            { key: 'math', label: 'Mathematics', icon: Calculator, color: 'bg-teal-600', available: selected.hasMath },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => { setDetailSubject(s.key); setLevelFilter(null) }}
              disabled={!s.available}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                detailSubject === s.key
                  ? `${s.color} text-white shadow-md`
                  : isDark ? 'text-slate-400 hover:text-white/80' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
              {s.available && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  detailSubject === s.key ? 'bg-white/20' : isDark ? 'bg-white/10' : 'bg-slate-200'
                }`}>
                  {s.key === 'english' ? selected.engPlayed : selected.mathPlayed}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Participants', value: participantCount, border: isDark ? 'border-slate-600' : 'border-slate-300' },
            { label: 'Average Score', value: avgScore, border: isDark ? 'border-purple-500/40' : 'border-purple-300' },
            { label: 'Top Score', value: topScore, border: isDark ? 'border-amber-500/40' : 'border-amber-300' },
          ].map(c => (
            <div key={c.label} className={`rounded-2xl border-2 p-4 text-center ${card} ${c.border}`}>
              <p className={`text-2xl font-black ${text}`}>{c.value}</p>
              <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${textMuted}`}>{c.label}</p>
            </div>
          ))}
        </div>

        {/* Level filter + export buttons */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
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
                {detailSubject === 'math' ? mathGradeLabel(lvl) : `L${lvl}`}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <AwardConfigButton onClick={() => setShowAwardConfig(true)} isDark={isDark} />
            <button
              onClick={exportExcelResults}
              disabled={excelExporting}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <Table className="w-4 h-4" />
              {excelExporting ? 'Exporting...' : 'Excel'}
            </button>
            <button
              onClick={exportCSVResults}
              disabled={csvExporting}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              {csvExporting ? 'Exporting...' : 'CSV (Canva)'}
            </button>
          </div>
        </div>

        {showAwardConfig && (
          <AwardConfigModal tiers={awardTiers} onChange={setAwardTiers} isDark={isDark} onClose={() => setShowAwardConfig(false)} />
        )}

        {/* Score table */}
        <div className={`border rounded-3xl overflow-hidden shadow-lg transition-all duration-300 ${
          isDark ? 'bg-[#0e1224]/20 border-white/5' : 'bg-white border-slate-200'
        }`}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`text-[10px] font-black uppercase tracking-widest border-b transition-colors ${
                isDark ? 'text-slate-400 bg-slate-950/20 border-white/5' : 'text-slate-500 bg-slate-100/80 border-slate-200'
              }`}>
                <th className="px-5 py-4">Rank</th>
                <th className="px-4 py-4">Name</th>
                <th className="px-4 py-4">School</th>
                <th className="px-4 py-4 text-center">{detailSubject === 'math' ? 'Grade' : 'Level'}</th>
                <th className="px-4 py-4 text-right">Score</th>
                <th className="px-4 py-4 text-right">Time</th>
                <th className="px-5 py-4 text-center">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y font-semibold text-sm transition-colors divide-white/5">
              {officialSorted.map((s, i) => (
                <tr
                  key={s.participant_id}
                  className={`transition-colors border-b ${
                    isDark ? 'border-white/5' : 'border-slate-100'
                  } ${
                    i === 0 ? 'bg-amber-500/5 hover:bg-amber-500/10'
                      : i === 1 ? 'bg-slate-400/5 hover:bg-slate-400/10'
                      : i === 2 ? 'bg-amber-700/5 hover:bg-amber-700/10'
                      : isDark ? 'hover:bg-white/[0.01]' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <td className="px-5 py-4 font-black text-base">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className={`px-4 py-4 font-bold ${text}`}>{s.name}</td>
                  <td className={`px-4 py-4 text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.school || '-'}</td>
                  <td className="px-4 py-4 text-center text-xs font-black">
                    <span className={`px-2 py-0.5 rounded border ${
                      isDark ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {detailSubject === 'math' ? mathGradeLabel(s.level) : `L${s.level}`}
                    </span>
                  </td>
                  <td className={`px-4 py-4 text-right font-black text-base ${text}`}>
                    {s.validated_score}
                    <span className={`text-xs font-semibold ml-1 ${textMuted}`}>/ {getTotalQuestions(s.level)}</span>
                  </td>
                  <td className={`px-4 py-4 text-right font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {fmt(s.time_spent_seconds)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={async () => {
                        const { downloadCertificate } = await import('../generateCertificate')
                        await downloadCertificate({
                          name: s.name,
                          rank: i + 1,
                          score: s.validated_score,
                          totalQuestions: getTotalQuestions(s.level),
                          level: s.level,
                          school: s.school,
                          country: s.country,
                          eventName: selected.round_label || 'International English Spelling & Math Championship',
                          competitionId: selected.competition_id,
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
                  <td colSpan={7} className={`px-6 py-12 text-center font-bold ${textMuted}`}>
                    No {subjectLabel} results for this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Print view */}
        <div className="hidden print:block bg-white text-black">
          {[...new Set(officialSorted.map(s => s.level))].sort((a, b) => a - b).map(lvl => {
            const lvlResults = officialSorted.filter(s => s.level === lvl)
            return (
              <div key={lvl} className="break-before-page first:break-before-auto p-8">
                <h1 className="text-2xl font-bold mb-1">Session History — {subjectLabel} — {detailSubject === 'math' ? mathGradeLabel(lvl) : `Level ${lvl}`}</h1>
                <p className="text-sm text-gray-500 mb-4">
                  {sessionDate.toLocaleDateString()} · Session {selected.competition_id?.slice(5, 13)?.toUpperCase()} {selected.round_label ? `— ${selected.round_label}` : ''}
                </p>
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
                        <td className="px-3 py-2 text-right font-bold">{s.validated_score} / {getTotalQuestions(s.level)}</td>
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

  // --- Session list view ---
  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className={`rounded-2xl p-5 border ${
        isDark
          ? 'bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border-indigo-500/20'
          : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer border ${
                isDark
                  ? 'text-slate-300 bg-white/10 border-white/10 hover:bg-white/15 hover:border-white/20'
                  : 'text-indigo-700 bg-white/80 border-indigo-200 hover:bg-white hover:border-indigo-300 shadow-sm'
              }`}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <h2 className={`text-xl font-black ${text}`}>Session History</h2>
              <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-indigo-300/60' : 'text-indigo-500/70'}`}>
                {history.length} {history.length === 1 ? 'session' : 'sessions'} recorded
              </p>
            </div>
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-indigo-500/15' : 'bg-indigo-100'}`}>
            <FileText className={`w-6 h-6 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
          </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${card}`}>
          <FileText className={`w-12 h-12 mx-auto mb-3 ${textMuted}`} />
          <p className={`font-bold text-lg ${textMuted}`}>No sessions recorded yet</p>
          <p className={`text-sm mt-1 ${textMuted}`}>Completed competitions will appear here</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {history.map(h => {
            const subjects = []
            if (h.hasEnglish) subjects.push('English')
            if (h.hasMath) subjects.push('Math')
            const subjectName = subjects.join(' + ') || 'No subjects'
            const totalPlayed = (h.engPlayed || 0) + (h.mathPlayed || 0)

            return (
              <button
                key={h.competition_id}
                onClick={() => { setSelected(h); setDetailSubject(h.hasEnglish ? 'english' : 'math') }}
                className={`w-full text-left border-2 rounded-2xl p-5 transition-all cursor-pointer group ${
                  isDark
                    ? 'bg-[#0e1224]/50 border-white/10 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`font-black text-lg group-hover:text-indigo-500 transition-colors ${text}`}>
                      {h.round_label || subjectName + ' Competition'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5 mt-3">
                      {h.hasEnglish && (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                          isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}>
                          <BookOpen className="w-3.5 h-3.5" />
                          English ({h.engCount})
                        </span>
                      )}
                      {h.hasMath && (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                          isDark ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 'bg-teal-50 border-teal-200 text-teal-700'
                        }`}>
                          <Calculator className="w-3.5 h-3.5" />
                          Math ({h.mathCount})
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] font-mono mt-2.5 ${textMuted}`}>{h.competition_id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className={`flex items-center gap-1.5 text-base font-black px-3 py-1 rounded-lg ${
                      isDark ? 'bg-white/5 text-white' : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      <Users className="w-4 h-4" />
                      {h.totalCount}
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${textMuted}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(h.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${textMuted}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(h.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatSessionName(h) {
  const subjects = []
  if (h.hasEnglish) subjects.push('English')
  if (h.hasMath) subjects.push('Math')
  return (subjects.join(' + ') || 'Session') + ' Competition'
}
