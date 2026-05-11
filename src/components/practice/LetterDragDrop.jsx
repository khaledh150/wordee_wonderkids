import { useState, useMemo, useCallback } from 'react'
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
    let prefilled
    let choiceLetters

    if (level === 2) {
      const revealed = new Set()
      const revealCount = Math.max(1, Math.floor(letters.length * 0.4))
      while (revealed.size < revealCount) {
        revealed.add(Math.floor(Math.random() * letters.length))
      }
      prefilled = letters.map((l, i) => revealed.has(i) ? l : null)
      choiceLetters = letters.filter((_, i) => !revealed.has(i))
    } else if (level === 3) {
      prefilled = letters.map(() => null)
      choiceLetters = [...letters]
    } else {
      prefilled = letters.map(() => null)
      const extras = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => !letters.includes(c))
      const distractorCount = Math.min(Math.max(4, Math.floor(letters.length * 0.6)), extras.length)
      const distractors = shuffleArray(extras).slice(0, distractorCount)
      choiceLetters = [...letters, ...distractors]
    }

    return {
      prefilled,
      choices: shuffleArray(choiceLetters),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, level])

  const [slots, setSlots] = useState(prefilled)
  const [usedMap, setUsedMap] = useState({})
  const [wrongSlot, setWrongSlot] = useState(null)

  const letters = word.split('')
  const nextEmpty = slots.findIndex(s => s === null)

  const placeLetter = useCallback((letter, choiceIdx) => {
    if (answered || nextEmpty === -1) return

    if (letter === letters[nextEmpty]) {
      const newSlots = [...slots]
      newSlots[nextEmpty] = letter
      setSlots(newSlots)
      setUsedMap(prev => ({ ...prev, [choiceIdx]: nextEmpty }))

      if (newSlots.every(s => s !== null)) {
        setTimeout(onCorrect, 300)
      }
    } else {
      setWrongSlot(nextEmpty)
      setTimeout(() => setWrongSlot(null), 500)
      onWrong()
    }
  }, [answered, nextEmpty, letters, slots, onCorrect, onWrong])

  const removeFromSlot = useCallback((slotIdx) => {
    if (answered) return
    if (prefilled[slotIdx] !== null) return
    if (slots[slotIdx] === null) return

    let lastFilled = -1
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i] !== null && prefilled[i] === null) { lastFilled = i; break }
    }
    if (slotIdx !== lastFilled) return

    const newSlots = [...slots]
    newSlots[slotIdx] = null
    setSlots(newSlots)

    const choiceIdx = Object.entries(usedMap).find(([, s]) => s === slotIdx)?.[0]
    if (choiceIdx != null) {
      setUsedMap(prev => {
        const next = { ...prev }
        delete next[choiceIdx]
        return next
      })
    }
  }, [answered, slots, prefilled, usedMap])

  const usedSet = new Set(Object.keys(usedMap).map(Number))

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Slots row */}
      <div
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
              className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-extrabold border-2
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
          return (
            <div
              key={i}
              className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-extrabold border-2 transition-opacity
                ${isUsed
                  ? 'opacity-0 pointer-events-none border-transparent'
                  : 'bg-white border-pink-200 text-pink-600 shadow-md cursor-pointer active:scale-90 active:bg-pink-50'
                }
              `}
              draggable={!isUsed}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(i))
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => { if (!isUsed) placeLetter(letter, i) }}
            >
              {letter}
            </div>
          )
        })}
      </div>
    </div>
  )
}
