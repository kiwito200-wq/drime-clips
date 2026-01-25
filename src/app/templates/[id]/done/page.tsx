'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function TemplateDonePage() {
  const router = useRouter()
  const params = useParams()
  const templateId = params.id as string
  const [template, setTemplate] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (templateId) {
      fetchTemplate()
    }
  }, [templateId])

  const fetchTemplate = async () => {
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setTemplate(data.template)
      }
    } catch (error) {
      console.error('Failed to fetch template:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center"
      >
        {/* Decorative graphic */}
        <div className="relative mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 mx-auto bg-[#08CF65] rounded-full flex items-center justify-center"
          >
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
          {/* Decorative swirl */}
          <motion.svg
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 -z-10"
            viewBox="0 0 200 200"
            initial={{ opacity: 0, rotate: -180 }}
            animate={{ opacity: 0.3, rotate: 0 }}
            transition={{ delay: 0.4, duration: 1 }}
          >
            <motion.path
              d="M 20,100 Q 50,20 100,50 T 180,100"
              stroke="#7E33F7"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.6, duration: 1.5 }}
            />
          </motion.svg>
        </div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-bold text-gray-900 mb-4"
        >
          Terminé
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xl font-semibold text-gray-700 mb-2"
        >
          Parfait ! Votre template a été créé
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-gray-500 mb-8"
        >
          Vous pouvez maintenant utiliser ce template pour envoyer des demandes de signature
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-4"
        >
          <Link
            href={`/send?template=${templateId}`}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            Utiliser ce template
          </Link>
          <Link
            href="/templates"
            className="px-8 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Retour aux templates
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}
