import { createContext, useContext, useState, useCallback } from 'react'
import { t as translate } from './translations'

const LanguageContext = createContext()

const STORAGE_KEY = 'wonderkids_language'

function getInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'th') return stored
  } catch {}
  return 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLanguage)

  const setLang = useCallback((newLang) => {
    setLangState(newLang)
    try { localStorage.setItem(STORAGE_KEY, newLang) } catch {}
    document.documentElement.lang = newLang
  }, [])

  const t = useCallback((path) => translate(lang, path), [lang])

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'th' : 'en')
  }, [lang, setLang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

const fallbackT = (path) => {
  const key = path.split('.').pop()
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
}
const fallbackCtx = { lang: 'en', setLang: () => {}, t: fallbackT, toggleLang: () => {} }

export function useLang() {
  const ctx = useContext(LanguageContext)
  return ctx || fallbackCtx
}
