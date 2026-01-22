'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Suspense } from 'react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const selfSignUrl = searchParams.get('selfSign')
  const documentName = searchParams.get('name') || 'document'

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Animated signature background */}
      <div className="relative mb-8">
        {/* SVG signature animation */}
        <motion.svg
          viewBox="0 0 300 200"
          className="w-80 h-56 text-[#7E33F7]/20"
          initial="hidden"
          animate="visible"
        >
          {/* Signature path - stylized cursive signature */}
          <motion.path
            d="M 30 120 
               Q 50 60, 80 100 
               T 130 90 
               Q 150 85, 160 95
               Q 180 110, 200 80
               Q 220 50, 240 90
               Q 260 120, 270 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: {
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: { duration: 2, ease: "easeInOut" },
                  opacity: { duration: 0.5 }
                }
              }
            }}
          />
          {/* Check mark */}
          <motion.path
            d="M 200 130 L 230 160 L 280 90"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: {
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: { duration: 0.5, ease: "easeOut", delay: 1.8 },
                  opacity: { duration: 0.3, delay: 1.8 }
                }
              }
            }}
          />
        </motion.svg>

        {/* "All done" text overlay */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-[#7E33F7]"
        >
          Terminé !
        </motion.h1>
      </div>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
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
        transition={{ delay: 1.2 }}
        className="flex flex-col items-center gap-4"
      >
        {selfSignUrl ? (
          <button
            onClick={() => router.push(selfSignUrl)}
            className="px-8 py-3 bg-[#0F172A] text-white rounded-xl font-medium hover:bg-[#1e293b] transition-colors"
          >
            Signer mon document
          </button>
        ) : (
          <button
            onClick={() => router.push('/dashboard/agreements')}
            className="px-8 py-3 bg-[#0F172A] text-white rounded-xl font-medium hover:bg-[#1e293b] transition-colors"
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
