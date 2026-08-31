import { useLanguage } from '../context/LanguageContext'
import { planetFacts as planetFactsEn } from './planetFacts.en'
import { planetFacts as planetFactsNo } from './planetFacts.no'

export function usePlanetFacts() {
  const { lang } = useLanguage()
  return lang === 'en' ? planetFactsEn : planetFactsNo
}
