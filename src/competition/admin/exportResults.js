import { supabase } from '../supabaseClient'

const MATH_LEVEL_LABELS = {
  1: 'Kindergarten',
  2: 'Grade 1',
  3: 'Grade 2',
  4: 'Grade 3',
  5: 'Grade 4',
  6: 'Grade 5',
  7: 'Grade 6',
  8: 'High-school 1-3',
}

function getAward(rank, totalParticipants) {
  if (totalParticipants <= 3) return `อันดับที่ ${rank}`
  if (rank <= 3) return 'ถ้วยรางวัล'
  if (rank <= 6) return 'เหรียญทอง'
  if (rank <= 9) return 'เหรียญเงิน'
  if (rank <= 12) return 'เหรียญทองแดง'
  return 'เกียรติบัตร'
}

function normalizeForMatch(name) {
  return (name || '').trim().replace(/\s+/g, ' ')
}

export async function exportFromTemplate(subject, competitionId) {
  const templateUrl = subject === 'math'
    ? '/templates/math-template.xlsx'
    : '/templates/english-template.xlsx'

  const [templateResp, sessionsResp] = await Promise.all([
    fetch(templateUrl),
    supabase
      .from('competition_sessions')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('subject', subject),
  ])

  if (!templateResp.ok) throw new Error('Template not found')
  const sessions = sessionsResp.data || []

  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const buffer = await templateResp.arrayBuffer()
  await wb.xlsx.load(buffer)

  const ws = wb.worksheets[0]

  const sections = []
  for (let r = 1; r <= ws.rowCount; r++) {
    const val = ws.getRow(r).getCell(1).value
    if (typeof val === 'string' && val.trim().length > 0) {
      const row = ws.getRow(r)
      const c2 = row.getCell(2).value
      if (c2 && typeof c2 === 'string' && c2.trim() === val.trim()) {
        sections.push({ row: r, title: val.trim() })
      }
    }
  }

  const levelMap = {}
  if (subject === 'math') {
    for (const [lvl, label] of Object.entries(MATH_LEVEL_LABELS)) {
      levelMap[label] = parseInt(lvl)
    }
  } else {
    for (let i = 1; i <= 10; i++) {
      levelMap[`English Level ${i}`] = i
    }
  }

  for (let si = 0; si < sections.length; si++) {
    const section = sections[si]
    const level = levelMap[section.title]
    if (level == null) continue

    const headerRow = section.row + 1
    const nextSectionRow = si < sections.length - 1 ? sections[si + 1].row : ws.rowCount + 1

    const dataRows = []
    for (let r = headerRow + 1; r < nextSectionRow; r++) {
      const name = ws.getRow(r).getCell(2).value
      if (!name || (typeof name === 'string' && !name.trim())) continue
      dataRows.push(r)
    }

    const levelSessions = sessions
      .filter(s => s.level === level && s.validated_score != null)
      .sort((a, b) => b.validated_score - a.validated_score || a.time_spent_seconds - b.time_spent_seconds)

    const sessionByName = new Map()
    for (const s of levelSessions) {
      sessionByName.set(normalizeForMatch(s.name), s)
    }

    const matched = []
    const unmatched = []

    for (const rowIdx of dataRows) {
      const row = ws.getRow(rowIdx)
      const cellName = normalizeForMatch(row.getCell(2).value)
      const s = sessionByName.get(cellName)
      if (s) {
        matched.push({ rowIdx, session: s })
        sessionByName.delete(cellName)
      } else {
        unmatched.push({ rowIdx, name: cellName })
      }
    }

    matched.sort((a, b) =>
      b.session.validated_score - a.session.validated_score ||
      a.session.time_spent_seconds - b.session.time_spent_seconds
    )

    const totalParticipants = matched.length
    const allEntries = [...matched, ...unmatched]

    for (let i = 0; i < allEntries.length; i++) {
      const templateRowIdx = dataRows[i]
      if (!templateRowIdx) continue
      const row = ws.getRow(templateRowIdx)
      const entry = allEntries[i]

      if (entry.session) {
        const rank = matched.indexOf(entry) + 1
        row.getCell(1).value = rank
        row.getCell(2).value = entry.session.name
        row.getCell(3).value = entry.session.school || ''
        row.getCell(4).value = entry.session.nickname || ''
        row.getCell(5).value = entry.session.validated_score
        row.getCell(6).value = '5:00'
        row.getCell(13).value = getAward(rank, totalParticipants)
      } else {
        row.getCell(1).value = ''
        row.getCell(2).value = entry.name || ''
        row.getCell(5).value = ''
        row.getCell(6).value = ''
        row.getCell(13).value = ''
      }
    }
  }

  const outBuffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const label = subject === 'math' ? 'Mathematics' : 'English'
  a.download = `${label}-results-${competitionId.slice(0, 8)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
