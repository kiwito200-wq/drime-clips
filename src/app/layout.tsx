import type { Metadata } from 'next'
import { Schibsted_Grotesk, Dancing_Script, Great_Vibes, Allura, Caveat, Pacifico, Satisfy } from 'next/font/google'
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

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
})

const pacifico = Pacifico({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pacifico',
})

const satisfy = Satisfy({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-satisfy',
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
      <body className={`${schibsted.className} ${dancingScript.variable} ${greatVibes.variable} ${allura.variable} ${caveat.variable} ${pacifico.variable} ${satisfy.variable}`}>
        {children}
      </body>
    </html>
  )
}
