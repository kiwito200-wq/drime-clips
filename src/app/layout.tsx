import type { Metadata } from 'next'
import { Schibsted_Grotesk } from 'next/font/google'
import './globals.css'

const schibsted = Schibsted_Grotesk({ 
  subsets: ['latin'],
  variable: '--font-schibsted',
})

export const metadata: Metadata = {
  title: 'Drime Sign - Electronic Signatures',
  description: 'Secure and modern electronic signature service',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={schibsted.className}>{children}</body>
    </html>
  )
}
