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
      {/* Animated signature background - Lumin style */}
      <div className="relative mb-6">
        {/* SVG signature animation - simple flowing stroke from bottom-left to top-right */}
        <motion.svg
          viewBox="0 0 400 300"
          className="w-[400px] h-[300px]"
          initial="hidden"
          animate="visible"
        >
          {/* Simple elegant signature stroke - from bottom-left going up to top-right with one loop */}
          <motion.path
            d="M 50 250 
               Q 80 200, 120 220
               Q 180 250, 220 180
               Q 250 120, 300 150
               Q 340 170, 350 100
               Q 360 50, 380 80"
            fill="none"
            stroke="#7E33F7"
            strokeOpacity="0.15"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: {
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: { duration: 1.5, ease: "easeOut" },
                  opacity: { duration: 0.3 }
                }
              }
            }}
          />
          {/* Small checkmark/flourish at the end */}
          <motion.path
            d="M 320 180 
               Q 340 200, 360 160
               Q 380 120, 390 140"
            fill="none"
            stroke="#7E33F7"
            strokeOpacity="0.15"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: {
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: { duration: 0.5, ease: "easeOut", delay: 1.3 },
                  opacity: { duration: 0.2, delay: 1.3 }
                }
              }
            }}
          />
        </motion.svg>

        {/* "Terminé !" text overlay */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-[#7E33F7]"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
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
