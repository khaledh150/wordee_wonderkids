import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Download, X, AlertCircle, CheckCircle2 } from 'lucide-react'

const HEADERS = ['Name', 'School', 'Country', 'English Level', 'Math Level']
const EXAMPLE_ROW = ['Jane Doe', 'Springfield Academy', 'TH', '3', '2']

const COL_MAP = {
  name: ['name'],
  school: ['school'],
  country: ['country'],
  english_level: ['english level', 'englishlevel', 'english_level', 'eng level', 'eng_level'],
  math_level: ['math level', 'mathlevel', 'math_level'],
}

function normalize(header) {
  return String(header).trim().toLowerCase()
}

function mapColumns(raw) {
  const keys = Object.keys(raw)
  const mapped = {}
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    const match = keys.find(k => aliases.includes(normalize(k)))
    if (match) mapped[field] = raw[match]
  }
  return mapped
}

function validateRow(row) {
  const errors = []
  if (!row.name || !String(row.name).trim()) errors.push('Name is required')
  const engLvl = Number(row.english_level)
  const mathLvl = Number(row.math_level)
  if (row.english_level !== undefined && row.english_level !== '' && (isNaN(engLvl) || engLvl < 0 || engLvl > 8)) {
    errors.push('English Level must be 0-8')
  }
  if (row.math_level !== undefined && row.math_level !== '' && (isNaN(mathLvl) || mathLvl < 0 || mathLvl > 8)) {
    errors.push('Math Level must be 0-8')
  }
  return errors
}

export default function RosterUpload({ open, onClose, onImport, competitionId, subject, isDark }) {
  const [rows, setRows] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const reset = useCallback(() => {
    setRows(null)
    setDragOver(false)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE_ROW])
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Roster')
    XLSX.writeFile(wb, 'roster_template.xlsx')
  }

  async function parseFile(file) {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer)
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet)

    const parsed = json.map((raw, i) => {
      const mapped = mapColumns(raw)
      const row = {
        name: String(mapped.name || '').trim(),
        school: String(mapped.school || '').trim(),
        country: String(mapped.country || '').trim().toLowerCase() || 'th',
        english_level: mapped.english_level !== undefined && mapped.english_level !== '' ? Number(mapped.english_level) : 0,
        math_level: mapped.math_level !== undefined && mapped.math_level !== '' ? Number(mapped.math_level) : 0,
      }
      const errors = validateRow({ ...mapped, name: row.name })
      return { ...row, _index: i + 2, _errors: errors, _valid: errors.length === 0 }
    })

    setRows(parsed)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) parseFile(file)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  function handleImport() {
    if (!rows) return
    const valid = rows.filter(r => r._valid).map(({ _index, _errors, _valid, ...rest }) => rest)
    if (valid.length === 0) return
    onImport(valid)
    handleClose()
  }

  const validCount = rows?.filter(r => r._valid).length || 0
  const invalidCount = rows?.filter(r => !r._valid).length || 0

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#060814]/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className={`rounded-3xl p-6 max-w-2xl w-full border shadow-2xl max-h-[85vh] flex flex-col ${
            isDark ? 'bg-[#0e1224] border-white/10' : 'bg-white border-slate-200'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Upload Roster
            </h2>
            <button
              onClick={handleClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={downloadTemplate}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium mb-4 transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>

          {!rows ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
                dragOver
                  ? 'border-blue-500 bg-blue-500/10'
                  : isDark
                    ? 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50'
              }`}
            >
              <Upload className={`w-8 h-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Drop Excel file here or click to browse
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                .xlsx or .csv
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4 min-h-0 flex-1">
              <div className="flex items-center gap-3 text-sm">
                {validCount > 0 && (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {validCount} valid
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {invalidCount} invalid
                  </span>
                )}
                <button
                  onClick={reset}
                  className={`ml-auto text-xs px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Clear
                </button>
              </div>

              <div className={`overflow-auto flex-1 rounded-xl border ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}>
                      <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>#</th>
                      <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Name</th>
                      <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>School</th>
                      <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Country</th>
                      <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Eng</th>
                      <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Math</th>
                      <th className={`px-3 py-2 text-left font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className={
                          row._valid
                            ? isDark ? 'bg-emerald-500/[0.04]' : 'bg-emerald-50/60'
                            : isDark ? 'bg-red-500/[0.06]' : 'bg-red-50/60'
                        }
                      >
                        <td className={`px-3 py-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{row._index}</td>
                        <td className={`px-3 py-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{row.name || '—'}</td>
                        <td className={`px-3 py-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.school || '—'}</td>
                        <td className={`px-3 py-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.country}</td>
                        <td className={`px-3 py-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.english_level}</td>
                        <td className={`px-3 py-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.math_level}</td>
                        <td className="px-3 py-1.5">
                          {row._valid ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <span className="text-xs text-red-400">{row._errors.join(', ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className={`flex gap-3 mt-5 pt-4 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
            <button
              onClick={handleClose}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Cancel
            </button>
            {rows && (
              <button
                onClick={handleImport}
                disabled={validCount === 0}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  validCount > 0
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-blue-600/30 text-blue-300/50 cursor-not-allowed'
                }`}
              >
                Import {validCount} Student{validCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
