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
  const words = word.split(' ')
  const allLetters = word.replace(/ /g, '').split('')

  const { prefilled, choices } = useMemo(() => {
    let pre, cl

    if (level === 2) {
      const revealed = new Set()
      const count = Math.max(1, Math.floor(allLetters.length * 0.4))
      while (revealed.size < count) revealed.add(Math.floor(Math.random() * allLetters.length))
      pre = allLetters.map((l, i) => revealed.has(i) ? l : null)
      cl = allLetters.filter((_, i) => !revealed.has(i))
    } else if (level === 3) {
      pre = allLetters.map(() => null)
      cl = [...allLetters]
    } else {
      pre = allLetters.map(() => null)
      const extras = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => !allLetters.includes(c))
      const n = Math.min(Math.max(4, Math.floor(allLetters.length * 0.6)), extras.length)
      cl = [...allLetters, ...shuffleArray(extras).slice(0, n)]
    }
    return { prefilled: pre, choices: shuffleArray(cl) }
  }, [word, level])

  const [slots, setSlots] = useState(prefilled)
  const [usedMap, setUsedMap] = useState({})
  const [wrongSlot, setWrongSlot] = useState(null)
  const [dragGhost, setDragGhost] = useState(null)
  const slotAreaRef = useRef(null)

  const nextEmpty = slots.findIndex(s => s === null)
  const usedSet = new Set(Object.keys(usedMap).map(Number))
  const availableChoices = choices.map((letter, i) => ({ letter, i, used: usedSet.has(i) })).filter(c => !c.used)

  const placeLetter = useCallback((letter, choiceIdx) => {
    if (answered || nextEmpty === -1) return

    if (letter === allLetters[nextEmpty]) {
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
  }, [answered, nextEmpty, allLetters, slots, onCorrect, onWrong])

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
    if (answered) return
    e.stopPropagation()
    const touch = e.touches[0]
    setDragGhost({ letter, choiceIdx, x: touch.clientX, y: touch.clientY })
  }, [answered])

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
    placeLetter(dragGhost.letter, dragGhost.choiceIdx)
    setDragGhost(null)
  }, [dragGhost, placeLetter])

  const SLOT = 'w-10 h-12 sm:w-12 sm:h-14'
  const FONT = 'text-xl sm:text-2xl font-extrabold'

  let slotIdx = 0
  const slotGroups = words.map(w => {
    const group = []
    for (let i = 0; i < w.length; i++) {
      group.push(slotIdx)
      slotIdx++
    }
    return group
  })

  return (
    <div
      className="flex flex-col items-center gap-2 w-full relative"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {dragGhost && (
        <div className="fixed z-50 pointer-events-none" style={{ left: dragGhost.x - 20, top: dragGhost.y - 24 }}>
          <div className={`${SLOT} rounded-xl bg-pink-100 border-2 border-pink-400 text-pink-600 ${FONT} flex items-center justify-center shadow-xl opacity-90`}>
            {dragGhost.letter}
          </div>
        </div>
      )}

      {/* Slots — grouped by word with gaps between words */}
      <div
        ref={slotAreaRef}
        className="flex flex-wrap justify-center items-center gap-y-1.5"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={(e) => {
          e.preventDefault()
          const idx = Number(e.dataTransfer.getData('text/plain'))
          if (!isNaN(idx) && !usedSet.has(idx)) placeLetter(choices[idx], idx)
        }}
      >
        {slotGroups.map((group, gi) => (
          <div key={gi} className={`flex gap-1 sm:gap-1.5 ${gi > 0 ? 'ml-4 sm:ml-5' : ''}`}>
            {group.map(si => {
              const letter = slots[si]
              const isPre = prefilled[si] !== null
              const isCurrent = si === nextEmpty
              const isWrong = wrongSlot === si
              return (
                <motion.div
                  key={si}
                  className={`${SLOT} rounded-xl flex items-center justify-center ${FONT} border-2
                    ${isPre ? 'bg-teal-50 border-teal-200 text-teal-600' : ''}
                    ${!isPre && letter ? 'bg-teal-100 border-teal-300 text-teal-700 cursor-pointer' : ''}
                    ${!isPre && !letter && isCurrent ? 'bg-yellow-50 border-yellow-400 border-dashed' : ''}
                    ${!isPre && !letter && !isCurrent ? 'bg-gray-50 border-gray-200' : ''}
                    ${isWrong ? 'bg-red-100 border-red-400' : ''}
                  `}
                  animate={isWrong ? { x: [0, -6, 6, -6, 0] } : {}}
                  transition={{ duration: 0.3 }}
                  onClick={() => removeFromSlot(si)}
                >
                  {letter || ''}
                </motion.div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Choices — only show available (not used), no empty placeholders */}
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {availableChoices.map(({ letter, i }) => {
          const isDragging = dragGhost?.choiceIdx === i
          return (
            <div
              key={`c${i}`}
              className={`${SLOT} rounded-xl flex items-center justify-center ${FONT} border-2 select-none
                ${isDragging
                  ? 'opacity-30 border-pink-200 text-pink-300 bg-pink-50'
                  : 'bg-white border-pink-200 text-pink-600 shadow-md cursor-pointer active:scale-90 active:bg-pink-50'
                }
              `}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(i))
                e.dataTransfer.effectAllowed = 'move'
              }}
              onTouchStart={(e) => handleTouchStart(e, letter, i)}
              onClick={() => { if (!dragGhost) placeLetter(letter, i) }}
            >
              {letter}
            </div>
          )
        })}
      </div>
    </div>
  )
}
