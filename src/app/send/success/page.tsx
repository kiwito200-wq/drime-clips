'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Suspense } from 'react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const selfSignUrl = searchParams.get('selfSign')

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Animated signature - Lumin style */}
      <div className="relative mb-4">
        {/* SVG signature animation - exact Lumin style: simple stroke from bottom going up with a loop */}
        <motion.svg
          viewBox="0 0 300 250"
          className="w-[300px] h-[250px]"
          initial="hidden"
          animate="visible"
        >
          {/* Main signature stroke - starts from bottom left, goes up and curves with a loop at the top */}
          <motion.path
            d="M 60 220 
               C 80 180, 100 140, 130 120
               C 160 100, 180 80, 200 60
               C 220 40, 240 30, 250 50
               C 260 70, 240 90, 220 100
               C 200 110, 180 130, 200 150
               C 220 170, 260 140, 270 120"
            fill="none"
            stroke="#7E33F7"
            strokeOpacity="0.2"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: {
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: { duration: 1.8, ease: "easeInOut" },
                  opacity: { duration: 0.3 }
                }
              }
            }}
          />
        </motion.svg>

        {/* "Terminé !" text overlay */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-[#7E33F7]"
        >
          Terminé !
        </motion.h1>
      </div>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="text-center mb-8"
      >
        <p className="text-xl font-semibold text-gray-900 mb-2">
          Parfait ! Votre document a été envoyé.
        </p>
        {selfSignUrl && (
          <p className="text-gray-500">
            C&apos;est à vous de signer le document.
          </p>
        )}
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="flex flex-col items-center gap-4"
      >
        {selfSignUrl ? (
          <button
            onClick={() => router.push(selfSignUrl)}
            className="px-8 py-3 bg-[#08CF65] text-white rounded-xl font-medium hover:bg-[#07b858] transition-colors"
          >
            Signer mon document
          </button>
        ) : (
          <button
            onClick={() => router.push('/dashboard/agreements')}
            className="px-8 py-3 bg-[#08CF65] text-white rounded-xl font-medium hover:bg-[#07b858] transition-colors"
          >
            Voir mes documents
          </button>
        )}
        
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          Retour au tableau de bord
        </button>
      </motion.div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
