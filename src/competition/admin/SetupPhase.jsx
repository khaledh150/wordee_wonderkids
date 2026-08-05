import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Plus, Upload, Users, ArrowRight, Clock, Tag, UserPlus, Download, Pencil, Check, X, Printer } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useToast } from '../../components/ToastContext'
import { generateCode } from './shared'
import { mathGradeLabel } from '../mathGradeLabels'

const DURATION_OPTIONS = [3, 5, 8, 10, 15]
const ENGLISH_LEVELS = [0, 1, 2, 3, 4]
const MATH_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export default function SetupPhase({ state, sessions, subject, isDark, autoPhase, updateState, loadSessions, onOpenLobby, onShowUpload, onNewSession }) {
  const toast = useToast()
  const [showAddRow, setShowAddRow] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', school: '', country: 'th', age: '', englishLevel: 0, mathLevel: 0 })
  const [editingCode, setEditingCode] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [roundLabel, setRoundLabel] = useState(state?.round_label || '')
  const [adding, setAdding] = useState(false)
  const [exportSchool, setExportSchool] = useState('all')
  const [schoolFilter, setSchoolFilter] = useState('all')

  const grouped = useMemo(() => {
    const map = new Map()
    for (const s of sessions) {
      const key = s.participant_code
      if (!map.has(key)) {
        map.set(key, { code: key, name: s.name, nickname: s.nickname, school: s.school, country: s.country, display_id: s.display_id, age: s.age, english: null, math: null })
      }
      const entry = map.get(key)
      if (s.subject === 'english') entry.english = s
      if (s.subject === 'math') entry.math = s
      if (s.age && !entry.age) entry.age = s.age
      if (s.nickname && !entry.nickname) entry.nickname = s.nickname
      if (s.photo_url && !entry.photo_url) entry.photo_url = s.photo_url
    }
    return [...map.values()].sort((a, b) => {
      const aSchool = (a.school || '').toLowerCase()
      const bSchool = (b.school || '').toLowerCase()
      if (aSchool !== bSchool) return aSchool.localeCompare(bSchool)
      const aLvl = (subject === 'math' ? a.math?.level : a.english?.level) || 0
      const bLvl = (subject === 'math' ? b.math?.level : b.english?.level) || 0
      if (aLvl !== bLvl) return aLvl - bLvl
      return a.code.localeCompare(b.code, undefined, { numeric: true })
    })
  }, [sessions, subject])

  const filteredGrouped = useMemo(() => {
    if (schoolFilter === 'all') return grouped
    return grouped.filter(s => s.school === schoolFilter)
  }, [grouped, schoolFilter])

  const studentCount = grouped.length

  const schools = useMemo(() => {
    const set = new Set()
    for (const s of grouped) {
      if (s.school) set.add(s.school)
    }
    return [...set].sort()
  }, [grouped])

  const cardClass = isDark
    ? 'bg-[#0e1224]/50 border-white/10'
    : 'bg-white border-slate-200'

  const inputClass = isDark
    ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500/50'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500/50'

  const selectClass = isDark
    ? 'bg-[#131830] border-white/10 text-white focus:border-indigo-500/50'
    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500/50'

  async function handleLevelChange(student, subjectKey, newLevel) {
    const row = subjectKey === 'english' ? student.english : student.math
    const level = Number(newLevel)

    if (row && level === 0) {
      const { error } = await supabase.from('competition_sessions').delete().eq('participant_id', row.participant_id)
      if (error) { toast.error('Failed to remove level: ' + error.message); return }
    } else if (row && level > 0) {
      const { error } = await supabase.from('competition_sessions').update({ level, updated_at: new Date().toISOString() }).eq('participant_id', row.participant_id)
      if (error) { toast.error('Failed to update level: ' + error.message); return }
    } else if (!row && level > 0) {
      const refRow = student.english || student.math
      const { error } = await supabase.from('competition_sessions').insert({
        competition_id: state.competition_id,
        participant_code: student.code,
        display_id: refRow.display_id,
        name: student.name,
        school: student.school || null,
        country: student.country || null,
        age: student.age || null,
        subject: subjectKey,
        level,
      })
      if (error) { toast.error('Failed to add level: ' + error.message); return }
    }
    await loadSessions()
    toast.success('Level updated')
  }

  async function handleAgeChange(student, newAge) {
    const age = newAge === '' ? null : Number(newAge)
    const ids = [student.english?.participant_id, student.math?.participant_id].filter(Boolean)
    for (const id of ids) {
      const { error } = await supabase.from('competition_sessions').update({ age, updated_at: new Date().toISOString() }).eq('participant_id', id)
      if (error) { toast.error('Failed to update age: ' + error.message); return }
    }
    await loadSessions()
    toast.success('Age updated')
  }

  async function handleDelete(student) {
    if (!window.confirm(`Delete "${student.name}"? This will remove all their session data permanently.`)) return
    const ids = [student.english?.participant_id, student.math?.participant_id].filter(Boolean)
    if (ids.length === 0) return
    for (const id of ids) {
      const { error } = await supabase.from('competition_sessions').delete().eq('participant_id', id)
      if (error) { toast.error('Failed to delete student: ' + error.message); return }
    }
    await loadSessions()
    toast.warning('Student removed')
  }

  function startEdit(student) {
    setEditingCode(student.code)
    setEditForm({ name: student.name, nickname: student.nickname || '', school: student.school || '', country: student.country || '' })
  }

  async function saveEdit(student) {
    const updates = {
      name: editForm.name.trim(),
      nickname: editForm.nickname.trim() || null,
      school: editForm.school.trim() || null,
      country: editForm.country.trim().toLowerCase() || null,
      updated_at: new Date().toISOString(),
    }
    const ids = [student.english?.participant_id, student.math?.participant_id].filter(Boolean)
    for (const id of ids) {
      const { error } = await supabase.from('competition_sessions').update(updates).eq('participant_id', id)
      if (error) { toast.error('Failed to save edit: ' + error.message); return }
    }
    setEditingCode(null)
    await loadSessions()
    toast.success('Saved')
  }

  async function handleAddStudent() {
    if (!newStudent.name.trim() || adding) return
    setAdding(true)
    try {
      const existingCodes = sessions.map(s => s.participant_code)
      const code = generateCode(existingCodes)
      const rows = []
      const base = {
        competition_id: state.competition_id,
        participant_code: code,
        display_id: `${(newStudent.country || 'XX').toUpperCase()}-${String(studentCount + 1).padStart(3, '0')}`,
        name: newStudent.name.trim(),
        school: newStudent.school.trim() || null,
        country: newStudent.country.toLowerCase() || null,
        age: newStudent.age ? Number(newStudent.age) : null,
      }

      if (Number(newStudent.englishLevel) > 0) {
        const row = { ...base, subject: 'english', level: Number(newStudent.englishLevel) }
        if (subject === 'english' && (autoPhase === 'lobby' || autoPhase === 'live')) row.status = 'waiting'
        rows.push(row)
      }
      if (Number(newStudent.mathLevel) > 0) {
        const row = { ...base, subject: 'math', level: Number(newStudent.mathLevel) }
        if (subject === 'math' && (autoPhase === 'lobby' || autoPhase === 'live')) row.status = 'waiting'
        rows.push(row)
      }

      if (rows.length === 0) {
        setAdding(false)
        return
      }

      const { error } = await supabase.from('competition_sessions').insert(rows)
      if (error) { toast.error('Failed to add student: ' + error.message); return }
      setNewStudent({ name: '', school: '', country: 'th', age: '', englishLevel: 0, mathLevel: 0 })
      await loadSessions()
      toast.success('Student added')
    } finally {
      setAdding(false)
    }
  }

  async function handleExport() {
    const { data: allSessions } = await supabase
      .from('competition_sessions')
      .select('participant_code, name, nickname, school, country, age, subject, level')
      .eq('competition_id', state.competition_id)
    if (!allSessions) return

    const map = new Map()
    for (const s of allSessions) {
      const key = s.participant_code
      if (!map.has(key)) map.set(key, { code: key, name: s.name, school: s.school, country: s.country, age: s.age })
      const entry = map.get(key)
      if (s.subject === 'english') entry.engLevel = s.level
      if (s.subject === 'math') entry.mathLevel = s.level
    }
    let list = [...map.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    if (exportSchool !== 'all') list = list.filter(s => s.school === exportSchool)
    if (list.length === 0) return

    const header = ['Name', 'School', 'Country', 'Age', 'Code', 'English Level', 'Math Level']
    const csvRows = [header.join(',')]
    for (const s of list) {
      csvRows.push([
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.school || '').replace(/"/g, '""')}"`,
        s.country || '',
        s.age || '',
        s.code,
        s.engLevel ?? '',
        s.mathLevel ?? '',
      ].join(','))
    }
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roster${exportSchool !== 'all' ? '_' + exportSchool.replace(/\s+/g, '_') : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }


  const printRows = useMemo(() => {
    const lvl = s => subject === 'math' ? s.math?.level : s.english?.level
    return [...grouped].filter(s => lvl(s)).sort((a, b) => (lvl(a) || 0) - (lvl(b) || 0))
  }, [grouped, subject])

  return (
    <>
    {/* Print-only roster */}
    <div className="hidden print:block bg-white text-black px-8 py-4">
      <div className="fixed top-2 right-4 text-[9px] font-mono text-gray-400">
        Session {state?.competition_id?.slice(5, 13)?.toUpperCase()}
      </div>
      {[...new Set(printRows.map(s => subject === 'math' ? s.math?.level : s.english?.level))].sort((a, b) => a - b).map((lvl, idx) => {
        const lvlStudents = printRows.filter(s => (subject === 'math' ? s.math?.level : s.english?.level) === lvl)
        return (
          <div key={lvl} className={idx > 0 ? 'mt-6' : ''}>
            <h1 className="text-xl font-bold mb-2 border-b-2 border-black pb-1">
              {subject === 'math' ? `Mathematics — ${mathGradeLabel(lvl)}` : `English Spelling — Level ${lvl}`}
              <span className="text-sm font-normal text-gray-500 ml-2">({lvlStudents.length})</span>
            </h1>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase font-bold text-gray-500">
                  <th className="px-2 py-1 text-left w-8">#</th>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Nickname</th>
                  <th className="px-2 py-1 text-left">School</th>
                  <th className="px-2 py-1 text-center w-16">Code</th>
                </tr>
              </thead>
              <tbody>
                {lvlStudents.map((s, i) => (
                  <tr key={s.code} className="border-b border-gray-200">
                    <td className="px-2 py-0.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-2 py-0.5 font-medium">{s.name}</td>
                    <td className="px-2 py-0.5 text-gray-600">{s.nickname || '—'}</td>
                    <td className="px-2 py-0.5 text-gray-600">{s.school || '—'}</td>
                    <td className="px-2 py-0.5 text-center font-mono font-bold">{s.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 print:hidden">
      {/* Left Side - Roster Table */}
      <div className="min-w-0">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-5 ${cardClass}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Student Roster
              </h3>
              {studentCount > 0 && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {schoolFilter !== 'all' ? `${filteredGrouped.length} / ` : ''}{studentCount} Student{studentCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {studentCount > 0 && (
                <>
                  <button
                    onClick={onShowUpload}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                        : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload
                  </button>
                  <button
                    onClick={handleExport}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                        : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  <button
                    onClick={() => window.print()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                        : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                </>
              )}
            </div>
          </div>

          {/* School filter */}
          {studentCount > 0 && schools.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>School:</span>
              <select
                value={schoolFilter}
                onChange={(e) => { setSchoolFilter(e.target.value); setExportSchool(e.target.value) }}
                className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none ${selectClass}`}
              >
                <option value="all">All Schools ({studentCount})</option>
                {schools.map(s => {
                  const count = grouped.filter(g => g.school === s).length
                  return <option key={s} value={s}>{s} ({count})</option>
                })}
              </select>
            </div>
          )}

          {studentCount === 0 && !showAddRow ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Users className={`w-16 h-16 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-xl font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                No students registered
              </p>
              <p className={`text-sm ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Upload a roster or add students manually to get started.
              </p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={onShowUpload}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload Excel
                </button>
                <button
                  onClick={() => setShowAddRow(true)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors cursor-pointer ${
                    isDark
                      ? 'border-white/10 text-slate-300 hover:bg-white/5'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  Add Manually
                </button>
              </div>
            </div>
          ) : (
            /* Table */
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 780 }}>
                {/* Columns: #, CODE, NAME, NICKNAME, SCHOOL, AGE, LEVEL, Actions */}
                <colgroup>
                  <col style={{ width: 32 }} />
                  <col style={{ width: 56 }} />
                  <col />
                  <col style={{ minWidth: 90 }} />
                  <col style={{ minWidth: 110 }} />
                  <col style={{ width: 48 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 96 }} />
                </colgroup>
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    {['#', 'CODE', 'NAME', 'NICKNAME', 'SCHOOL', 'AGE', subject === 'math' ? 'MATH' : 'ENG', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`py-2.5 text-[10px] font-bold uppercase tracking-wider ${
                          i === 1 || i === 5 || i === 6 ? 'text-center' : 'text-left'
                        } ${i === 5 ? 'px-1' : 'px-2'} ${
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGrouped.map((student, rowIdx) => {
                    const isEditing = editingCode === student.code
                    return (
                    <tr
                      key={student.code}
                      className={`border-b transition-colors ${
                        isDark
                          ? 'border-white/5 hover:bg-white/[0.02]'
                          : 'border-slate-50 hover:bg-slate-50/50'
                      }`}
                    >
                      <td className={`py-3 px-2 text-xs font-mono font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {rowIdx + 1}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`font-mono text-sm font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          {student.code}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {isEditing ? (
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${inputClass}`}
                            maxLength={100}
                            autoFocus
                          />
                        ) : (
                          <span className={`font-semibold text-sm leading-snug block ${isDark ? 'text-white' : 'text-slate-800'}`}>{student.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {isEditing ? (
                          <input
                            value={editForm.nickname}
                            onChange={(e) => setEditForm(p => ({ ...p, nickname: e.target.value }))}
                            placeholder="Nickname"
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${inputClass}`}
                            maxLength={50}
                          />
                        ) : (
                          <span className={`block text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{student.nickname || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {isEditing ? (
                          <input
                            value={editForm.school}
                            onChange={(e) => setEditForm(p => ({ ...p, school: e.target.value }))}
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${inputClass}`}
                            maxLength={100}
                          />
                        ) : (
                          <span className={`block text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{student.school || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-1">
                        <input
                          type="number"
                          min="4"
                          max="18"
                          value={student.age || ''}
                          onChange={(e) => handleAgeChange(student, e.target.value)}
                          placeholder="—"
                          className={`w-full px-1 py-1 rounded-lg border text-sm font-bold text-center focus:outline-none transition-colors ${selectClass}${isDark ? ' dark-spinner' : ''}`}
                        />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <select
                          value={(subject === 'math' ? student.math?.level : student.english?.level) || 0}
                          onChange={(e) => handleLevelChange(student, subject, e.target.value)}
                          className={`px-2 py-1.5 rounded-lg border text-sm font-bold cursor-pointer focus:outline-none transition-colors ${selectClass}`}
                        >
                          <option value={0}>—</option>
                          {(subject === 'math' ? MATH_LEVELS : ENGLISH_LEVELS).slice(1).map(l => (
                            <option key={l} value={l}>{subject === 'math' ? mathGradeLabel(l) : l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(student)}
                              disabled={!editForm.name.trim()}
                              className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer disabled:opacity-30"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingCode(null)}
                              className={`p-2 rounded-lg transition-colors cursor-pointer ${isDark ? 'text-slate-400 bg-white/5 hover:bg-white/10' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'}`}
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => startEdit(student)}
                              className={`p-2 rounded-lg transition-colors cursor-pointer ${isDark ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-500 hover:bg-blue-50'}`}
                              title="Edit student"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(student)}
                              className="p-2 rounded-lg text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete student"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    )
                  })}

                  {/* Add Student Row */}
                  <tr className={`border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <td className="py-2 px-2"></td>
                    <td className="py-2 px-2 text-center">
                      <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>auto</span>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        value={newStudent.name}
                        onChange={(e) => setNewStudent(p => ({ ...p, name: e.target.value }))}
                        placeholder="Name"
                        maxLength={100}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${inputClass}`}
                      />
                    </td>
                    <td className="py-2 px-2"></td>
                    <td className="py-2 px-2">
                      <input
                        value={newStudent.school}
                        onChange={(e) => setNewStudent(p => ({ ...p, school: e.target.value }))}
                        placeholder="School"
                        maxLength={100}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${inputClass}`}
                      />
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="number"
                        min="4"
                        max="18"
                        value={newStudent.age}
                        onChange={(e) => setNewStudent(p => ({ ...p, age: e.target.value }))}
                        placeholder="—"
                        className={`w-full px-1 py-1.5 rounded-lg border text-xs text-center transition-colors ${inputClass}${isDark ? ' dark-spinner' : ''}`}
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <select
                        value={subject === 'math' ? newStudent.mathLevel : newStudent.englishLevel}
                        onChange={(e) => setNewStudent(p => ({
                          ...p,
                          ...(subject === 'math' ? { mathLevel: Number(e.target.value) } : { englishLevel: Number(e.target.value) })
                        }))}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none transition-colors ${selectClass}`}
                      >
                        {(subject === 'math' ? MATH_LEVELS : ENGLISH_LEVELS).map(l => (
                          <option key={l} value={l}>{l === 0 ? '—' : subject === 'math' ? mathGradeLabel(l) : l}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={handleAddStudent}
                        disabled={!newStudent.name.trim() || adding || (subject === 'math' ? Number(newStudent.mathLevel) === 0 : Number(newStudent.englishLevel) === 0)}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:pointer-events-none text-white transition-colors cursor-pointer"
                        title="Add student"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Right Side - Settings */}
      <div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`rounded-2xl border p-5 ${cardClass}`}
        >
          <h3 className={`text-lg font-bold mb-5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Competition Settings
          </h3>

          {/* Duration */}
          <div className="mb-5">
            <label className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              Duration
            </label>
            <select
              value={state ? state.duration_seconds / 60 : 5}
              onChange={(e) => updateState({ duration_seconds: Number(e.target.value) * 60 })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold cursor-pointer focus:outline-none transition-colors ${selectClass}`}
            >
              {DURATION_OPTIONS.map(m => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>

          {/* Round Label */}
          <div className="mb-6">
            <label className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <Tag className="w-3.5 h-3.5" />
              Round Label
            </label>
            <div className="flex gap-2">
              <input
                value={roundLabel}
                onChange={(e) => setRoundLabel(e.target.value)}
                placeholder="e.g. Round 1, Finals"
                maxLength={50}
                className={`flex-1 px-3.5 py-2.5 rounded-xl border text-sm transition-colors ${inputClass}`}
              />
              <button
                onClick={() => updateState({ round_label: roundLabel || null })}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Save
              </button>
            </div>
          </div>

          {/* Open Lobby Button */}
          {autoPhase === 'lobby' || autoPhase === 'live' ? (
            <div className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-base font-black uppercase tracking-wider ${
              isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}>
              {autoPhase === 'lobby' ? 'Lobby is Open' : 'Competition is Live'}
            </div>
          ) : (
            <>
              <button
                onClick={onOpenLobby}
                disabled={studentCount === 0}
                className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-base font-black uppercase tracking-wider transition-all cursor-pointer
                  ${studentCount > 0
                    ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white shadow-lg shadow-emerald-900/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  }
                  disabled:pointer-events-none
                `}
              >
                Open Lobby
                <ArrowRight className="w-5 h-5" />
              </button>
              {studentCount === 0 && (
                <p className={`text-xs text-center mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Add students to enable lobby
                </p>
              )}
            </>
          )}

          {onNewSession && (
            <div className={`flex items-center justify-center gap-3 mt-4 pt-4 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
              <button
                onClick={() => onNewSession(true)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isDark
                    ? 'text-slate-400 bg-white/5 border-white/10 hover:bg-white/10 hover:text-slate-200'
                    : 'text-slate-500 bg-slate-100 border-slate-200 hover:bg-slate-200 hover:text-slate-700'
                }`}
              >
                New Session (Keep Roster)
              </button>
              <button
                onClick={() => onNewSession(false)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isDark
                    ? 'text-rose-400/70 bg-rose-500/5 border-rose-500/10 hover:bg-rose-500/10 hover:text-rose-300'
                    : 'text-rose-500 bg-rose-50 border-rose-200 hover:bg-rose-100 hover:text-rose-600'
                }`}
              >
                New Session (Fresh)
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
    </>
  )
}
