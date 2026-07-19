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

const ENG_LEVEL_LABELS = {
  1: 'English Level 1',
  2: 'English Level 2',
  3: 'English Level 3',
  4: 'English Level 4',
}

function getAward(rank, totalParticipants) {
  if (totalParticipants <= 3) return `อันดับที่ ${rank}`
  if (rank <= 3) return 'ถ้วยรางวัล'
  if (rank <= 6) return 'เหรียญทอง'
  if (rank <= 9) return 'เหรียญเงิน'
  if (rank <= 12) return 'เหรียญทองแดง'
  return 'เกียรติบัตร'
}

const CYAN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' }, bgColor: { argb: 'FF00FFFF' } }
const THIN_BORDER = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
}
const HEADER_FONT = { bold: true, size: 14, name: 'Angsana New' }
const HEADER_FONT_SM = { bold: true, size: 12, name: 'Angsana New' }
const DATA_FONT = { size: 14, name: 'Angsana New' }
const TITLE_FONT = { bold: true, size: 18, name: 'Angsana New' }

const COL_WIDTHS = [11, 44.25, 12.25, 8.88, 8.88, 7.13, 4.13, 2.38, 8.38, 3.13, 5.75, 5.75, 17.75]

const THAI_HEADERS = ['ลำดับ', 'รายชื่อ', 'สาขา', 'ชื่อเล่น', 'ข้อถูก', 'นาที', 'ข้อผิด/ปรับ', 'ข้อผิด/ปรับ', 'เวลาปรับ', 'เวลาปรับ', 'วินาที', 'วินาที', 'รางวัลที่ได้']

export async function exportFromTemplate(subject, competitionId) {
  const { data: allSessions } = await supabase
    .from('competition_sessions')
    .select('*')
    .eq('competition_id', competitionId)
    .eq('subject', subject)

  if (!allSessions) throw new Error('No sessions found')

  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Wonderkids Championship'

  const levelLabels = subject === 'math' ? MATH_LEVEL_LABELS : ENG_LEVEL_LABELS
  const ws = wb.addWorksheet('E')

  ws.columns = COL_WIDTHS.map(w => ({ width: w }))

  let currentRow = 1

  const levels = [...new Set(allSessions.map(s => s.level))].sort((a, b) => a - b)

  for (const level of levels) {
    const title = levelLabels[level] || `Level ${level}`

    const levelSessions = allSessions.filter(s => s.level === level)
    const participated = levelSessions
      .filter(s => s.validated_score != null)
      .sort((a, b) => b.validated_score - a.validated_score || a.time_spent_seconds - b.time_spent_seconds)
    const notParticipated = levelSessions.filter(s => s.validated_score == null)
    const sorted = [...participated, ...notParticipated]

    // Title row
    ws.mergeCells(`A${currentRow}:M${currentRow}`)
    const titleCell = ws.getCell(`A${currentRow}`)
    titleCell.value = title
    titleCell.font = TITLE_FONT
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(currentRow).height = 32.25
    currentRow++

    // Header row
    const headerRow = ws.getRow(currentRow)
    headerRow.height = 18.75
    ws.mergeCells(`G${currentRow}:H${currentRow}`)
    ws.mergeCells(`I${currentRow}:J${currentRow}`)
    for (let c = 1; c <= 13; c++) {
      const cell = headerRow.getCell(c)
      cell.value = THAI_HEADERS[c - 1]
      cell.font = c >= 7 && c <= 12 ? HEADER_FONT_SM : HEADER_FONT
      cell.fill = CYAN_FILL
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = THIN_BORDER
    }
    currentRow++

    // Data rows
    let rankCounter = 1
    for (const s of sorted) {
      const row = ws.getRow(currentRow)
      row.height = 18.75
      const hasScore = s.validated_score != null
      const rank = hasScore ? rankCounter++ : null

      row.getCell(1).value = rank || ''
      row.getCell(2).value = s.name || ''
      row.getCell(3).value = s.school || ''
      row.getCell(4).value = s.nickname || ''
      row.getCell(5).value = hasScore ? s.validated_score : ''
      row.getCell(6).value = hasScore ? '5:00' : ''
      row.getCell(13).value = hasScore ? getAward(rank, participated.length) : ''

      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c)
        cell.font = DATA_FONT
        cell.border = THIN_BORDER
        if (c === 1 || c === 5 || c === 6 || c === 13) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        } else {
          cell.alignment = { vertical: 'middle' }
        }
      }

      currentRow++
    }

    // Gap between sections
    currentRow += 3
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const label = subject === 'math' ? 'Mathematics' : 'English'
  a.download = `${label}-results-${competitionId.slice(0, 8)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
