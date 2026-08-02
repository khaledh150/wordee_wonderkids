import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'

export default function useAdminData({ subject }) {
  const [state, setState] = useState(null)
  const [sessions, setSessions] = useState([])
  const [elapsed, setElapsed] = useState(null)
  const [error, setError] = useState(null)
  const channelRef = useRef(null)
  const stateRef = useRef(null)
  const fetchingStateRef = useRef(false)
  const fetchingSessionsRef = useRef(false)

  const loadState = useCallback(async () => {
    if (fetchingStateRef.current) return
    fetchingStateRef.current = true
    try {
      const { data, error: fetchError } = await supabase
        .from('competition_state')
        .select('*')
        .eq('id', subject)
        .single()
      if (fetchError) { setError(fetchError.message); return null }
      setError(null)
      if (data) {
        stateRef.current = data
        setState(prev => {
          if (prev && prev.competition_id === data.competition_id
            && prev.is_unlocked === data.is_unlocked
            && prev.started_at === data.started_at
            && prev.podium_visible === data.podium_visible
            && prev.podium_level === data.podium_level
            && prev.extra_seconds === data.extra_seconds
            && prev.announcement === data.announcement
            && prev.theme === data.theme) return prev
          return data
        })
      }
      return data
    } finally { fetchingStateRef.current = false }
  }, [subject])

  const loadSessions = useCallback(async (levelFilter) => {
    const s = stateRef.current
    if (!s || fetchingSessionsRef.current) return
    fetchingSessionsRef.current = true
    try {
      let q = supabase
        .from('competition_sessions')
        .select('participant_id, participant_code, display_id, competition_id, name, nickname, school, country, age, subject, level, status, provisional_score, validated_score, questions_answered, time_spent_seconds, ready, started_at, completed_at, updated_at, last_seen_at, photo_url')
        .eq('competition_id', s.competition_id)
        .eq('subject', subject)
      if (levelFilter) q = q.eq('level', levelFilter)
      const { data, error: fetchError } = await q
      if (fetchError) { setError(fetchError.message); return }
      setError(null)
      if (data) setSessions(prev => {
        if (prev.length !== data.length) return data
        const changed = data.some((d, i) => {
          const p = prev[i]
          return !p || p.participant_id !== d.participant_id
            || p.status !== d.status
            || p.provisional_score !== d.provisional_score
            || p.validated_score !== d.validated_score
            || p.questions_answered !== d.questions_answered
            || p.time_spent_seconds !== d.time_spent_seconds
            || p.ready !== d.ready
            || p.completed_at !== d.completed_at
            || p.last_seen_at !== d.last_seen_at
        })
        return changed ? data : prev
      })
    } finally { fetchingSessionsRef.current = false }
  }, [subject])

  const updateState = useCallback(async (fields) => {
    if (!stateRef.current) return
    const { error } = await supabase
      .from('competition_state')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', subject)
    if (error) throw error
    await loadState()
  }, [subject, loadState])

  useEffect(() => { loadState() }, [loadState])

  const compId = state?.competition_id
  useEffect(() => { if (compId) loadSessions() }, [compId, loadSessions])

  // Poll state every 2 seconds
  useEffect(() => {
    const id = setInterval(loadState, 2000)
    return () => clearInterval(id)
  }, [loadState])

  // Realtime subscription on competition_sessions + polling fallback
  useEffect(() => {
    if (!compId) return
    const ch = supabase
      .channel(`admin-sessions-${subject}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'competition_sessions',
        filter: `competition_id=eq.${compId}`
      }, () => {
        loadSessions()
      })
      .subscribe()
    channelRef.current = ch
    const pollId = setInterval(loadSessions, 2000)
    return () => {
      clearInterval(pollId)
      supabase.removeChannel(ch)
    }
  }, [compId, subject, loadSessions])

  // Elapsed timer
  useEffect(() => {
    if (!state?.started_at || !state?.is_unlocked) return
    const start = new Date(state.started_at).getTime()
    const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'completed')
    const allDone = activeSessions.length > 0 && activeSessions.every(s => s.status === 'completed')
    if (allDone) {
      const completedWithTime = activeSessions.filter(s => s.completed_at)
      if (completedWithTime.length > 0) {
        const lastDone = Math.max(...completedWithTime.map(s => new Date(s.completed_at).getTime()))
        setElapsed(Math.round((lastDone - start) / 1000))
      }
      return
    }
    const id = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [state?.started_at, state?.is_unlocked, sessions])

  const phase = (() => {
    if (!state) return 'setup'
    const hasCompleted = sessions.some(s => s.status === 'completed')
    const hasActive = sessions.some(s => s.status === 'active')
    if (state.is_unlocked && state.started_at) return 'live'
    if (state.is_unlocked && !state.started_at) return 'lobby'
    if (!state.is_unlocked && (hasCompleted || hasActive)) return 'results'
    return 'setup'
  })()

  return { state, sessions, elapsed, phase, error, loadState, loadSessions, updateState }
}
