'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DocumentBuilder from '@/components/sign/DocumentBuilder'

export default function PrepareDocument() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const [envelope, setEnvelope] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchEnvelope = useCallback(async () => {
    try {
      const res = await fetch(`/api/envelopes/${slug}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setEnvelope(data.envelope)
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Failed to fetch envelope:', error)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [slug, router])

  useEffect(() => {
    fetchEnvelope()
  }, [fetchEnvelope])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!envelope) {
    return null
  }

  return (
    <DocumentBuilder
      envelopeSlug={slug}
      pdfUrl={envelope.pdfUrl}
      documentName={envelope.name}
      onBack={() => router.push('/dashboard')}
    />
  )
}
