/**
 * Load a roster JSON into the ACTIVE competition directly via Supabase REST API.
 * Auto-fetches the current competition_id from competition_state — no manual ID needed.
 * Also outputs a codes manifest JSON (for printing sticker cards).
 *
 * Usage:
 *   node scripts/loadRoster.js <path-to-json>
 *
 * JSON format (array) — one row per student:
 *   [
 *     {
 *       "name": "Somchai K.",
 *       "school": "Bangkok International School",
 *       "country": "th",
 *       "english_level": 2,
 *       "math_level": 1,
 *       "participant_code": ""  // leave blank to auto-generate 4-digit code
 *     },
 *     ...
 *   ]
 */

import { readFileSync, writeFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const content = readFileSync(resolve(__dirname, '..', '.env'), 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.+)/)
    if (m) env[m[1].trim()] = m[2].trim()
  }
  return env
}

function generateCode() {
  const n = randomBytes(2).readUInt16BE(0) % 10000
  return String(n).padStart(4, '0')
}

async function main() {
  const [jsonPath] = process.argv.slice(2)
  if (!jsonPath) {
    console.error('Usage: node scripts/loadRoster.js <path-to-json>')
    console.error('\nAuto-fetches the active competition_id from Supabase.')
    process.exit(1)
  }

  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const headers = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }

  // Auto-fetch active competition_id
  const stateRes = await fetch(`${supabaseUrl}/rest/v1/competition_state?select=competition_id&limit=1`, { headers })
  if (!stateRes.ok) { console.error('Failed to fetch competition_state:', stateRes.status); process.exit(1) }
  const stateData = await stateRes.json()
  if (!stateData.length) { console.error('No competition_state rows found'); process.exit(1) }
  const competitionId = stateData[0].competition_id
  console.error(`Active competition: ${competitionId}`)

  // Fetch existing codes to avoid collisions
  const codesRes = await fetch(`${supabaseUrl}/rest/v1/competition_sessions?competition_id=eq.${competitionId}&select=participant_code&limit=5000`, { headers })
  const usedCodes = new Set(codesRes.ok ? (await codesRes.json()).map(r => r.participant_code) : [])
  console.error(`Existing codes: ${usedCodes.size}`)

  let raw
  try { raw = JSON.parse(readFileSync(jsonPath, 'utf8')) }
  catch (err) { console.error(`Failed to read/parse ${jsonPath}:`, err.message); process.exit(1) }

  if (!Array.isArray(raw) || raw.length === 0) {
    console.error('JSON must be a non-empty array of participant objects.')
    process.exit(1)
  }

  const participants = []
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!item.name) { console.error(`Row ${i} missing name:`, item); process.exit(1) }

    let code = item.participant_code?.trim()
    if (!code) {
      do { code = generateCode() } while (usedCodes.has(code))
    }
    usedCodes.add(code)

    const base = {
      competition_id: competitionId,
      participant_code: code,
      display_id: item.display_id || `${(item.country || 'XX').toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      name: item.name,
      nickname: item.nickname || null,
      school: item.school || null,
      country: item.country?.toLowerCase() || null,
    }

    if (item.english_level) participants.push({ ...base, subject: 'english', level: Number(item.english_level) })
    if (item.math_level) participants.push({ ...base, subject: 'math', level: Number(item.math_level) })
    if (!item.english_level && !item.math_level && item.subject && item.level) {
      participants.push({ ...base, subject: item.subject, level: Number(item.level) })
    }
  }

  console.error(`Inserting ${participants.length} rows (${raw.length} students)...`)

  const res = await fetch(`${supabaseUrl}/rest/v1/competition_sessions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(participants),
  })

  if (!res.ok) { console.error(`Insert failed: ${res.status} ${await res.text()}`); process.exit(1) }
  console.error(`Done! ${participants.length} rows upserted into ${competitionId}`)

  const manifest = participants.map(p => ({
    name: p.name, display_id: p.display_id, school: p.school, country: p.country,
    subject: p.subject, level: p.level, participant_code: p.participant_code,
  }))
  const manifestPath = jsonPath.replace(/\.json$/, '') + '-codes.json'
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.error(`Code manifest saved to: ${manifestPath}`)
}

main()
