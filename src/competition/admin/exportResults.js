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

function getAward(rank) {
  let prize
  if (rank <= 3) prize = 'Trophy'
  else if (rank <= 6) prize = 'Gold Medal'
  else if (rank <= 9) prize = 'Silver Medal'
  else if (rank <= 12) prize = 'Bronze Medal'
  else prize = 'Certificate'
  return `Rank ${rank} (${prize})`
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

const CYAN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' }, bgColor: { argb: 'FF00FFFF' } }
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { argb: 'FFFFFF00' } }
const GRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA5A5A5' }, bgColor: { argb: 'FFA5A5A5' } }

function measureCol(allSessions, key, minWidth) {
  let max = minWidth
  for (const s of allSessions) {
    const val = s[key] || ''
    const len = val.length * 1.3 + 2
    if (len > max) max = len
  }
  return Math.min(max, 50)
}

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
  const headerMainFill = isMath ? YELLOW_FILL : CYAN_FILL
  const headerSmallFill = isMath ? GRAY_FILL : CYAN_FILL

  const nameW = measureCol(allSessions, 'name', 20)
  const schoolW = measureCol(allSessions, 'school', 10)
  const nickW = measureCol(allSessions, 'nickname', 8)
  const colWidths = [5, nameW, schoolW, nickW, 7, 6, 4, 2.5, 8.5, 3, 5.5, 5.5, 16]

  const ws = wb.addWorksheet('E')
  ws.columns = colWidths.map(w => ({ width: w }))
  ws.pageSetup = { orientation: 'landscape', paperSize: 9 }

  for (let c = 7; c <= 12; c++) {
    ws.getColumn(c).hidden = true
  }

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
    titleCell.font = { bold: true, size: 28, name: 'CordiaUPC', color: { theme: 1 } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.border = TITLE_BORDER
    ws.getRow(currentRow).height = 45
    currentRow++

    // Header row
    const headerRow = ws.getRow(currentRow)
    headerRow.height = 28
    ws.mergeCells(`G${currentRow}:H${currentRow}`)
    ws.mergeCells(`I${currentRow}:J${currentRow}`)

    for (let c = 1; c <= 13; c++) {
      const cell = headerRow.getCell(c)
      cell.value = THAI_HEADERS[c - 1]
      const isSmall = c >= 7 && c <= 12
      cell.font = { bold: true, size: isSmall ? 14 : 18, name: 'Angsana New', color: { theme: 1 } }
      cell.fill = isSmall ? headerSmallFill : headerMainFill
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = THIN_BORDER_ALL
    }
    currentRow++

    // Data rows — number ALL students sequentially
    let rowNum = 1
    let scoreRank = 1
    for (const s of sorted) {
      const row = ws.getRow(currentRow)
      row.height = 26
      const hasScore = s.validated_score != null
      const rank = hasScore ? scoreRank++ : null
      const fontSize = 20

      const cellA = row.getCell(1)
      cellA.value = rowNum++
      cellA.font = { bold: true, size: fontSize, name: 'Angsana New', color: { theme: 1 } }
      cellA.alignment = { horizontal: 'center', vertical: 'middle' }
      cellA.border = THIN_BORDER_ALL

      const cellB = row.getCell(2)
      cellB.value = s.name || ''
      cellB.font = { size: fontSize, name: 'Angsana New', color: { theme: 1 } }
      cellB.alignment = { horizontal: 'left', vertical: 'middle' }
      cellB.border = THIN_BORDER_ALL

      const cellC = row.getCell(3)
      cellC.value = s.school || ''
      cellC.font = { size: fontSize, name: 'Angsana New', color: { theme: 1 } }
      cellC.alignment = { vertical: 'middle' }
      cellC.border = THIN_BORDER_ALL

      const cellD = row.getCell(4)
      cellD.value = s.nickname || ''
      cellD.font = { size: fontSize, name: 'AngsanaUPC', color: { theme: 1 } }
      cellD.alignment = { horizontal: 'center', vertical: 'middle' }
      cellD.border = THIN_BORDER_ALL

      const cellE = row.getCell(5)
      cellE.value = hasScore ? s.validated_score : ''
      cellE.font = { size: fontSize, name: 'Angsana New', color: { theme: 1 } }
      cellE.alignment = { horizontal: 'center', vertical: 'middle' }
      cellE.border = THIN_BORDER_ALL

      const cellF = row.getCell(6)
      cellF.value = hasScore ? '5:00' : ''
      cellF.font = { size: fontSize, name: 'Angsana New', color: { theme: 1 } }
      cellF.alignment = { horizontal: 'center', vertical: 'middle' }
      cellF.border = THIN_BORDER_ALL

      for (let c = 7; c <= 12; c++) {
        const cell = row.getCell(c)
        cell.value = ''
        cell.font = { size: fontSize, name: 'Angsana New', color: { theme: 1 } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = THIN_BORDER_ALL
      }

      const cellM = row.getCell(13)
      cellM.value = hasScore ? getAward(rank) : ''
      cellM.font = { size: fontSize, name: 'Angsana New', color: { theme: 1 } }
      cellM.alignment = { vertical: 'middle' }
      cellM.border = THIN_BORDER_ALL

      currentRow++
    }

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
        getAward(rank),
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
