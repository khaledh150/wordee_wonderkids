/**
 * Generate a printable HTML page of participant code cards.
 * Each card shows: Name, Display ID, School, Level, Participant Code, and a QR code
 * linking to the app URL (not pre-filled with the student's code).
 *
 * Usage:
 *   node scripts/printCodes.js <codes-json> <app-url> [output-html]
 *
 * Example:
 *   node scripts/printCodes.js data/roster-codes.json https://wordee.vercel.app/play codes.html
 *
 * Then open codes.html in a browser and print (Ctrl+P / Cmd+P).
 * Cards are sized for cutting — 3 per row on A4.
 */

import { readFileSync, writeFileSync } from 'fs'

function main() {
  const [jsonPath, appUrl, outputPath = 'codes.html'] = process.argv.slice(2)
  if (!jsonPath || !appUrl) {
    console.error('Usage: node scripts/printCodes.js <codes-json> <app-url> [output-html]')
    console.error('Example: node scripts/printCodes.js data/roster-codes.json https://wordee.vercel.app/play')
    process.exit(1)
  }

  let participants
  try {
    participants = JSON.parse(readFileSync(jsonPath, 'utf8'))
  } catch (err) {
    console.error(`Failed to read ${jsonPath}:`, err.message)
    process.exit(1)
  }

  // QR code via a public API (no dependency needed) — encodes the app URL only
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(appUrl)}`

  const cards = participants.map(p => `
    <div class="card">
      <div class="card-header">${escapeHtml(p.subject?.toUpperCase() || '')} — Level ${p.level}</div>
      <div class="card-name">${escapeHtml(p.name)}</div>
      <div class="card-school">${escapeHtml(p.school || '')}</div>
      <div class="card-id">ID: ${escapeHtml(p.display_id || '')}</div>
      <div class="card-code">${escapeHtml(p.participant_code)}</div>
      <div class="card-qr"><img src="${qrUrl}" alt="QR" width="100" height="100"></div>
      <div class="card-hint">Scan QR to open app, then enter your code above</div>
    </div>
  `).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Competition Codes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 12px;
    }
    .card {
      border: 2px solid #333;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .card-header {
      font-size: 11px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .card-name {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .card-school {
      font-size: 11px;
      color: #555;
      margin-bottom: 4px;
    }
    .card-id {
      font-size: 11px;
      color: #888;
      margin-bottom: 8px;
    }
    .card-code {
      font-size: 24px;
      font-weight: 900;
      font-family: 'Courier New', monospace;
      letter-spacing: 3px;
      background: #f0f0f0;
      border-radius: 6px;
      padding: 6px 0;
      margin-bottom: 8px;
    }
    .card-qr { margin-bottom: 4px; }
    .card-qr img { display: inline-block; }
    .card-hint {
      font-size: 9px;
      color: #999;
    }
    @media print {
      body { margin: 0; }
      .grid { padding: 4px; gap: 4px; }
      .card { border-width: 1px; }
    }
  </style>
</head>
<body>
  <div class="grid">
    ${cards}
  </div>
</body>
</html>`

  writeFileSync(outputPath, html)
  console.log(`Generated ${participants.length} code cards → ${outputPath}`)
  console.log('Open in a browser and print (Ctrl+P). Cards are 3-per-row on A4.')
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

main()
