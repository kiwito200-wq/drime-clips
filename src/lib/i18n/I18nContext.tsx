'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  Locale,
  Translations,
  translations,
  defaultLocale,
  getBrowserLocale,
  getStoredLocale,
  setStoredLocale,
  getNestedTranslation,
  replacePlaceholders,
} from './index'

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  translations: Translations
}

const I18nContext = createContext<I18nContextType | null>(null)

interface I18nProviderProps {
  children: ReactNode
  initialLocale?: Locale
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize locale from browser language (priority) or storage
  useEffect(() => {
    const browserLocale = getBrowserLocale()
    const storedLocale = getStoredLocale()
    
    // If browser is FR, use French
    // If browser is EN, use English  
    // Otherwise (DE, ES, IT, etc.), use English as fallback
    // Only respect stored locale if user explicitly changed it AND browser matches
    const browserLang = typeof window !== 'undefined' 
      ? navigator.language.split('-')[0].toLowerCase() 
      : 'en'
    
    let finalLocale: Locale
    
    if (browserLang === 'fr') {
      // French browser -> use French (or stored if user changed)
      finalLocale = storedLocale || 'fr'
    } else if (browserLang === 'en') {
      // English browser -> use English (or stored if user changed)
      finalLocale = storedLocale || 'en'
    } else {
      // Other languages -> ALWAYS English, ignore stored locale
      finalLocale = 'en'
      // Clear any old stored French locale for non-FR/EN users
      if (storedLocale === 'fr') {
        setStoredLocale('en')
      }
    }
    
    setLocaleState(finalLocale)
    if (!storedLocale) {
      setStoredLocale(finalLocale)
    }
    setIsInitialized(true)
  }, [])

  // Set locale and persist to storage
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    setStoredLocale(newLocale)
  }, [])

  // Translation function
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const translation = getNestedTranslation(translations[locale] as unknown as Record<string, unknown>, key)
    return replacePlaceholders(translation, params)
  }, [locale])

  const value: I18nContextType = {
    locale,
    setLocale,
    t,
    translations: translations[locale],
  }

  // Prevent hydration mismatch by rendering with default locale until initialized
  if (!isInitialized) {
    return (
      <I18nContext.Provider value={{
        locale: defaultLocale,
        setLocale,
        t: (key: string, params?: Record<string, string | number>) => {
          const translation = getNestedTranslation(translations[defaultLocale] as unknown as Record<string, unknown>, key)
          return replacePlaceholders(translation, params)
        },
        translations: translations[defaultLocale],
      }}>
        {children}
      </I18nContext.Provider>
    )
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

// Hook for just the translation function
export function useTranslation() {
  const { t, locale } = useI18n()
  return { t, locale }
}
