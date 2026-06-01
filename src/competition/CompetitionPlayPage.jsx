import { useState, useEffect, useCallback, useRef } from 'react'
import { useCompetitionEngine } from './useCompetitionEngine'
import { getCompetitionQuestions } from './competitionQuestions'
import { getVocabForLevel } from '../data/vocabulary'
import CompetitionGameView from './CompetitionGameView'

const CONCURRENCY = 5
const CACHE_NAME = 'wordee-competition-assets-v1'

async function cacheAsset(url) {
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(url)
      if (cached) return true
      const response = await fetch(url)
      if (response.ok) await cache.put(url, response)
      return true
    }
  } catch {}
  return false
}

function preloadAsset(url) {
  return new Promise(async (resolve) => {
    const cached = await cacheAsset(url)
    if (url.match(/\.(webp|png|jpg|jpeg|gif|svg)$/i)) {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    } else if (url.match(/\.(mp3|wav|ogg|aac)$/i)) {
      if (cached) { resolve(true); return }
      const audio = new Audio()
      audio.preload = 'auto'
      audio.oncanplaythrough = () => resolve(true)
      audio.onerror = () => resolve(false)
      audio.src = url
    } else {
      resolve(true)
    }
  })
}

async function preloadWithConcurrency(urls, onProgress) {
  const total = urls.length
  if (total === 0) { onProgress(0, 0); return }

  let loaded = 0
  const queue = [...urls]

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift()
      await preloadAsset(url)
      loaded++
      onProgress(loaded, total)
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker())
  await Promise.all(workers)
}

export default function CompetitionPlayPage() {
  const [step, setStep] = useState('code') // code | waiting | active
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 })
  const [preloadDone, setPreloadDone] = useState(false)
  const [questions, setQuestions] = useState(null)
  const competitionId = 'default'

  const engine = useCompetitionEngine({
    competitionId,
    subject: 'english',
    questions,
  })

  const { session, phase, competitionState, announcement, joinCompetition, startRace, markReady } = engine

  // If engine restored state, handle it
  useEffect(() => {
    if (session && questions == null) {
      setQuestions(getCompetitionQuestions(session.level))
    }
    if (phase === 'completed' && session) setStep('active')
    else if (phase === 'waiting' && session) setStep('waiting')
    else if (phase === 'active' && session) setStep('active')
  }, [phase, session])

  // Handle code submission
  async function handleCodeSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setError('')
    setLoading(true)
    try {
      const result = await joinCompetition(code.trim().toUpperCase())
      setQuestions(getCompetitionQuestions(result.level))
      if (result.completed) setStep('active')
      else if (result.resume) setStep('active')
      else setStep('waiting')
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.')
    }
    setLoading(false)
  }

  // Preload images + audio when entering lobby
  useEffect(() => {
    if (step !== 'waiting' || !session) return
    const vocab = getVocabForLevel(session.level)
    const urls = []
    for (const item of vocab) {
      if (item.image) urls.push(item.image)
      if (item.audio) urls.push(item.audio)
    }
    if (urls.length === 0) {
      setPreloadDone(true)
      markReady()
      return
    }

    setPreloadProgress({ loaded: 0, total: urls.length })

    preloadWithConcurrency(urls, (loaded, total) => {
      setPreloadProgress({ loaded, total })
      if (loaded >= total) {
        setPreloadDone(true)
        markReady()
      }
    })
  }, [step, session, markReady])

  // Start race — let engine handle the state, we follow
  async function handleStart() {
    try {
      await startRace()
    } catch (err) {
      setError(err.message || 'Failed to start')
    }
  }


  // ===== SCREENS =====

  // Code entry
  if (step === 'code') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <form onSubmit={handleCodeSubmit} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-indigo-700 mb-2">Competition</h1>
          <p className="text-sm text-gray-500 mb-6">Enter your participant code</p>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123"
            className="w-full text-center text-2xl font-mono tracking-widest border-2 border-indigo-200 rounded-xl px-4 py-4 mb-4 focus:outline-none focus:border-indigo-500 uppercase"
            maxLength={6}
            autoFocus
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Checking...' : 'Join'}
          </button>
        </form>
      </div>
    )
  }

  // Waiting room
  if (step === 'waiting' && session) {
    const isUnlocked = competitionState?.is_unlocked
    const canStart = isUnlocked && preloadDone

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          {/* Student info */}
          <div className="mb-6">
            <p className="text-lg font-bold text-indigo-700">{session.name}</p>
            {session.school && <p className="text-sm text-gray-500">{session.school}</p>}
            <p className="text-sm text-gray-400">Level {session.level}</p>
          </div>

          {/* Announcement */}
          {announcement && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-yellow-800 font-medium">{announcement}</p>
            </div>
          )}

          {/* Preload progress */}
          {!preloadDone && (
            <div className="mb-6">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: preloadProgress.total ? `${(preloadProgress.loaded / preloadProgress.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-400">Getting ready... {preloadProgress.loaded}/{preloadProgress.total}</p>
            </div>
          )}

          {/* Waiting / Start button */}
          {!isUnlocked && (
            <div className="mb-4">
              <div className="inline-block animate-pulse">
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-300 animate-ping" />
                </div>
              </div>
              <p className="text-gray-500">Waiting in lobby...</p>
              {preloadDone && <p className="text-xs text-green-500 mt-1">You're ready!</p>}
            </div>
          )}

          {isUnlocked && !preloadDone && (
            <div className="mb-4">
              <p className="text-orange-500 font-medium">Almost ready... loading assets</p>
            </div>
          )}

          {canStart && (
            <button
              onClick={handleStart}
              className="w-full py-5 bg-green-500 text-white text-2xl font-black rounded-2xl shadow-lg hover:bg-green-600 active:scale-95 transition-all animate-pulse"
            >
              START
            </button>
          )}

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>
      </div>
    )
  }

  // Active game
  if (step === 'active' && session && questions) {
    return <CompetitionGameView engine={engine} level={session.level} />
  }

  return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
}
