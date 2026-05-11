import { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
  const letters = word.split('')

  const { slots: initialSlots, choices: initialChoices } = useMemo(() => {
    if (level === 2) {
      const revealed = new Set()
      const revealCount = Math.max(1, Math.floor(letters.length * 0.4))
      while (revealed.size < revealCount) {
        revealed.add(Math.floor(Math.random() * letters.length))
      }
      const slots = letters.map((l, i) => revealed.has(i) ? l : null)
      const missing = letters.filter((_, i) => !revealed.has(i))
      return { slots, choices: shuffleArray(missing) }
    }
    if (level === 3) {
      const slots = letters.map(() => null)
      return { slots, choices: shuffleArray([...letters]) }
    }
    // Level 4: extra distractors
    const slots = letters.map(() => null)
    const extras = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => !letters.includes(c))
    const distractorCount = Math.min(Math.max(4, Math.floor(letters.length * 0.6)), extras.length)
    const distractors = shuffleArray(extras).slice(0, distractorCount)
    return { slots, choices: shuffleArray([...letters, ...distractors]) }
  }, [current.word, level, letters])

  const [slots, setSlots] = useState(initialSlots)
  const [availableChoices, setAvailableChoices] = useState(initialChoices)
  const [dragging, setDragging] = useState(null)
  const [wrongSlot, setWrongSlot] = useState(null)
  const slotRefs = useRef([])

  const nextEmptySlot = slots.findIndex(s => s === null)

  const placeLetter = useCallback((letter, choiceIndex) => {
    if (answered) return
    if (nextEmptySlot === -1) return

    const correctLetter = letters[nextEmptySlot]
    if (letter === correctLetter) {
      const newSlots = [...slots]
      newSlots[nextEmptySlot] = letter
      setSlots(newSlots)
      const newChoices = [...availableChoices]
      newChoices.splice(choiceIndex, 1)
      setAvailableChoices(newChoices)

      if (newSlots.every(s => s !== null)) {
        setTimeout(onCorrect, 300)
      }
    } else {
      setWrongSlot(nextEmptySlot)
      setTimeout(() => setWrongSlot(null), 500)
      onWrong()
    }
  }, [answered, nextEmptySlot, letters, slots, availableChoices, onCorrect, onWrong])

  const removeFromSlot = useCallback((slotIndex) => {
    if (answered) return
    if (initialSlots[slotIndex] !== null) return
    if (slots[slotIndex] === null) return

    let lastFilled = -1
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i] !== null && initialSlots[i] === null) { lastFilled = i; break }
    }
    if (slotIndex !== lastFilled) return

    const letter = slots[slotIndex]
    const newSlots = [...slots]
    newSlots[slotIndex] = null
    setSlots(newSlots)
    setAvailableChoices(prev => [...prev, letter])
  }, [answered, slots, initialSlots])

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Slots */}
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {slots.map((letter, i) => {
          const isPreFilled = initialSlots[i] !== null
          const isCurrent = i === nextEmptySlot
          const isWrong = wrongSlot === i
          return (
            <motion.div
              key={i}
              ref={el => slotRefs.current[i] = el}
              className={`w-9 h-11 sm:w-12 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-extrabold border-2 transition-all
                ${isPreFilled ? 'bg-purple-100 border-purple-200 text-purple-600' : ''}
                ${!isPreFilled && letter ? 'bg-teal-100 border-teal-300 text-teal-700 cursor-pointer' : ''}
                ${!isPreFilled && !letter && isCurrent ? 'bg-yellow-50 border-yellow-400 border-dashed' : ''}
                ${!isPreFilled && !letter && !isCurrent ? 'bg-gray-50 border-gray-200' : ''}
                ${isWrong ? 'bg-red-100 border-red-400 animate-wiggle' : ''}
              `}
              animate={isWrong ? { x: [0, -5, 5, -5, 0] } : {}}
              transition={{ duration: 0.3 }}
              onClick={() => removeFromSlot(i)}
            >
              {letter || ''}
            </motion.div>
          )
        })}
      </div>

      {/* Letter choices */}
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-2 max-w-sm">
        <AnimatePresence>
          {availableChoices.map((letter, i) => (
            <motion.button
              key={`${letter}-${i}`}
              className="w-9 h-11 sm:w-12 sm:h-14 rounded-xl bg-white border-2 border-pink-200 text-pink-600 text-xl sm:text-2xl font-extrabold shadow-md hover:shadow-lg active:scale-90 transition-all flex items-center justify-center"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => placeLetter(letter, i)}
              whileTap={{ scale: 0.85 }}
            >
              {letter}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
