import type { Metadata } from 'next'
import { Schibsted_Grotesk, Dancing_Script, Great_Vibes, Allura } from 'next/font/google'
import './globals.css'

const schibsted = Schibsted_Grotesk({ 
  subsets: ['latin'],
  variable: '--font-schibsted',
})

// Signature fonts for typed signatures
const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-dancing',
})

const greatVibes = Great_Vibes({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-great-vibes',
})

const allura = Allura({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-allura',
})

export const metadata: Metadata = {
  title: 'Drime Sign - Electronic Signatures',
  description: 'Secure and modern electronic signature service',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${schibsted.className} ${dancingScript.variable} ${greatVibes.variable} ${allura.variable}`}>
        {children}
      </body>
    </html>
  )
}
