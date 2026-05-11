import { useMemo } from 'react'
import { motion } from 'framer-motion'

export default function MultipleChoice({ current, allVocab, onCorrect, onWrong, answered }) {
  const choices = useMemo(() => {
    const others = allVocab.filter(v => v.word !== current.word)
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 2)
    const all = [current, ...shuffled].sort(() => Math.random() - 0.5)
    return all
  }, [current, allVocab])

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      {choices.map((choice, i) => {
        const isCorrect = choice.word === current.word
        return (
          <motion.button
            key={choice.word}
            className={`px-6 py-3 rounded-2xl text-lg font-bold shadow-md transition-all
              ${answered && isCorrect ? 'bg-green-400 text-white shadow-green-200' : ''}
              ${answered && !isCorrect ? 'bg-gray-200 text-gray-400' : ''}
              ${!answered ? 'bg-white text-purple-700 hover:bg-purple-50 active:scale-95 border-2 border-purple-100' : ''}
            `}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => isCorrect ? onCorrect() : onWrong()}
            disabled={answered}
          >
            {choice.word}
          </motion.button>
        )
      })}
    </div>
  )
}
