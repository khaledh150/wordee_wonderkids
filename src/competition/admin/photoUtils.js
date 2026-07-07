import { supabase } from '../supabaseClient'

function compressPhoto(file, maxSize = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = maxSize
      canvas.height = maxSize

      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas context unavailable'))
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize)

      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/webp',
        0.8
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

export async function uploadPhoto(file, competitionId, participantId) {
  const blob = await compressPhoto(file)
  const path = `${competitionId}/${participantId}.webp`

  const { error } = await supabase.storage
    .from('student-photos')
    .upload(path, blob, { contentType: 'image/webp', upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from('student-photos').getPublicUrl(path)
  return data.publicUrl + '?t=' + Date.now()
}

export async function deletePhoto(competitionId, participantId) {
  const path = `${competitionId}/${participantId}.webp`
  await supabase.storage.from('student-photos').remove([path])
}
