import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText, ArrowRight, Table, Trophy } from 'lucide-react'
import { supabase, SUBJECTS } from '../supabaseClient'
import { getVocabForLevel } from '../../data/vocabulary'
import { fmt } from './shared'

const mathQuestionCountCache = {}

function getEnglishTotal(level) {
  return getVocabForLevel(level).length
}

export default function ResultsPhase({ state, sessions, subject, isDark, updateState, loadSessions, onSwitchSubject, onNewSession, onShowPodium, readOnly }) {
  const [levelFilter, setLevelFilter] = useState(null)
  const [confirmNew, setConfirmNew] = useState(null)
  const [batchProgress, setBatchProgress] = useState(null)
  const [excelExporting, setExcelExporting] = useState(false)
  const [mathCounts, setMathCounts] = useState(mathQuestionCountCache)
  const [otherSubjectDone, setOtherSubjectDone] = useState(false)

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

  function exportCSV() {
    const h = ['Rank', 'Name', 'Display ID', 'School', 'Country', 'Level', 'Score', 'Total', 'Time (s)']
    const r = officialSorted.map((s, i) => [
      i + 1, s.name, s.display_id, s.school || '', s.country || '', s.level,
      s.validated_score, getTotalQuestions(s.level), s.time_spent_seconds
    ])
    const csv = [h, ...r].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const bom = '﻿'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([bom + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `results-${subject}.csv`
    a.click()
  }

  async function exportExcelResults() {
    if (excelExporting || !state) return
    setExcelExporting(true)
    try {
      const ExcelJS = await import('exceljs')
      const { data: allSessions } = await supabase
        .from('competition_sessions')
        .select('*')
        .eq('competition_id', state.competition_id)
      if (!allSessions) { setExcelExporting(false); return }

      let mathTotals = { ...mathCounts }
      if (Object.keys(mathTotals).length === 0) {
        try {
          const { getExamQuestions } = await import('../../data/mathQuestionBank')
          for (let l = 1; l <= 8; l++) {
            try { mathTotals[l] = getExamQuestions(l).length } catch {}
          }
        } catch {}
      }

      const getTotal = (subj, lvl) => {
        if (subj === 'math') return mathTotals[lvl] || 20
        return getVocabForLevel(lvl).length
      }

      const NAVY = { argb: 'FF1B1464' }
      const WHITE_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      const THIN_BORDER = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      }
      const GOLD_BG = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
      const SILVER_BG = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }
      const BRONZE_BG = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8D0' } }
      const GREEN_BG = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }

      const allSubjectDefs = [
        { key: 'english', label: 'English Spelling', maxLevel: 4, color: { argb: 'FFCC0000' } },
        { key: 'math', label: 'Mathematics', maxLevel: 8, color: { argb: 'FF3333CC' } },
      ]
      const subjects = allSubjectDefs.filter(s => s.key === subject)

      const wb = new ExcelJS.Workbook()
      wb.creator = 'Wonderkids Championship'

      for (const subj of subjects) {
        for (let lvl = 1; lvl <= subj.maxLevel; lvl++) {
          const lvlSessions = allSessions
            .filter(s => s.subject === subj.key && s.level === lvl)
          if (lvlSessions.length === 0) continue

          const participated = lvlSessions
            .filter(s => s.validated_score != null)
            .sort((a, b) => b.validated_score - a.validated_score || a.time_spent_seconds - b.time_spent_seconds)
          const notParticipated = lvlSessions.filter(s => s.validated_score == null)
          const sorted = [...participated, ...notParticipated]

          const sheetName = `${subj.key === 'english' ? 'English' : 'Math'} L${lvl}`
          const ws = wb.addWorksheet(sheetName)

          ws.columns = [
            { width: 6 },   // A: No.
            { width: 30 },  // B: Name
            { width: 12 },  // C: Display ID
            { width: 20 },  // D: School
            { width: 10 },  // E: Country
            { width: 6 },   // F: Age
            { width: 8 },   // G: Score
            { width: 8 },   // H: Total
            { width: 10 },  // I: Time
          ]

          // Row 1: Title
          ws.mergeCells('A1:I1')
          const titleCell = ws.getCell('A1')
          titleCell.value = `${state.round_label || 'International Championship'} — ${subj.label} — Level ${lvl}`
          titleCell.font = { bold: true, size: 16 }
          titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
          ws.getRow(1).height = 38

          // Row 2: Competition ID + date
          ws.mergeCells('A2:I2')
          const infoCell = ws.getCell('A2')
          infoCell.value = `Session: ${state.competition_id} | Exported: ${new Date().toLocaleDateString()}`
          infoCell.font = { size: 9, color: { argb: 'FF888888' } }
          infoCell.alignment = { horizontal: 'center', vertical: 'middle' }
          ws.getRow(2).height = 20

          ws.views = [{ state: 'frozen', ySplit: 3 }]
          ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } }

          // Row 3: Column headers
          const headers = ['No.', 'Name', 'Display ID', 'School', 'Country', 'Age', 'Score', 'Total', 'Time']
          const headerRow = ws.getRow(3)
          headerRow.height = 26
          headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1)
            cell.value = h
            cell.font = HEADER_FONT
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: subj.color }
            cell.alignment = { horizontal: i >= 6 ? 'center' : 'left', vertical: 'middle' }
            cell.border = THIN_BORDER
          })

          // Data rows
          let rankCounter = 1
          sorted.forEach((s, i) => {
            const row = ws.getRow(i + 4)
            row.height = 22
            const hasScore = s.validated_score != null
            const rank = hasScore ? rankCounter++ : ''
            const totalQ = getTotal(subj.key, lvl)
            const timeFmt = hasScore && s.time_spent_seconds != null
              ? `${Math.floor(s.time_spent_seconds / 60)}:${String(s.time_spent_seconds % 60).padStart(2, '0')}`
              : ''

            const values = [
              rank,
              s.name || '',
              s.display_id || '',
              s.school || '',
              s.country ? s.country.toUpperCase() : '',
              s.age || '',
              hasScore ? s.validated_score : '',
              hasScore ? totalQ : '',
              timeFmt,
            ]

            values.forEach((v, ci) => {
              const cell = row.getCell(ci + 1)
              cell.value = v
              cell.border = THIN_BORDER
              cell.alignment = { horizontal: ci >= 6 ? 'center' : 'left', vertical: 'middle' }
              if (ci === 0) cell.font = { bold: true }
              if (ci === 1) cell.font = { bold: true }
            })

            // Highlight top 3
            if (hasScore && rank <= 3) {
              const bg = rank === 1 ? GOLD_BG : rank === 2 ? SILVER_BG : BRONZE_BG
              for (let c = 1; c <= 9; c++) row.getCell(c).fill = bg
            } else if (hasScore) {
              for (let c = 1; c <= 9; c++) row.getCell(c).fill = GREEN_BG
            }
          })

          // Summary row
          const sumRowIdx = sorted.length + 5
          ws.getRow(sumRowIdx).height = 24
          ws.mergeCells(`A${sumRowIdx}:F${sumRowIdx}`)
          const sumCell = ws.getCell(`A${sumRowIdx}`)
          sumCell.value = `Total Participants: ${participated.length} / ${sorted.length} registered`
          sumCell.font = { bold: true, size: 10, italic: true }
          sumCell.alignment = { horizontal: 'left', vertical: 'middle' }

          if (participated.length > 0) {
            const avg = (participated.reduce((sum, s) => sum + s.validated_score, 0) / participated.length).toFixed(1)
            const avgCell = ws.getCell(`G${sumRowIdx}`)
            avgCell.value = `Avg: ${avg}`
            avgCell.font = { bold: true, size: 10 }
            avgCell.alignment = { horizontal: 'center', vertical: 'middle' }
          }
        }
      }

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `results-${state.competition_id}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Excel export failed:', err)
    } finally {
      setExcelExporting(false)
    }
  }

  async function handleBatchDownload() {
    if (!officialSorted.length || batchProgress) return
    const { downloadBatchCertificates } = await import('../generateCertificate')
    const students = officialSorted.map((s, i) => ({
      ...s,
      rank: i + 1,
      totalQuestions: getTotalQuestions(s.level),
    }))
    setBatchProgress({ done: 0, total: students.length })
    await downloadBatchCertificates(
      students,
      state.round_label || 'International English Spelling & Math Championship',
      state.competition_id,
      (done, total) => setBatchProgress({ done, total })
    )
    setBatchProgress(null)
  }

  async function handleNewSession(copyRoster) {
    if (confirmNew !== copyRoster) {
      setConfirmNew(copyRoster)
      return
    }
    setConfirmNew(null)
    await onNewSession(copyRoster)
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

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportExcelResults}
            disabled={excelExporting}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Table className="w-4 h-4" />
            {excelExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            onClick={exportCSV}
            className={`px-5 py-3 border font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={() => window.print()}
            className={`px-5 py-3 border font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
            }`}
          >
            Print
          </button>
          <button
            onClick={handleBatchDownload}
            disabled={batchProgress != null || !officialSorted.length}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            {batchProgress ? `Compiling ${batchProgress.done}/${batchProgress.total}...` : 'All Certificates'}
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
                    L{s.level}
                  </span>
                </td>
                <td className={`px-4 py-4 text-right font-black text-base ${text}`}>
                  {s.validated_score}
                  <span className={`text-xs font-semibold ml-1 ${textMuted}`}>/ {getTotalQuestions(s.level)}</span>
                </td>
                <td className={`px-4 py-4 text-right font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmt(s.time_spent_seconds)}</td>
                <td className="px-6 py-4 text-center">
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

          {onSwitchSubject && subject === SUBJECTS.ENGLISH && !otherSubjectDone && participantCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onSwitchSubject(otherSubject)}
              className="w-full max-w-md px-8 py-4 rounded-xl font-black text-base uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              Proceed to {otherLabel}
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          )}

          {onNewSession && (
            <>
              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleNewSession(true)}
                  className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all cursor-pointer ${
                    confirmNew === true ? 'bg-red-600 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  {confirmNew === true ? 'TAP TO CONFIRM' : 'New Session (Keep Roster)'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleNewSession(false)}
                  className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all cursor-pointer ${
                    confirmNew === false ? 'bg-red-600 animate-pulse' : 'bg-slate-600 hover:bg-slate-500'
                  }`}
                >
                  {confirmNew === false ? 'TAP TO CONFIRM' : 'New Session (Fresh)'}
                </motion.button>
                {confirmNew != null && (
                  <button
                    onClick={() => setConfirmNew(null)}
                    className={`text-xs font-bold underline cursor-pointer ${textMuted}`}
                  >
                    Cancel
                  </button>
                )}
              </div>
              <p className={`text-xs ${textMuted}`}>
                Previous results are preserved in session history.
              </p>
            </>
          )}
        </div>
      )}

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
