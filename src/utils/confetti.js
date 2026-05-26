import confetti from 'canvas-confetti'

export function fireConfetti() {
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }
  confetti({ ...defaults, particleCount: 50, origin: { x: 0.3, y: 0.6 } })
  confetti({ ...defaults, particleCount: 50, origin: { x: 0.7, y: 0.6 } })
}

let celebrationRaf = null

export function fireCelebration() {
  cancelCelebration()
  const end = Date.now() + 1500
  const colors = ['#FF6B9D', '#4ECDC4', '#FFE66D', '#A78BFA', '#FB923C']
  ;(function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors, zIndex: 9999 })
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors, zIndex: 9999 })
    if (Date.now() < end) celebrationRaf = requestAnimationFrame(frame)
    else celebrationRaf = null
  })()
}

export function cancelCelebration() {
  if (celebrationRaf) {
    cancelAnimationFrame(celebrationRaf)
    celebrationRaf = null
  }
}
