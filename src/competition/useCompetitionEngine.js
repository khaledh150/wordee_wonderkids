import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { seededShuffle } from './seededShuffle'

const FUNC_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'
const SYNC_INTERVAL = 30_000
const JITTER_MAX = 5_000
const POLL_INTERVAL = 5_000
const HEARTBEAT_INTERVAL = 15_000
const ACTIVE_POLL_INTERVAL = 30_000

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
  const [isSyncing, setIsSyncing] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [competitionState, setCompetitionState] = useState(null)
  const [orderedQuestions, setOrderedQuestions] = useState([])
  const [hapticPulse, setHapticPulse] = useState(false)

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

  // Reset engine state when subject changes
  useEffect(() => {
    if (subjectRef.current === subject) return
    subjectRef.current = subject
    setPhase('idle')
    setSession(null)
    setTimeLeft(null)
    setAnswers([])
    setCorrectCount(0)
    setValidatedScore(null)
    setRank(null)
    setSubmitError(false)
    setOrderedQuestions([])
    submittingRef.current = false
    lastSyncedLenRef.current = 0
    clearInterval(timerRef.current)
    clearTimeout(syncRef.current)
    clearTimeout(autoSubmitRef.current)
  }, [subject])

  // ── Poll competition_state ──
  const pollState = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('competition_state')
        .select('is_unlocked, active_level, extra_seconds, announcement, duration_seconds, theme, started_at')
        .eq('id', subject)
        .single()
      if (error) { console.warn('Poll state error:', error.message); return }
      if (data) { setCompetitionState(data); setAnnouncement(data.announcement || '') }
    } catch (e) { console.warn('Poll state exception:', e) }
  }, [subject])

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

  // Poll on mount
  useEffect(() => {
    let cancelled = false
    function tick() { pollState(); if (!cancelled) pollRef.current = setTimeout(tick, jitter(POLL_INTERVAL)) }
    tick()
    return () => { cancelled = true; clearTimeout(pollRef.current) }
  }, [pollState])

  // Heartbeat while waiting
  useEffect(() => {
    if (phase !== 'waiting' || !session) return
    let cancelled = false
    function tick() { sendHeartbeat(); if (!cancelled) heartbeatRef.current = setTimeout(tick, jitter(HEARTBEAT_INTERVAL)) }
    tick()
    return () => { cancelled = true; clearTimeout(heartbeatRef.current) }
  }, [phase, session, sendHeartbeat])

  // Keep polling during active (for time extensions only — reduced frequency)
  useEffect(() => {
    if (phase !== 'active') return
    let cancelled = false; let tid
    function tick() { pollState(); if (!cancelled) tid = setTimeout(tick, jitter(ACTIVE_POLL_INTERVAL)) }
    tid = setTimeout(tick, jitter(POLL_INTERVAL))
    return () => { cancelled = true; clearTimeout(tid) }
  }, [phase, pollState])

  // ── Restore from localStorage ──
  // Only restore to 'waiting' — never blindly restore to 'active'.
  // The actual state will be validated via joinCompetition/startRace.
  useEffect(() => {
    const saved = loadLocal(competitionId)
    if (saved.participantCode && saved.session) {
      setSession(saved.session)
      setAnswers(saved.answers || [])
      setCorrectCount(saved.correctCount || 0)
      if (questions) setOrderedQuestions(seededShuffle(questions, saved.session.participant_id))

      if (saved.phase === 'completed' && saved.validatedScore != null) {
        setValidatedScore(saved.validatedScore)
        if (saved.rank != null) setRank(saved.rank)
        setPhase('completed')
      } else {
        // Always go to waiting — startRace will re-validate with server
        setPhase('waiting')
      }
    }
  }, [competitionId, questions])

  // ── Join ──
  const joinCompetition = useCallback(async (participantCode, subjectOverride) => {
    const joinSubject = subjectOverride || subject
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
    if (!session) return
    const result = await callFunction('join', {
      participant_code: session.participant_code,
      competition_id: competitionId,
      subject: subjectRef.current,
    })

    if (result.completed) {
      setPhase('completed')
      setValidatedScore(result.validated_score)
      if (result.rank != null) setRank(result.rank)
      saveLocal(competitionId, { ...loadLocal(competitionId), phase: 'completed', validatedScore: result.validated_score, rank: result.rank ?? null })
      return
    }

    // Server returned not_started (competition not unlocked)
    if (result.not_started || !result.remaining) {
      return
    }

    if (result.resume && result.remaining > 0) {
      setTimeLeft(result.remaining)
      setPhase('active')
      saveLocal(competitionId, { ...loadLocal(competitionId), phase: 'active' })
      return
    }

    // Fresh start
    if (result.remaining > 0) {
      setTimeLeft(result.remaining)
      setPhase('active')
      saveLocal(competitionId, { ...loadLocal(competitionId), phase: 'active' })
    }
  }, [session, competitionId, subject])

  // ── Timer ──
  useEffect(() => {
    if (phase !== 'active' || timeLeft == null || timeLeft <= 0) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev == null || prev <= 0) { clearInterval(timerRef.current); return 0 }
        const next = prev - 1

        if (next === 60 || next === 30) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(next === 30 ? [200, 100, 200] : [200])
          }
          setHapticPulse(true)
          setTimeout(() => setHapticPulse(false), 1000)
        }

        if (next <= 0) {
          clearInterval(timerRef.current)
          autoSubmitRef.current = setTimeout(() => { if (phaseRef.current === 'active' && !submittingRef.current) doSubmit() }, Math.random() * 3000)
          return 0
        }
        return next
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [phase])

  // Admin time extension
  useEffect(() => {
    if (phase !== 'active' || !competitionState || !sessionRef.current?.started_at) return
    const total = (competitionState.duration_seconds || 300) + (competitionState.extra_seconds || 0)
    const elapsed = (Date.now() - new Date(sessionRef.current.started_at).getTime()) / 1000
    const newRemaining = Math.max(0, Math.round(total - elapsed))
    if (newRemaining > (timeLeftRef.current || 0) + 2) setTimeLeft(newRemaining)
  }, [competitionState?.extra_seconds])

  // ── Sync ──
  useEffect(() => {
    if (phase !== 'active' || !session) return

    const doSync = async () => {
      if (phaseRef.current !== 'active') return
      // Only sync if there are new answers
      if (answersRef.current.length === lastSyncedLenRef.current) return

      setIsSyncing(true)
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
      setIsSyncing(false)
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

    const sess = sessionRef.current
    if (!sess) { submittingRef.current = false; return }

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
      } catch {
        retryCount++
        if (unmountedRef.current) { submittingRef.current = false; return }
        if (retryCount <= 3) setTimeout(trySubmit, Math.min(3000 * Math.pow(2, retryCount - 1), 15000))
        else { submittingRef.current = false; setSubmitError(true) }
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
      else { next = [...prev, entry] }
      clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = setTimeout(() => {
        saveLocal(competitionId, { ...loadLocal(competitionId), answers: next, correctCount: correctCountRef.current })
      }, 2000)
      return next
    })
    if (isCorrect) setCorrectCount(prev => prev + 1)
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
    questionsAnswered: answers.length, validatedScore, rank, isSyncing, isOffline,
    announcement, competitionState, orderedQuestions, hapticPulse,
    submitError, joinCompetition, startRace, recordAnswer, finish, markReady, sendHeartbeat,
  }
}
