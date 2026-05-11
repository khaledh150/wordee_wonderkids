const preloaded = new Set()

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
    if (i < vocab.length) {
      requestIdleCallback ? requestIdleCallback(loadBatch) : setTimeout(loadBatch, 100)
    }
  }
  loadBatch()
}
