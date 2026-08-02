import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { seededShuffle } from './seededShuffle'

const FUNC_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'
const SYNC_INTERVAL = 12_000
const JITTER_MAX = 3_000
const POLL_INTERVAL = 25_000
const HEARTBEAT_INTERVAL = 30_000
const ACTIVE_POLL_INTERVAL = 60_000

function jitter(base) { return base + Math.random() * JITTER_MAX }

function storageKey(competitionId) { return `wordee_comp_${competitionId}` }

function loadLocal(competitionId) {
  try { return JSON.parse(localStorage.getItem(storageKey(competitionId))) || {} } catch { return {} }
}
function saveLocal(competitionId, data) {
  try { localStorage.setItem(storageKey(competitionId), JSON.stringify(data)) } catch {}
}

async function callFunction(name, body) {
  const res = await fetch(`${FUNC_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `${name} failed (${res.status})`)
  return data
}

export function useCompetitionEngine({ competitionId, subject, questions }) {
  const [phase, setPhase] = useState('idle')
  const [session, setSession] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const [answers, setAnswers] = useState([])
  const [correctCount, setCorrectCount] = useState(0)
  const [validatedScore, setValidatedScore] = useState(null)
  const [rank, setRank] = useState(null)
  const [submitError, setSubmitError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [competitionState, setCompetitionState] = useState(null)
  const [orderedQuestions, setOrderedQuestions] = useState([])
  const [hapticPulse, setHapticPulse] = useState(false)
  const [autoStarting, setAutoStarting] = useState(false)
  const [countdownReady, setCountdownReady] = useState(false)
  const autoStartRef = useRef(false)
  const startRaceRef = useRef(null)

  const timerRef = useRef(null)
  const syncRef = useRef(null)
  const pollRef = useRef(null)
  const heartbeatRef = useRef(null)
  const answersRef = useRef(answers)
  const correctCountRef = useRef(correctCount)
  const phaseRef = useRef(phase)
  const submittingRef = useRef(false)
  const sessionRef = useRef(session)
  const timeLeftRef = useRef(timeLeft)
  const lastSyncedLenRef = useRef(0)
  const unmountedRef = useRef(false)
  const saveDebounceRef = useRef(null)
  const autoSubmitRef = useRef(null)
  const deadlineRef = useRef(null)
  const broadcastRef = useRef(null)
  const [isOffline, setIsOffline] = useState(false)
  const syncFailCountRef = useRef(0)

  useEffect(() => { return () => { unmountedRef.current = true } }, [])

  // Multi-tab detection via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(`wordee_comp_${competitionId}`)
    broadcastRef.current = channel
    channel.postMessage({ type: 'tab_open', ts: Date.now() })
    channel.onmessage = (e) => {
      if (e.data?.type === 'tab_open' && phaseRef.current === 'active') {
        channel.postMessage({ type: 'tab_active', ts: Date.now() })
      }
      if (e.data?.type === 'tab_active' && phaseRef.current === 'active') {
        alert('Competition is open in another tab. This tab will be disabled to protect your score.')
        setPhase('idle')
        clearInterval(timerRef.current)
        clearTimeout(syncRef.current)
        clearTimeout(pollRef.current)
        clearTimeout(heartbeatRef.current)
        clearTimeout(autoSubmitRef.current)
      }
    }
    return () => { channel.close(); broadcastRef.current = null }
  }, [competitionId])

  // Online/offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => { setIsOffline(false); syncFailCountRef.current = 0 }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline) }
  }, [])

  const subjectRef = useRef(subject)
  answersRef.current = answers
  correctCountRef.current = correctCount
  phaseRef.current = phase
  sessionRef.current = session
  timeLeftRef.current = timeLeft

  // Keep subjectRef in sync (no reset — joinCompetition handles state)
  useEffect(() => {
    subjectRef.current = subject
  }, [subject])

  // ── Poll competition_state ──
  const pollState = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('competition_state')
        .select('is_unlocked, active_level, extra_seconds, announcement, duration_seconds, theme, started_at, competition_id')
        .eq('id', subject)
        .single()
      if (error) { console.warn('Poll state error:', error.message); return }
      if (data) {
        if (competitionId && data.competition_id && data.competition_id !== competitionId) {
          if (phaseRef.current !== 'completed') {
            window.location.reload()
          }
          return
        }
        setCompetitionState(data)
        setAnnouncement(data.announcement || '')
      }
    } catch (e) { console.warn('Poll state exception:', e) }
  }, [subject, competitionId])

  // ── Heartbeat ──
  const sendHeartbeat = useCallback(async (ready = false) => {
    if (!sessionRef.current) return
    try {
      await callFunction('heartbeat', {
        participant_code: sessionRef.current.participant_code,
        competition_id: competitionId,
        subject: subjectRef.current,
        ready: ready || undefined,
      })
    } catch {}
  }, [competitionId])

  // Poll on mount — moderate (5s+jitter) when waiting in lobby, normal (15s) otherwise
  const lobbyPoll = phase === 'waiting'
  useEffect(() => {
    let cancelled = false
    function tick() {
      pollState()
      if (!cancelled) {
        const interval = lobbyPoll ? 8_000 + Math.random() * 3_000 : jitter(POLL_INTERVAL)
        pollRef.current = setTimeout(tick, interval)
      }
    }
    tick()
    return () => { cancelled = true; clearTimeout(pollRef.current) }
  }, [pollState, lobbyPoll])

  // Heartbeat while waiting
  useEffect(() => {
    if (phase !== 'waiting' || !session) return
    let cancelled = false
    function tick() { sendHeartbeat(); if (!cancelled) heartbeatRef.current = setTimeout(tick, jitter(HEARTBEAT_INTERVAL)) }
    tick()
    return () => { cancelled = true; clearTimeout(heartbeatRef.current) }
  }, [phase, session, sendHeartbeat])

  // Auto-start: when admin starts the competition, signal countdown ready
  // The actual startRace() is deferred until AFTER the UI countdown finishes
  useEffect(() => {
    if (phase !== 'waiting' || !session || !competitionState?.started_at) return
    if (autoStartRef.current) return
    autoStartRef.current = true
    setCountdownReady(true)
  }, [phase, session, competitionState?.started_at])

  // triggerStart: called by CompetitionPlayPage AFTER countdown animation finishes
  // Retries up to 5 times with exponential backoff if startRace fails
  const triggerStart = useCallback(() => {
    setAutoStarting(true)
    let attempt = 0

    async function tryStart() {
      try {
        const ok = await startRaceRef.current()
        if (!ok) {
          attempt++
          if (attempt <= 5) {
            const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000) + Math.random() * 1000
            setTimeout(tryStart, backoff)
          } else {
            setAutoStarting(false)
            setCountdownReady(false)
            autoStartRef.current = false
          }
        }
      } catch {
        attempt++
        if (attempt <= 5) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000) + Math.random() * 1000
          setTimeout(tryStart, backoff)
        } else {
          setAutoStarting(false)
          setCountdownReady(false)
          autoStartRef.current = false
        }
      }
    }

    tryStart()
  }, [])

  // Keep polling during active (for time extensions only — reduced frequency)
  useEffect(() => {
    if (phase !== 'active') return
    let cancelled = false; let tid
    function tick() { pollState(); if (!cancelled) tid = setTimeout(tick, jitter(ACTIVE_POLL_INTERVAL)) }
    tid = setTimeout(tick, jitter(POLL_INTERVAL))
    return () => { cancelled = true; clearTimeout(tid) }
  }, [phase, pollState])

  // ── Restore from localStorage ──
  const restoredEngineRef = useRef(false)
  useEffect(() => {
    if (!competitionId || restoredEngineRef.current) return
    restoredEngineRef.current = true
    const saved = loadLocal(competitionId)
    if (saved.participantCode && saved.session) {
      setSession(saved.session)
      setAnswers(saved.answers || [])
      setCorrectCount(saved.correctCount || 0)
      if (saved.phase === 'completed') {
        setPhase('completed')
        if (saved.validatedScore != null) setValidatedScore(saved.validatedScore)
        if (saved.rank != null) setRank(saved.rank)
      } else {
        setPhase('waiting')
      }
    }
  }, [competitionId])

  // Set orderedQuestions once questions arrive and we have a session
  useEffect(() => {
    if (questions && session?.participant_id && orderedQuestions.length === 0) {
      setOrderedQuestions(seededShuffle(questions, session.participant_id))
    }
  }, [questions, session])

  // ── Join ──
  const joinCompetition = useCallback(async (participantCode, subjectOverride) => {
    const joinSubject = subjectOverride || subject
    if (subjectOverride) {
      clearInterval(timerRef.current)
      clearTimeout(syncRef.current)
      clearTimeout(autoSubmitRef.current)
      submittingRef.current = false
      autoStartRef.current = false
      setAutoStarting(false)
      setCountdownReady(false)
      lastSyncedLenRef.current = 0
      setTimeLeft(null)
      deadlineRef.current = null
      setAnswers([])
      setCorrectCount(0)
      setValidatedScore(null)
      setRank(null)
      setSubmitError(false)
      setIsSubmitting(false)
      setOrderedQuestions([])
      subjectRef.current = subjectOverride
    }
    const result = await callFunction('join', {
      participant_code: participantCode,
      competition_id: competitionId,
      subject: joinSubject,
    })

    const sess = { ...result, participant_code: participantCode }
    setSession(sess)
    if (questions) setOrderedQuestions(seededShuffle(questions, result.participant_id))

    if (result.completed) {
      setPhase('completed')
      setValidatedScore(result.validated_score)
      if (result.rank != null) setRank(result.rank)
      saveLocal(competitionId, { participantCode, phase: 'completed', validatedScore: result.validated_score, rank: result.rank ?? null, session: sess, answers: [], correctCount: 0 })
      return result
    }

    if (result.resume && result.remaining > 0) {
      const serverAnswers = result.answers_snapshot || []
      const saved = loadLocal(competitionId)
      const localAnswers = saved.answers || []
      // Use whichever has more answers (server snapshot or local)
      const restoredAnswers = serverAnswers.length >= localAnswers.length ? serverAnswers : localAnswers
      const restoredCorrect = saved.correctCount || 0

      setAnswers(restoredAnswers)
      setCorrectCount(restoredCorrect)
      deadlineRef.current = Date.now() + result.remaining * 1000
      setTimeLeft(result.remaining)
      setPhase('active')
      saveLocal(competitionId, { participantCode, phase: 'active', answers: restoredAnswers, correctCount: restoredCorrect, session: sess })
      return result
    }

    // Not started or waiting
    setPhase('waiting')
    setAnswers([])
    setCorrectCount(0)
    saveLocal(competitionId, { participantCode, phase: 'waiting', answers: [], correctCount: 0, session: sess })
    return result
  }, [competitionId, subject, questions])

  // ── Start Race ──
  const startRace = useCallback(async () => {
    if (!session) return false
    const result = await callFunction('join', {
      participant_code: session.participant_code,
      competition_id: competitionId,
      subject: subjectRef.current,
    })

    const sess = { ...result, participant_code: session.participant_code }
    setSession(sess)

    if (result.completed) {
      setPhase('completed')
      setValidatedScore(result.validated_score)
      if (result.rank != null) setRank(result.rank)
      saveLocal(competitionId, { ...loadLocal(competitionId), phase: 'completed', validatedScore: result.validated_score, rank: result.rank ?? null, session: sess })
      return true
    }

    // Server returned not_started (competition not unlocked yet)
    if (result.not_started || !result.remaining) {
      return false
    }

    if (result.resume && result.remaining > 0) {
      deadlineRef.current = Date.now() + result.remaining * 1000
      setTimeLeft(result.remaining)
      setPhase('active')
      saveLocal(competitionId, { ...loadLocal(competitionId), phase: 'active', session: sess })
      return true
    }

    // Fresh start
    if (result.remaining > 0) {
      deadlineRef.current = Date.now() + result.remaining * 1000
      setTimeLeft(result.remaining)
      setPhase('active')
      saveLocal(competitionId, { ...loadLocal(competitionId), phase: 'active', session: sess })
      return true
    }
    return false
  }, [session, competitionId, subject])
  startRaceRef.current = startRace

  // ── Timer (clock-based to avoid drift from throttled setInterval) ──
  useEffect(() => {
    if (phase !== 'active' || timeLeft == null || timeLeft <= 0 || !deadlineRef.current) return

    timerRef.current = setInterval(() => {
      const next = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))

      if ((next === 60 || next === 30) && timeLeftRef.current > next) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(next === 30 ? [200, 100, 200] : [200])
        }
        setHapticPulse(true)
        setTimeout(() => setHapticPulse(false), 1000)
      }

      setTimeLeft(next)

      if (next <= 0) {
        clearInterval(timerRef.current)
        autoSubmitRef.current = setTimeout(() => { if (phaseRef.current === 'active' && !submittingRef.current) doSubmit() }, Math.random() * 5000)
      }
    }, 1000)

    return () => { clearInterval(timerRef.current); if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current) }
  }, [phase])

  // Re-sync timer+deadline when tab becomes visible or time is extended
  useEffect(() => {
    if (phase !== 'active' || !competitionState || !sessionRef.current?.started_at) return
    const resync = () => {
      const total = (competitionState.duration_seconds || 300) + (competitionState.extra_seconds || 0)
      const elapsed = (Date.now() - new Date(sessionRef.current.started_at).getTime()) / 1000
      const corrected = Math.max(0, Math.round(total - elapsed))
      deadlineRef.current = Date.now() + corrected * 1000
      setTimeLeft(corrected)
      if (corrected <= 0 && !submittingRef.current) {
        clearInterval(timerRef.current)
        autoSubmitRef.current = setTimeout(() => { if (phaseRef.current === 'active' && !submittingRef.current) doSubmit() }, Math.random() * 5000)
      }
    }
    const handleVisibility = () => { if (document.visibilityState === 'visible') resync() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [phase, competitionState])

  // Admin time extension
  useEffect(() => {
    if (phase !== 'active' || !competitionState || !sessionRef.current?.started_at) return
    const total = (competitionState.duration_seconds || 300) + (competitionState.extra_seconds || 0)
    const elapsed = (Date.now() - new Date(sessionRef.current.started_at).getTime()) / 1000
    const newRemaining = Math.max(0, Math.round(total - elapsed))
    if (newRemaining > (timeLeftRef.current || 0) + 2) {
      deadlineRef.current = Date.now() + newRemaining * 1000
      setTimeLeft(newRemaining)
    }
  }, [competitionState?.extra_seconds])

  // ── Sync ──
  useEffect(() => {
    if (phase !== 'active' || !session) return

    const doSync = async () => {
      if (phaseRef.current !== 'active') return
      const hasNewAnswers = answersRef.current.length !== lastSyncedLenRef.current

      setIsSyncing(hasNewAnswers)
      try {
        await callFunction('sync', {
          participant_code: session.participant_code,
          competition_id: competitionId,
          subject: subjectRef.current,
          provisional_score: correctCountRef.current,
          questions_answered: answersRef.current.length,
          answers: answersRef.current,
        })
        lastSyncedLenRef.current = answersRef.current.length
        syncFailCountRef.current = 0
      } catch {
        syncFailCountRef.current++
        if (syncFailCountRef.current >= 2) setIsOffline(true)
      }
      if (hasNewAnswers) setIsSyncing(false)
    }

    let cancelled = false
    function scheduleTick() { if (!cancelled) syncRef.current = setTimeout(() => { doSync(); scheduleTick() }, jitter(SYNC_INTERVAL)) }
    const firstSync = setTimeout(() => { doSync(); scheduleTick() }, 3000)
    return () => { cancelled = true; clearTimeout(syncRef.current); clearTimeout(firstSync) }
  }, [phase, session, competitionId])

  // ── Submit ──
  const doSubmit = useCallback(async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    setSubmitError(false)

    const sess = sessionRef.current
    if (!sess) { submittingRef.current = false; setIsSubmitting(false); return }

    saveLocal(competitionId, { ...loadLocal(competitionId), phase: 'submitting', answers: answersRef.current })

    let retryCount = 0
    const trySubmit = async () => {
      try {
        const result = await callFunction('submit', {
          participant_code: sess.participant_code,
          competition_id: competitionId,
          subject: subjectRef.current,
          answers: answersRef.current,
        })
        setValidatedScore(result.validated_score)
        if (result.rank != null) setRank(result.rank)
        setPhase('completed')
        clearInterval(timerRef.current)
        clearTimeout(syncRef.current)
        saveLocal(competitionId, {
          participantCode: sess.participant_code, phase: 'completed',
          validatedScore: result.validated_score, rank: result.rank ?? null,
          correctCount: correctCountRef.current,
          answers: answersRef.current, session: sess,
        })
        submittingRef.current = false
        setIsSubmitting(false)
      } catch {
        retryCount++
        if (unmountedRef.current) { submittingRef.current = false; return }
        if (retryCount <= 3) setTimeout(trySubmit, Math.min(3000 * Math.pow(2, retryCount - 1), 15000))
        else { submittingRef.current = false; setIsSubmitting(false); setSubmitError(true) }
      }
    }
    await trySubmit()
  }, [competitionId])

  // ── Record Answer ──
  const recordAnswer = useCallback((questionId, submittedAnswer, isCorrect) => {
    setAnswers(prev => {
      const idx = prev.findIndex(a => a.question_id === questionId)
      const entry = { question_id: questionId, submitted_answer: submittedAnswer }
      let next
      if (idx >= 0) { next = [...prev]; next[idx] = entry }
      else {
        next = [...prev, entry]
        if (isCorrect) setCorrectCount(c => c + 1)
      }
      clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = setTimeout(() => {
        saveLocal(competitionId, { ...loadLocal(competitionId), answers: next, correctCount: correctCountRef.current })
      }, 2000)
      return next
    })
  }, [competitionId])

  // ── Manual Finish ──
  const finish = useCallback(() => {
    if (phaseRef.current !== 'active' || submittingRef.current) return
    clearInterval(timerRef.current)
    clearTimeout(autoSubmitRef.current)
    doSubmit()
  }, [doSubmit])

  // ── Mark Ready ──
  const markReady = useCallback(async () => {
    if (!session) return
    await sendHeartbeat(true)
  }, [session, sendHeartbeat])

  return {
    phase, session, timeLeft, currentScore: correctCount,
    questionsAnswered: answers.length, validatedScore, rank, isSyncing, isOffline, isSubmitting,
    announcement, competitionState, orderedQuestions, hapticPulse,
    autoStarting, countdownReady, submitError, joinCompetition, startRace, triggerStart, recordAnswer, finish, markReady, sendHeartbeat,
  }
}
