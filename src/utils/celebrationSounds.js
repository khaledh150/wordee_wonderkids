import { isVOMuted } from './audioPlayer'

let Tone = null
let loading = null

async function ensureTone() {
  if (Tone) return Tone
  if (loading) return loading
  loading = import('tone').then(m => { Tone = m; return m }).catch(e => { loading = null; throw e })
  return loading
}

async function startContext() {
  const T = await ensureTone()
  if (T.getContext().state !== 'running') {
    await T.start()
  }
  return T
}

export async function playFanfare() {
  if (isVOMuted()) return
  const T = await startContext()
  const synth = new T.PolySynth(T.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
    volume: -8,
  }).toDestination()

  const now = T.now()
  const notes = ['C4', 'E4', 'G4', 'C5', 'E5']
  notes.forEach((note, i) => {
    synth.triggerAttackRelease(note, '4n', now + i * 0.15)
  })
  synth.triggerAttackRelease(['C5', 'E5', 'G5'], '2n', now + notes.length * 0.15)

  setTimeout(() => synth.dispose(), 4000)
}

export async function playDrumroll() {
  if (isVOMuted()) return
  const T = await startContext()
  const noise = new T.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0.02 },
    volume: -15,
  }).toDestination()

  const now = T.now()
  const hits = 24
  for (let i = 0; i < hits; i++) {
    const time = now + i * 0.06
    const vol = -20 + (i / hits) * 10
    noise.volume.setValueAtTime(vol, time)
    noise.triggerAttackRelease('32n', time)
  }

  setTimeout(() => noise.dispose(), 3000)
}

export async function playLevelTransition() {
  if (isVOMuted()) return
  const T = await startContext()
  const synth = new T.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.3 },
    volume: -10,
  }).toDestination()

  const now = T.now()
  const notes = ['G4', 'B4', 'D5', 'G5']
  notes.forEach((note, i) => {
    synth.triggerAttackRelease(note, '16n', now + i * 0.08)
  })

  setTimeout(() => synth.dispose(), 2000)
}

export async function playApplause() {
  if (isVOMuted()) return
  const T = await startContext()
  const filter = new T.Filter(3000, 'lowpass').toDestination()
  const noise = new T.Noise('pink').connect(filter)
  const gain = new T.Gain(0).connect(filter)
  noise.disconnect()
  noise.connect(gain)

  noise.start()
  const now = T.now()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.15, now + 0.5)
  gain.gain.linearRampToValueAtTime(0.12, now + 2)
  gain.gain.linearRampToValueAtTime(0, now + 4)

  setTimeout(() => {
    noise.stop()
    noise.dispose()
    filter.dispose()
    gain.dispose()
  }, 5000)
}

export async function playCelebrationSequence() {
  if (isVOMuted()) return
  await playDrumroll().catch(() => {})
  setTimeout(() => {
    playFanfare().catch(() => {})
    setTimeout(() => playApplause().catch(() => {}), 600)
  }, 1500)
}
