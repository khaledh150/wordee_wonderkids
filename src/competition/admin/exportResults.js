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

const THIN_BORDER_ALL = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
}

const TITLE_BORDER = {
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
}

const THAI_HEADERS = ['ลำดับ', 'รายชื่อ', 'สาขา', 'ชื่อเล่น', 'ข้อถูก', 'นาที', 'ข้อผิด/ปรับ', 'ข้อผิด/ปรับ', 'เวลาปรับ', 'เวลาปรับ', 'วินาที', 'วินาที', 'รางวัลที่ได้']

const ENG_COL_WIDTHS = [11, 52, 18, 12, 10, 8, 4.13, 2.38, 8.38, 3.13, 5.75, 5.75, 22]
const MATH_COL_WIDTHS = [8, 56, 18, 14, 10, 7, 4.13, 2.38, 8.38, 3.13, 5.75, 5.75, 30]

const CYAN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' }, bgColor: { argb: 'FF00FFFF' } }
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { argb: 'FFFFFF00' } }
const GRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA5A5A5' }, bgColor: { argb: 'FFA5A5A5' } }

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

  const isMath = subject === 'math'
  const levelLabels = isMath ? MATH_LEVEL_LABELS : ENG_LEVEL_LABELS
  const colWidths = isMath ? MATH_COL_WIDTHS : ENG_COL_WIDTHS
  const headerMainFill = isMath ? YELLOW_FILL : CYAN_FILL
  const headerSmallFill = isMath ? GRAY_FILL : CYAN_FILL
  const dataFontSize = isMath ? 14 : 16

  const ws = wb.addWorksheet('E')
  ws.columns = colWidths.map(w => ({ width: w }))
  ws.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'portrait' }

  // Hide penalty/adjustment columns G-L (7-12) to match template
  for (let c = 7; c <= 12; c++) {
    ws.getColumn(c).hidden = true
  }

  let currentRow = 1
  const levels = [...new Set(allSessions.map(s => s.level))].sort((a, b) => a - b)
  let isFirstLevel = true

  for (const level of levels) {
    const title = levelLabels[level] || `Level ${level}`
    const levelSessions = allSessions.filter(s => s.level === level)
    const participated = levelSessions
      .filter(s => s.validated_score != null)
      .sort((a, b) => b.validated_score - a.validated_score || a.time_spent_seconds - b.time_spent_seconds)
    const notParticipated = levelSessions.filter(s => s.validated_score == null)
    const sorted = [...participated, ...notParticipated]

    // Title row — CordiaUPC 24 bold, merged across visible cols, center, bottom border only
    ws.mergeCells(`A${currentRow}:F${currentRow}`)
    const titleCell = ws.getCell(`A${currentRow}`)
    titleCell.value = ` ${title}`
    titleCell.font = { bold: true, size: 24, name: 'CordiaUPC', color: { theme: 1 } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.border = TITLE_BORDER
    ws.getRow(currentRow).height = 50
    currentRow++

    // Header row — Angsana New 14 bold (main), 12 bold (small), subject-specific fill
    const headerRow = ws.getRow(currentRow)
    headerRow.height = 26
    ws.mergeCells(`G${currentRow}:H${currentRow}`)
    ws.mergeCells(`I${currentRow}:J${currentRow}`)

    for (let c = 1; c <= 13; c++) {
      const cell = headerRow.getCell(c)
      cell.value = THAI_HEADERS[c - 1]
      const isSmall = c >= 7 && c <= 12
      cell.font = { bold: true, size: isSmall ? 12 : 14, name: 'Angsana New', color: { theme: 1 } }
      cell.fill = isSmall ? headerSmallFill : headerMainFill
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = THIN_BORDER_ALL
    }
    currentRow++

    // Data rows
    let rankCounter = 1
    for (const s of sorted) {
      const row = ws.getRow(currentRow)
      row.height = 24
      const hasScore = s.validated_score != null
      const rank = hasScore ? rankCounter++ : null

      // Col A — rank (bold)
      const cellA = row.getCell(1)
      cellA.value = rank || ''
      cellA.font = { bold: true, size: dataFontSize, name: 'Angsana New', color: { theme: 1 } }
      cellA.alignment = { horizontal: 'center', vertical: 'middle' }
      cellA.border = THIN_BORDER_ALL

      // Col B — name
      const cellB = row.getCell(2)
      cellB.value = s.name || ''
      cellB.font = { size: dataFontSize, name: 'Angsana New', color: { theme: 1 } }
      cellB.alignment = { horizontal: 'left', vertical: 'middle' }
      cellB.border = THIN_BORDER_ALL

      // Col C — school
      const cellC = row.getCell(3)
      cellC.value = s.school || ''
      cellC.font = { size: dataFontSize, name: 'Angsana New', color: { theme: 1 } }
      cellC.alignment = { vertical: 'middle' }
      cellC.border = THIN_BORDER_ALL

      // Col D — nickname (AngsanaUPC, not Angsana New)
      const cellD = row.getCell(4)
      cellD.value = s.nickname || ''
      cellD.font = { size: dataFontSize, name: 'AngsanaUPC', color: { theme: 1 } }
      cellD.alignment = { horizontal: 'center', vertical: 'middle' }
      cellD.border = THIN_BORDER_ALL

      // Col E — score
      const cellE = row.getCell(5)
      cellE.value = hasScore ? s.validated_score : ''
      cellE.font = { size: dataFontSize, name: 'Angsana New', color: { theme: 1 } }
      cellE.alignment = { horizontal: 'center', vertical: 'middle' }
      cellE.border = THIN_BORDER_ALL

      // Col F — time (always 5:00)
      const cellF = row.getCell(6)
      cellF.value = hasScore ? '5:00' : ''
      cellF.font = { size: dataFontSize, name: 'Angsana New', color: { theme: 1 } }
      cellF.alignment = { horizontal: 'center', vertical: 'middle' }
      cellF.border = THIN_BORDER_ALL

      // Cols G-L — empty penalty/adjustment columns
      for (let c = 7; c <= 12; c++) {
        const cell = row.getCell(c)
        cell.value = ''
        cell.font = { size: dataFontSize, name: 'Angsana New', color: { theme: 1 } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = THIN_BORDER_ALL
      }

      // Col M — award
      const cellM = row.getCell(13)
      cellM.value = hasScore ? getAward(rank, participated.length) : ''
      cellM.font = { size: dataFontSize, name: 'Angsana New', color: { theme: 1 } }
      cellM.alignment = { vertical: 'middle' }
      cellM.border = THIN_BORDER_ALL

      currentRow++
    }

    isFirstLevel = false
    currentRow += 3
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const label = isMath ? 'Mathematics' : 'English'
  a.download = `${label}-results-${competitionId.slice(0, 8)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportCSVForCanva(subject, competitionId) {
  const { data: allSessions } = await supabase
    .from('competition_sessions')
    .select('*')
    .eq('competition_id', competitionId)
    .eq('subject', subject)

  if (!allSessions) throw new Error('No sessions found')

  const isMath = subject === 'math'
  const levelLabels = isMath ? MATH_LEVEL_LABELS : ENG_LEVEL_LABELS

  const CSV_HEADERS = ['ลำดับ', 'รายชื่อ', 'สาขา', 'ชื่อเล่น', 'ระดับ', 'ข้อถูก', 'นาที', 'รางวัลที่ได้']

  const rows = []
  const levels = [...new Set(allSessions.map(s => s.level))].sort((a, b) => a - b)

  for (const level of levels) {
    const levelSessions = allSessions.filter(s => s.level === level)
    const participated = levelSessions
      .filter(s => s.validated_score != null)
      .sort((a, b) => b.validated_score - a.validated_score || a.time_spent_seconds - b.time_spent_seconds)

    let rankCounter = 1
    for (const s of participated) {
      const rank = rankCounter++
      rows.push([
        rank,
        s.name || '',
        s.school || '',
        s.nickname || '',
        levelLabels[level] || `Level ${level}`,
        s.validated_score,
        '5:00',
        getAward(rank, participated.length),
      ])
    }
  }

  const esc = v => {
    const str = String(v ?? '')
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }

  const csv = '﻿' + [CSV_HEADERS.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const label = isMath ? 'Mathematics' : 'English'
  a.download = `${label}-canva-${competitionId.slice(0, 8)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
