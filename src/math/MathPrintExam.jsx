import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useLang } from '../i18n/LanguageContext'
import { generateExam, levelConfig } from './mathEngine'
import { ArrowLeft, Printer, Key } from 'lucide-react'
import { renderQuestion } from '../utils/fractionRenderer'
import FullscreenBtn from '../components/FullscreenBtn'

function stripQuestionMark(text) {
  return text.replace(/\s*\?\s*$/, '').trim()
}

const QUESTIONS_PER_PAGE = 102
const COLS_PER_PAGE = 3
const QUESTIONS_PER_COL = QUESTIONS_PER_PAGE / COLS_PER_PAGE

export default function MathPrintExam({ onBack }) {
  const { t, lang } = useLang()
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [examData, setExamData] = useState(null)
  const [showAnswerKey, setShowAnswerKey] = useState(false)
  const answerKeyRef = useRef(null)

  function handleGenerate(level) {
    const questions = generateExam(level, levelConfig[level - 1].questions)
    setSelectedLevel(level)
    setExamData(questions)
    setShowAnswerKey(false)
  }

  function handlePrint() {
    window.print()
  }

  if (!examData) {
    return (
      <motion.div
        className="w-full min-h-screen-safe flex flex-col items-center justify-center p-4 md:p-6 overflow-auto relative bg-gradient-to-br from-pink-50 via-white to-purple-50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <div className="absolute top-3 right-3 md:top-5 md:right-5 z-10">
          <FullscreenBtn />
        </div>
        <button onClick={onBack} className="absolute top-3 left-3 md:top-5 md:left-5 z-10 p-2 md:p-3 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform" aria-label="Back">
          <ArrowLeft size={20} className="text-text-light md:!w-6 md:!h-6" />
        </button>

        <div className="max-w-md mx-auto w-full">
          <div className="text-center mb-4 md:mb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text mb-1">{t('math.print.title')}</h1>
          </div>
          <div className="space-y-2.5">
            {levelConfig.map((config, i) => (
              <motion.button
                key={config.level}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleGenerate(config.level)}
                className={`w-full text-left p-3 md:p-4 rounded-2xl bg-gradient-to-br ${config.color} text-white font-bold gummy-shadow gummy-press transition-all`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl md:text-3xl">{config.emoji}</span>
                  <div>
                    <div className="text-base md:text-lg">{t(`math.levels.level${config.level}`)}</div>
                    <div className="text-xs md:text-sm opacity-80">{t('math.levels.level')} {config.level} &middot; {t('math.print.generateButton')}</div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  const totalPages = Math.ceil(examData.length / QUESTIONS_PER_PAGE)
  const pages = []
  for (let p = 0; p < totalPages; p++) {
    const start = p * QUESTIONS_PER_PAGE
    const pageQuestions = examData.slice(start, start + QUESTIONS_PER_PAGE)
    const cols = []
    for (let c = 0; c < COLS_PER_PAGE; c++) {
      cols.push(pageQuestions.slice(c * QUESTIONS_PER_COL, (c + 1) * QUESTIONS_PER_COL))
    }
    pages.push({ cols, startNum: start + 1, pageNum: p + 1 })
  }

  return (
    <div className="flex-1 bg-gray-100 pb-8">
      <div className="no-print p-4 flex items-center justify-between mx-auto" style={{ width: '210mm', maxWidth: '100%' }}>
        <button onClick={() => setExamData(null)} className="p-2 rounded-full bg-white/80 shadow-md active:scale-90 transition-transform">
          <ArrowLeft size={20} className="text-text-light" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !showAnswerKey
              setShowAnswerKey(next)
              if (next) setTimeout(() => answerKeyRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold gummy-shadow gummy-press ${
              showAnswerKey ? 'bg-orange text-white' : 'bg-white text-orange'
            }`}
          >
            <Key size={18} />
            {t('math.print.answerKey')}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-white font-bold gummy-shadow gummy-press"
          >
            <Printer size={18} /> {t('math.print.printButton')}
          </button>
        </div>
      </div>

      {pages.map((page, pi) => (
        <div
          key={pi}
          className="print-page bg-white mx-auto shadow-[0_2px_8px_rgba(0,0,0,0.12)] border border-gray-200 flex flex-col"
          style={{
            fontFamily: 'Arial, sans-serif',
            width: '210mm',
            maxWidth: '100%',
            minHeight: '297mm',
            padding: '5mm 6mm',
            boxSizing: 'border-box',
            pageBreakAfter: pi < pages.length - 1 ? 'always' : 'auto',
            marginBottom: '16px',
          }}
        >
          <div className="flex items-center justify-between border-b border-black pb-1 mb-1 print-small">
            <span className="font-bold print-title">Math Competition &mdash; {t(`math.levels.level${selectedLevel}`)}</span>
            <span>{t('math.print.studentName')} ________________</span>
            <span>{t('math.print.date')}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/</span>
          </div>

          <div className="flex gap-2 flex-1 print-questions print-questions-fill">
            {page.cols.map((col, ci) => (
              <div key={ci} className="flex-1 flex flex-col justify-between" style={ci > 0 ? { borderLeft: '1px solid #d1d5db', paddingLeft: '8px' } : {}}>
                {col.map((q, i) => {
                  const num = page.startNum + ci * QUESTIONS_PER_COL + i
                  const text = lang === 'en' && q.questionEn ? q.questionEn : q.question
                  return (
                    <div key={q.id} className="print-q-row">
                      <span className="print-q-num">{num}.</span>
                      <span>{renderQuestion(stripQuestionMark(text))}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ))}

      {showAnswerKey && (
        <div
          ref={answerKeyRef}
          className="print-page bg-white mx-auto shadow-[0_2px_8px_rgba(0,0,0,0.12)] border border-gray-200"
          style={{
            fontFamily: 'Arial, sans-serif',
            width: '210mm',
            maxWidth: '100%',
            padding: '5mm 6mm',
            boxSizing: 'border-box',
            pageBreakBefore: 'always',
            marginTop: '16px',
          }}
        >
          <h2 className="text-lg font-bold mb-3 border-b-2 border-black pb-2">
            {t('math.print.answerKey')} &mdash; {t(`math.levels.level${selectedLevel}`)}
          </h2>
          <div className="grid grid-cols-10 gap-x-3 gap-y-0.5 text-xs">
            {examData.map((q, i) => (
              <div key={q.id} className="flex gap-1">
                <span className="font-bold">{i + 1}.</span>
                <span>{renderQuestion(q.answerDisplay || String(q.correctAnswer))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
