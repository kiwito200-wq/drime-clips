'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

interface Signer {
  id: string
  email: string
  name: string | null
  color: string
  order: number
}

interface Field {
  id: string
  type: 'signature' | 'text' | 'date' | 'initials' | 'checkbox'
  signerId: string
  page: number
  x: number
  y: number
  width: number
  height: number
  label: string | null
  placeholder: string | null
  required: boolean
}

interface Envelope {
  id: string
  slug: string
  name: string
  pdfUrl: string
  status: string
  signers: Signer[]
  fields: Field[]
}

export default function PrepareDocument() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const [envelope, setEnvelope] = useState<Envelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState<Field[]>([])
  const [signers, setSigners] = useState<Signer[]>([])
  const [selectedFieldType, setSelectedFieldType] = useState<Field['type']>('signature')
  const [selectedSignerId, setSelectedSignerId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [pages, setPages] = useState<{ width: number; height: number }[]>([])
  const [scale, setScale] = useState(1)
  const [saving, setSaving] = useState(false)
  
  // Add signer modal
  const [showAddSigner, setShowAddSigner] = useState(false)
  const [newSignerEmail, setNewSignerEmail] = useState('')
  const [newSignerName, setNewSignerName] = useState('')
  
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({})

  useEffect(() => {
    fetchEnvelope()
  }, [slug])

  async function fetchEnvelope() {
    try {
      const res = await fetch(`/api/envelopes/${slug}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const env = data.envelope
        setEnvelope(env)
        setFields(env.fields || [])
        setSigners(env.signers || [])
        if (env.signers && env.signers.length > 0) {
          setSelectedSignerId(env.signers[0].id)
        }
        await loadPDF(env.pdfUrl)
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Failed to fetch envelope:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPDF(url: string) {
    try {
      const loadingTask = pdfjsLib.getDocument(url)
      const pdf = await loadingTask.promise
      const numPages = pdf.numPages
      
      const pageInfos: { width: number; height: number }[] = []
      
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1 })
        pageInfos.push({
          width: viewport.width,
          height: viewport.height,
        })
      }
      
      setPages(pageInfos)
      renderPages(pdf, pageInfos)
    } catch (error) {
      console.error('Failed to load PDF:', error)
    }
  }

  async function renderPages(pdf: pdfjsLib.PDFDocumentProxy, pageInfos: { width: number; height: number }[]) {
    for (let i = 0; i < pageInfos.length; i++) {
      const page = await pdf.getPage(i + 1)
      const viewport = page.getViewport({ scale: scale })
      const canvas = canvasRefs.current[i]
      
      if (!canvas) continue
      
      const context = canvas.getContext('2d')
      if (!context) continue
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }
      
      await page.render(renderContext).promise
    }
  }

  async function handleAddSigner() {
    if (!newSignerEmail.trim()) {
      alert('Email is required')
      return
    }
    
    try {
      const res = await fetch(`/api/envelopes/${slug}/signers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: newSignerEmail,
          name: newSignerName || null,
        }),
      })
      
      if (res.ok) {
        const data = await res.json()
        setSigners([...signers, data.signer])
        setSelectedSignerId(data.signer.id)
        setNewSignerEmail('')
        setNewSignerName('')
        setShowAddSigner(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to add signer')
      }
    } catch (error) {
      console.error('Failed to add signer:', error)
      alert('Failed to add signer')
    }
  }

  async function handleDeleteSigner(signerId: string) {
    if (!confirm('Delete this signer?')) return
    
    try {
      const res = await fetch(`/api/envelopes/${slug}/signers?id=${signerId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (res.ok) {
        setSigners(signers.filter(s => s.id !== signerId))
        if (selectedSignerId === signerId && signers.length > 1) {
          setSelectedSignerId(signers.find(s => s.id !== signerId)?.id || null)
        }
      }
    } catch (error) {
      console.error('Failed to delete signer:', error)
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>, pageIndex: number) {
    if (!selectedSignerId) {
      alert('Please select a signer first')
      return
    }
    
    const canvas = canvasRefs.current[pageIndex]
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    const newField: Field = {
      id: `field-${Date.now()}`,
      type: selectedFieldType,
      signerId: selectedSignerId,
      page: pageIndex,
      x,
      y,
      width: 0.2,
      height: 0.05,
      label: null,
      placeholder: null,
      required: true,
    }
    
    setFields([...fields, newField])
  }

  async function handleSave() {
    if (!envelope) return
    
    setSaving(true)
    try {
      // Save fields
      const fieldsRes = await fetch(`/api/envelopes/${slug}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fields }),
      })
      
      if (!fieldsRes.ok) {
        throw new Error('Failed to save fields')
      }
      
      // Save signers
      const signersRes = await fetch(`/api/envelopes/${slug}/signers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signers }),
      })
      
      if (!signersRes.ok) {
        throw new Error('Failed to save signers')
      }
      
      router.push('/dashboard')
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function handleDeleteField(fieldId: string) {
    setFields(fields.filter(f => f.id !== fieldId))
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
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
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r overflow-y-auto">
          <div className="p-6">
            {/* Signers */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Signers</h2>
                <button
                  onClick={() => setShowAddSigner(true)}
                  className="text-sm text-[#08CF65] hover:text-[#06B557] font-medium"
                >
                  + Add
                </button>
              </div>
              
              <div className="space-y-2">
                {signers.map((signer) => (
                  <div
                    key={signer.id}
                    onClick={() => setSelectedSignerId(signer.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedSignerId === signer.id
                        ? 'border-[#08CF65] bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: signer.color }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {signer.name || signer.email}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSigner(signer.id)
                        }}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{signer.email}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Field Types */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Add Field</h2>
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
                        <span className="text-xs font-medium text-white capitalize">{type[0]}</span>
                      </div>
                      <span className="font-medium text-gray-900 capitalize">{type}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Fields List */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Fields ({fields.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {fields.map((field) => {
                  const signer = signers.find(s => s.id === field.signerId)
                  return (
                    <div key={field.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: signer?.color || '#EF4444' }}
                          />
                          <span className="text-sm font-medium text-gray-900 capitalize">{field.type}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteField(field.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Page {field.page + 1} • {signer?.name || signer?.email}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Main - PDF Viewer */}
        <main className="flex-1 overflow-auto bg-gray-100 p-8" ref={containerRef}>
          <div className="max-w-4xl mx-auto space-y-4">
            {pages.map((pageInfo, index) => (
              <div key={index} className="bg-white shadow-lg rounded-lg overflow-hidden relative">
                <canvas
                  ref={(el) => { canvasRefs.current[index] = el }}
                  onClick={(e) => handleCanvasClick(e, index)}
                  className="w-full cursor-crosshair"
                  style={{ height: `${(pageInfo.height / pageInfo.width) * 100}%` }}
                />
                
                {/* Render fields on this page */}
                {fields
                  .filter(f => f.page === index)
                  .map((field) => {
                    const signer = signers.find(s => s.id === field.signerId)
                    return (
                      <div
                        key={field.id}
                        className="absolute border-2 border-dashed"
                        style={{
                          left: `${field.x * 100}%`,
                          top: `${field.y * 100}%`,
                          width: `${field.width * 100}%`,
                          height: `${field.height * 100}%`,
                          borderColor: signer?.color || '#EF4444',
                          backgroundColor: `${signer?.color || '#EF4444'}20`,
                        }}
                      >
                        <div className="absolute -top-6 left-0 text-xs font-medium" style={{ color: signer?.color || '#EF4444' }}>
                          {field.type}
                        </div>
                      </div>
                    )
                  })}
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Add Signer Modal */}
      <AnimatePresence>
        {showAddSigner && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Signer</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={newSignerEmail}
                    onChange={(e) => setNewSignerEmail(e.target.value)}
                    className="input"
                    placeholder="signer@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={newSignerName}
                    onChange={(e) => setNewSignerName(e.target.value)}
                    className="input"
                    placeholder="Optional"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddSigner(false)
                    setNewSignerEmail('')
                    setNewSignerName('')
                  }}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSigner}
                  className="btn-primary flex-1"
                >
                  Add Signer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
