import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { renderQuestion } from '../../utils/fractionRenderer'

export default function MathQuestion({ current, onCorrect, onWrong, answered }) {
  const [wrongPick, setWrongPick] = useState(null)

  useEffect(() => { setWrongPick(null) }, [current.question_id])

  const handlePick = useCallback((choice) => {
    if (answered || wrongPick !== null) return
    if (choice === current.correctAnswer) {
      onCorrect()
    } else {
      setWrongPick(choice)
      onWrong()
      setTimeout(() => setWrongPick(null), 400)
    }
  }, [answered, wrongPick, current, onCorrect, onWrong])

  const labels = ['A', 'B', 'C', 'D']

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 w-full max-w-md">
      <div className="bg-white rounded-2xl p-3 sm:p-5 shadow-lg text-center w-full">
        <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 leading-snug break-words">
          {renderQuestion(current.question)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full">
        {current.choices.map((choice, i) => {
          const isCorrect = answered && choice === current.correctAnswer
          const isWrong = wrongPick === choice
          return (
            <motion.button
              key={`${current.question_id}-${choice}-${i}`}
              onClick={() => handlePick(choice)}
              disabled={answered}
              animate={isWrong ? { x: [0, -6, 6, -6, 0] } : {}}
              transition={{ duration: 0.25 }}
              className={`relative p-3 sm:p-4 rounded-xl font-bold text-lg sm:text-xl transition-all cursor-pointer active:scale-95
                ${isCorrect ? 'bg-emerald-500 text-white shadow-lg scale-105' : ''}
                ${isWrong ? 'bg-red-500 text-white' : ''}
                ${!isCorrect && !isWrong ? 'bg-white text-slate-800 shadow-md hover:bg-slate-50' : ''}
                ${answered && !isCorrect ? 'opacity-50' : ''}
              `}
            >
              <span className={`absolute top-1 left-2 text-[10px] font-bold ${isCorrect || isWrong ? 'text-white/60' : 'text-slate-400'}`}>
                {labels[i]}
              </span>
              {choice}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
