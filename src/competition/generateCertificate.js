import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

const FLAG_CDN = 'https://flagcdn.com/w80'
const THAI_RE = /[฀-๿]/
const VERIFY_BASE = typeof window !== 'undefined' ? window.location.origin : 'https://wordee-wonderkids.vercel.app'

let thaifontsLoaded = false
async function ensureThaiFonts(doc) {
  if (thaifontsLoaded) return true
  try {
    const [regular, bold] = await Promise.all([
      fetch('/fonts/Sarabun-Regular.ttf').then(r => r.arrayBuffer()),
      fetch('/fonts/Sarabun-Bold.ttf').then(r => r.arrayBuffer()),
    ])
    doc.addFileToVFS('Sarabun-Regular.ttf', btoa(String.fromCharCode(...new Uint8Array(regular))))
    doc.addFileToVFS('Sarabun-Bold.ttf', btoa(String.fromCharCode(...new Uint8Array(bold))))
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold')
    thaifontsLoaded = true
    return true
  } catch {
    return false
  }
}

async function loadImageAsDataUrl(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function loadLogoAsDataUrl() {
  try {
    const logoModule = await import('../assets/logo.webp')
    return await loadImageAsDataUrl(logoModule.default)
  } catch {
    return null
  }
}

function rankSuffix(rank) {
  const mod100 = rank % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  if (rank % 10 === 1) return 'st'
  if (rank % 10 === 2) return 'nd'
  if (rank % 10 === 3) return 'rd'
  return 'th'
}

function drawRoundedRect(doc, x, y, w, h, r) {
  doc.roundedRect(x, y, w, h, r, r)
}

export async function generateCertificate({ name, rank, score, totalQuestions, level, school, country, eventName, competitionId, date }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const w = 297
  const h = 210
  const cx = w / 2

  const hasThai = [name, school, eventName].some(s => s && THAI_RE.test(s))
  const thaiFontsOk = hasThai ? await ensureThaiFonts(doc) : false
  const textFont = thaiFontsOk ? 'Sarabun' : 'helvetica'

  // ── Background gradient (warm cream) ──
  doc.setFillColor(255, 252, 247)
  doc.rect(0, 0, w, h, 'F')

  // Subtle radial accent circles
  doc.setFillColor(238, 232, 255)
  doc.circle(50, 40, 60, 'F')
  doc.setFillColor(255, 240, 230)
  doc.circle(250, 170, 55, 'F')
  doc.setFillColor(230, 245, 255)
  doc.circle(270, 30, 35, 'F')

  // Overlay to soften the circles
  doc.setGState(new doc.GState({ opacity: 0.85 }))
  doc.setFillColor(255, 252, 247)
  doc.rect(0, 0, w, h, 'F')
  doc.setGState(new doc.GState({ opacity: 1 }))

  // ── Outer border frame ──
  doc.setDrawColor(99, 82, 175)
  doc.setLineWidth(2.5)
  doc.roundedRect(8, 8, w - 16, h - 16, 4, 4)

  // Inner decorative border
  doc.setDrawColor(186, 172, 230)
  doc.setLineWidth(0.6)
  doc.roundedRect(12, 12, w - 24, h - 24, 3, 3)

  // Corner accents (small diamond shapes at corners)
  const corners = [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]]
  doc.setFillColor(99, 82, 175)
  for (const [cx2, cy] of corners) {
    doc.circle(cx2, cy, 1.8, 'F')
  }

  // ── Logo ──
  const logoData = await loadLogoAsDataUrl()
  if (logoData) {
    try {
      doc.addImage(logoData, 'WEBP', cx - 18, 16, 36, 28)
    } catch {}
  }

  const topY = logoData ? 48 : 32

  // ── "CERTIFICATE OF ACHIEVEMENT" header ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(160, 145, 195)
  doc.setCharSpace(3)
  doc.text('CERTIFICATE OF ACHIEVEMENT', cx, topY, { align: 'center' })
  doc.setCharSpace(0)

  // Decorative line under header
  doc.setDrawColor(186, 172, 230)
  doc.setLineWidth(0.4)
  const lineHalfW = 55
  doc.line(cx - lineHalfW, topY + 3, cx - 8, topY + 3)
  doc.line(cx + 8, topY + 3, cx + lineHalfW, topY + 3)
  // Small diamond in center of line
  doc.setFillColor(99, 82, 175)
  const dY = topY + 3
  doc.triangle(cx - 2.5, dY, cx, dY - 2, cx + 2.5, dY, 'F')
  doc.triangle(cx - 2.5, dY, cx, dY + 2, cx + 2.5, dY, 'F')

  // ── Event name ──
  doc.setFont(textFont, 'bold')
  doc.setFontSize(16)
  doc.setTextColor(68, 55, 130)
  const displayEvent = eventName || 'International English Spelling & Math Championship'
  doc.text(displayEvent, cx, topY + 14, { align: 'center', maxWidth: w - 60 })

  // ── "Presented to" ──
  doc.setFont(textFont === 'Sarabun' ? 'Sarabun' : 'helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(140, 130, 170)
  doc.text('This certificate is proudly presented to', cx, topY + 26, { align: 'center' })

  // ── Student name ──
  const studentName = name || 'Student'
  doc.setFont(textFont, 'bold')
  doc.setFontSize(30)
  doc.setTextColor(35, 25, 70)
  doc.text(studentName, cx, topY + 42, { align: 'center' })

  // Elegant underline
  const nameW = doc.getTextWidth(studentName)
  const ulHalf = Math.max(nameW / 2 + 8, 40)
  doc.setDrawColor(99, 82, 175)
  doc.setLineWidth(1)
  doc.line(cx - ulHalf, topY + 45, cx + ulHalf, topY + 45)
  doc.setLineWidth(0.3)
  doc.line(cx - ulHalf + 5, topY + 47, cx + ulHalf - 5, topY + 47)

  // ── School ──
  let infoY = topY + 55
  if (school) {
    doc.setFont(textFont, 'normal')
    doc.setFontSize(12)
    doc.setTextColor(120, 110, 150)
    doc.text(school, cx, infoY, { align: 'center' })
    infoY += 10
  }

  // ── Achievement cards row ──
  const cardW = 52
  const cardH = 26
  const cardGap = 8
  const pct = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0

  const cards = []
  if (rank != null) {
    cards.push({ label: 'RANK', value: `${rank}${rankSuffix(rank)}`, accent: [218, 165, 32] })
  }
  cards.push({ label: 'SCORE', value: `${score} / ${totalQuestions}`, accent: [99, 82, 175] })
  cards.push({ label: 'ACCURACY', value: `${pct}%`, accent: [16, 185, 129] })
  cards.push({ label: 'LEVEL', value: `${level}`, accent: [59, 130, 246] })

  const totalCardsW = cards.length * cardW + (cards.length - 1) * cardGap
  let cardX = cx - totalCardsW / 2

  for (const card of cards) {
    // Card background
    doc.setFillColor(248, 246, 255)
    doc.setDrawColor(220, 215, 240)
    doc.setLineWidth(0.4)
    drawRoundedRect(doc, cardX, infoY, cardW, cardH, 3)
    doc.rect(cardX, infoY, cardW, cardH, 'FD')

    // Top accent bar
    doc.setFillColor(...card.accent)
    doc.rect(cardX + 2, infoY, cardW - 4, 1.5, 'F')

    // Label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 140, 175)
    doc.setCharSpace(1.5)
    doc.text(card.label, cardX + cardW / 2, infoY + 8, { align: 'center' })
    doc.setCharSpace(0)

    // Value
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...card.accent)
    doc.text(card.value, cardX + cardW / 2, infoY + 19, { align: 'center' })

    cardX += cardW + cardGap
  }

  // ── Country flag ──
  if (country) {
    const flagUrl = `${FLAG_CDN}/${country.toLowerCase()}.png`
    const flagData = await loadImageAsDataUrl(flagUrl)
    if (flagData) {
      try {
        doc.addImage(flagData, 'PNG', cx - 10, infoY + cardH + 4, 20, 13)
      } catch {}
    }
  }

  // ── Verification QR Code ──
  const qrSize = 22
  const qrX = w - 38
  const qrY = h - 42
  try {
    const verifyUrl = `${VERIFY_BASE}/verify?c=${encodeURIComponent(competitionId || '')}&n=${encodeURIComponent(name || '')}&s=${score}&l=${level}`
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1, color: { dark: '#443782', light: '#ffffff' } })
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5)
    doc.setTextColor(180, 175, 200)
    doc.text('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' })
  } catch {}

  // ── Footer ──
  const footerY = h - 28
  doc.setDrawColor(200, 195, 220)
  doc.setLineWidth(0.3)
  doc.line(30, footerY - 4, w - 30, footerY - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(160, 155, 175)

  const displayDate = date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.text(displayDate, 40, footerY, { align: 'center' })

  if (competitionId && competitionId !== 'default') {
    doc.text(competitionId, cx, footerY, { align: 'center' })
  }

  // Powered by Wonderkids
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(180, 175, 200)
  doc.text('Powered by Wonderkids Phonics', cx, footerY + 5, { align: 'center' })

  return doc
}

export async function downloadCertificate(data) {
  const doc = await generateCertificate(data)
  doc.save(`certificate-${(data.name || 'student').replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

export async function downloadBatchCertificates(students, eventName, competitionId, onProgress) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const total = students.length

  for (let i = 0; i < total; i++) {
    const s = students[i]
    const doc = await generateCertificate({
      name: s.name,
      rank: s.rank,
      score: s.validated_score,
      totalQuestions: s.totalQuestions || s.validated_score,
      level: s.level,
      school: s.school,
      country: s.country,
      eventName,
      competitionId,
    })
    const pdfBlob = doc.output('blob')
    const filename = `certificate-${(s.name || 'student').replace(/\s+/g, '-').replace(/[^\w-]/g, '').toLowerCase()}.pdf`
    zip.file(filename, pdfBlob)

    if (onProgress) onProgress(i + 1, total)

    if ((i + 1) % 5 === 0) {
      await new Promise(r => setTimeout(r, 10))
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `certificates-${competitionId}.zip`
  a.click()
  URL.revokeObjectURL(a.href)
}
