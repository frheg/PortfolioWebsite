import { useLanguage } from '../context/LanguageContext'
import profileEn from './profile.en.json'
import profileNo from './profile.no.json'

export function useProfile() {
  const { lang } = useLanguage()
  return lang === 'en' ? profileEn : profileNo
}
