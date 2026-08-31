import { createContext, useContext } from 'react'

export const LanguageContext = createContext({ lang: 'no', toggleLang: () => {}, setLang: () => {} })

export function useLanguage() {
  return useContext(LanguageContext)
}
