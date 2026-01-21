'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'

interface SignerData {
  id: string
  name: string | null
  email: string
  envelope: {
    name: string
    pdfUrl: string
  }
  fields: {
    id: string
    type: string
    label: string | null
    page: number
    x: number
    y: number
    width: number
    height: number
    value: string | null
  }[]
}

export default function SignPage() {
  const params = useParams()
  const token = params.token as string
  
  const [data, setData] = useState<SignerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  const fetchSignerData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sign/${token}`)
      
      if (!res.ok) {
        const errorData = await res.json()
        setError(errorData.error || 'Invalid signing link')
        return
      }
      
      const signerData = await res.json()
      setData(signerData)
    } catch (err) {
      setError('Failed to load signing page')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchSignerData()
  }, [fetchSignerData])

  async function handleComplete() {
    setSubmitting(true)
    
    try {
      const res = await fetch(`/api/sign/${token}/complete`, {
        method: 'POST',
      })
      
      if (res.ok) {
        setCompleted(true)
      } else {
        const errorData = await res.json()
        alert(errorData.error || 'Failed to complete signing')
      }
    } catch (err) {
      alert('Failed to complete signing')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-12 text-center max-w-md"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Signed Successfully!</h1>
          <p className="text-gray-500">
            Thank you for signing <strong>{data?.envelope.name}</strong>.
            You will receive a copy once all parties have signed.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-900">{data?.envelope.name}</h1>
            <p className="text-sm text-gray-500">Please review and sign the document</p>
          </div>
          
          <button
            onClick={handleComplete}
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Complete Signing
          </button>
        </div>
      </header>

      {/* Document viewer */}
      <main className="py-8">
        <div className="max-w-4xl mx-auto px-6">
          <div className="card overflow-hidden">
            {/* PDF would be rendered here */}
            <div className="aspect-[8.5/11] bg-white flex items-center justify-center">
              <p className="text-gray-400">PDF Document Viewer</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
