import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, SUBJECTS } from './supabaseClient'
import { getVocabForLevel } from '../data/vocabulary'

export default function AdminDashboard() {
  const [state, setState] = useState(null)
  const [sessions, setSessions] = useState([])
  const [subject, setSubject] = useState(SUBJECTS.ENGLISH)
  const [levelFilter, setLevelFilter] = useState(null)
  const [view, setView] = useState('live')
  const [announcement, setAnnouncement] = useState('')
  const [roundLabel, setRoundLabel] = useState('')
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [elapsed, setElapsed] = useState(null)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', school: '', country: 'th', level: 1 })
  const channelRef = useRef(null)

  const loadState = useCallback(async () => {
    const { data } = await supabase.from('competition_state').select('*').eq('id', subject).single()
    if (data) { setState(data); setAnnouncement(data.announcement || ''); setRoundLabel(data.round_label || '') }
  }, [subject])

  const loadSessions = useCallback(async () => {
    if (!state) return
    let q = supabase.from('competition_sessions').select('*').eq('competition_id', state.competition_id).eq('subject', subject)
    if (levelFilter) q = q.eq('level', levelFilter)
    const { data } = await q
    if (data) setSessions(data)
  }, [state, subject, levelFilter])

  useEffect(() => { loadState() }, [loadState])
  useEffect(() => { loadSessions() }, [loadSessions])
  useEffect(() => { const id = setInterval(loadState, 10_000); return () => clearInterval(id) }, [loadState])

  // Elapsed timer — ticks every second while competition is running
  useEffect(() => {
    if (!state?.started_at || !state?.is_unlocked) { setElapsed(null); return }
    const start = new Date(state.started_at).getTime()
    const allDone = sessions.length > 0 && sessions.filter(s => s.status !== 'waiting' || s.ready).every(s => s.status === 'completed')
    if (allDone && sessions.some(s => s.status === 'completed')) {
      const lastCompleted = Math.max(...sessions.filter(s => s.completed_at).map(s => new Date(s.completed_at).getTime()))
      setElapsed(Math.round((lastCompleted - start) / 1000))
      return
    }
    const id = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [state?.started_at, state?.is_unlocked, sessions])

  useEffect(() => {
    if (!state) return
    const ch = supabase.channel('admin-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_sessions', filter: `competition_id=eq.${state.competition_id}` }, () => loadSessions())
      .subscribe()
    channelRef.current = ch
    return () => supabase.removeChannel(ch)
  }, [state?.competition_id, loadSessions])

  function showDialog(message, onConfirm) {
    setDialog({ message, onConfirm: () => { setDialog(null); onConfirm() }, onCancel: () => setDialog(null) })
  }

  async function updateState(fields) {
    if (!state) return
    const { error } = await supabase.from('competition_state').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', subject)
    if (error) { showDialog('Update failed: ' + error.message, () => {}); return }
    await loadState()
  }

  async function toggleStart() {
    if (!state.is_unlocked) {
      if (!confirmStart) { setConfirmStart(true); return }
      await updateState({ is_unlocked: true, started_at: new Date().toISOString() })
    } else {
      showDialog('Stop the competition? Students can still submit but no new students can start.', async () => {
        await updateState({ is_unlocked: false })
      })
      return
    }
    setConfirmStart(false)
  }

  async function extendTime(min) { await updateState({ extra_seconds: (state.extra_seconds || 0) + min * 60 }) }
  async function saveAnnouncement() { await updateState({ announcement: announcement || null }) }
  async function saveRound() { await updateState({ round_label: roundLabel || null }) }
  async function setActiveLevel(lvl) { await updateState({ active_level: lvl || null }) }

  async function resetRound() {
    if (!confirmReset) { setConfirmReset(true); return }
    let q = supabase.from('competition_sessions').update({ status: 'waiting', provisional_score: 0, validated_score: null, questions_answered: 0, time_spent_seconds: 0, ready: false, answers_snapshot: null, started_at: null, completed_at: null, updated_at: new Date().toISOString() }).eq('competition_id', state.competition_id).eq('subject', subject)
    if (levelFilter) q = q.eq('level', levelFilter)
    await q
    await updateState({ is_unlocked: false, extra_seconds: 0 })
    setConfirmReset(false)
    await loadSessions()
  }

  async function logout() { await supabase.auth.signOut(); window.location.reload() }

  const levels = [...new Set(sessions.map(s => s.level))].sort((a, b) => a - b)
  const filtered = levelFilter ? sessions.filter(s => s.level === levelFilter) : sessions
  const readyCount = filtered.filter(s => s.ready).length
  const onlineCount = filtered.filter(s => isOnline(s)).length
  const offlineCount = filtered.filter(s => !isOnline(s) && s.status === 'waiting').length
  const activeCount = filtered.filter(s => s.status === 'active').length
  const completedCount = filtered.filter(s => s.status === 'completed').length
  const totalCount = filtered.length

  const liveSorted = [...filtered].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (b.status === 'completed' && a.status !== 'completed') return -1
    return b.provisional_score - a.provisional_score || a.time_spent_seconds - b.time_spent_seconds
  })

  const officialSorted = [...filtered].filter(s => s.validated_score != null).sort((a, b) => b.validated_score - a.validated_score || a.time_spent_seconds - b.time_spent_seconds)

  function exportCSV() {
    const h = ['Rank','Name','Display ID','School','Country','Level','Score','Time (s)']
    const r = officialSorted.map((s, i) => [i+1,s.name,s.display_id,s.school||'',s.country||'',s.level,s.validated_score,s.time_spent_seconds])
    const csv = [h,...r].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = `results-${subject}.csv`; a.click()
  }

  if (!state) return <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center text-white/30 text-xl">Loading...</div>

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Top Bar */}
      <div className="bg-[#0f1424] border-b border-white/5 px-6 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Competition Admin</h1>
          <div className="flex bg-white/5 rounded-lg p-0.5">
            {['english','math'].map(s => (
              <button key={s} onClick={() => { setSubject(s); setLevelFilter(null) }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${subject === s ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-white/40 hover:text-white/70'}`}
              >{s.charAt(0).toUpperCase()+s.slice(1)}</button>
            ))}
          </div>
          {state.round_label && <span className="text-sm text-white/30 bg-white/5 px-3 py-1 rounded-lg">{state.round_label}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/20 font-mono">{state.competition_id}</span>
          <button onClick={logout} className="text-sm text-red-400/70 hover:text-red-400 transition-colors">Logout</button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6 space-y-6 print:p-0">

        {/* Stats Row */}
        <div className="grid grid-cols-6 gap-4 print:hidden">
          {[
            { label: 'Total', value: totalCount, color: 'from-gray-600 to-gray-700' },
            { label: 'Online', value: onlineCount, color: 'from-blue-600 to-blue-700' },
            { label: 'Ready', value: readyCount, color: 'from-green-600 to-green-700' },
            { label: 'Playing', value: activeCount, color: 'from-amber-600 to-amber-700' },
            { label: 'Done', value: completedCount, color: 'from-purple-600 to-purple-700' },
            { label: 'Elapsed', value: elapsed != null ? `${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}` : '--:--', color: state?.is_unlocked ? 'from-rose-600 to-red-700' : 'from-gray-700 to-gray-800' },
          ].map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 shadow-lg`}>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">{s.label}</p>
              <p className="text-4xl font-black mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 print:hidden">
          {/* Start Button */}
          <div className="bg-[#131830] rounded-2xl p-5 border border-white/5">
            {state.is_unlocked && (
              <div className="w-full py-4 rounded-2xl bg-emerald-600/20 border-2 border-emerald-500/40 text-center mb-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-black text-xl">COMPETITION RUNNING</span>
                </div>
              </div>
            )}
            <button onClick={toggleStart} className={`w-full py-5 rounded-2xl text-xl font-black transition-all active:scale-[0.97] ${
              state.is_unlocked
                ? 'bg-red-500/20 border-2 border-red-500/30 text-red-400 hover:bg-red-500/30'
                : confirmStart
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/30 animate-pulse text-white'
                  : 'bg-gradient-to-r from-emerald-600 to-green-700 shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-green-600 text-white'
            }`}>
              {state.is_unlocked ? 'STOP COMPETITION' : confirmStart ? 'TAP AGAIN TO CONFIRM' : 'START COMPETITION'}
            </button>
            {confirmStart && <button onClick={() => setConfirmStart(false)} className="w-full mt-2 text-xs text-white/30 hover:text-white/50">Cancel</button>}
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <input value={roundLabel} onChange={e => setRoundLabel(e.target.value)} placeholder="Round label (e.g. Round 1)" className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40" />
                <button onClick={saveRound} className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/15 transition-colors">Save</button>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-white/30">Pin level:</span>
                <select value={state.active_level || ''} onChange={e => setActiveLevel(e.target.value ? Number(e.target.value) : null)} className="bg-[#1a2040] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none appearance-auto">
                  <option value="">All</option>
                  {levels.map(l => <option key={l} value={l}>Level {l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Announcement */}
          <div className="bg-[#131830] rounded-2xl p-5 border border-white/5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Announcement</h3>
            <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} placeholder="Broadcast to all lobbies..." className="w-full h-24 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-blue-500/40" />
            <div className="flex gap-2 mt-3">
              <button onClick={saveAnnouncement} className="flex-1 py-2.5 bg-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20">Broadcast</button>
              <button onClick={() => { setAnnouncement(''); updateState({ announcement: null }) }} className="px-4 py-2.5 bg-white/5 rounded-xl text-sm hover:bg-white/10 transition-colors">Clear</button>
            </div>
            {state.announcement && <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-sm text-amber-300">"{state.announcement}"</div>}
          </div>

          {/* Time Extension */}
          <div className="bg-[#131830] rounded-2xl p-5 border border-white/5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Time Extension</h3>
            <p className="text-sm text-white/30 mb-3">Extra time added: <span className={`font-bold ${(state.extra_seconds || 0) > 0 ? 'text-amber-400' : 'text-white'}`}>{Math.round((state.extra_seconds || 0) / 60)} min</span></p>
            <div className="grid grid-cols-3 gap-2">
              {[1,2,5].map(m => (
                <button key={m} onClick={() => showDialog(`Add ${m} minute(s) to all active students?`, () => extendTime(m))} className="py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 font-bold hover:bg-amber-500/20 transition-colors">+{m}m</button>
              ))}
            </div>
            {(state.extra_seconds || 0) > 0 && (
              <button onClick={() => showDialog('Remove all extra time?', () => updateState({ extra_seconds: 0 }))} className="w-full mt-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40 text-sm font-medium hover:bg-white/10 transition-colors">
                Reset extra time to 0
              </button>
            )}
          </div>

          {/* Reset */}
          <div className="bg-[#131830] rounded-2xl p-5 border border-white/5">
            <h3 className="text-xs font-semibold text-red-400/60 uppercase tracking-wider mb-3">Danger Zone</h3>
            <button onClick={resetRound} disabled={!state.is_unlocked && activeCount === 0 && completedCount === 0} className={`w-full py-4 rounded-xl font-bold transition-all ${
              confirmReset ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/30' : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-20 disabled:cursor-not-allowed'
            }`}>
              {confirmReset ? 'TAP AGAIN TO RESET' : 'Reset Round'}
            </button>
            {confirmReset && <button onClick={() => setConfirmReset(false)} className="w-full mt-2 text-xs text-white/30 hover:text-white/50">Cancel</button>}
            <p className="text-xs text-white/20 mt-3">Resets all students to waiting state. Clears scores and progress.</p>
            <p className="text-xs text-white/15 mt-4">Updated: {new Date(state.updated_at).toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Students Panel */}
        <div className="bg-[#131830] rounded-2xl border border-white/5 print:hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
            <h3 className="font-semibold">Students</h3>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Ready {readyCount}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Online {onlineCount}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Offline {offlineCount}</span>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-white/20 uppercase tracking-wider">
                <th className="px-5 py-2 text-left">Name</th><th className="px-3 py-2 text-left">School</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Lvl</th><th className="px-3 py-2">Status</th>
              </tr></thead>
              <tbody>
                {[...filtered].sort((a, b) => { const ao = isOnline(a), bo = isOnline(b); if (!ao && bo) return -1; if (ao && !bo) return 1; if (!a.ready && b.ready) return -1; if (a.ready && !b.ready) return 1; return (a.name||'').localeCompare(b.name||'') }).map(s => (
                  <tr key={s.participant_id} className={`border-t border-white/5 ${!isOnline(s) && s.status === 'waiting' ? 'bg-red-500/5' : ''}`}>
                    <td className="px-5 py-2.5 font-medium">{s.name}</td>
                    <td className="px-3 py-2.5 text-white/40">{s.school || '-'}</td>
                    <td className="px-3 py-2.5 font-mono text-white/30 text-center text-xs">{s.participant_code}</td>
                    <td className="px-3 py-2.5 text-center">{s.level}</td>
                    <td className="px-3 py-2.5 text-center">
                      {s.status === 'completed' ? <Badge color="green">Done</Badge>
                       : s.status === 'active' ? <Badge color="blue">Playing</Badge>
                       : s.ready ? <Badge color="green">Ready</Badge>
                       : isOnline(s) ? <Badge color="yellow">Loading</Badge>
                       : <Badge color="red">OFFLINE</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Student */}
        <div className="print:hidden">
          {!showAddStudent ? (
            <button onClick={() => setShowAddStudent(true)} className="px-5 py-2.5 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-semibold hover:bg-emerald-600/30 transition-colors">
              + Add Student
            </button>
          ) : (
            <div className="bg-[#131830] rounded-2xl p-5 border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Add Student</h3>
                <button onClick={() => setShowAddStudent(false)} className="text-white/30 hover:text-white/50 text-sm">Close</button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <input value={newStudent.name} onChange={e => setNewStudent(p => ({...p, name: e.target.value}))} placeholder="Name" className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40" />
                <input value={newStudent.school} onChange={e => setNewStudent(p => ({...p, school: e.target.value}))} placeholder="School (optional)" className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40" />
                <input value={newStudent.country} onChange={e => setNewStudent(p => ({...p, country: e.target.value}))} placeholder="Country (e.g. th)" maxLength={2} className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40" />
                <select value={newStudent.level} onChange={e => setNewStudent(p => ({...p, level: Number(e.target.value)}))} className="px-3 py-2.5 bg-[#1a2040] border border-white/10 rounded-xl text-sm text-white focus:outline-none">
                  {[1,2,3,4].map(l => <option key={l} value={l}>Level {l}</option>)}
                </select>
                <button onClick={async () => {
                  if (!newStudent.name.trim()) return
                  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
                  let code
                  try { code = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => chars[b % 32]).join('') }
                  catch { code = Array.from({length:6}, () => chars[Math.floor(Math.random()*32)]).join('') }
                  const { error } = await supabase.from('competition_sessions').insert({
                    competition_id: state.competition_id,
                    participant_code: code,
                    display_id: `${(newStudent.country || 'XX').toUpperCase()}-${String(totalCount + 1).padStart(3, '0')}`,
                    name: newStudent.name.trim(),
                    school: newStudent.school.trim() || null,
                    country: newStudent.country.toLowerCase() || null,
                    subject,
                    level: newStudent.level,
                  })
                  if (error) { showDialog('Failed: ' + error.message, () => {}); return }
                  setNewStudent({ name: '', school: '', country: 'th', level: 1 })
                  await loadSessions()
                  showDialog(`Student added! Code: ${code}`, () => {})
                }} disabled={!newStudent.name.trim()} className="py-2.5 bg-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-500 disabled:opacity-30 transition-colors">
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* View Tabs + Level Filter */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex bg-white/5 rounded-lg p-0.5">
            {[['live','Live Board'],['results','Official Results']].map(([k,l]) => (
              <button key={k} onClick={() => setView(k)} className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${view === k ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-white/40 hover:text-white/70'}`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-1">
            <LevelBtn active={!levelFilter} onClick={() => setLevelFilter(null)}>All</LevelBtn>
            {levels.map(l => <LevelBtn key={l} active={levelFilter === l} onClick={() => setLevelFilter(l)}>L{l}</LevelBtn>)}
          </div>
        </div>

        {/* Live Board */}
        {view === 'live' && (
          <div className="bg-[#131830] rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-white/20 uppercase tracking-wider bg-white/[0.02]">
                <th className="px-5 py-3 text-left w-16">#</th><th className="px-3 py-3 text-left">Name</th><th className="px-3 py-3 text-left">School</th><th className="px-3 py-3">ID</th><th className="px-3 py-3">Lvl</th><th className="px-3 py-3 text-right">Score</th><th className="px-3 py-3 text-right">Time</th><th className="px-3 py-3 text-center">Status</th>
              </tr></thead>
              <tbody>
                {liveSorted.map((s, i) => (
                  <tr key={s.participant_id} className={`border-t border-white/5 transition-colors ${s.status === 'completed' ? 'bg-green-500/5' : s.status === 'active' ? 'bg-blue-500/5' : ''}`}>
                    <td className="px-5 py-3 font-mono font-bold text-white/50">{i+1}</td>
                    <td className="px-3 py-3 font-semibold">{s.name}</td>
                    <td className="px-3 py-3 text-white/40">{s.school || '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs text-white/25 text-center">{s.display_id}</td>
                    <td className="px-3 py-3 text-center">{s.level}</td>
                    <td className="px-3 py-3 text-right font-black text-lg">{s.provisional_score}</td>
                    <td className="px-3 py-3 text-right font-mono text-white/50">{fmt(s.time_spent_seconds)}</td>
                    <td className="px-3 py-3 text-center">
                      {s.status === 'completed' ? <Badge color="green">Done</Badge> : s.status === 'active' ? <Badge color="blue">Live</Badge> : <Badge color="gray">Waiting</Badge>}
                    </td>
                  </tr>
                ))}
                {liveSorted.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-white/20">No participants</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Results */}
        {view === 'results' && (
          <>
            <div className="flex gap-3 print:hidden">
              <button onClick={exportCSV} className="px-5 py-2.5 bg-emerald-600 rounded-xl text-sm font-semibold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20">Export CSV</button>
              <button onClick={() => window.print()} className="px-5 py-2.5 bg-white/10 rounded-xl text-sm font-semibold hover:bg-white/15 transition-colors">Print</button>
              <button onClick={async () => {
                if (!officialSorted.length) return
                const { downloadBatchCertificates } = await import('./generateCertificate')
                const students = officialSorted.map((s, i) => ({ ...s, rank: i+1, totalQuestions: getVocabForLevel(s.level).length }))
                setBatchProgress({ done: 0, total: students.length })
                await downloadBatchCertificates(students, state.round_label || 'Wordee Competition', state.competition_id, (done, total) => setBatchProgress({ done, total }))
                setBatchProgress(null)
              }} disabled={batchProgress != null || !officialSorted.length} className="px-5 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-colors shadow-lg shadow-indigo-600/20">
                {batchProgress ? `Certificates ${batchProgress.done}/${batchProgress.total}` : 'All Certificates'}
              </button>
            </div>
            {/* Screen table */}
            <div className="bg-[#131830] rounded-2xl border border-white/5 overflow-hidden print:hidden">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-white/20 uppercase tracking-wider bg-white/[0.02]">
                  <th className="px-5 py-3 text-left">Rank</th><th className="px-3 py-3 text-left">Name</th><th className="px-3 py-3">ID</th><th className="px-3 py-3">School</th><th className="px-3 py-3">Lvl</th><th className="px-3 py-3 text-right">Score</th><th className="px-3 py-3 text-right">Time</th><th className="px-3 py-3"></th>
                </tr></thead>
                <tbody>
                  {officialSorted.map((s, i) => (
                    <tr key={s.participant_id} className={`border-t border-white/5 ${i < 3 ? 'bg-amber-500/5' : ''}`}>
                      <td className="px-5 py-3 font-black text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}</td>
                      <td className="px-3 py-3 font-semibold">{s.name}</td>
                      <td className="px-3 py-3 font-mono text-xs text-white/30 text-center">{s.display_id}</td>
                      <td className="px-3 py-3 text-white/40">{s.school || '-'}</td>
                      <td className="px-3 py-3 text-center">{s.level}</td>
                      <td className="px-3 py-3 text-right font-black text-lg">{s.validated_score}</td>
                      <td className="px-3 py-3 text-right font-mono text-white/50">{fmt(s.time_spent_seconds)}</td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={async () => { const { downloadCertificate } = await import('./generateCertificate'); await downloadCertificate({ name: s.name, rank: i+1, score: s.validated_score, totalQuestions: getVocabForLevel(s.level).length, level: s.level, school: s.school, country: s.country, eventName: state.round_label || 'Wordee Competition', competitionId: state.competition_id }) }} className="text-xs text-indigo-400 hover:text-indigo-300">PDF</button>
                      </td>
                    </tr>
                  ))}
                  {!officialSorted.length && <tr><td colSpan={8} className="px-5 py-12 text-center text-white/20">No results yet</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Print view — each level on its own page */}
            <div className="hidden print:block">
              {[...new Set(officialSorted.map(s => s.level))].sort((a,b) => a-b).map(lvl => {
                const lvlResults = officialSorted.filter(s => s.level === lvl)
                return (
                  <div key={lvl} className="break-before-page first:break-before-auto">
                    <h1 className="text-2xl font-bold mb-1">Official Results — {subject.charAt(0).toUpperCase()+subject.slice(1)} — Level {lvl}</h1>
                    <p className="text-sm text-gray-500 mb-4">{state.competition_id} {state.round_label ? `— ${state.round_label}` : ''}</p>
                    <table className="w-full text-base border-collapse">
                      <thead><tr className="border-b-2 border-black text-sm uppercase">
                        <th className="px-3 py-2 text-left">Rank</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2">Display ID</th><th className="px-3 py-2 text-left">School</th><th className="px-3 py-2 text-right">Score</th><th className="px-3 py-2 text-right">Time</th>
                      </tr></thead>
                      <tbody>
                        {lvlResults.map((s, i) => (
                          <tr key={s.participant_id} className="border-b border-gray-300">
                            <td className="px-3 py-2 font-bold">{i+1}</td>
                            <td className="px-3 py-2 font-semibold">{s.name}</td>
                            <td className="px-3 py-2 text-center font-mono text-gray-500">{s.display_id}</td>
                            <td className="px-3 py-2 text-gray-600">{s.school || '-'}</td>
                            <td className="px-3 py-2 text-right font-bold">{s.validated_score}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt(s.time_spent_seconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* In-app dialog */}
      {dialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 print:hidden">
          <div className="bg-[#1a2040] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white text-lg mb-6">{dialog.message}</p>
            <div className="flex gap-3">
              <button onClick={dialog.onCancel} className="flex-1 py-3 bg-white/10 rounded-xl font-semibold hover:bg-white/15 transition-colors">Cancel</button>
              <button onClick={dialog.onConfirm} className="flex-1 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Badge({ color, children }) {
  const colors = {
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/15 text-red-400 border-red-500/20',
    gray: 'bg-white/5 text-white/30 border-white/10',
  }
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${colors[color]}`}>{children}</span>
}

function LevelBtn({ active, onClick, children }) {
  return <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-white/5 text-white/40 hover:text-white/70'}`}>{children}</button>
}

function isOnline(s) { return s.last_seen_at && (Date.now() - new Date(s.last_seen_at).getTime()) < 15_000 }
function fmt(sec) { if (sec == null) return '-'; return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}` }
