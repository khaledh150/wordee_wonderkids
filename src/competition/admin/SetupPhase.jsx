import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Plus, Upload, Users, ArrowRight, Clock, Tag, UserPlus, Download, Pencil, Check, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { generateCode } from './shared'

const DURATION_OPTIONS = [3, 5, 8, 10, 15]
const ENGLISH_LEVELS = [0, 1, 2, 3, 4]
const MATH_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export default function SetupPhase({ state, sessions, subject, isDark, autoPhase, updateState, loadSessions, onOpenLobby, onShowUpload }) {
  const [showAddRow, setShowAddRow] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', school: '', country: 'th', age: '', englishLevel: 0, mathLevel: 0 })
  const [editingCode, setEditingCode] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [roundLabel, setRoundLabel] = useState(state?.round_label || '')
  const [adding, setAdding] = useState(false)
  const [exportSchool, setExportSchool] = useState('all')

  const grouped = useMemo(() => {
    const map = new Map()
    for (const s of sessions) {
      const key = s.participant_code
      if (!map.has(key)) {
        map.set(key, { code: key, name: s.name, school: s.school, country: s.country, display_id: s.display_id, age: s.age, english: null, math: null })
      }
      const entry = map.get(key)
      if (s.subject === 'english') entry.english = s
      if (s.subject === 'math') entry.math = s
      if (s.age && !entry.age) entry.age = s.age
    }
    return [...map.values()]
  }, [sessions])

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
      await supabase.from('competition_sessions').delete().eq('participant_id', row.participant_id)
    } else if (row && level > 0) {
      await supabase.from('competition_sessions').update({ level, updated_at: new Date().toISOString() }).eq('participant_id', row.participant_id)
    } else if (!row && level > 0) {
      const refRow = student.english || student.math
      await supabase.from('competition_sessions').insert({
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
    }
    await loadSessions()
  }

  async function handleAgeChange(student, newAge) {
    const age = newAge === '' ? null : Number(newAge)
    const ids = [student.english?.participant_id, student.math?.participant_id].filter(Boolean)
    for (const id of ids) {
      await supabase.from('competition_sessions').update({ age, updated_at: new Date().toISOString() }).eq('participant_id', id)
    }
    await loadSessions()
  }

  async function handleDelete(student) {
    if (!window.confirm(`Delete "${student.name}"? This will remove all their session data permanently.`)) return
    const ids = [student.english?.participant_id, student.math?.participant_id].filter(Boolean)
    if (ids.length === 0) return
    for (const id of ids) {
      await supabase.from('competition_sessions').delete().eq('participant_id', id)
    }
    await loadSessions()
  }

  function startEdit(student) {
    setEditingCode(student.code)
    setEditForm({ name: student.name, school: student.school || '', country: student.country || '' })
  }

  async function saveEdit(student) {
    const updates = {
      name: editForm.name.trim(),
      school: editForm.school.trim() || null,
      country: editForm.country.trim().toLowerCase() || null,
      updated_at: new Date().toISOString(),
    }
    const ids = [student.english?.participant_id, student.math?.participant_id].filter(Boolean)
    for (const id of ids) {
      await supabase.from('competition_sessions').update(updates).eq('participant_id', id)
    }
    setEditingCode(null)
    await loadSessions()
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

      await supabase.from('competition_sessions').insert(rows)
      setNewStudent({ name: '', school: '', country: 'th', age: '', englishLevel: 0, mathLevel: 0 })
      await loadSessions()
    } finally {
      setAdding(false)
    }
  }

  function handleExport() {
    const list = exportSchool === 'all' ? grouped : grouped.filter(s => s.school === exportSchool)
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
        s.english?.level || 0,
        s.math?.level || 0,
      ].join(','))
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roster${exportSchool !== 'all' ? '_' + exportSchool.replace(/\s+/g, '_') : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left Side - Roster Table */}
      <div className="lg:col-span-3">
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
                  {studentCount} Student{studentCount !== 1 ? 's' : ''}
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
                </>
              )}
            </div>
          </div>

          {/* Export school filter */}
          {studentCount > 0 && schools.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Export:</span>
              <select
                value={exportSchool}
                onChange={(e) => setExportSchool(e.target.value)}
                className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none ${selectClass}`}
              >
                <option value="all">All Schools</option>
                {schools.map(s => <option key={s} value={s}>{s}</option>)}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[18%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    {['Name', 'School', 'Ctry', 'Age', 'Code', 'Eng', 'Math', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`text-left py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider ${
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((student) => {
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
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                            className={`w-full px-2 py-1 rounded-lg border text-xs transition-colors ${inputClass}`}
                            autoFocus
                          />
                        ) : (
                          <span className={`font-medium truncate block ${isDark ? 'text-white' : 'text-slate-800'}`}>{student.name}</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            value={editForm.school}
                            onChange={(e) => setEditForm(p => ({ ...p, school: e.target.value }))}
                            className={`w-full px-2 py-1 rounded-lg border text-xs transition-colors ${inputClass}`}
                          />
                        ) : (
                          <span className={`truncate block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{student.school || '—'}</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            value={editForm.country}
                            onChange={(e) => setEditForm(p => ({ ...p, country: e.target.value }))}
                            maxLength={2}
                            className={`w-12 px-1.5 py-1 rounded-lg border text-xs text-center transition-colors ${inputClass}`}
                          />
                        ) : (
                          <span className={`text-xs uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{student.country || '—'}</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="4"
                          max="18"
                          value={student.age || ''}
                          onChange={(e) => handleAgeChange(student, e.target.value)}
                          placeholder="—"
                          className={`w-14 px-1.5 py-0.5 rounded-lg border text-xs font-bold text-center focus:outline-none transition-colors ${selectClass}${isDark ? ' dark-spinner' : ''}`}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <span className={`font-mono text-xs font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          {student.code}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={student.english?.level || 0}
                          onChange={(e) => handleLevelChange(student, 'english', e.target.value)}
                          className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none transition-colors ${selectClass}`}
                        >
                          <option value={0}>—</option>
                          {ENGLISH_LEVELS.slice(1).map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={student.math?.level || 0}
                          onChange={(e) => handleLevelChange(student, 'math', e.target.value)}
                          className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none transition-colors ${selectClass}`}
                        >
                          <option value={0}>—</option>
                          {MATH_LEVELS.slice(1).map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(student)}
                                disabled={!editForm.name.trim()}
                                className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-30"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingCode(null)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100'}`}
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(student)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isDark ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-500 hover:bg-blue-50'}`}
                                title="Edit student"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(student)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
                                title="Delete student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })}

                  {/* Add Student Row */}
                  <tr className={`border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <td className="py-2 px-2">
                      <input
                        value={newStudent.name}
                        onChange={(e) => setNewStudent(p => ({ ...p, name: e.target.value }))}
                        placeholder="Name"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${inputClass}`}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        value={newStudent.school}
                        onChange={(e) => setNewStudent(p => ({ ...p, school: e.target.value }))}
                        placeholder="School"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${inputClass}`}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        value={newStudent.country}
                        onChange={(e) => setNewStudent(p => ({ ...p, country: e.target.value }))}
                        placeholder="th"
                        maxLength={2}
                        className={`w-12 px-1.5 py-1.5 rounded-lg border text-xs text-center transition-colors ${inputClass}`}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="4"
                        max="18"
                        value={newStudent.age}
                        onChange={(e) => setNewStudent(p => ({ ...p, age: e.target.value }))}
                        placeholder="—"
                        className={`w-14 px-1.5 py-1.5 rounded-lg border text-xs text-center transition-colors ${inputClass}${isDark ? ' dark-spinner' : ''}`}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>auto</span>
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={newStudent.englishLevel}
                        onChange={(e) => setNewStudent(p => ({ ...p, englishLevel: Number(e.target.value) }))}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none transition-colors ${selectClass}`}
                      >
                        {ENGLISH_LEVELS.map(l => (
                          <option key={l} value={l}>{l === 0 ? '—' : l}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={newStudent.mathLevel}
                        onChange={(e) => setNewStudent(p => ({ ...p, mathLevel: Number(e.target.value) }))}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none transition-colors ${selectClass}`}
                      >
                        {MATH_LEVELS.map(l => (
                          <option key={l} value={l}>{l === 0 ? '—' : l}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={handleAddStudent}
                        disabled={!newStudent.name.trim() || adding || (Number(newStudent.englishLevel) === 0 && Number(newStudent.mathLevel) === 0)}
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
          )}
        </motion.div>
      </div>

      {/* Right Side - Settings */}
      <div className="lg:col-span-2">
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
        </motion.div>
      </div>
    </div>
  )
}
