'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function NewDocument() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile)
      if (!name) setName(droppedFile.name.replace('.pdf', ''))
    }
  }, [name])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (!name) setName(selectedFile.name.replace('.pdf', ''))
    }
  }

  const handleUpload = async () => {
    if (!file || !name.trim()) return
    
    setUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name)
      
      const res = await fetch('/api/envelopes', {
        method: 'POST',
        body: formData,
      })
      
      if (res.ok) {
        const data = await res.json()
        router.push(`/prepare/${data.envelope.slug}`)
      } else {
        alert('Upload failed. Please try again.')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          
          <button
            onClick={handleUpload}
            disabled={!file || !name.trim() || uploading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Continue
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">New Document</h1>
          <p className="text-gray-500 mb-8">Upload a PDF to prepare for signing</p>

          {/* Name input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter document name"
              className="input"
            />
          </div>

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`
              card p-12 text-center cursor-pointer transition-all
              ${dragActive ? 'border-[#08CF65] border-2 bg-green-50' : 'border-dashed border-2 border-gray-300 hover:border-gray-400'}
              ${file ? 'border-solid border-[#08CF65] bg-green-50' : ''}
            `}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {file ? (
              <div className="flex items-center justify-center gap-4">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="ml-4 p-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-900 mb-1">
                  Drop your PDF here
                </p>
                <p className="text-gray-500">
                  or click to browse
                </p>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  )
}
