const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:\\Apps and Games Dev\\wordee\\.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const MATH_LEVEL_PREFIXES = [
  ['Kindergarten', 1], ['Grade 1', 2], ['Grade 2', 3], ['Grade 3', 4],
  ['Grade 4', 5], ['Grade 5', 6], ['Grade 6', 7], ['High-school', 8], ['Highschool', 8],
];
const ENG_LEVEL_PREFIXES = [
  ['English Level 1', 1], ['English Level 2', 2], ['English Level 3', 3], ['English Level 4', 4],
];

function matchLevel(name, prefixes) {
  for (const [prefix, lvl] of prefixes) {
    if (name.startsWith(prefix)) return lvl;
  }
  return null;
}

function parseRosterWithNicknames(filename) {
  const wb = XLSX.readFile(filename);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const levels = {};
  let currentLevel = null;
  for (let r = 0; r <= range.e.r; r++) {
    const c0 = sheet[XLSX.utils.encode_cell({r, c:0})];
    const c1 = sheet[XLSX.utils.encode_cell({r, c:1})];
    const c2 = sheet[XLSX.utils.encode_cell({r, c:2})];
    const c3 = sheet[XLSX.utils.encode_cell({r, c:3})];
    const c0v = c0 ? String(c0.v).trim() : '';
    const c1v = c1 ? String(c1.v).trim() : '';
    const c2v = c2 ? String(c2.v).trim() : '';
    const c3v = c3 ? String(c3.v).trim() : '';
    if (c0v && c0v !== 'ลำดับ' && !c1v) { currentLevel = c0v; levels[currentLevel] = []; continue; }
    if (c0v === 'ลำดับ') continue;
    if (c1v && currentLevel) levels[currentLevel].push({ name: c1v, school: c2v || null, nickname: c3v || null });
  }
  return levels;
}

function generateCode(usedCodes) {
  const used = new Set(usedCodes);
  let attempts = 0;
  let code;
  do {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const n = buf[0] % 10000;
    code = String(n).padStart(4, '0');
    if (++attempts > 100) throw new Error('Code space exhausted');
  } while (used.has(code));
  return code;
}

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');
  const EXECUTE = process.argv.includes('--execute');

  if (!DRY_RUN && !EXECUTE) {
    console.log('Usage: node upload-roster.js --dry-run   (preview only)');
    console.log('       node upload-roster.js --execute   (actually upload)');
    process.exit(0);
  }

  // 1. Get current competition_id
  const { data: states, error: stateErr } = await supabase.from('competition_state').select('*');
  if (stateErr) { console.error('Failed to get state:', stateErr.message); process.exit(1); }

  const compId = states[0].competition_id;
  console.log('Competition ID:', compId);
  console.log('English unlocked:', states.find(s => s.id === 'english')?.is_unlocked);
  console.log('Math unlocked:', states.find(s => s.id === 'math')?.is_unlocked);

  if (states.some(s => s.is_unlocked)) {
    console.error('ABORT: Competition is currently unlocked!');
    process.exit(1);
  }

  // 2. Parse Excel files
  const math = parseRosterWithNicknames('c:\\Apps and Games Dev\\wordee\\roster\\Mathematics.xlsx');
  const eng = parseRosterWithNicknames('c:\\Apps and Games Dev\\wordee\\roster\\English Name-student.xlsx');

  // 3. Build unified student map
  const students = new Map();

  Object.entries(math).forEach(([lvlName, entries]) => {
    const lvl = matchLevel(lvlName, MATH_LEVEL_PREFIXES);
    if (!lvl) { console.error('UNKNOWN MATH LEVEL:', lvlName); process.exit(1); }
    entries.forEach(({ name, school, nickname }) => {
      if (!students.has(name)) students.set(name, {});
      const s = students.get(name);
      s.mathLevel = lvl;
      if (school && !s.school) s.school = school;
      if (nickname && !s.nickname) s.nickname = nickname;
    });
  });

  Object.entries(eng).forEach(([lvlName, entries]) => {
    const lvl = matchLevel(lvlName, ENG_LEVEL_PREFIXES);
    if (!lvl) { console.error('UNKNOWN ENG LEVEL:', lvlName); process.exit(1); }
    entries.forEach(({ name, school, nickname }) => {
      if (!students.has(name)) students.set(name, {});
      const s = students.get(name);
      s.engLevel = lvl;
      if (school && !s.school) s.school = school;
      if (nickname && !s.nickname) s.nickname = nickname;
    });
  });

  // 4. Generate codes and build insert rows
  const usedCodes = [];
  const inserts = [];
  let displayNum = 1;

  for (const [name, info] of students) {
    const code = generateCode(usedCodes);
    usedCodes.push(code);
    const displayId = `XX-${String(displayNum++).padStart(3, '0')}`;

    const base = {
      competition_id: compId,
      participant_code: code,
      display_id: displayId,
      name: name,
      nickname: info.nickname || null,
      school: info.school || null,
      status: 'waiting',
    };

    if (info.mathLevel) {
      inserts.push({ ...base, subject: 'math', level: info.mathLevel });
    }
    if (info.engLevel) {
      inserts.push({ ...base, subject: 'english', level: info.engLevel });
    }
  }

  // Summary
  console.log('\nTotal unique students:', students.size);
  console.log('With school:', [...students.values()].filter(s => s.school).length);
  console.log('With nicknames:', [...students.values()].filter(s => s.nickname).length);
  console.log('Session rows to insert:', inserts.length);

  const summary = {};
  inserts.forEach(r => {
    const key = `${r.subject} L${r.level}`;
    summary[key] = (summary[key] || 0) + 1;
  });
  console.log('\n=== BREAKDOWN ===');
  Object.entries(summary).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log('\n=== ALL STUDENTS ===');
  let i = 1;
  for (const [name, info] of students) {
    const nick = info.nickname ? ` (${info.nickname})` : '';
    const sch = info.school ? ` [${info.school}]` : '';
    const code = usedCodes[i-1];
    console.log(`  ${String(i++).padStart(3)}. [${code}] ${name}${nick}${sch} -> Math:${info.mathLevel || '-'} Eng:${info.engLevel || '-'}`);
  }

  if (DRY_RUN) {
    console.log('\n=== DRY RUN COMPLETE - No changes made ===');
    return;
  }

  // 5. DELETE all existing sessions AND history
  console.log('\n--- CLEARING ALL existing data ---');
  const { error: delSubErr } = await supabase
    .from('competition_submissions')
    .delete({ count: 'exact' })
    .neq('participant_id', '00000000-0000-0000-0000-000000000000');
  if (delSubErr) console.log('  Submissions clear:', delSubErr.message);
  else console.log('  Submissions cleared');

  const { error: delErr, count: delCount } = await supabase
    .from('competition_sessions')
    .delete({ count: 'exact' })
    .neq('participant_id', '00000000-0000-0000-0000-000000000000');
  if (delErr) { console.error('DELETE sessions failed:', delErr.message); process.exit(1); }
  console.log('  Sessions deleted:', delCount, 'rows');

  const { error: delHistErr } = await supabase
    .from('competition_history')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (delHistErr) console.log('  History clear:', delHistErr.message);
  else console.log('  History cleared');

  // 6. INSERT one by one, verifying each
  console.log('\n--- INSERTING', inserts.length, 'rows ONE BY ONE ---');
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < inserts.length; i++) {
    const row = inserts[i];
    const { error: insErr } = await supabase.from('competition_sessions').insert(row);
    if (insErr) {
      console.error(`  FAIL #${i+1}: ${row.name} (${row.subject} L${row.level}): ${insErr.message}`);
      failed++;
    } else {
      inserted++;
      const nick = row.nickname ? ` (${row.nickname})` : '';
      const sch = row.school ? ` [${row.school}]` : '';
      console.log(`  OK #${String(i+1).padStart(3)}: [${row.participant_code}] ${row.name}${nick}${sch} -> ${row.subject} L${row.level}`);
    }
  }
  console.log(`\nInserted: ${inserted} | Failed: ${failed}`);

  // 7. Verify
  const { data: verify } = await supabase
    .from('competition_sessions')
    .select('subject, level, name, nickname, participant_code')
    .eq('competition_id', compId)
    .order('subject')
    .order('level');

  const verifySummary = {};
  verify.forEach(r => {
    const key = `${r.subject} L${r.level}`;
    verifySummary[key] = (verifySummary[key] || 0) + 1;
  });

  console.log('\n=== VERIFICATION ===');
  console.log('Expected:', inserts.length, '| Actual:', verify.length);
  Object.entries(verifySummary).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(verify.length === inserts.length ? '\n✓ SUCCESS!' : '\n✗ MISMATCH!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
