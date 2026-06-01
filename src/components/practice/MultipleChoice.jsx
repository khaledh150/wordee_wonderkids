import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MultipleChoice({ current, allVocab, onCorrect, onWrong, answered }) {
  const [wrongPick, setWrongPick] = useState(null)

  const choices = useMemo(() => {
    setWrongPick(null)
    const others = allVocab.filter(v => v.word !== current.word)
    return shuffle([current, ...shuffle(others).slice(0, 2)])
  }, [current, allVocab])

  const handlePick = (choice) => {
    if (answered || wrongPick) return
    const isCorrect = choice.word === current.word
    if (isCorrect) {
      onCorrect()
    } else {
      setWrongPick(choice.word)
      onWrong()
      setTimeout(() => setWrongPick(null), 400)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 lg:gap-4 xl:gap-5 w-full">
      <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-purple-500">What is this?</p>
      <div className="flex flex-row flex-wrap justify-center gap-2 sm:gap-3 lg:gap-4 xl:gap-5">
        {choices.map((choice, i) => {
          const isCorrect = choice.word === current.word
          const isWrong = wrongPick === choice.word
          return (
            <motion.button
              key={choice.word}
              className={`px-5 sm:px-7 lg:px-9 xl:px-12 py-2.5 sm:py-3 lg:py-4 xl:py-5 rounded-2xl text-base sm:text-lg lg:text-xl xl:text-2xl font-bold shadow-md transition-colors
                ${answered && isCorrect ? 'bg-green-400 text-white shadow-green-200' : ''}
                ${answered && !isCorrect ? 'bg-gray-200 text-gray-400' : ''}
                ${isWrong ? 'bg-red-400 text-white shadow-red-200' : ''}
                ${!answered && !isWrong ? 'bg-white text-purple-700 hover:bg-purple-50 active:scale-95 border-2 border-purple-100' : ''}
              `}
              initial={{ opacity: 0, y: 10 }}
              animate={isWrong ? { opacity: 1, y: 0, x: [0, -6, 6, -6, 0] } : { opacity: 1, y: 0 }}
              transition={isWrong ? { x: { duration: 0.25 } } : { delay: i * 0.04 }}
              onClick={() => handlePick(choice)}
              disabled={answered}
            >
              {choice.word}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
