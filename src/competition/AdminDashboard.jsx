import { useState, useEffect } from 'react'
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

export default function AdminDashboard() {
  const [theme, setTheme] = useState(() => localStorage.getItem('wordee_admin_theme') || 'dark')
  const [subject, setSubject] = useState(SUBJECTS.ENGLISH)
  const [showUpload, setShowUpload] = useState(false)
  const [dialog, setDialog] = useState(null)

  const isDark = theme === 'dark'

  useEffect(() => {
    localStorage.setItem('wordee_admin_theme', theme)
    supabase.from('competition_state').update({ theme }).eq('id', 'english')
    supabase.from('competition_state').update({ theme }).eq('id', 'math')
  }, [theme])

  const { state, sessions, elapsed, phase, loadSessions, updateState } = useAdminData({ subject })

  async function handleOpenLobby() {
    setDialog({
      message: 'Open the lobby? Students will be able to join via QR code.',
      onConfirm: async () => {
        await updateState({ is_unlocked: true })
        setDialog(null)
      },
      onCancel: () => setDialog(null),
    })
  }

  async function handleRosterImport(rows) {
    if (!state) return
    const inserts = []
    for (const row of rows) {
      const code = generateCode()
      const base = {
        competition_id: state.competition_id,
        participant_code: code,
        display_id: `${(row.country || 'XX').toUpperCase()}-${String(inserts.length + sessions.length + 1).padStart(3, '0')}`,
        name: row.name,
        school: row.school || null,
        country: row.country || null,
      }
      if (row.english_level > 0) inserts.push({ ...base, subject: 'english', level: row.english_level })
      if (row.math_level > 0) inserts.push({ ...base, subject: 'math', level: row.math_level })
    }
    if (inserts.length > 0) {
      await supabase.from('competition_sessions').insert(inserts)
      await loadSessions()
    }
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
        competitionId={state.competition_id}
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
              />
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
