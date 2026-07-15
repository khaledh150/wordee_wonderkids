const SOUNDS = {
  tap: { frequency: 800, duration: 0.05, type: 'sine' },
  correct: { frequencies: [523, 659, 784], duration: 0.15, type: 'sine' },
  wrong: { frequencies: [300, 250], duration: 0.2, type: 'square' },
  tick: { frequency: 1000, duration: 0.03, type: 'sine' },
  countdown: { frequency: 600, duration: 0.15, type: 'sine' },
  countdownGo: { frequencies: [523, 659, 784, 1047], duration: 0.12, type: 'sine' },
  complete: { frequencies: [523, 659, 784, 1047, 1319], duration: 0.18, type: 'sine' },
  swipe: { frequency: 500, duration: 0.08, type: 'sine', slide: true },
  select: { frequency: 660, duration: 0.06, type: 'sine' },
  timeWarning: { frequencies: [800, 600], duration: 0.15, type: 'square' },
}

let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

function playTone(frequency, duration, type = 'sine', startTime = 0) {
  const ctx = getAudioContext()
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startTime)
  gainNode.gain.setValueAtTime(0.15, ctx.currentTime + startTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration)
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.start(ctx.currentTime + startTime)
  oscillator.stop(ctx.currentTime + startTime + duration)
}

export function playSound(name) {
  try {
    const sound = SOUNDS[name]
    if (!sound) return
    if (sound.frequencies) {
      sound.frequencies.forEach((freq, i) => {
        playTone(freq, sound.duration, sound.type, i * sound.duration * 0.8)
      })
    } else {
      playTone(sound.frequency, sound.duration, sound.type)
    }
  } catch {}
}

export function initAudio() {
  try { getAudioContext() } catch {}
}
