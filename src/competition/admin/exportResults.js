import { supabase } from '../supabaseClient'

import { MATH_GRADE_LABELS } from '../mathGradeLabels'

const MATH_LEVEL_LABELS = MATH_GRADE_LABELS

const ENG_LEVEL_LABELS = {
  1: 'English Level 1',
  2: 'English Level 2',
  3: 'English Level 3',
  4: 'English Level 4',
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function getAward(rank, tiers) {
  const t = tiers || { trophy: 3, gold: 3, silver: 3, bronze: 3 }
  let cutoff = 0
  cutoff += t.trophy; if (rank <= cutoff) return `${ordinal(rank)} Place Award`
  cutoff += t.gold; if (rank <= cutoff) return 'Gold Medal Award'
  cutoff += t.silver; if (rank <= cutoff) return 'Silver Medal Award'
  cutoff += t.bronze; if (rank <= cutoff) return 'Bronze Medal Award'
  return ''
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

// A4 landscape ~143 chars printable. Visible cols: A,B,C,D,E,F,M
const COL_WIDTHS = [5, 50, 22, 16, 8, 7, 4, 2.5, 8.5, 3, 5.5, 5.5, 35]

export async function exportFromTemplate(subject, competitionId, tiers) {
  const [{ data: allSessions }, { data: stateData }] = await Promise.all([
    supabase.from('competition_sessions').select('*').eq('competition_id', competitionId).eq('subject', subject),
    supabase.from('competition_state').select('duration_seconds').eq('id', subject).single(),
  ])

  if (!allSessions) throw new Error('No sessions found')
  const durationMinutes = Math.round((stateData?.duration_seconds || 300) / 60)

  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Wonderkids Championship'

  const isMath = subject === 'math'
  const levelLabels = isMath ? MATH_LEVEL_LABELS : ENG_LEVEL_LABELS
  const headerMainFill = isMath ? YELLOW_FILL : CYAN_FILL
  const headerSmallFill = isMath ? GRAY_FILL : CYAN_FILL

  const ws = wb.addWorksheet('E')
  ws.columns = COL_WIDTHS.map(w => ({ width: w }))
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

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
    headerRow.height = 30
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

    // Data rows
    let rowNum = 1
    let scoreRank = 1
    for (const s of sorted) {
      const row = ws.getRow(currentRow)
      row.height = 30
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
      cellF.value = durationMinutes
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
      cellM.value = hasScore ? getAward(rank, tiers) : ''
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

export async function exportCSVForCanva(subject, competitionId, tiers) {
  const { data: allSessions } = await supabase
    .from('competition_sessions')
    .select('*')
    .eq('competition_id', competitionId)
    .eq('subject', subject)

  if (!allSessions) throw new Error('No sessions found')

  const isMath = subject === 'math'
  const levelLabels = isMath ? MATH_LEVEL_LABELS : ENG_LEVEL_LABELS

  const CSV_HEADERS = ['ลำดับ', 'รายชื่อ', 'สาขา', 'ชื่อเล่น', 'ระดับ', 'ข้อถูก', 'รางวัลที่ได้']

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
        getAward(rank, tiers),
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
