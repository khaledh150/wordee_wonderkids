import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, Activity, LogOut, Users, Award, Megaphone, Clock, Plus, Trash2, 
  Settings, AlertTriangle, FileText, CheckCircle2, Download, RefreshCw, Play, Square, Globe, UserPlus, Sun, Moon 
} from 'lucide-react'
import { supabase, SUBJECTS } from './supabaseClient'
import { getVocabForLevel } from '../data/vocabulary'

export default function AdminDashboard() {
  const [theme, setTheme] = useState(() => localStorage.getItem('wordee_admin_theme') || 'dark')
  const [projTheme, setProjTheme] = useState(() => localStorage.getItem('wordee_projector_theme') || 'dark')
  
  const [state, setState] = useState(null)
  const [sessions, setSessions] = useState([])
  const [subject, setSubject] = useState(SUBJECTS.ENGLISH)
  const [levelFilter, setLevelFilter] = useState(null)
  const [view, setView] = useState('live') // live | results
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
  const realtimeDebounceRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('wordee_admin_theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('wordee_projector_theme', projTheme)
    // Dispatch storage event to trigger immediate local listeners if running in same tab context
    window.dispatchEvent(new Event('storage'))
  }, [projTheme])

  const loadState = useCallback(async () => {
    const { data } = await supabase.from('competition_state').select('*').eq('id', subject).single()
    if (data) { 
      setState(data)
      setAnnouncement(data.announcement || '')
      setRoundLabel(data.round_label || '') 
    }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_sessions', filter: `competition_id=eq.${state.competition_id}` }, () => {
        clearTimeout(realtimeDebounceRef.current)
        realtimeDebounceRef.current = setTimeout(loadSessions, 1000)
      })
      .subscribe()
    channelRef.current = ch
    return () => supabase.removeChannel(ch)
  }, [state?.competition_id, loadSessions])

  function showDialog(message, onConfirm) {
    setDialog({ 
      message, 
      onConfirm: () => { setDialog(null); onConfirm() }, 
      onCancel: () => setDialog(null) 
    })
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

  if (!state) return <div className="min-h-screen bg-[#070913] flex items-center justify-center text-white/30 text-xl font-bold">Initializing Command Deck...</div>

  const formatElapsed = (sec) => {
    if (sec == null) return '--:--'
    return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`
  }

  // Active theme properties
  const isDark = theme === 'dark'

  const statsOptions = [
    { 
      label: 'Total Enrolled', 
      value: totalCount, 
      color: isDark ? 'from-[#1e293b]/70 to-[#0f172a]/70 text-white' : 'from-slate-100 to-slate-200 text-slate-800', 
      border: isDark ? 'border-slate-800' : 'border-slate-300' 
    },
    { 
      label: 'Sync Online', 
      value: onlineCount, 
      color: isDark ? 'from-blue-600/10 to-indigo-600/5 text-white' : 'from-blue-50 to-blue-100/50 text-blue-800', 
      border: isDark ? 'border-blue-500/20' : 'border-blue-300', 
      icon: <Activity className={`w-4 h-4 animate-pulse ${isDark ? 'text-blue-400' : 'text-blue-600'}`} /> 
    },
    { 
      label: 'Roster Ready', 
      value: readyCount, 
      color: isDark ? 'from-emerald-600/10 to-teal-600/5 text-white' : 'from-emerald-50 to-emerald-100/50 text-emerald-800', 
      border: isDark ? 'border-emerald-500/20' : 'border-emerald-300', 
      icon: <CheckCircle2 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} /> 
    },
    { 
      label: 'Spelling Live', 
      value: activeCount, 
      color: isDark ? 'from-amber-600/10 to-orange-600/5 text-white' : 'from-amber-50 to-amber-100/50 text-amber-800', 
      border: isDark ? 'border-amber-500/20' : 'border-amber-300', 
      icon: <Clock className={`w-4 h-4 animate-spin ${isDark ? 'text-amber-400' : 'text-amber-600'}`} /> 
    },
    { 
      label: 'Completed', 
      value: completedCount, 
      color: isDark ? 'from-purple-600/10 to-pink-600/5 text-white' : 'from-purple-50 to-purple-100/50 text-purple-800', 
      border: isDark ? 'border-purple-500/20' : 'border-purple-300', 
      icon: <Award className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} /> 
    },
    { 
      label: 'Arena Timer', 
      value: formatElapsed(elapsed), 
      color: state?.is_unlocked 
        ? isDark ? 'from-rose-600/20 to-red-600/10 text-white' : 'from-rose-100 to-red-100 text-rose-800'
        : isDark ? 'from-slate-800/40 to-slate-900/40 text-slate-400' : 'from-slate-100 to-slate-200 text-slate-500', 
      border: state?.is_unlocked 
        ? isDark ? 'border-rose-500/30' : 'border-rose-300' 
        : isDark ? 'border-slate-800' : 'border-slate-300', 
      pulse: state?.is_unlocked 
    },
  ]

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none antialiased transition-colors duration-300 ${
      isDark ? 'bg-[#070913] text-slate-100' : 'bg-[#f8fafc] text-slate-800'
    }`}>
      {/* Top Header Panel */}
      <header className={`border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40 print:hidden shadow-lg transition-colors duration-300 ${
        isDark ? 'bg-[#0e1224]/80 border-white/5' : 'bg-white border-slate-200 shadow-slate-100/40'
      }`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md transition-colors ${
              isDark ? 'bg-blue-600' : 'bg-blue-500'
            }`}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className={`text-xl font-black tracking-tight transition-colors ${
              isDark ? 'bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent' : 'text-slate-800'
            }`}>
              Spelling Arena Admin
            </h1>
          </div>
          
          {/* Slider Capsule Switcher */}
          <div className={`flex rounded-xl p-1 border relative z-10 transition-colors ${
            isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
          }`}>
            {['english','math'].map(s => (
              <button
                key={s}
                onClick={() => { setSubject(s); setLevelFilter(null) }}
                className={`px-5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  subject === s 
                    ? isDark 
                      ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]' 
                      : 'bg-blue-600 text-white shadow-md'
                    : isDark 
                      ? 'text-slate-400 hover:text-white/80' 
                      : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          
          {state.round_label && (
            <span className={`text-xs font-black uppercase tracking-widest px-3.5 py-1.5 rounded-lg border shadow-inner transition-colors ${
              isDark ? 'text-slate-400 bg-white/5 border-white/5' : 'text-slate-600 bg-slate-50 border-slate-200'
            }`}>
              {state.round_label}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Admin Dashboard Theme Toggle */}
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className={`p-2.5 rounded-xl transition-all border cursor-pointer flex items-center gap-1.5 ${
              isDark 
                ? 'bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10' 
                : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200 shadow-sm'
            }`}
            title={`Switch Dashboard to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Admin</span>
          </button>

          {/* Projector Screen Theme Toggle (Syncs to projector locally in real time) */}
          <button
            onClick={() => setProjTheme(t => t === 'dark' ? 'light' : 'dark')}
            className={`p-2.5 rounded-xl transition-all border cursor-pointer flex items-center gap-1.5 ${
              projTheme === 'dark' 
                ? 'bg-white/5 border-white/10 text-amber-400 hover:bg-white/10' 
                : 'bg-slate-100 border-slate-200 text-blue-600 hover:bg-slate-200 shadow-sm'
            }`}
            title={`Switch Projector Screen to ${projTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {projTheme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Projector</span>
          </button>

          <span className={`text-xs font-mono border px-3 py-1.5 rounded-lg font-bold shadow-inner transition-colors ${
            isDark ? 'bg-slate-900 border-white/5 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}>
            Session: {state.competition_id}
          </span>

          <button 
            onClick={logout} 
            className={`flex items-center gap-1.5 text-sm font-bold px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
              isDark 
                ? 'text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 border-rose-500/10' 
                : 'text-rose-600 hover:text-white hover:bg-rose-500 border-rose-200 hover:border-rose-500'
            }`}
          >
            <LogOut className="w-4 h-4" />
            Exit
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] w-full mx-auto p-6 space-y-6 flex-1 relative z-10 print:p-0">
        {/* Real-time Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 print:hidden">
          {statsOptions.map((s, idx) => (
            <div 
              key={idx} 
              className={`bg-gradient-to-br ${s.color} border ${s.border} rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all duration-300`}
            >
              {s.pulse && <div className="absolute inset-0 bg-red-500/5 animate-pulse" />}
              <div className="flex items-center justify-between">
                <p className={`text-xs font-black uppercase tracking-wider leading-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</p>
                {s.icon}
              </div>
              <p className="text-3xl font-black mt-2 font-mono tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        {/* 3-Column SaaS Command Center Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:hidden">
          {/* Column 1: Active Controller */}
          <div className={`border rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all duration-300 ${
            isDark ? 'bg-[#0e1224]/50 border-white/5' : 'bg-white border-slate-200'
          }`}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Settings className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <h3 className={`text-xs font-black uppercase tracking-widest leading-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Arena Controller</h3>
              </div>
              
              {state.is_unlocked && (
                <div className={`w-full py-3.5 rounded-xl text-center mb-4 border transition-colors ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-600 font-extrabold text-sm uppercase tracking-wider">COMPETITION ACTIVE</span>
                  </div>
                </div>
              )}
              
              <button 
                onClick={toggleStart} 
                className={`w-full py-4.5 rounded-xl text-lg font-black transition-all active:scale-[0.98] cursor-pointer ${
                  state.is_unlocked
                    ? isDark 
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
                      : 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'
                    : confirmStart
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 shadow-md animate-pulse text-white border-none'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-none shadow-md'
                }`}
              >
                {state.is_unlocked ? (
                  <span className="flex items-center justify-center gap-1.5"><Square className="w-5 h-5 fill-current" /> STOP COMPETITION</span>
                ) : confirmStart ? (
                  'TAP TO CONFIRM'
                ) : (
                  <span className="flex items-center justify-center gap-1.5"><Play className="w-5 h-5 fill-current" /> START COMPETITION</span>
                )}
              </button>
              
              {confirmStart && (
                <button 
                  onClick={() => setConfirmStart(false)} 
                  className={`w-full mt-2 text-xs font-bold py-1 rounded cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="mt-5 space-y-3 pt-5 border-t border-white/5">
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Round Name / Tag</span>
                <div className="flex gap-2">
                  <input 
                    value={roundLabel} 
                    onChange={e => setRoundLabel(e.target.value)} 
                    placeholder="e.g. Round 1" 
                    className={`flex-1 px-3 py-2 border rounded-xl text-sm transition-colors ${
                      isDark 
                        ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500 focus:border-blue-500/50' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600'
                    }`} 
                  />
                  <button 
                    onClick={saveRound} 
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className={`flex gap-3 items-center justify-between border rounded-xl px-4 py-2 transition-colors ${
                isDark ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-xs font-bold text-slate-400">Lock Active Level:</span>
                <select 
                  value={state.active_level || ''} 
                  onChange={e => setActiveLevel(e.target.value ? Number(e.target.value) : null)} 
                  className={`border rounded-lg px-2 py-1.5 text-xs focus:outline-none cursor-pointer outline-none transition-colors ${
                    isDark 
                      ? 'bg-[#131830] border-white/10 text-white focus:border-blue-500/50' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-600'
                  }`}
                >
                  <option value="">Show All Levels</option>
                  {levels.map(l => <option key={l} value={l}>Level {l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Column 2: Broadcast Hub */}
          <div className={`border rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all duration-300 ${
            isDark ? 'bg-[#0e1224]/50 border-white/5' : 'bg-white border-slate-200'
          }`}>
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="w-4 h-4 text-amber-500" />
                <h3 className={`text-xs font-black uppercase tracking-widest leading-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Broadcast Center</h3>
              </div>
              
              <textarea 
                value={announcement} 
                onChange={e => setAnnouncement(e.target.value)} 
                placeholder="Type real-time alerts to display on student lobbies..." 
                className={`w-full flex-1 min-h-[90px] px-3.5 py-2.5 border rounded-xl text-sm transition-colors ${
                  isDark 
                    ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500 focus:border-blue-500/50 resize-none' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 resize-none'
                }`} 
              />
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
              <div className="flex gap-2.5">
                <button 
                  onClick={saveAnnouncement} 
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-md"
                >
                  Broadcast
                </button>
                <button 
                  onClick={() => { setAnnouncement(''); updateState({ announcement: null }) }} 
                  className={`px-4 py-2.5 hover:bg-white/10 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                    isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Clear
                </button>
              </div>
              
              {state.announcement && (
                <div className={`border rounded-xl px-3 py-2 flex items-center gap-2 text-xs shadow-inner transition-colors ${
                  isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0 animate-ping" />
                  <span className="truncate">Live: "{state.announcement}"</span>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Time Adjuster */}
          <div className={`border rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all duration-300 ${
            isDark ? 'bg-[#0e1224]/50 border-white/5' : 'bg-white border-slate-200'
          }`}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <h3 className={`text-xs font-black uppercase tracking-widest leading-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Time Extension</h3>
              </div>
              
              <p className="text-sm font-bold">
                Extra seconds injected:{' '}
                <span className={`font-mono font-black text-lg ml-1 ${ (state.extra_seconds || 0) > 0 ? 'text-amber-505' : ''}`}>
                  {Math.round((state.extra_seconds || 0) / 60)} min
                </span>
              </p>
            </div>
            
            <div className="mt-5 space-y-3.5">
              <div className="grid grid-cols-3 gap-2.5">
                {[1, 2, 5].map(m => (
                  <button 
                    key={m} 
                    onClick={() => showDialog(`Add +${m} minute(s) of spelling time to all active students?`, () => extendTime(m))} 
                    className={`py-3 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 font-black rounded-xl text-sm transition-all border cursor-pointer ${
                      isDark 
                        ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-400' 
                        : 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-700'
                    }`}
                  >
                    +{m}m
                  </button>
                ))}
              </div>
              
              {(state.extra_seconds || 0) > 0 && (
                <button 
                  onClick={() => showDialog('Remove all injected extra time?', () => updateState({ extra_seconds: 0 }))} 
                  className={`w-full py-2.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isDark 
                      ? 'bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 border-white/5 hover:border-rose-500/25 text-slate-400' 
                      : 'bg-slate-50 hover:bg-rose-500 hover:text-white border-slate-200 hover:border-rose-500 text-slate-500'
                  }`}
                >
                  Reset extra seconds to 0
                </button>
              )}
            </div>
          </div>

          {/* Column 4: Danger Zone */}
          <div className={`border rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all duration-300 ${
            isDark ? 'bg-[#0e1224]/50 border-white/5' : 'bg-white border-slate-200'
          }`}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className={`text-xs font-black uppercase tracking-widest leading-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Danger Area</h3>
              </div>
              
              <button 
                onClick={resetRound} 
                disabled={!state.is_unlocked && activeCount === 0 && completedCount === 0} 
                className={`w-full py-4.5 rounded-xl text-base font-black transition-all active:scale-[0.98] cursor-pointer ${
                  confirmReset 
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-md border-none' 
                    : isDark
                      ? 'bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/25 text-rose-400 disabled:opacity-20 disabled:pointer-events-none'
                      : 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 disabled:opacity-25 disabled:pointer-events-none'
                }`}
              >
                {confirmReset ? 'TAP AGAIN TO RESET' : 'Reset Spelling Round'}
              </button>
              
              {confirmReset && (
                <button 
                  onClick={() => setConfirmReset(false)} 
                  className={`w-full mt-2 text-xs font-bold py-1 rounded cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Cancel
                </button>
              )}
            </div>
            
            <p className={`text-[10px] font-bold leading-normal mt-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Resetting moves all active and finished spelling sessions to the waiting lobby. 
              Scores and logs are cleared.
            </p>
          </div>
        </div>

        {/* Live connected students list - Redesigned custom scrollbar and expanded viewport height */}
        <div className={`border rounded-2xl shadow-md overflow-hidden print:hidden transition-all duration-300 ${
          isDark ? 'bg-[#0e1224]/30 border-white/5' : 'bg-white border-slate-200'
        }`}>
          <div className={`px-5 py-4 flex items-center justify-between border-b bg-[#0e1224]/10 transition-colors ${
            isDark ? 'border-white/5 bg-[#0e1224]/60' : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="flex items-center gap-2">
              <Users className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <h3 className={`font-black text-sm uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Live Participant Status</h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-extrabold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />Ready: {readyCount}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Online: {onlineCount}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" />Offline: {offlineCount}</span>
            </div>
          </div>
          
          {/* Expanded viewport height with custom scrollbars */}
          <div className="max-h-[32rem] overflow-y-auto custom-scrollbar transition-all duration-300">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                  isDark ? 'text-slate-400 bg-slate-950/20 border-b border-white/5' : 'text-slate-500 bg-slate-100/80 border-b border-slate-200'
                }`}>
                  <th className="px-6 py-3.5 w-1/4">Student Name</th>
                  <th className="px-4 py-3.5 w-1/4">School Registry</th>
                  <th className="px-4 py-3.5 text-center">Entry Code</th>
                  <th className="px-4 py-3.5 text-center">Target Level</th>
                  <th className="px-6 py-3.5 text-center">Live Status</th>
                </tr>
              </thead>
              <tbody className="divide-y font-semibold text-sm transition-colors divide-white/5">
                {[...filtered]
                  .sort((a, b) => { 
                    const ao = isOnline(a), bo = isOnline(b)
                    if (!ao && bo) return 1
                    if (ao && !bo) return -1
                    if (!a.ready && b.ready) return 1
                    if (a.ready && !b.ready) return -1
                    return (a.name || '').localeCompare(b.name || '') 
                  })
                  .map(s => {
                    const onlineState = isOnline(s)
                    return (
                      <tr 
                        key={s.participant_id} 
                        className={`transition-colors border-b ${
                          isDark ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-100 hover:bg-slate-50/50'
                        } ${
                          !onlineState && s.status === 'waiting' ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        <td className={`px-6 py-4 font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          <span className={`w-2 h-2 rounded-full ${onlineState ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                          {s.name}
                        </td>
                        <td className={`px-4 py-4 text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.school || '-'}</td>
                        <td className={`px-4 py-4 font-mono text-center text-xs font-black tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{s.participant_code}</td>
                        <td className="px-4 py-4 text-center text-xs font-black">
                          <span className={`px-2.5 py-0.5 border rounded-full ${
                            isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            L{s.level}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {s.status === 'completed' ? <Badge color="green">Done</Badge>
                           : s.status === 'active' ? <Badge color="blue">Live Spelling</Badge>
                           : s.ready ? <Badge color="green">Sync Ready</Badge>
                           : onlineState ? <Badge color="yellow">Loading</Badge>
                           : <Badge color="red">Offline</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold">
                      No participants registered at this level.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Student Control Box */}
        <div className="print:hidden">
          {!showAddStudent ? (
            <button 
              onClick={() => setShowAddStudent(true)} 
              className={`px-5 py-3 border rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                isDark 
                  ? 'bg-[#0e1224]/60 hover:bg-[#0e1224] border-white/5 hover:border-indigo-500/40 text-indigo-400' 
                  : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Add Participant
            </button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all duration-300 ${
                isDark ? 'bg-[#0e1224]/50 border-white/5' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4.5">
                <div className="flex items-center gap-2">
                  <UserPlus className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <h3 className={`font-black text-xs uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Add Participant Session</h3>
                </div>
                <button 
                  onClick={() => setShowAddStudent(false)} 
                  className={`text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                <input 
                  value={newStudent.name} 
                  onChange={e => setNewStudent(p => ({...p, name: e.target.value}))} 
                  placeholder="Student Full Name" 
                  className={`px-3.5 py-3 border rounded-xl text-sm transition-colors ${
                    isDark 
                      ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500/50' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500/50'
                  }`} 
                />
                <input 
                  value={newStudent.school} 
                  onChange={e => setNewStudent(p => ({...p, school: e.target.value}))} 
                  placeholder="School Registry Name (optional)" 
                  className={`px-3.5 py-3 border rounded-xl text-sm transition-colors ${
                    isDark 
                      ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500/50' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500/50'
                  }`} 
                />
                <input 
                  value={newStudent.country} 
                  onChange={e => setNewStudent(p => ({...p, country: e.target.value}))} 
                  placeholder="Country Tag (e.g. th)" 
                  maxLength={2} 
                  className={`px-3.5 py-3 border rounded-xl text-sm transition-colors ${
                    isDark 
                      ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500/50' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500/50'
                  }`} 
                />
                <select 
                  value={newStudent.level} 
                  onChange={e => setNewStudent(p => ({...p, level: Number(e.target.value)}))} 
                  className={`px-3.5 py-3 border rounded-xl text-sm focus:outline-none cursor-pointer transition-colors ${
                    isDark 
                      ? 'bg-[#131830] border-white/10 text-white focus:border-indigo-500/50' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500/50'
                  }`}
                >
                  {[1, 2, 3, 4].map(l => <option key={l} value={l}>Target Level {l}</option>)}
                </select>
                
                <button 
                  onClick={async () => {
                    if (!newStudent.name.trim()) return
                    // Safe browser random token compilation supporting iOS/Safari fallbacks
                    const code = Array.from((window.crypto || window.msCrypto).getRandomValues(new Uint8Array(6)))
                      .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32])
                      .join('')
                      
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
                    if (error) { showDialog('Failed to create student session: ' + error.message, () => {}); return }
                    setNewStudent({ name: '', school: '', country: 'th', level: 1 })
                    await loadSessions()
                    showDialog(`Student added successfully! Access Code: ${code}`, () => {})
                  }} 
                  disabled={!newStudent.name.trim()} 
                  className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:pointer-events-none text-white font-black rounded-xl text-sm uppercase tracking-wider transition-colors cursor-pointer shadow-md"
                >
                  Compile Session
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Board switcher and filtering capsules */}
        <div className="flex items-center justify-between border-t border-white/5 pt-6 print:hidden">
          <div className={`flex border rounded-xl p-1 relative z-10 shadow-inner transition-colors ${
            isDark ? 'bg-[#0e1224]/80 border-white/5' : 'bg-slate-100 border-slate-200'
          }`}>
            {[
              ['live','Live Ranks Board'],
              ['results','Official Completed Results']
            ].map(([k,l]) => (
              <button 
                key={k} 
                onClick={() => setView(k)} 
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  view === k 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : isDark 
                      ? 'text-slate-400 hover:text-white/80' 
                      : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          
          <div className={`flex border rounded-xl p-1 relative z-10 shadow-inner transition-colors ${
            isDark ? 'bg-[#0e1224]/80 border-white/5' : 'bg-slate-100 border-slate-200'
          }`}>
            <LevelBtn active={!levelFilter} onClick={() => setLevelFilter(null)} isDark={isDark}>All Levels</LevelBtn>
            {levels.map(l => (
              <LevelBtn key={l} active={levelFilter === l} onClick={() => setLevelFilter(l)} isDark={isDark}>L{l}</LevelBtn>
            ))}
          </div>
        </div>

        {/* Live spelling ranks board */}
        {view === 'live' && (
          <div className={`border rounded-3xl overflow-hidden shadow-lg transition-all duration-300 ${
            isDark ? 'bg-[#0e1224]/20 border-white/5' : 'bg-white border-slate-200'
          }`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`text-[10px] font-black uppercase tracking-widest border-b transition-colors ${
                  isDark ? 'text-slate-400 bg-slate-950/20 border-white/5' : 'text-slate-500 bg-slate-100/80 border-slate-200'
                }`}>
                  <th className="px-6 py-4 w-16">Rank</th>
                  <th className="px-4 py-4">Participant Name</th>
                  <th className="px-4 py-4">School Registry</th>
                  <th className="px-4 py-4 text-center">Display ID</th>
                  <th className="px-4 py-4 text-center">Level</th>
                  <th className="px-4 py-4 text-right">Provisional Score</th>
                  <th className="px-4 py-4 text-right">Timer Spent</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y font-semibold text-sm transition-colors divide-white/5">
                {liveSorted.map((s, i) => (
                  <tr 
                    key={s.participant_id} 
                    className={`transition-colors border-b ${
                      isDark ? 'border-white/5' : 'border-slate-100'
                    } ${
                      s.status === 'completed' 
                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10' 
                        : s.status === 'active' 
                          ? 'bg-blue-500/5 hover:bg-blue-500/10' 
                          : isDark ? 'hover:bg-white/[0.01]' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="px-6 py-4 font-mono font-black text-slate-500">{i+1}</td>
                    <td className={`px-4 py-4 font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.name}</td>
                    <td className={`px-4 py-4 text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.school || '-'}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-500 text-center font-bold">{s.display_id}</td>
                    <td className="px-4 py-4 text-center text-xs font-black">
                      <span className={`px-2 py-0.5 rounded border ${
                        isDark ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        L{s.level}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-right font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.provisional_score}</td>
                    <td className={`px-4 py-4 text-right font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmt(s.time_spent_seconds)}</td>
                    <td className="px-6 py-4 text-center">
                      {s.status === 'completed' 
                        ? <Badge color="green">Done</Badge> 
                        : s.status === 'active' 
                          ? <Badge color="blue">Active</Badge> 
                          : <Badge color="gray">Idle</Badge>}
                    </td>
                  </tr>
                ))}
                {liveSorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                      No participants registered under selection parameters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Official finalized results */}
        {view === 'results' && (
          <div className="space-y-4">
            <div className="flex gap-3 print:hidden">
              <button 
                onClick={exportCSV} 
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button 
                onClick={() => window.print()} 
                className={`px-5 py-3 border font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                Print Report
              </button>
              <button 
                onClick={async () => {
                  if (!officialSorted.length) return
                  const { downloadBatchCertificates } = await import('./generateCertificate')
                  const students = officialSorted.map((s, i) => ({ ...s, rank: i+1, totalQuestions: getVocabForLevel(s.level).length }))
                  setBatchProgress({ done: 0, total: students.length })
                  await downloadBatchCertificates(students, state.round_label || 'Wordee Competition', state.competition_id, (done, total) => setBatchProgress({ done, total }))
                  setBatchProgress(null)
                }} 
                disabled={batchProgress != null || !officialSorted.length} 
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                {batchProgress ? `Compiling ${batchProgress.done}/${batchProgress.total}...` : 'Download All Certificates'}
              </button>
            </div>
            
            {/* Screen table */}
            <div className={`border rounded-3xl overflow-hidden shadow-lg print:hidden transition-all duration-300 ${
              isDark ? 'bg-[#0e1224]/20 border-white/5' : 'bg-white border-slate-200'
            }`}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`text-[10px] font-black uppercase tracking-widest border-b transition-colors ${
                    isDark ? 'text-slate-400 bg-slate-950/20 border-white/5' : 'text-slate-500 bg-slate-100/80 border-slate-200'
                  }`}>
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-4 py-4">Participant Name</th>
                    <th className="px-4 py-4 text-center">Display ID</th>
                    <th className="px-4 py-4">School Registry</th>
                    <th className="px-4 py-4 text-center">Level</th>
                    <th className="px-4 py-4 text-right">Final Score</th>
                    <th className="px-4 py-4 text-right">Elapsed Time</th>
                    <th className="px-6 py-4 text-center">Award PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-semibold text-sm transition-colors divide-white/5">
                  {officialSorted.map((s, i) => (
                    <tr 
                      key={s.participant_id} 
                      className={`transition-colors border-b ${
                        isDark ? 'border-white/5' : 'border-slate-100'
                      } ${
                        i === 0 
                          ? 'bg-amber-500/5 hover:bg-amber-500/10' 
                          : i === 1 
                            ? 'bg-slate-400/5 hover:bg-slate-400/10' 
                            : i === 2 
                              ? 'bg-amber-700/5 hover:bg-amber-700/10' 
                              : isDark ? 'hover:bg-white/[0.01]' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="px-6 py-4 font-black text-base">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}
                      </td>
                      <td className={`px-4 py-4 font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.name}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-500 text-center font-bold">{s.display_id}</td>
                      <td className={`px-4 py-4 text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.school || '-'}</td>
                      <td className="px-4 py-4 text-center text-xs font-black">
                        <span className={`px-2 py-0.5 rounded border ${
                          isDark ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          L{s.level}
                        </span>
                      </td>
                      <td className={`px-4 py-4 text-right font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.validated_score}</td>
                      <td className={`px-4 py-4 text-right font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmt(s.time_spent_seconds)}</td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={async () => { 
                            const { downloadCertificate } = await import('./generateCertificate')
                            await downloadCertificate({ 
                              name: s.name, 
                              rank: i+1, 
                              score: s.validated_score, 
                              totalQuestions: getVocabForLevel(s.level).length, 
                              level: s.level, 
                              school: s.school, 
                              country: s.country, 
                              eventName: state.round_label || 'Wordee Competition', 
                              competitionId: state.competition_id 
                            }) 
                          }} 
                          className={`text-xs font-black uppercase px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isDark 
                              ? 'text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border-indigo-500/20' 
                              : 'text-indigo-600 hover:text-white hover:bg-indigo-500 bg-indigo-50 border-indigo-200 hover:border-indigo-500 shadow-sm'
                          }`}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!officialSorted.length && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                        No spelling sessions validated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Print view — each level on its own page */}
            <div className="hidden print:block bg-white text-black">
              {[...new Set(officialSorted.map(s => s.level))].sort((a,b) => a-b).map(lvl => {
                const lvlResults = officialSorted.filter(s => s.level === lvl)
                return (
                  <div key={lvl} className="break-before-page first:break-before-auto p-8">
                    <h1 className="text-2xl font-bold mb-1">Official Results — {subject.toUpperCase()} — Level {lvl}</h1>
                    <p className="text-sm text-gray-500 mb-4">{state.competition_id} {state.round_label ? `— ${state.round_label}` : ''}</p>
                    <table className="w-full text-base border-collapse">
                      <thead>
                        <tr className="border-b-2 border-black text-sm uppercase font-bold">
                          <th className="px-3 py-2 text-left">Rank</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-center">Display ID</th>
                          <th className="px-3 py-2 text-left">School</th>
                          <th className="px-3 py-2 text-right">Score</th>
                          <th className="px-3 py-2 text-right">Time</th>
                        </tr>
                      </thead>
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
          </div>
        )}
      </main>

      {/* Elegant glassmorphic Confirmation dialog overlays */}
      <AnimatePresence>
        {dialog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#060814]/75 backdrop-blur-sm -webkit-backdrop-blur-sm flex items-center justify-center z-50 print:hidden p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className={`border rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden transition-colors ${
                isDark ? 'bg-[#0e1224] border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-blue-400" />
              </div>
              
              <p className={`text-lg font-black leading-snug tracking-tight mb-6 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {dialog.message}
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={dialog.onCancel} 
                  className={`flex-1 py-3 border rounded-2xl font-extrabold text-sm transition-all cursor-pointer ${
                    isDark ? 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  onClick={dialog.onConfirm} 
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-2xl transition-colors cursor-pointer shadow-lg shadow-blue-600/25"
                >
                  Confirm Operation
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Badge({ color, children }) {
  const colors = {
    green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-sm',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm',
    yellow: 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-sm',
    red: 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-sm',
    gray: 'bg-slate-500/10 text-slate-500 border-slate-500/20 shadow-sm',
  }
  return <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${colors[color]}`}>{children}</span>
}

function LevelBtn({ active, onClick, children, isDark }) {
  return (
    <button 
      onClick={onClick} 
      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
        active 
          ? 'bg-blue-600 text-white shadow-md' 
          : isDark 
            ? 'text-slate-400 hover:text-white/80' 
            : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  )
}

function isOnline(s) { 
  return s.last_seen_at && (Date.now() - new Date(s.last_seen_at).getTime()) < 15_000 
}

function fmt(sec) { 
  if (sec == null) return '-'; 
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}` 
}
