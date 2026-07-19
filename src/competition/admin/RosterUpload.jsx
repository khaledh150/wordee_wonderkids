import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Download, X, AlertCircle, CheckCircle2 } from 'lucide-react'

const COL_MAP = {
  name: ['name', 'ชื่อ', 'ชื่อ-นามสกุล', 'ชื่อ - นามสกุล', 'ชื่อ-นามสกุล (ผู้เข้าแข่งขัน)', 'ชื่อ - นามสกุล (ผู้เข้าแข่งขัน)', 'student name', 'full name'],
  school: ['school', 'สำขา', 'สาขา', 'โรงเรียน', 'branch'],
  age: ['age', 'อายุ'],
  country: ['country', 'ประเทศ'],
  english_level: ['english level', 'englishlevel', 'english_level', 'eng level', 'eng_level', 'english', 'ภาษาอังกฤษ', 'eng'],
  math_level: ['math level', 'mathlevel', 'math_level', 'math', 'คณิตศาสตร์', 'mathematics'],
  grade: ['grade', 'ชั้น'],
  parent: ['parent', 'ผู้ปกครอง', 'guardian'],
  shirt_size: ['shirt size', 'ไซด์เสื้อ', 'size'],
  phone: ['phone', 'เบอร์โทร', 'tel', 'telephone'],
}

function normalize(header) {
  return String(header).trim().toLowerCase().replace(/\s+/g, ' ')
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
  if (row.english_level !== undefined && row.english_level !== '' && (isNaN(engLvl) || engLvl < 0 || engLvl > 4)) {
    errors.push('English Level must be 0-4')
  }
  if (row.math_level !== undefined && row.math_level !== '' && (isNaN(mathLvl) || mathLvl < 0 || mathLvl > 8)) {
    errors.push('Math Level must be 0-8')
  }
  return errors
}

const NAVY = { argb: 'FF1B1464' }
const WHITE_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
const THIN_BORDER = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
}

async function buildStyledWorkbook(lang = 'en') {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()

  {
    const isTh = lang === 'th'
    const sheetName = isTh ? 'ลงทะเบียน' : 'Registration'
    const ws = wb.addWorksheet(sheetName)

    // Column widths
    ws.columns = [
      { width: 6 },   // A: No.
      { width: 32 },  // B: Name
      { width: 8 },   // C: Level
      { width: 7 },   // D: Age
      { width: 9 },   // E: Grade
      { width: 13 },  // F: Mental Math
      { width: 15 },  // G: English
      { width: 15 },  // H: Mathematics
      { width: 18 },  // I: Parent
      { width: 12 },  // J: Shirt Size
      { width: 15 },  // K: Phone
    ]

    // Row 1: Title (merged A1:K1)
    ws.mergeCells('A1:K1')
    const titleCell = ws.getCell('A1')
    titleCell.value = isTh
      ? 'ลงทะเบียนรายชื่อผู้เข้าแข่งขันระดับนานาชาติ'
      : 'International Championship Registration Form'
    titleCell.font = { bold: true, size: 20 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 45

    // Row 2: Group headers
    const row2 = ws.getRow(2)
    row2.height = 28

    // A2: Branch label (merged A2:E2)
    ws.mergeCells('A2:E2')
    const branchCell = ws.getCell('A2')
    branchCell.value = isTh ? 'สาขา' : 'Branch'
    branchCell.font = WHITE_FONT
    branchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: NAVY }
    branchCell.alignment = { horizontal: 'center', vertical: 'middle' }
    branchCell.border = THIN_BORDER

    // F2:H2: Subjects (merged)
    ws.mergeCells('F2:H2')
    const subjectsCell = ws.getCell('F2')
    subjectsCell.value = isTh ? 'วิชาที่ลงแข่ง' : 'Subjects'
    subjectsCell.font = WHITE_FONT
    subjectsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: NAVY }
    subjectsCell.alignment = { horizontal: 'center', vertical: 'middle' }
    subjectsCell.border = THIN_BORDER

    // I2, J2, K2: Individual headers (merged vertically with row 3)
    const r2Headers = [
      { col: 'I', label: isTh ? 'ผู้ปกครอง' : 'Parent' },
      { col: 'J', label: isTh ? 'ไซด์เสื้อ' : 'Shirt Size' },
      { col: 'K', label: isTh ? 'เบอร์โทร' : 'Phone' },
    ]
    for (const { col, label } of r2Headers) {
      ws.mergeCells(`${col}2:${col}3`)
      const cell = ws.getCell(`${col}2`)
      cell.value = label
      cell.font = WHITE_FONT
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: NAVY }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = THIN_BORDER
    }

    // Row 3: Column sub-headers
    const row3 = ws.getRow(3)
    row3.height = 24

    const subHeaders = [
      { col: 1, label: 'No.', fill: NAVY },
      { col: 2, label: isTh ? 'ชื่อ - นามสกุล (ผู้เข้าแข่งขัน)' : 'Student Name', fill: NAVY },
      { col: 3, label: 'Level', fill: NAVY },
      { col: 4, label: isTh ? 'อายุ' : 'Age', fill: NAVY },
      { col: 5, label: isTh ? 'ชั้น' : 'Grade', fill: NAVY },
      { col: 6, label: isTh ? 'จินตคณิต' : 'Mental Math', fill: { argb: 'FFFFD700' } },
      { col: 7, label: isTh ? 'ภาษาอังกฤษ' : 'English', fill: { argb: 'FFCC0000' } },
      { col: 8, label: isTh ? 'คณิตศาสตร์' : 'Mathematics', fill: { argb: 'FF3333CC' } },
    ]

    for (const { col, label, fill } of subHeaders) {
      const cell = row3.getCell(col)
      cell.value = label
      const isYellow = fill.argb === 'FFFFD700'
      cell.font = { bold: true, color: { argb: isYellow ? 'FF000000' : 'FFFFFFFF' }, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: fill }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = THIN_BORDER
    }

    // Rows 4-34: Numbered rows with borders
    for (let i = 1; i <= 31; i++) {
      const row = ws.getRow(i + 3)
      row.height = 22
      const noCell = row.getCell(1)
      noCell.value = i
      noCell.font = { bold: true, color: { argb: 'FFCC0000' }, size: 10 }
      noCell.alignment = { horizontal: 'center', vertical: 'middle' }

      for (let c = 1; c <= 11; c++) {
        row.getCell(c).border = THIN_BORDER
      }
    }
  }

  return wb
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

  async function downloadTemplate(lang) {
    const wb = await buildStyledWorkbook(lang)
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = lang === 'th' ? 'ใบลงทะเบียน.xlsx' : 'registration_template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  function detectTemplateFormat(sheet, XLSX) {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    for (let r = range.s.r; r <= Math.min(range.e.r, 3); r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })]
      if (!cell) continue
      const v = String(cell.v).trim()
      if (v.match(/^(English Level|Kindergarten|Grade \d|High-school|Mathematics)/i)) {
        return true
      }
    }
    return false
  }

  function parseTemplateFormat(sheet, XLSX, fileName) {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    const isMathFile = fileName.toLowerCase().includes('math')

    const MATH_GRADE_TO_LEVEL = {
      'kindergarten': 1, 'grade 1': 2, 'grade 2': 3, 'grade 3': 4,
      'grade 4': 5, 'grade 5': 6, 'grade 6': 7, 'high-school 1-3': 8,
    }

    const sections = []
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })]
      if (!cell) continue
      const v = String(cell.v).trim()
      if (v.match(/^(English Level \d|Kindergarten|Grade \d|High-school)/i)) {
        let level
        if (isMathFile) {
          level = MATH_GRADE_TO_LEVEL[v.toLowerCase()] || MATH_GRADE_TO_LEVEL[v]
        } else {
          const m = v.match(/Level\s*(\d+)/i)
          level = m ? parseInt(m[1]) : null
        }
        if (level != null) sections.push({ row: r, level, title: v })
      }
    }

    const results = []
    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si]
      const headerRow = sec.row + 1
      const nextRow = si < sections.length - 1 ? sections[si + 1].row : range.e.r + 1

      for (let r = headerRow + 1; r < nextRow; r++) {
        const nameCell = sheet[XLSX.utils.encode_cell({ r, c: 1 })]
        if (!nameCell || !String(nameCell.v).trim()) continue
        const name = String(nameCell.v).trim()

        const schoolCell = sheet[XLSX.utils.encode_cell({ r, c: 2 })]
        const nicknameCell = sheet[XLSX.utils.encode_cell({ r, c: 3 })]

        results.push({
          name,
          school: schoolCell ? String(schoolCell.v).trim() : '',
          nickname: nicknameCell ? String(nicknameCell.v).trim() : '',
          country: 'th',
          age: null,
          english_level: isMathFile ? 0 : sec.level,
          math_level: isMathFile ? sec.level : 0,
          _index: r + 1,
          _errors: name ? [] : ['Name is required'],
          _valid: !!name,
        })
      }
    }
    return results
  }

  async function parseFile(file) {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer)
    const sheet = wb.Sheets[wb.SheetNames[0]]

    if (detectTemplateFormat(sheet, XLSX)) {
      const parsed = parseTemplateFormat(sheet, XLSX, file.name)
      setRows(parsed)
      return
    }

    // Detect header row: find the row containing "No." or name-like header
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    let headerRow = 0
    for (let r = range.s.r; r <= Math.min(range.e.r, 5); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })]
        if (cell) {
          const v = normalize(String(cell.v))
          if (v === 'name' || v === 'student name' || v.includes('นามสกุล') || v.includes('ชื่อ')) {
            headerRow = r
            break
          }
        }
      }
      if (headerRow > 0) break
    }

    const json = XLSX.utils.sheet_to_json(sheet, { range: headerRow })

    const parsed = json.map((raw, i) => {
      const mapped = mapColumns(raw)
      if (!mapped.name && !mapped.school) return null

      const row = {
        name: String(mapped.name || '').trim(),
        school: String(mapped.school || '').trim(),
        country: String(mapped.country || '').trim().toLowerCase() || 'th',
        age: mapped.age !== undefined && mapped.age !== '' ? Number(mapped.age) : null,
        english_level: mapped.english_level !== undefined && mapped.english_level !== '' ? Number(mapped.english_level) : 0,
        math_level: mapped.math_level !== undefined && mapped.math_level !== '' ? Number(mapped.math_level) : 0,
      }
      const errors = validateRow({ ...mapped, name: row.name })
      return { ...row, _index: headerRow + i + 2, _errors: errors, _valid: errors.length === 0 }
    }).filter(Boolean)

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

          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Download className="w-3.5 h-3.5 inline mr-1" />Template:
            </span>
            <button
              onClick={() => downloadTemplate('en')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => downloadTemplate('th')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              🇹🇭 ไทย
            </button>
          </div>

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
                .xlsx or .csv — supports Thai and English headers
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
                      {['#', 'Name', 'School', 'Age', 'Eng', 'Math', 'Status'].map(h => (
                        <th key={h} className={`px-3 py-2 text-left font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>
                      ))}
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
                        <td className={`px-3 py-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.age || '—'}</td>
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
