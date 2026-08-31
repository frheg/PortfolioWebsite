import { useCallback, useEffect, useMemo, useState } from 'react'
import { LanguageContext } from './LanguageContext'

const STORAGE_KEY = 'site-language'
const DEFAULT_LANG = 'no'

function readStoredLang() {
  if (typeof window === 'undefined') return DEFAULT_LANG
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'en' || stored === 'no' ? stored : DEFAULT_LANG
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang)

  useEffect(() => {
    document.documentElement.lang = lang
    window.localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const setLang = useCallback((next) => {
    setLangState(next === 'en' ? 'en' : 'no')
  }, [])

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'no' ? 'en' : 'no'))
  }, [])

  const value = useMemo(() => ({ lang, setLang, toggleLang }), [lang, setLang, toggleLang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
