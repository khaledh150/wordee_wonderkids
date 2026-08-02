import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

function shuffleArray(arr) {
  if (arr.length <= 1) return [...arr]
  let a
  do {
    a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
  } while (a.length > 1 && a.every((v, i) => v === arr[i]))
  return a
}

export default function LetterDragDrop({ current, level, onCorrect, onWrong, answered }) {
  const word = current.word.toLowerCase()
  const words = word.split(' ')
  const allLetters = word.replace(/ /g, '').split('')
  const checkTimerRef = useRef(null)
  const touchedRef = useRef(false)

  useEffect(() => {
    return () => { if (checkTimerRef.current) clearTimeout(checkTimerRef.current) }
  }, [])

  const { prefilled, choices } = useMemo(() => {
    const hintPct = 0.4
    const revealed = new Set()
    const count = Math.max(1, Math.floor(allLetters.length * hintPct))
    // Always reveal first letter of each word
    let pos = 0
    for (const w of words) {
      revealed.add(pos)
      pos += w.length
    }
    // Fill remaining hints randomly
    while (revealed.size < count) revealed.add(Math.floor(Math.random() * allLetters.length))
    const pre = allLetters.map((l, i) => revealed.has(i) ? l : null)
    const cl = allLetters.filter((_, i) => !revealed.has(i))
    return { prefilled: pre, choices: shuffleArray(cl) }
  }, [word, level])

  const [slots, setSlots] = useState(prefilled)
  const [usedMap, setUsedMap] = useState({})
  const [wrongSlots, setWrongSlots] = useState(null)
  const [checking, setChecking] = useState(false)
  const [dragGhost, setDragGhost] = useState(null)

  const nextEmpty = slots.findIndex(s => s === null)
  const usedSet = new Set(Object.keys(usedMap).map(Number))
  const availableChoices = choices.map((letter, i) => ({ letter, i, used: usedSet.has(i) })).filter(c => !c.used)

  const clearPlaced = useCallback(() => {
    setSlots([...prefilled])
    setUsedMap({})
    setWrongSlots(null)
    setChecking(false)
  }, [prefilled])

  const checkWord = useCallback((filledSlots) => {
    setChecking(true)
    const isCorrect = filledSlots.every((l, i) => l === allLetters[i])

    if (isCorrect) {
      checkTimerRef.current = setTimeout(onCorrect, 200)
    } else {
      const badIndices = []
      filledSlots.forEach((l, i) => {
        if (prefilled[i] === null && l !== allLetters[i]) badIndices.push(i)
      })
      if (badIndices.length === 0) {
        setChecking(false)
        return
      }
      setWrongSlots(new Set(badIndices))
      onWrong()
      setTimeout(clearPlaced, 600)
    }
  }, [allLetters, prefilled, onCorrect, onWrong, clearPlaced])

  const placeLetter = useCallback((letter, choiceIdx) => {
    if (answered || checking || nextEmpty === -1) return
    if (usedSet.has(choiceIdx)) return

    const newSlots = [...slots]
    newSlots[nextEmpty] = letter
    const newUsedMap = { ...usedMap, [choiceIdx]: nextEmpty }
    setSlots(newSlots)
    setUsedMap(newUsedMap)

    if (newSlots.every(s => s !== null)) {
      checkWord(newSlots, newUsedMap)
    }
  }, [answered, checking, nextEmpty, slots, usedMap, usedSet, checkWord])

  const removeFromSlot = useCallback((slotIdx) => {
    if (answered || checking || prefilled[slotIdx] !== null || slots[slotIdx] === null) return

    const newSlots = [...slots]
    newSlots[slotIdx] = null
    setSlots(newSlots)
    const cIdx = Object.entries(usedMap).find(([, s]) => s === slotIdx)?.[0]
    if (cIdx != null) {
      setUsedMap(prev => { const n = { ...prev }; delete n[cIdx]; return n })
    }
  }, [answered, checking, slots, prefilled, usedMap])

  const handleTouchStart = useCallback((e, letter, choiceIdx) => {
    if (answered || checking) return
    touchedRef.current = true
    setTimeout(() => { touchedRef.current = false }, 500)
    e.stopPropagation()
    const touch = e.touches?.[0]
    if (!touch) return
    setDragGhost({ letter, choiceIdx, x: touch.clientX, y: touch.clientY, startX: touch.clientX, startY: touch.clientY })
  }, [answered, checking])

  const handleTouchMove = useCallback((e) => {
    if (!dragGhost) return
    e.stopPropagation()
    e.preventDefault()
    const touch = e.touches?.[0]
    if (!touch) return
    setDragGhost(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null)
  }, [dragGhost])

  const handleTouchEnd = useCallback((e) => {
    if (!dragGhost) return
    e.stopPropagation()
    e.preventDefault()
    placeLetter(dragGhost.letter, dragGhost.choiceIdx)
    setDragGhost(null)
  }, [dragGhost, placeLetter])

  const handleClick = useCallback((letter, choiceIdx) => {
    if (touchedRef.current) {
      touchedRef.current = false
      return
    }
    placeLetter(letter, choiceIdx)
  }, [placeLetter])

  const isLong = allLetters.length > 8
  const SLOT = isLong
    ? 'w-[clamp(1.5rem,6vw,3.5rem)] h-[clamp(2rem,7vw,4rem)]'
    : 'w-[clamp(2rem,7vw,4rem)] h-[clamp(2.5rem,8vw,4.5rem)]'
  const FONT = isLong
    ? 'text-[clamp(0.8rem,3vw,1.75rem)] font-extrabold'
    : 'text-[clamp(1rem,3.5vw,2rem)] font-extrabold'

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
      className="flex flex-col items-center gap-1.5 sm:gap-2 w-full relative"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-purple-500">Spell this word</p>
      {dragGhost && (
        <div className="fixed z-50 pointer-events-none" style={{ left: dragGhost.x - 18, top: dragGhost.y - 22 }}>
          <div className={`${SLOT} rounded-xl bg-pink-100 border-2 border-pink-400 text-pink-600 ${FONT} flex items-center justify-center shadow-xl opacity-90`}>
            {dragGhost.letter}
          </div>
        </div>
      )}

      <div
        className="flex flex-wrap justify-center items-center gap-y-0.5"
        role="group"
        aria-label="Letter slots"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={(e) => {
          e.preventDefault()
          const idx = Number(e.dataTransfer.getData('text/plain'))
          if (!isNaN(idx) && !usedSet.has(idx)) placeLetter(choices[idx], idx)
        }}
      >
        {slotGroups.map((group, gi) => (
          <div key={gi} className={`flex gap-0.5 ${gi > 0 ? 'ml-2 sm:ml-3' : ''}`}>
            {group.map(si => {
              const letter = slots[si]
              const isPre = prefilled[si] !== null
              const isCurrent = si === nextEmpty
              const isWrong = wrongSlots?.has(si)
              return (
                <motion.div
                  key={si}
                  className={`${SLOT} rounded-lg flex items-center justify-center ${FONT} border-2
                    ${isWrong ? 'bg-red-100 border-red-400 text-red-600' : ''}
                    ${!isWrong && isPre ? 'bg-teal-50 border-teal-200 text-teal-600' : ''}
                    ${!isWrong && !isPre && letter ? 'bg-teal-100 border-teal-300 text-teal-700 cursor-pointer' : ''}
                    ${!isWrong && !isPre && !letter && isCurrent ? 'bg-yellow-50 border-yellow-400 border-dashed' : ''}
                    ${!isWrong && !isPre && !letter && !isCurrent ? 'bg-gray-50 border-gray-200' : ''}
                  `}
                  animate={isWrong ? { x: [0, -6, 6, -6, 0] } : {}}
                  transition={{ duration: 0.25 }}
                  onClick={() => removeFromSlot(si)}
                  role="button"
                  aria-label={letter ? `Remove letter ${letter}` : `Empty slot ${si + 1}`}
                >
                  {letter || ''}
                </motion.div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-0.5 sm:gap-1" role="group" aria-label="Available letters">
        {availableChoices.map(({ letter, i }) => {
          const isDragging = dragGhost?.choiceIdx === i
          return (
            <div
              key={`c${i}`}
              className={`${SLOT} rounded-lg flex items-center justify-center ${FONT} border-2 select-none
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
              onClick={() => handleClick(letter, i)}
              role="button"
              aria-label={`Letter ${letter}`}
            >
              {letter}
            </div>
          )
        })}
      </div>
    </div>
  )
}
