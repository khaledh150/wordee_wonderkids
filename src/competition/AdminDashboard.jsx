import { useState, useEffect, lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase, SUBJECTS } from './supabaseClient'
import useAdminData from './admin/useAdminData'
import AdminHeader from './admin/AdminHeader'
import SetupPhase from './admin/SetupPhase'
import LobbyPhase from './admin/LobbyPhase'
import LivePhase from './admin/LivePhase'
import ResultsPhase from './admin/ResultsPhase'
import RosterUpload from './admin/RosterUpload'
import ConfirmDialog from './admin/ConfirmDialog'
import { generateCode } from './admin/shared'

const HistoryPhase = lazy(() => import('./admin/HistoryPhase'))

export default function AdminDashboard() {
  const [theme, setTheme] = useState(() => localStorage.getItem('wordee_admin_theme') || 'dark')
  const [subject, setSubject] = useState(SUBJECTS.ENGLISH)
  const [showUpload, setShowUpload] = useState(false)
  const [dialog, setDialog] = useState(null)

  const isDark = theme === 'dark'

  useEffect(() => {
    localStorage.setItem('wordee_admin_theme', theme)
    Promise.all([
      supabase.from('competition_state').update({ theme }).eq('id', 'english'),
      supabase.from('competition_state').update({ theme }).eq('id', 'math'),
    ])
  }, [theme])

  const { state, sessions, elapsed, phase: autoPhase, loadState, loadSessions, updateState } = useAdminData({ subject })
  const [phaseOverride, setPhaseOverride] = useState(null)
  const phase = phaseOverride || autoPhase

  async function handleOpenLobby() {
    setDialog({
      message: 'Open the lobby? Students will be able to join via QR code.',
      onConfirm: async () => {
        await updateState({ is_unlocked: true, started_at: null })
        setDialog(null)
      },
      onCancel: () => setDialog(null),
    })
  }

  async function handleRosterImport(rows) {
    if (!state) return
    const existingCodes = sessions.map(s => s.participant_code)
    const inserts = []
    for (const row of rows) {
      const code = generateCode(existingCodes)
      existingCodes.push(code)
      const base = {
        competition_id: state.competition_id,
        participant_code: code,
        display_id: `${(row.country || 'XX').toUpperCase()}-${String(inserts.length + sessions.length + 1).padStart(3, '0')}`,
        name: row.name,
        school: row.school || null,
        country: row.country || null,
        age: row.age || null,
      }
      if (row.english_level > 0) inserts.push({ ...base, subject: 'english', level: row.english_level })
      if (row.math_level > 0) inserts.push({ ...base, subject: 'math', level: row.math_level })
    }
    if (inserts.length > 0) {
      await supabase.from('competition_sessions').insert(inserts)
      await loadSessions()
    }
  }

  async function handleNewSession(copyRoster) {
    const newId = 'session_' + Math.floor(Date.now() / 1000)
    const oldId = state.competition_id

    await supabase.from('competition_history').insert({
      competition_id: newId,
      round_label: state.round_label || null,
    })

    await supabase.from('competition_state').update({
      competition_id: newId,
      is_unlocked: false,
      started_at: null,
      extra_seconds: 0,
      announcement: null,
      updated_at: new Date().toISOString(),
    }).in('id', ['english', 'math'])

    if (copyRoster) {
      const { data: oldSessions } = await supabase
        .from('competition_sessions')
        .select('*')
        .eq('competition_id', oldId)
      if (oldSessions?.length) {
        const existingCodes = []
        const inserts = oldSessions.map(s => {
          const code = generateCode(existingCodes)
          existingCodes.push(code)
          return {
            competition_id: newId,
            participant_code: code,
            display_id: s.display_id,
            name: s.name,
            school: s.school,
            country: s.country,
            age: s.age,
            subject: s.subject,
            level: s.level,
            status: 'registered',
            provisional_score: 0,
            validated_score: null,
            questions_answered: 0,
            time_spent_seconds: 0,
            ready: false,
            answers_snapshot: null,
            started_at: null,
            completed_at: null,
          }
        })
        await supabase.from('competition_sessions').insert(inserts)
      }
    }

    setPhaseOverride(null)
    await loadState()
    await loadSessions()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!state) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#060814]' : 'bg-slate-50'}`}>
        <div className={`animate-spin w-8 h-8 border-4 border-t-transparent rounded-full ${isDark ? 'border-blue-500' : 'border-blue-600'}`} />
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors ${isDark ? 'bg-[#060814] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <AdminHeader
        subject={subject}
        setSubject={setSubject}
        phase={phase}
        isDark={isDark}
        setTheme={setTheme}
        onLogout={handleLogout}
        onPhaseClick={(p) => setPhaseOverride(p == null || p === autoPhase ? null : p)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <SetupPhase
                state={state}
                sessions={sessions}
                subject={subject}
                isDark={isDark}
                updateState={updateState}
                loadSessions={loadSessions}
                onOpenLobby={handleOpenLobby}
                onShowUpload={() => setShowUpload(true)}
              />
            </motion.div>
          )}

          {phase === 'lobby' && (
            <motion.div key="lobby" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <LobbyPhase
                state={state}
                sessions={sessions}
                subject={subject}
                isDark={isDark}
                updateState={updateState}
                loadSessions={loadSessions}
                onBackToSetup={async () => { await updateState({ is_unlocked: false }) }}
              />
            </motion.div>
          )}

          {phase === 'live' && (
            <motion.div key="live" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <LivePhase
                state={state}
                sessions={sessions}
                elapsed={elapsed}
                subject={subject}
                isDark={isDark}
                updateState={updateState}
                loadSessions={loadSessions}
              />
            </motion.div>
          )}

          {phase === 'results' && (
            <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ResultsPhase
                state={state}
                sessions={sessions}
                subject={subject}
                isDark={isDark}
                updateState={updateState}
                loadSessions={loadSessions}
                onSwitchSubject={async (sub) => {
                  const label = sub === 'math' ? 'Mathematics' : 'English Spelling'
                  if (!window.confirm(`Open the ${label} lobby? Students who completed the current subject will be prompted to join.`)) return
                  const prevSubject = sub === 'math' ? 'english' : 'math'
                  const now = new Date().toISOString()
                  await Promise.all([
                    supabase.from('competition_state').update({
                      is_unlocked: false, started_at: null, updated_at: now,
                    }).eq('id', prevSubject),
                    supabase.from('competition_state').update({
                      is_unlocked: true, started_at: null,
                      extra_seconds: 0, announcement: null, updated_at: now,
                    }).eq('id', sub),
                  ])
                  setPhaseOverride(null)
                  setSubject(sub)
                }}
                onNewSession={handleNewSession}
              />
            </motion.div>
          )}
          {phase === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <Suspense fallback={<div className="flex justify-center py-12"><div className={`animate-spin w-8 h-8 border-4 border-t-transparent rounded-full ${isDark ? 'border-blue-500' : 'border-blue-600'}`} /></div>}>
                <HistoryPhase isDark={isDark} onBack={() => setPhaseOverride(null)} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <RosterUpload
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onImport={handleRosterImport}
        competitionId={state.competition_id}
        subject={subject}
        isDark={isDark}
      />

      <ConfirmDialog dialog={dialog} isDark={isDark} />
    </div>
  )
}
