import { jsPDF } from 'jspdf'

const FLAG_CDN = 'https://flagcdn.com/w80'

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

export async function generateCertificate({ name, rank, score, totalQuestions, level, school, country, eventName, competitionId, date }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const w = 297
  const h = 210

  // Background
  doc.setFillColor(250, 250, 255)
  doc.rect(0, 0, w, h, 'F')

  // Border
  doc.setDrawColor(79, 70, 229)
  doc.setLineWidth(2)
  doc.rect(10, 10, w - 20, h - 20)
  doc.setLineWidth(0.5)
  doc.rect(13, 13, w - 26, h - 26)

  // Header
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(120, 120, 140)
  doc.text('CERTIFICATE OF ACHIEVEMENT', w / 2, 35, { align: 'center' })

  // Event name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(79, 70, 229)
  doc.text(eventName || 'International English Spelling & Math Championship', w / 2, 50, { align: 'center' })

  // Presented to
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(100, 100, 120)
  doc.text('This certificate is presented to', w / 2, 68, { align: 'center' })

  // Student name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  doc.setTextColor(30, 30, 60)
  doc.text(name || 'Student', w / 2, 85, { align: 'center' })

  // Underline
  const nameWidth = doc.getTextWidth(name || 'Student')
  doc.setDrawColor(79, 70, 229)
  doc.setLineWidth(0.8)
  doc.line(w / 2 - nameWidth / 2 - 5, 88, w / 2 + nameWidth / 2 + 5, 88)

  // School
  if (school) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.setTextColor(100, 100, 120)
    doc.text(school, w / 2, 98, { align: 'center' })
  }

  // Achievement line
  const achievementY = school ? 112 : 105
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(60, 60, 80)

  if (rank != null) {
    const mod100 = rank % 100
    const rankSuffix = (mod100 >= 11 && mod100 <= 13) ? 'th' : rank % 10 === 1 ? 'st' : rank % 10 === 2 ? 'nd' : rank % 10 === 3 ? 'rd' : 'th'
    doc.text(
      `Achieved ${rank}${rankSuffix} place — Level ${level}`,
      w / 2, achievementY, { align: 'center' }
    )
  } else {
    doc.text(
      `Completed Level ${level}`,
      w / 2, achievementY, { align: 'center' }
    )
  }

  // Score
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(79, 70, 229)
  doc.text(`Score: ${score} / ${totalQuestions}`, w / 2, achievementY + 12, { align: 'center' })

  // Country flag
  if (country) {
    const flagUrl = `${FLAG_CDN}/${country.toLowerCase()}.png`
    const flagData = await loadImageAsDataUrl(flagUrl)
    if (flagData) {
      try {
        doc.addImage(flagData, 'PNG', w / 2 - 8, achievementY + 18, 16, 10)
      } catch {}
    }
  }

  // Date and competition ID
  const footerY = h - 30
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(150, 150, 160)

  const displayDate = date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.text(displayDate, 40, footerY, { align: 'center' })
  if (competitionId && competitionId !== 'default') {
    doc.text(competitionId, w - 40, footerY, { align: 'center' })
  }

  // Footer line
  doc.setDrawColor(200, 200, 210)
  doc.setLineWidth(0.3)
  doc.line(30, footerY - 6, w - 30, footerY - 6)

  return doc
}

export async function downloadCertificate(data) {
  const doc = await generateCertificate(data)
  doc.save(`certificate-${(data.name || 'student').replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

export async function downloadBatchCertificates(students, eventName, competitionId, onProgress) {
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
    doc.save(`certificate-${(s.name || 'student').replace(/\s+/g, '-').toLowerCase()}.pdf`)

    if (onProgress) onProgress(i + 1, total)

    // Yield to UI every 5 certificates to prevent browser freeze
    if ((i + 1) % 5 === 0) {
      await new Promise(r => setTimeout(r, 50))
    }
  }
}
