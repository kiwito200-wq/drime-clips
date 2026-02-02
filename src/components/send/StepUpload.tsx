'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/I18nContext'

interface StepUploadProps {
  onUpload: (file: File, name: string) => void
  isLoading: boolean
}

export default function StepUpload({ onUpload, isLoading }: StepUploadProps) {
  const { locale } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
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

  const handleContinue = () => {
    if (file && name.trim()) {
      onUpload(file, name.trim())
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Sélectionner un document
        </h1>
        <p className="text-gray-500">
          Uploadez un fichier PDF pour commencer
        </p>
      </motion.div>

      {/* Upload zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`
          relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
          ${dragActive 
            ? 'border-[#08CF65] bg-green-50 scale-[1.01]' 
            : file 
              ? 'border-[#08CF65] bg-green-50/50' 
              : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
          }
        `}
        onClick={() => !file && document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="p-12">
          {file ? (
            <div className="flex items-center justify-center gap-6">
              {/* PDF Icon */}
              <div className="w-20 h-24 bg-red-100 rounded-lg flex items-center justify-center relative">
                <svg className="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                </svg>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                  PDF
                </div>
              </div>
              
              {/* File info */}
              <div className="text-left flex-1 max-w-md">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom du document"
                  className="w-full text-lg font-semibold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-[#08CF65] focus:outline-none transition-colors py-1"
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="text-sm text-gray-500 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • {file.name}
                </p>
              </div>
              
              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setName('') }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="text-center">
              {/* Upload icon */}
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              
              <p className="text-xl font-medium text-gray-900 mb-2">
                Glissez votre PDF ici
              </p>
              <p className="text-gray-500 mb-4">
                ou <span className="text-[#08CF65] font-medium">parcourez vos fichiers</span>
              </p>
              <p className="text-sm text-gray-400">
                Formats acceptés : PDF • Taille max : 25 MB
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Continue button */}
      {file && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex justify-end"
        >
          <button
            onClick={handleContinue}
            disabled={!name.trim() || isLoading}
            className="btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {locale === 'fr' ? 'Upload en cours...' : 'Uploading...'}
              </>
            ) : (
              <>
                {locale === 'fr' ? 'Continuer' : 'Continue'}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  )
}
