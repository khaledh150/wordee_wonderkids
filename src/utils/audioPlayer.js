let voMuted = false
let currentAudio = null
let currentSource = null
let generationId = 0
let audioCtx = null

// Bounded buffer cache: decoded AudioBuffers, max 50 to limit RAM on old devices (~3MB cap)
const bufferCache = new Map()
const CACHE_MAX = 50

function evictOldest() {
  if (bufferCache.size <= CACHE_MAX) return
  const firstKey = bufferCache.keys().next().value
  bufferCache.delete(firstKey)
}

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// Resume AudioContext on EVERY user gesture (not just the first).
// Mobile Safari/iOS Chrome require this to allow programmatic playback from useEffect.
// Listeners are never removed — each tap keeps the audio pipeline warm.
if (typeof window !== 'undefined') {
  const warmAudio = () => {
    try { getAudioContext() } catch {}
  }
  for (const e of ['touchstart', 'touchend', 'mousedown', 'keydown', 'click']) {
    document.addEventListener(e, warmAudio, { capture: true, passive: true })
  }
}

export function setVOMuted(muted) { voMuted = muted }
export function isVOMuted() { return voMuted }
export function toggleMute() { voMuted = !voMuted; if (voMuted) stopAll(); return voMuted }

export function stopAll() {
  generationId++
  if (currentSource) {
    try { currentSource.stop() } catch {}
    currentSource = null
  }
  if (currentAudio) {
    cleanupAudio(currentAudio)
    currentAudio = null
  }
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function cleanupAudio(audio) {
  audio.pause()
  audio.onended = null
  audio.onerror = null
  audio.removeAttribute('src')
}

// Legacy-compatible decodeAudioData — handles both Promise (modern) and callback (iOS < 14)
function safeDecodeAudioData(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const result = ctx.decodeAudioData(arrayBuffer, resolve, reject)
    if (result && typeof result.then === 'function') {
      result.then(resolve, reject)
    }
  })
}

async function fetchAndDecode(url) {
  const ctx = getAudioContext()
  const response = await fetch(url)
  if (!response.ok) throw new Error('fetch failed')
  const arrayBuffer = await response.arrayBuffer()
  return safeDecodeAudioData(ctx, arrayBuffer)
}

function playBuffer(buffer, volume = 1) {
  return new Promise(resolve => {
    if (voMuted) return resolve()
    stopAll()
    const myGen = ++generationId
    try {
      const ctx = getAudioContext()
      const source = ctx.createBufferSource()
      source.buffer = buffer
      if (volume < 1) {
        const gain = ctx.createGain()
        gain.gain.value = volume
        source.connect(gain)
        gain.connect(ctx.destination)
      } else {
        source.connect(ctx.destination)
      }
      currentSource = source
      source.onended = () => {
        if (generationId === myGen) currentSource = null
        resolve()
      }
      source.start(0)
    } catch {
      resolve()
    }
  })
}

// HTML5 Audio fallback — identical to original behavior for devices where AudioContext unavailable
function playFileHTML5(src, volume = 1) {
  return new Promise(resolve => {
    if (voMuted) return resolve()
    stopAll()
    ++generationId
    const audio = new Audio(src)
    audio.volume = volume
    currentAudio = audio
    const done = () => {
      if (currentAudio === audio) {
        cleanupAudio(audio)
        currentAudio = null
      }
      resolve()
    }
    audio.onended = done
    audio.onerror = done
    audio.play().catch(() => { done() })
  })
}

// Primary: AudioContext (immune to autoplay blocks after any user gesture)
// Fallback: HTML5 Audio (same as original code — works on everything, may be blocked on some mobile)
function playFile(src, volume = 1) {
  if (voMuted) return Promise.resolve()
  return fetchAndDecode(src)
    .then(buffer => playBuffer(buffer, volume))
    .catch(() => playFileHTML5(src, volume))
}

export function playVO(filePath) {
  return playFile(filePath)
}

export function preloadAudio(filenames) {
  const BATCH = 4
  let i = 0
  async function loadBatch() {
    const batch = []
    while (i < filenames.length && batch.length < BATCH) {
      const fn = filenames[i++]
      if (bufferCache.has(fn)) continue
      batch.push(
        fetchAndDecode(`/audio/vocab/${fn}`)
          .then(buf => { bufferCache.set(fn, buf); evictOldest() })
          .catch(() => {})
      )
    }
    if (batch.length > 0) await Promise.all(batch)
    if (i < filenames.length) setTimeout(loadBatch, 50)
  }
  loadBatch()
}

export function playWordVO(filename) {
  if (voMuted) return Promise.resolve()
  const cached = bufferCache.get(filename)
  if (cached) return playBuffer(cached)
  return playFile(`/audio/vocab/${filename}`)
}

export function playSFX(name) {
  return playFile(`/audio/sfx/${name}`, 0.5)
}

const encouragementCorrect = [
  'Amazing!', 'Awesome!', 'Beautiful!', 'Bravo!', 'Brilliant!', 'Excellent!',
  'Fantastic!', 'Great job!', 'Hooray!', 'Incredible!', 'Keep it up!',
  'Nailed it!', 'Nice one!', 'Outstanding!', 'Perfect!', 'Right on!',
  'Smart move!', 'So good!', 'Spot on!', 'Success!', 'Super duper!',
  'Terrific!', 'Way to go!', 'Wonderful!', 'You did it!', "You're a star!",
]

const encouragementWrong = [
  'Almost!', "Don't give up, you can do it!", 'Give it another go!',
  "It's okay to make mistakes, try again!", 'Keep trying, you\'re getting better!',
  "Let's try again!", 'One more try!', 'Oops! Try once more!',
  'Oops, try again!', 'So close!', 'Try again!',
]

const celebrations = [
  'All done! You\'re a champion!', 'Great work! Let\'s celebrate!',
  'Lesson complete! Well done!', 'Wonderful! You completed it!',
  'You finished! Amazing work!',
]

let correctIdx = 0
let wrongIdx = 0

export async function playCorrectEncouragement() {
  await playSFX('correct.wav')
  await delay(200)
  const phrase = encouragementCorrect[correctIdx % encouragementCorrect.length]
  correctIdx++
  return playFile(`/audio/common/encouragement_correct/${phrase}.mp3`)
}

export async function playWrongEncouragement() {
  await playSFX('wrong.wav')
  await delay(200)
  const phrase = encouragementWrong[wrongIdx % encouragementWrong.length]
  wrongIdx++
  return playFile(`/audio/common/encouragement_wrong/${phrase}.mp3`)
}

export async function playCelebration() {
  const phrase = celebrations[Math.floor(Math.random() * celebrations.length)]
  return playFile(`/audio/common/celebrations/${phrase}.mp3`)
}

const idleReminders = [
  'Tap the speaker to hear it again!',
  'Need help Tap the speaker!',
]

let idleTimer = null
let idleCallback = null

export function startIdleTimer(onIdle, delayMs = 15000) {
  clearIdleTimer()
  idleCallback = onIdle
  idleTimer = setTimeout(async () => {
    const phrase = idleReminders[Math.floor(Math.random() * idleReminders.length)]
    await playFile(`/audio/common/idle_reminders/${phrase}.mp3`)
    if (idleCallback) idleCallback()
  }, delayMs)
}

export function resetIdleTimer() {
  if (idleTimer && idleCallback) {
    startIdleTimer(idleCallback)
  }
}

export function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  idleCallback = null
}
