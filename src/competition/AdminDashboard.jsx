import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase, SUBJECTS } from './supabaseClient'
import { useToast } from '../components/ToastContext'
import useAdminData from './admin/useAdminData'
import AdminHeader from './admin/AdminHeader'
import SetupPhase from './admin/SetupPhase'
import LobbyPhase from './admin/LobbyPhase'
import LivePhase from './admin/LivePhase'
import ResultsPhase from './admin/ResultsPhase'
import PodiumPhase from './admin/PodiumPhase'
import RosterUpload from './admin/RosterUpload'
import ConfirmDialog from './admin/ConfirmDialog'
import { generateCode } from './admin/shared'
import ModuleBoundary from '../components/ModuleBoundary'

const HistoryPhase = lazy(() => import('./admin/HistoryPhase'))
const DiagnosticsPanel = lazy(() => import('./admin/DiagnosticsPanel'))
const ThemeModal = lazy(() => import('./admin/ThemeModal'))


export default function AdminDashboard() {
  const toast = useToast()
  const [themes, setThemes] = useState(() => {
    try {
      const saved = localStorage.getItem('wonderkids_themes')
      if (saved) return { admin: 'dark', student: 'dark', projector: 'dark', ...JSON.parse(saved) }
    } catch {}
    return { admin: 'dark', student: 'dark', projector: 'dark' }
  })
  const [subject, setSubject] = useState(SUBJECTS.ENGLISH)
  const [showUpload, setShowUpload] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [otherSubjectPlayed, setOtherSubjectPlayed] = useState(false)

  const isDark = themes.admin === 'dark'

  function toggleTheme(key) {
    setThemes(prev => {
      const next = { ...prev, [key]: prev[key] === 'dark' ? 'light' : 'dark' }
      localStorage.setItem('wonderkids_themes', JSON.stringify(next))
      if (key === 'student') {
        supabase.from('competition_state').update({ theme: next.student }).eq('id', 'english')
        supabase.from('competition_state').update({ theme: next.student }).eq('id', 'math')
      }
      if (key === 'projector') {
        supabase.from('competition_state').update({ projector_theme: next.projector }).eq('id', 'english')
        supabase.from('competition_state').update({ projector_theme: next.projector }).eq('id', 'math')
      }
      return next
    })
  }

  const { state, sessions, elapsed, phase: autoPhase, error: adminError, loadState, loadSessions, updateState } = useAdminData({ subject })
  const [phaseOverride, setPhaseOverride] = useState(null)
  const phase = phaseOverride || autoPhase

  useEffect(() => {
    if (!state?.competition_id) return
    const otherSub = subject === SUBJECTS.ENGLISH ? SUBJECTS.MATH : SUBJECTS.ENGLISH
    supabase
      .from('competition_sessions')
      .select('status', { count: 'exact', head: true })
      .eq('competition_id', state.competition_id)
      .eq('subject', otherSub)
      .eq('status', 'completed')
      .then(({ count }) => setOtherSubjectPlayed((count || 0) > 0))
  }, [state?.competition_id, subject])

  const lobbyBusyRef = useRef(false)
  async function handleOpenLobby() {
    if (lobbyBusyRef.current) return
    lobbyBusyRef.current = true
    try {
    const otherSubject = subject === SUBJECTS.ENGLISH ? SUBJECTS.MATH : SUBJECTS.ENGLISH
    const { data: otherState } = await supabase
      .from('competition_state')
      .select('is_unlocked, started_at')
      .eq('id', otherSubject)
      .single()
    if (otherState?.is_unlocked) {
      const otherLabel = otherSubject === 'math' ? 'Mathematics' : 'English Spelling'
      setDialog({
        message: `Cannot open lobby — the ${otherLabel} ${otherState.started_at ? 'competition is still running' : 'lobby is still open'}. End it first before opening a new lobby.`,
        onConfirm: () => setDialog(null),
        onCancel: () => setDialog(null),
      })
      return
    }
    const otherSub = subject === SUBJECTS.ENGLISH ? SUBJECTS.MATH : SUBJECTS.ENGLISH
    const { data: otherSessions } = await supabase
      .from('competition_sessions')
      .select('status')
      .eq('competition_id', state.competition_id)
      .eq('subject', otherSub)
      .eq('status', 'completed')
    const completedOther = otherSessions?.length || 0

    if (completedOther > 0) {
      const subLabel = subject === 'math' ? 'Mathematics' : 'English Spelling'
      const otherLabel = otherSub === 'math' ? 'Mathematics' : 'English Spelling'
      const doOpen = async (mode) => {
        setDialog(null)
        await updateState({ is_unlocked: true, started_at: null, transfer_mode: mode })
        setPhaseOverride(null)
        toast.success('Lobby opened')
      }
      setDialog({
        title: `Open ${subLabel} Lobby`,
        message: `${completedOther} student${completedOther !== 1 ? 's' : ''} completed ${otherLabel}. How should they move to ${subLabel}?`,
        onCancel: () => setDialog(null),
        actions: [
          {
            label: 'Auto-Transfer All',
            className: 'bg-blue-600 hover:bg-blue-500 text-white',
            onClick: () => doOpen('auto'),
          },
          {
            label: 'Let Students Tap to Move',
            className: 'bg-emerald-600 hover:bg-emerald-500 text-white',
            onClick: () => doOpen('manual'),
          },
          {
            label: 'Cancel',
            className: isDark
              ? 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200',
            onClick: () => setDialog(null),
          },
        ],
      })
    } else {
      setDialog({
        message: 'Open the lobby? Students will be able to join via QR code.',
        onConfirm: async () => {
          await updateState({ is_unlocked: true, started_at: null })
          setPhaseOverride(null)
          setDialog(null)
          toast.success('Lobby opened')
        },
        onCancel: () => setDialog(null),
      })
    }
    } finally { lobbyBusyRef.current = false }
  }

  async function handleRosterImport(rows) {
    if (!state) return
    const existingCodes = sessions.map(s => s.participant_code)
    const existingByNameSubject = new Map()
    for (const s of sessions) {
      existingByNameSubject.set(`${s.name}|${s.subject}`, s)
    }
    const inserts = []
    const updates = []
    let skipped = 0
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
        nickname: row.nickname || null,
      }
      for (const [subjectKey, lvl] of [['english', row.english_level], ['math', row.math_level]]) {
        if (!lvl || lvl <= 0) continue
        const key = `${row.name}|${subjectKey}`
        const existing = existingByNameSubject.get(key)
        if (existing) {
          if (existing.level !== lvl) {
            updates.push({ participant_id: existing.participant_id, level: lvl })
          }
          skipped++
        } else {
          existingByNameSubject.set(key, { name: row.name, subject: subjectKey, level: lvl })
          inserts.push({ ...base, subject: subjectKey, level: lvl })
        }
      }
    }
    if (updates.length > 0) {
      for (const u of updates) {
        await supabase.from('competition_sessions').update({ level: u.level, updated_at: new Date().toISOString() }).eq('participant_id', u.participant_id)
      }
    }
    if (inserts.length > 0) {
      const { error } = await supabase.from('competition_sessions').insert(inserts)
      if (error) { toast.error('Roster import failed: ' + error.message); return }
    }
    if (updates.length > 0 || inserts.length > 0) {
      await loadSessions()
      toast.success('Roster imported')
    }
  }

  const newSessionRef = useRef(false)
  async function handleNewSession(copyRoster) {
    if (newSessionRef.current) return
    newSessionRef.current = true
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('')
    const newId = 'comp_' + rnd
    const oldId = state.competition_id

    const { error: histErr } = await supabase.from('competition_history').insert({
      competition_id: oldId,
      round_label: state.round_label || null,
    })
    if (histErr) { toast.error('Failed to create history entry: ' + histErr.message); newSessionRef.current = false; return }

    const { error: stateErr } = await supabase.from('competition_state').update({
      competition_id: newId,
      is_unlocked: false,
      started_at: null,
      duration_seconds: 300,
      extra_seconds: 0,
      announcement: null,
      podium_visible: false,
      podium_level: 1,
      transfer_mode: null,
      round_label: null,
      updated_at: new Date().toISOString(),
    }).in('id', ['english', 'math'])
    if (stateErr) { toast.error('Failed to reset competition state: ' + stateErr.message); newSessionRef.current = false; return }

    if (copyRoster) {
      const { data: oldSessions } = await supabase
        .from('competition_sessions')
        .select('*')
        .eq('competition_id', oldId)
      if (oldSessions?.length) {
        const inserts = oldSessions.map(s => ({
          competition_id: newId,
          participant_code: s.participant_code,
          display_id: s.display_id,
          name: s.name,
          school: s.school,
          country: s.country,
          age: s.age,
          subject: s.subject,
          level: s.level,
          photo_url: s.photo_url,
          nickname: s.nickname,
          status: 'registered',
          provisional_score: 0,
          validated_score: null,
          questions_answered: 0,
          time_spent_seconds: 0,
          ready: false,
          answers_snapshot: null,
          started_at: null,
          completed_at: null,
        }))
        const { error: copyErr } = await supabase.from('competition_sessions').insert(inserts)
        if (copyErr) { toast.error('Failed to copy roster: ' + copyErr.message) }
      }
    }

    setPhaseOverride(null)
    await loadState()
    await loadSessions()
    toast.success('New session created')
    newSessionRef.current = false
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
      {phase !== 'history' && (
        <AdminHeader
          subject={subject}
          setSubject={(s) => { setSubject(s); setPhaseOverride(null) }}
          phase={phase}
          autoPhase={autoPhase}
          isDark={isDark}
          onLogout={handleLogout}
          onPhaseClick={(p) => setPhaseOverride(p == null || p === autoPhase ? null : p)}
          onDiagnostics={() => setShowDiagnostics(true)}
          onThemeModal={() => setShowThemeModal(true)}
          competitionId={state.competition_id}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {adminError && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-bold ${isDark ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
            Error: {adminError}
          </div>
        )}
        <AnimatePresence mode="wait">
          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ModuleBoundary label="Setup">
                <SetupPhase
                  state={state}
                  sessions={sessions}
                  subject={subject}
                  isDark={isDark}
                  autoPhase={autoPhase}
                  updateState={updateState}
                  loadSessions={loadSessions}
                  onOpenLobby={handleOpenLobby}
                  onShowUpload={() => setShowUpload(true)}
                  onNewSession={(copyRoster) => {
                    const action = copyRoster ? 'keep the current roster' : 'start completely fresh (empty roster)'
                    setDialog({
                      title: 'New Session',
                      message: `Create a new competition session? This will ${action}. The current session will be saved to history.`,
                      onConfirm: async () => { setDialog(null); await handleNewSession(copyRoster) },
                      onCancel: () => setDialog(null),
                    })
                  }}
                />
              </ModuleBoundary>
            </motion.div>
          )}

          {phase === 'lobby' && (
            <motion.div key="lobby" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ModuleBoundary label="Lobby">
                <LobbyPhase
                  state={state}
                  sessions={sessions}
                  subject={subject}
                  isDark={isDark}
                  autoPhase={autoPhase}
                  updateState={updateState}
                  loadSessions={loadSessions}
                  onBackToSetup={() => setPhaseOverride(null)}
                />
              </ModuleBoundary>
            </motion.div>
          )}

          {phase === 'live' && (
            <motion.div key="live" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ModuleBoundary label="Live Competition">
                <LivePhase
                  state={state}
                  sessions={sessions}
                  elapsed={elapsed}
                  subject={subject}
                  isDark={isDark}
                  autoPhase={autoPhase}
                  updateState={updateState}
                  loadSessions={loadSessions}
                />
              </ModuleBoundary>
            </motion.div>
          )}

          {phase === 'results' && (
            <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ModuleBoundary label="Results">
              <ResultsPhase
                state={state}
                sessions={sessions}
                subject={subject}
                isDark={isDark}
                updateState={updateState}
                loadSessions={loadSessions}
                onShowPodium={() => setPhaseOverride('podium')}
                onSwitchSubject={(sub) => {
                  const label = sub === 'math' ? 'Mathematics' : 'English Spelling'
                  const prevSubject = sub === 'math' ? 'english' : 'math'
                  const completedCount = sessions.filter(s => s.status === 'completed').length

                  const doTransfer = async (mode) => {
                    setDialog(null)
                    const now = new Date().toISOString()
                    await Promise.all([
                      supabase.from('competition_state').update({
                        is_unlocked: false, started_at: null, podium_visible: false, updated_at: now,
                      }).eq('id', prevSubject),
                      supabase.from('competition_state').update({
                        is_unlocked: true, started_at: null,
                        extra_seconds: 0, announcement: null,
                        transfer_mode: mode, updated_at: now,
                      }).eq('id', sub),
                    ])
                    setPhaseOverride(null)
                    setSubject(sub)
                  }

                  setDialog({
                    title: `Open ${label} Lobby`,
                    message: `${completedCount} student${completedCount !== 1 ? 's' : ''} completed ${subject === 'english' ? 'English Spelling' : 'Mathematics'}. How should they move to ${label}?`,
                    onCancel: () => setDialog(null),
                    actions: [
                      {
                        label: '⚡ Auto-Transfer All Students',
                        className: 'bg-blue-600 hover:bg-blue-500 text-white',
                        onClick: () => doTransfer('auto'),
                      },
                      {
                        label: '👆 Let Students Tap to Move',
                        className: 'bg-emerald-600 hover:bg-emerald-500 text-white',
                        onClick: () => doTransfer('manual'),
                      },
                      {
                        label: 'Cancel',
                        className: isDark
                          ? 'bg-white/5 hover:bg-white/10 text-slate-400'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-500',
                        onClick: () => setDialog(null),
                      },
                    ],
                  })
                }}
              />
              </ModuleBoundary>
            </motion.div>
          )}
          {phase === 'podium' && (
            <motion.div key="podium" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ModuleBoundary label="Podium">
                <PodiumPhase
                  state={state}
                  sessions={sessions}
                  subject={subject}
                  isDark={isDark}
                  updateState={updateState}
                  otherSubjectPlayed={otherSubjectPlayed}
                  onEndCompetition={async () => {
                    try {
                      const now = new Date().toISOString()
                      await Promise.all([
                        supabase.from('competition_state').update({
                          is_unlocked: false, started_at: null, podium_visible: false, updated_at: now,
                        }).eq('id', 'english'),
                        supabase.from('competition_state').update({
                          is_unlocked: false, started_at: null, podium_visible: false, updated_at: now,
                        }).eq('id', 'math'),
                      ])
                      await handleNewSession(true)
                      toast.success('Competition ended')
                    } catch (err) {
                      toast.error('Failed to end session: ' + (err.message || 'Unknown error'))
                    }
                  }}
                  onProceedToSubject={(sub) => {
                    const label = sub === 'math' ? 'Mathematics' : 'English Spelling'
                    const completedCount = sessions.filter(s => s.subject === subject && s.status === 'completed').length

                    const doTransfer = async (mode) => {
                      setDialog(null)
                      const now = new Date().toISOString()
                      await Promise.all([
                        supabase.from('competition_state').update({
                          is_unlocked: false, started_at: null, podium_visible: false, updated_at: now,
                        }).eq('id', subject),
                        supabase.from('competition_state').update({
                          is_unlocked: true, started_at: null,
                          extra_seconds: 0, announcement: null,
                          transfer_mode: mode, updated_at: now,
                        }).eq('id', sub),
                      ])
                      setPhaseOverride(null)
                      setSubject(sub)
                    }

                    setDialog({
                      title: `Open ${label} Lobby`,
                      message: `${completedCount} student${completedCount !== 1 ? 's' : ''} completed ${subject === 'english' ? 'English Spelling' : 'Mathematics'}. How should they move to ${label}?`,
                      onCancel: () => setDialog(null),
                      actions: [
                        {
                          label: 'Auto-Transfer All Students',
                          className: 'bg-blue-600 hover:bg-blue-500 text-white',
                          onClick: () => doTransfer('auto'),
                        },
                        {
                          label: 'Let Students Tap to Move',
                          className: 'bg-emerald-600 hover:bg-emerald-500 text-white',
                          onClick: () => doTransfer('manual'),
                        },
                        {
                          label: 'Cancel',
                          className: isDark
                            ? 'bg-white/5 hover:bg-white/10 text-slate-400'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-500',
                          onClick: () => setDialog(null),
                        },
                      ],
                    })
                  }}
                />
              </ModuleBoundary>
            </motion.div>
          )}

          {phase === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <Suspense fallback={<div className="flex justify-center py-12"><div className={`animate-spin w-8 h-8 border-4 border-t-transparent rounded-full ${isDark ? 'border-blue-500' : 'border-blue-600'}`} /></div>}>
                <ModuleBoundary label="History">
                  <HistoryPhase isDark={isDark} onBack={() => setPhaseOverride(null)} />
                </ModuleBoundary>
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {(autoPhase === 'setup' || autoPhase === 'lobby') && (
        <RosterUpload
          open={showUpload}
          onClose={() => setShowUpload(false)}
          onImport={handleRosterImport}
          competitionId={state.competition_id}
          subject={subject}
          isDark={isDark}
        />
      )}

      <ConfirmDialog dialog={dialog} isDark={isDark} />

      {showDiagnostics && (
        <Suspense fallback={null}>
          <ModuleBoundary label="Diagnostics">
            <DiagnosticsPanel isDark={isDark} onClose={() => setShowDiagnostics(false)} />
          </ModuleBoundary>
        </Suspense>
      )}

      {showThemeModal && (
        <Suspense fallback={null}>
          <ModuleBoundary label="Theme">
            <ThemeModal
              themes={themes}
              onToggle={toggleTheme}
              onClose={() => setShowThemeModal(false)}
            />
          </ModuleBoundary>
        </Suspense>
      )}

    </div>
  )
}
