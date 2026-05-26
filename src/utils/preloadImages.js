const preloaded = new Set()

const scheduleIdle = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
  ? (cb) => window.requestIdleCallback(cb)
  : (cb) => setTimeout(cb, 100)

export function preloadLevelImages(vocab, batchSize = 15) {
  let i = 0
  function loadBatch() {
    const batch = vocab.slice(i, i + batchSize)
    batch.forEach(item => {
      if (preloaded.has(item.image)) return
      preloaded.add(item.image)
      const img = new Image()
      img.src = item.image
    })
    i += batchSize
    if (i < vocab.length) scheduleIdle(loadBatch)
  }
  loadBatch()
}
