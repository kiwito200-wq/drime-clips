'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface Envelope {
  id: string
  slug: string
  name: string
  pdfUrl: string
  status: string
}

interface Field {
  id: string
  type: 'signature' | 'text' | 'date' | 'initials' | 'checkbox'
  page: number
  x: number
  y: number
  width: number
  height: number
  label?: string
  required: boolean
}

export default function PrepareDocument() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const [envelope, setEnvelope] = useState<Envelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState<Field[]>([])
  const [selectedFieldType, setSelectedFieldType] = useState<Field['type']>('signature')
  const [currentPage, setCurrentPage] = useState(1)
  const [pdfPages, setPdfPages] = useState(1)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchEnvelope()
  }, [slug])

  async function fetchEnvelope() {
    try {
      const res = await fetch('/api/envelopes', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const found = data.envelopes?.find((e: Envelope) => e.slug === slug)
        if (found) {
          setEnvelope(found)
          setPdfUrl(found.pdfUrl)
          // TODO: Load existing fields from API
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      console.error('Failed to fetch envelope:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current || !containerRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    const newField: Field = {
      id: `field-${Date.now()}`,
      type: selectedFieldType,
      page: currentPage,
      x,
      y,
      width: 0.2, // Default width (20% of page)
      height: 0.05, // Default height (5% of page)
      required: true,
    }
    
    setFields([...fields, newField])
  }

  async function handleSave() {
    if (!envelope) return
    
    try {
      // TODO: Save fields to API
      console.log('Saving fields:', fields)
      
      // For now, just redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save fields')
    }
  }

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{envelope.name}</h1>
              <p className="text-sm text-gray-500">Place signature fields on your document</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="btn-primary"
            >
              Save & Continue
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar - Field Types */}
        <aside className="w-64 bg-white border-r p-6 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Field</h2>
          
          <div className="space-y-2">
            {(['signature', 'text', 'date', 'initials', 'checkbox'] as Field['type'][]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedFieldType(type)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  selectedFieldType === type
                    ? 'border-[#08CF65] bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedFieldType === type ? 'bg-[#08CF65]' : 'bg-gray-100'
                  }`}>
                    {type === 'signature' && (
                      <svg className={`w-5 h-5 ${selectedFieldType === type ? 'text-white' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    )}
                    {type === 'text' && (
                      <svg className={`w-5 h-5 ${selectedFieldType === type ? 'text-white' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    )}
                    {type === 'date' && (
                      <svg className={`w-5 h-5 ${selectedFieldType === type ? 'text-white' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    {type === 'initials' && (
                      <svg className={`w-5 h-5 ${selectedFieldType === type ? 'text-white' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                    {type === 'checkbox' && (
                      <svg className={`w-5 h-5 ${selectedFieldType === type ? 'text-white' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-gray-900 capitalize">{type}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Fields ({fields.length})</h3>
            <div className="space-y-2">
              {fields.map((field) => (
                <div key={field.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 capitalize">{field.type}</span>
                    <button
                      onClick={() => setFields(fields.filter(f => f.id !== field.id))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Page {field.page}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main - PDF Viewer */}
        <main className="flex-1 overflow-auto bg-gray-100 p-8">
          <div ref={containerRef} className="max-w-4xl mx-auto">
            {pdfUrl ? (
              <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                <iframe
                  src={pdfUrl}
                  className="w-full"
                  style={{ height: '800px' }}
                  title="PDF Preview"
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg p-12 text-center">
                <p className="text-gray-500">Loading PDF...</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
