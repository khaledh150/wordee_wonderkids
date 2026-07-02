import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Plus, Upload, Users, ArrowRight, Clock, Tag, UserPlus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { generateCode } from './shared'

const DURATION_OPTIONS = [3, 5, 8, 10, 15]
const ENGLISH_LEVELS = [0, 1, 2, 3, 4]
const MATH_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export default function SetupPhase({ state, sessions, subject, isDark, updateState, loadSessions, onOpenLobby, onShowUpload }) {
  const [showAddRow, setShowAddRow] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', school: '', country: 'th', englishLevel: 0, mathLevel: 0 })
  const [roundLabel, setRoundLabel] = useState(state?.round_label || '')
  const [adding, setAdding] = useState(false)

  // Group sessions by participant_code to get unified student view
  const grouped = useMemo(() => {
    const map = new Map()
    for (const s of sessions) {
      const key = s.participant_code
      if (!map.has(key)) {
        map.set(key, { code: key, name: s.name, school: s.school, country: s.country, display_id: s.display_id, english: null, math: null })
      }
      const entry = map.get(key)
      if (s.subject === 'english') entry.english = s
      if (s.subject === 'math') entry.math = s
    }
    return [...map.values()]
  }, [sessions])

  const studentCount = grouped.length

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
      // Delete this subject row
      await supabase.from('competition_sessions').delete().eq('id', row.id)
    } else if (row && level > 0) {
      // Update existing row
      await supabase.from('competition_sessions').update({ level, updated_at: new Date().toISOString() }).eq('id', row.id)
    } else if (!row && level > 0) {
      // Insert new row for this subject
      const refRow = student.english || student.math
      await supabase.from('competition_sessions').insert({
        competition_id: state.competition_id,
        participant_code: student.code,
        display_id: refRow.display_id,
        name: student.name,
        school: student.school || null,
        country: student.country || null,
        subject: subjectKey,
        level,
      })
    }
    await loadSessions()
  }

  async function handleDelete(student) {
    const ids = [student.english?.id, student.math?.id].filter(Boolean)
    if (ids.length === 0) return
    for (const id of ids) {
      await supabase.from('competition_sessions').delete().eq('id', id)
    }
    await loadSessions()
  }

  async function handleAddStudent() {
    if (!newStudent.name.trim() || adding) return
    setAdding(true)
    try {
      const code = generateCode()
      const rows = []
      const base = {
        competition_id: state.competition_id,
        participant_code: code,
        display_id: `${(newStudent.country || 'XX').toUpperCase()}-${String(studentCount + 1).padStart(3, '0')}`,
        name: newStudent.name.trim(),
        school: newStudent.school.trim() || null,
        country: newStudent.country.toLowerCase() || null,
      }

      if (Number(newStudent.englishLevel) > 0) {
        rows.push({ ...base, subject: 'english', level: Number(newStudent.englishLevel) })
      }
      if (Number(newStudent.mathLevel) > 0) {
        rows.push({ ...base, subject: 'math', level: Number(newStudent.mathLevel) })
      }

      if (rows.length === 0) {
        setAdding(false)
        return
      }

      await supabase.from('competition_sessions').insert(rows)
      setNewStudent({ name: '', school: '', country: 'th', englishLevel: 0, mathLevel: 0 })
      await loadSessions()
    } finally {
      setAdding(false)
    }
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
            {studentCount > 0 && (
              <button
                onClick={onShowUpload}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Excel
              </button>
            )}
          </div>

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
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    {['Name', 'School', 'Code', 'Eng Lvl', 'Math Lvl', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`text-left py-2.5 px-3 text-xs font-bold uppercase tracking-wider ${
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        } ${i === 5 ? 'w-10' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((student) => (
                    <tr
                      key={student.code}
                      className={`border-b transition-colors ${
                        isDark
                          ? 'border-white/5 hover:bg-white/[0.02]'
                          : 'border-slate-50 hover:bg-slate-50/50'
                      }`}
                    >
                      <td className={`py-2.5 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {student.name}
                      </td>
                      <td className={`py-2.5 px-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {student.school || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-mono text-xs font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          {student.code}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
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
                      <td className="py-2.5 px-3">
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
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleDelete(student)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
                          title="Delete student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Add Student Row */}
                  <tr className={`border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <td className="py-2.5 px-3">
                      <input
                        value={newStudent.name}
                        onChange={(e) => setNewStudent(p => ({ ...p, name: e.target.value }))}
                        placeholder="Name"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${inputClass}`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        value={newStudent.school}
                        onChange={(e) => setNewStudent(p => ({ ...p, school: e.target.value }))}
                        placeholder="School"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${inputClass}`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        value={newStudent.country}
                        onChange={(e) => setNewStudent(p => ({ ...p, country: e.target.value }))}
                        placeholder="th"
                        maxLength={2}
                        className={`w-16 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${inputClass}`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
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
                    <td className="py-2.5 px-3">
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
                    <td className="py-2.5 px-3">
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
        </motion.div>
      </div>
    </div>
  )
}
