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
    <div className="flex flex-col items-center gap-1.5 sm:gap-3 w-full max-w-[17rem] sm:max-w-md md:max-w-lg lg:max-w-xl">
      <div className="bg-white rounded-2xl sm:rounded-3xl p-2 sm:p-4 md:p-5 lg:p-7 shadow-lg text-center w-full mb-1.5 sm:mb-3">
        <p className="text-lg sm:text-2xl md:text-3xl lg:text-5xl font-bold text-slate-800 leading-snug break-words">
          {renderQuestion(current.question)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 sm:gap-2 md:gap-3 w-full">
        {current.choices.map((choice, i) => {
          const isCorrect = answered && choice === current.correctAnswer
          const isWrong = wrongPick === choice
          return (
            <motion.button
              key={`${current.question_id}-${choice}-${i}`}
              onClick={() => handlePick(choice)}
              disabled={answered}
              whileTap={{ scale: 0.95 }}
              animate={isWrong ? { x: [0, -6, 6, -6, 0] } : {}}
              transition={{ duration: 0.25 }}
              className={`relative p-2 sm:p-3 md:p-4 lg:p-5 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg md:text-xl lg:text-2xl transition-all cursor-pointer
                ${isCorrect ? 'bg-emerald-500 text-white shadow-lg scale-[1.03]' : ''}
                ${isWrong ? 'bg-red-500 text-white' : ''}
                ${!isCorrect && !isWrong ? 'bg-white text-slate-800 shadow-md hover:bg-slate-50' : ''}
                ${answered && !isCorrect ? 'opacity-50' : ''}
              `}
            >
              <span className={`absolute top-0.5 left-1.5 text-[9px] sm:text-[10px] md:text-xs font-bold ${isCorrect || isWrong ? 'text-white/60' : 'text-slate-400'}`}>
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
