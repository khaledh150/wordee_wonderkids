import { useState } from 'react'

const PALETTE = [
  'bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
  'bg-teal-500', 'bg-orange-500', 'bg-fuchsia-500', 'bg-lime-500',
]

const SIZES = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-24 h-24 text-3xl',
}

function getInitials(name) {
  const trimmed = name?.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function hashName(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function InitialsFallback({ name, sizeClass, colorClass, className }) {
  return (
    <div className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center text-white font-black flex-shrink-0 ${className}`}>
      {getInitials(name)}
    </div>
  )
}

export default function StudentAvatar({ photoUrl, name, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = SIZES[size] || SIZES.md
  const colorClass = PALETTE[hashName(name) % PALETTE.length]

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name || 'Student'}
        loading="lazy"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return <InitialsFallback name={name} sizeClass={sizeClass} colorClass={colorClass} className={className} />
}
