let voMuted = false
let currentAudio = null
let generationId = 0

export function setVOMuted(muted) { voMuted = muted }
export function isVOMuted() { return voMuted }
export function toggleMute() { voMuted = !voMuted; if (voMuted) stopAll(); return voMuted }

export function stopAll() {
  generationId++
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
  audio.removeAttribute('src')
  audio.load()
}

function playFile(src) {
  return new Promise((resolve) => {
    if (voMuted) return resolve()
    const myGen = generationId
    stopAll()
    generationId = myGen
    const audio = new Audio(src)
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

export function playVO(filePath) {
  return playFile(filePath)
}

export function playWordVO(filename) {
  return playFile(`/audio/vocab/${filename}`)
}

export async function playSFX(name) {
  if (voMuted) return
  const audio = new Audio(`/audio/sfx/${name}`)
  audio.volume = 0.5
  audio.play().catch(() => {})
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
