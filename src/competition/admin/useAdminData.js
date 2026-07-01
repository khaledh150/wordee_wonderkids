import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'

export default function useAdminData({ subject }) {
  const [state, setState] = useState(null)
  const [sessions, setSessions] = useState([])
  const [elapsed, setElapsed] = useState(null)
  const channelRef = useRef(null)
  const debounceRef = useRef(null)

  const loadState = useCallback(async () => {
    const { data } = await supabase
      .from('competition_state')
      .select('*')
      .eq('id', subject)
      .single()
    if (data) setState(data)
    return data
  }, [subject])

  const loadSessions = useCallback(async (levelFilter) => {
    if (!state) return
    let q = supabase
      .from('competition_sessions')
      .select('*')
      .eq('competition_id', state.competition_id)
      .eq('subject', subject)
    if (levelFilter) q = q.eq('level', levelFilter)
    const { data } = await q
    if (data) setSessions(data)
  }, [state, subject])

  const updateState = useCallback(async (fields) => {
    if (!state) return
    const { error } = await supabase
      .from('competition_state')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', subject)
    if (error) throw error
    await loadState()
  }, [state, subject, loadState])

  useEffect(() => { loadState() }, [loadState])
  useEffect(() => { loadSessions() }, [loadSessions])

  // Poll state every 10 seconds
  useEffect(() => {
    const id = setInterval(loadState, 10_000)
    return () => clearInterval(id)
  }, [loadState])

  // Realtime subscription on competition_sessions, debounced
  useEffect(() => {
    if (!state) return
    const ch = supabase
      .channel('admin-sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'competition_sessions',
        filter: `competition_id=eq.${state.competition_id}`
      }, () => {
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(loadSessions, 1000)
      })
      .subscribe()
    channelRef.current = ch
    return () => supabase.removeChannel(ch)
  }, [state?.competition_id, loadSessions])

  // Elapsed timer
  useEffect(() => {
    if (!state?.started_at || !state?.is_unlocked) {
      setElapsed(null)
      return
    }
    const start = new Date(state.started_at).getTime()
    const allDone = sessions.length > 0
      && sessions.filter(s => s.status !== 'waiting' || s.ready).every(s => s.status === 'completed')
    if (allDone && sessions.some(s => s.status === 'completed')) {
      const lastCompleted = Math.max(
        ...sessions.filter(s => s.completed_at).map(s => new Date(s.completed_at).getTime())
      )
      setElapsed(Math.round((lastCompleted - start) / 1000))
      return
    }
    const id = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [state?.started_at, state?.is_unlocked, sessions])

  // Derive phase
  const phase = (() => {
    if (!state) return 'setup'
    const hasActive = sessions.some(s => s.status === 'active')
    const hasCompleted = sessions.some(s => s.status === 'completed')
    if (hasActive) return 'live'
    if (state.is_unlocked && !hasActive) return 'lobby'
    if (!state.is_unlocked && hasCompleted) return 'results'
    return 'setup'
  })()

  return { state, sessions, elapsed, phase, loadState, loadSessions, updateState }
}
