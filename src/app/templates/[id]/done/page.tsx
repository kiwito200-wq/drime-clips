'use client'

import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useI18n } from '@/lib/i18n/I18nContext'

// Dynamic import of Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

// Import the animation data
import signatureAnimation from '../../../../public/signature-animation.json'

function TemplateDoneContent() {
  const router = useRouter()
  const params = useParams()
  const templateId = params.id as string
  const { t, locale } = useI18n()

  return (
    <div className="min-h-screen bg-[#F8F7FC] flex flex-col items-center justify-center px-4">
      {/* Animated signature using Lottie */}
      <div className="relative mb-8">
        <div className="w-[500px] h-[400px] flex items-center justify-center">
          <Lottie
            animationData={signatureAnimation}
            loop={false}
            style={{ width: 500, height: 400, opacity: 0.3 }}
          />
        </div>

        {/* "Terminé !" text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.4 }}
            className="text-4xl font-bold text-[#7E33F7]"
          >
            {t('success.signatureComplete')}
          </motion.h1>
        </div>
      </div>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 0.4 }}
        className="text-center max-w-md"
      >
        <p className="text-gray-700 text-lg mb-2">
          {locale === 'fr' ? 'Parfait ! Votre template a été créé.' : 'Perfect! Your template has been created.'}
        </p>
        <p className="text-gray-500 mb-8">
          {locale === 'fr' ? 'Vous pouvez maintenant utiliser ce template pour envoyer des demandes de signature.' : 'You can now use this template to send signature requests.'}
        </p>
        
        {/* Action buttons */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => router.push(`/send?template=${templateId}`)}
            className="px-8 py-3 bg-[#08CF65] text-white rounded-xl font-medium hover:bg-[#07b858] transition-colors"
          >
            {locale === 'fr' ? 'Utiliser ce template' : 'Use this template'}
          </button>
          
          <button
            onClick={() => router.push('/templates')}
            className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
          >
            {locale === 'fr' ? 'Retour aux templates' : 'Back to templates'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function TemplateDonePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8F7FC] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TemplateDoneContent />
    </Suspense>
  )
}
