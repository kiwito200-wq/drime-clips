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

  // Initialize locale from storage or browser
  useEffect(() => {
    const storedLocale = getStoredLocale()
    if (storedLocale) {
      setLocaleState(storedLocale)
    } else {
      const browserLocale = getBrowserLocale()
      setLocaleState(browserLocale)
      setStoredLocale(browserLocale)
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
