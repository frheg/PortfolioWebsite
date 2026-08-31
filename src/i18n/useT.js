import { useLanguage } from '../context/LanguageContext'
import { getTranslation } from './translations'

// Returns the current language's translation tree, e.g. t.nav.home.
export function useT() {
  const { lang } = useLanguage()
  return getTranslation(lang)
}
