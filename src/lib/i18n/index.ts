import { fr } from './translations/fr'
import { en } from './translations/en'

export type Locale = 'fr' | 'en'
export type Translations = typeof fr | typeof en

export const translations = {
  fr,
  en,
} as const

export const defaultLocale: Locale = 'en'

// Get browser locale
export function getBrowserLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  
  const browserLang = navigator.language.split('-')[0].toLowerCase()
  
  if (browserLang === 'fr') return 'fr'
  if (browserLang === 'en') return 'en'
  
  // Fallback to English for unsupported languages
  return defaultLocale
}

// Get stored locale from localStorage
export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null
  
  const stored = localStorage.getItem('locale')
  if (stored === 'fr' || stored === 'en') return stored
  return null
}

// Store locale in localStorage
export function setStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('locale', locale)
}

// Get nested translation by dot notation
export function getNestedTranslation(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return path // Return the key if not found
    }
  }
  
  return typeof current === 'string' ? current : path
}

// Replace placeholders in translation strings
export function replacePlaceholders(str: string, params?: Record<string, string | number>): string {
  if (!params) return str
  
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }, str)
}
