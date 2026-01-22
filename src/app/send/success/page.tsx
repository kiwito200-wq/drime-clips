'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Dynamic import of Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

// Import the animation data
import signatureAnimation from '../../../../public/signature-animation.json'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const selfSignUrl = searchParams.get('selfSign')

  return (
    <div className="min-h-screen bg-[#F8F7FC] flex flex-col items-center justify-center px-4">
      {/* Animated signature using Lottie */}
      <div className="relative mb-8">
        <div className="w-[500px] h-[400px] flex items-center justify-center">
          <Lottie
            animationData={signatureAnimation}
            loop={false}
            style={{ width: 500, height: 400 }}
          />
        </div>

        {/* "Terminé !" text overlay */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, duration: 0.4 }}
          className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-[#7E33F7]"
        >
          Terminé !
        </motion.h1>
      </div>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
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
        transition={{ delay: 1.8 }}
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
      <div className="min-h-screen bg-[#F8F7FC] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
