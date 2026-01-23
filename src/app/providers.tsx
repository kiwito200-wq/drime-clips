'use client'

import { ReactNode } from 'react'
import { I18nProvider } from '@/lib/i18n/I18nContext'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <I18nProvider>
      {children}
    </I18nProvider>
  )
}
