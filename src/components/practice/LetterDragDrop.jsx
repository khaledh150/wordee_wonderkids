import { useState, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function LetterDragDrop({ current, level, onCorrect, onWrong, answered }) {
  const word = current.word.toLowerCase()

  const { prefilled, choices } = useMemo(() => {
    const letters = word.split('')
    let pre, cl

    if (level === 2) {
      const revealed = new Set()
      const count = Math.max(1, Math.floor(letters.length * 0.4))
      while (revealed.size < count) revealed.add(Math.floor(Math.random() * letters.length))
      pre = letters.map((l, i) => revealed.has(i) ? l : null)
      cl = letters.filter((_, i) => !revealed.has(i))
    } else if (level === 3) {
      pre = letters.map(() => null)
      cl = [...letters]
    } else {
      pre = letters.map(() => null)
      const extras = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => !letters.includes(c))
      const n = Math.min(Math.max(4, Math.floor(letters.length * 0.6)), extras.length)
      cl = [...letters, ...shuffleArray(extras).slice(0, n)]
    }
    return { prefilled: pre, choices: shuffleArray(cl) }
  }, [word, level])

  const [slots, setSlots] = useState(prefilled)
  const [usedMap, setUsedMap] = useState({})
  const [wrongSlot, setWrongSlot] = useState(null)
  const [dragGhost, setDragGhost] = useState(null)
  const slotAreaRef = useRef(null)

  const letters = word.split('')
  const nextEmpty = slots.findIndex(s => s === null)
  const usedSet = new Set(Object.keys(usedMap).map(Number))

  const placeLetter = useCallback((letter, choiceIdx) => {
    if (answered || nextEmpty === -1) return

    if (letter === letters[nextEmpty]) {
      const newSlots = [...slots]
      newSlots[nextEmpty] = letter
      setSlots(newSlots)
      setUsedMap(prev => ({ ...prev, [choiceIdx]: nextEmpty }))
      if (newSlots.every(s => s !== null)) setTimeout(onCorrect, 300)
    } else {
      setWrongSlot(nextEmpty)
      setTimeout(() => setWrongSlot(null), 500)
      onWrong()
    }
  }, [answered, nextEmpty, letters, slots, onCorrect, onWrong])

  const removeFromSlot = useCallback((slotIdx) => {
    if (answered || prefilled[slotIdx] !== null || slots[slotIdx] === null) return
    let lastFilled = -1
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i] !== null && prefilled[i] === null) { lastFilled = i; break }
    }
    if (slotIdx !== lastFilled) return

    const newSlots = [...slots]
    newSlots[slotIdx] = null
    setSlots(newSlots)
    const cIdx = Object.entries(usedMap).find(([, s]) => s === slotIdx)?.[0]
    if (cIdx != null) {
      setUsedMap(prev => { const n = { ...prev }; delete n[cIdx]; return n })
    }
  }, [answered, slots, prefilled, usedMap])

  const handleTouchStart = useCallback((e, letter, choiceIdx) => {
    if (usedSet.has(choiceIdx) || answered) return
    e.stopPropagation()
    const touch = e.touches[0]
    setDragGhost({ letter, choiceIdx, x: touch.clientX, y: touch.clientY })
  }, [usedSet, answered])

  const handleTouchMove = useCallback((e) => {
    if (!dragGhost) return
    e.stopPropagation()
    e.preventDefault()
    const touch = e.touches[0]
    setDragGhost(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null)
  }, [dragGhost])

  const handleTouchEnd = useCallback((e) => {
    if (!dragGhost) return
    e.stopPropagation()
    const { letter, choiceIdx, x, y } = dragGhost
    setDragGhost(null)

    if (slotAreaRef.current) {
      const rect = slotAreaRef.current.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        placeLetter(letter, choiceIdx)
        return
      }
    }
    placeLetter(letter, choiceIdx)
  }, [dragGhost, placeLetter])

  const SLOT = 'w-10 h-12 sm:w-12 sm:h-14'
  const FONT = 'text-xl sm:text-2xl font-extrabold'

  return (
    <div
      className="flex flex-col items-center gap-2 w-full relative"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating ghost for touch drag */}
      {dragGhost && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: dragGhost.x - 20,
            top: dragGhost.y - 24,
          }}
        >
          <div className={`${SLOT} rounded-xl bg-pink-100 border-2 border-pink-400 text-pink-600 ${FONT} flex items-center justify-center shadow-xl opacity-90`}>
            {dragGhost.letter}
          </div>
        </div>
      )}

      {/* Slots row */}
      <div
        ref={slotAreaRef}
        className="flex flex-wrap justify-center gap-1.5 sm:gap-2"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={(e) => {
          e.preventDefault()
          const idx = Number(e.dataTransfer.getData('text/plain'))
          if (!isNaN(idx) && !usedSet.has(idx)) placeLetter(choices[idx], idx)
        }}
      >
        {slots.map((letter, i) => {
          const isPre = prefilled[i] !== null
          const isCurrent = i === nextEmpty
          const isWrong = wrongSlot === i
          return (
            <motion.div
              key={i}
              className={`${SLOT} rounded-xl flex items-center justify-center ${FONT} border-2
                ${isPre ? 'bg-teal-50 border-teal-200 text-teal-600' : ''}
                ${!isPre && letter ? 'bg-teal-100 border-teal-300 text-teal-700 cursor-pointer' : ''}
                ${!isPre && !letter && isCurrent ? 'bg-yellow-50 border-yellow-400 border-dashed' : ''}
                ${!isPre && !letter && !isCurrent ? 'bg-gray-50 border-gray-200' : ''}
                ${isWrong ? 'bg-red-100 border-red-400' : ''}
              `}
              animate={isWrong ? { x: [0, -6, 6, -6, 0] } : {}}
              transition={{ duration: 0.3 }}
              onClick={() => removeFromSlot(i)}
            >
              {letter || ''}
            </motion.div>
          )
        })}
      </div>

      {/* Choices — FIXED grid, used ones go invisible but keep space */}
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {choices.map((letter, i) => {
          const isUsed = usedSet.has(i)
          const isDragging = dragGhost?.choiceIdx === i
          return (
            <div
              key={i}
              className={`${SLOT} rounded-xl flex items-center justify-center ${FONT} border-2 select-none
                ${isUsed
                  ? 'opacity-0 pointer-events-none border-transparent'
                  : isDragging
                    ? 'opacity-30 border-pink-200 text-pink-300 bg-pink-50'
                    : 'bg-white border-pink-200 text-pink-600 shadow-md cursor-pointer active:scale-90 active:bg-pink-50'
                }
              `}
              draggable={!isUsed}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(i))
                e.dataTransfer.effectAllowed = 'move'
              }}
              onTouchStart={(e) => handleTouchStart(e, letter, i)}
              onClick={() => { if (!isUsed && !dragGhost) placeLetter(letter, i) }}
            >
              {letter}
            </div>
          )
        })}
      </div>
    </div>
  )
}
