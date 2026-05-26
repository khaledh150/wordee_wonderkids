const loaded = new Set()
const failed = new Set()

const scheduleIdle = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
  ? (cb) => window.requestIdleCallback(cb)
  : (cb) => setTimeout(cb, 100)

export function preloadLevelImages(vocab, batchSize = 15) {
  let i = 0
  function loadBatch() {
    const batch = vocab.slice(i, i + batchSize)
    batch.forEach(item => {
      if (loaded.has(item.image)) return
      failed.delete(item.image)
      const img = new Image()
      img.onload = () => loaded.add(item.image)
      img.onerror = () => failed.add(item.image)
      img.src = item.image
    })
    i += batchSize
    if (i < vocab.length) scheduleIdle(loadBatch)
  }
  loadBatch()
}
