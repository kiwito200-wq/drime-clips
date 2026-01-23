'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

interface DrimeFile {
  id: string
  name: string
  file_name: string
  extension: string
  mime: string
  file_size: number
  hash: string
  type: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

interface DrimeFolder {
  id: string
  name: string
  type: string
  parent_id: string | null
}

interface BreadcrumbItem {
  id: string | null
  name: string
}

interface DrimeFilePickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (file: DrimeFile, blob: Blob) => void
}

// PDF Icon component
const PDFIcon = () => (
  <svg viewBox="60 0 400 500" className="w-8 h-8">
    <path fill="#fff" d="m136.39,485c-33.08,0-60-26.92-60-60V15h310c33.08,0,60,26.92,60,60v410H136.39Z"/>
    <path fill="#cb0606" d="m386.39,30c24.81,0,45,20.19,45,45v395H136.39c-24.81,0-45-20.19-45-45V30h295m0-30H61.39v425c0,41.42,33.58,75,75,75h325V75c0-41.42-33.58-75-75-75h0Z"/>
    <path fill="#cb0606" d="m360.38,275.89c-15.47-16.07-57.72-9.52-67.84-8.33-14.88-14.28-24.99-31.54-28.56-37.49,5.36-16.07,8.92-32.13,9.52-49.39,0-14.88-5.95-30.94-22.61-30.94-5.95,0-11.31,3.57-14.28,8.33-7.14,12.5-4.17,37.49,7.14,63.08-6.54,18.45-12.5,36.3-29.16,67.84-17.26,7.14-53.56,23.8-56.53,41.65-1.19,5.35.59,10.71,4.76,14.88,4.17,3.57,9.52,5.36,14.88,5.36,22.02,0,43.44-30.35,58.32-55.94,12.5-4.16,32.13-10.12,51.77-13.69,23.21,20.23,43.44,23.21,54.15,23.21,14.28,0,19.64-5.95,21.42-11.31,2.97-5.95,1.19-12.49-2.97-17.26h0Zm-14.88,10.12c-.59,4.17-5.95,8.33-15.47,5.95-11.31-2.97-21.42-8.33-30.35-15.47,7.74-1.19,24.99-2.98,37.49-.59,4.76,1.19,9.52,4.17,8.33,10.12h0Zm-99.37-122.58c1.19-1.78,2.98-2.97,4.76-2.97,5.36,0,6.54,6.54,6.54,11.9-.59,12.5-2.98,24.99-7.14,36.89-8.93-23.8-7.14-40.47-4.17-45.82Zm-1.19,115.44c4.76-9.52,11.31-26.18,13.69-33.32,5.36,8.92,14.28,19.64,19.04,24.4,0,.6-18.45,4.17-32.73,8.93Zm-35.11,23.8c-13.69,22.61-27.97,36.89-35.7,36.89-1.19,0-2.38-.59-3.57-1.19-1.79-1.19-2.38-2.98-1.79-5.36,1.79-8.33,17.26-19.64,41.06-30.35h0Z"/>
  </svg>
)

// Folder Icon component
const FolderIcon = () => (
  <svg viewBox="130 150 510 400" className="w-8 h-8">
    <path fill="#ff9d4c" d="m634,259.74v204.97c0,8.42-1.39,16.52-3.94,24.08-.59,1.74-1.24,3.45-1.96,5.13-.71,1.68-1.49,3.34-2.31,4.96-1.06,2.08-2.22,4.09-3.46,6.05-.52.81-1.05,1.62-1.6,2.41-1.03,1.48-2.11,2.93-3.24,4.34-.38.47-.76.93-1.15,1.39-.31.36-.62.73-.94,1.09t0,.01c-1.14,1.31-2.33,2.57-3.56,3.78-.52.51-1.04,1.02-1.57,1.52-1.07,1-2.16,1.97-3.29,2.9-7.29,6.09-15.75,10.8-25,13.77-.42.14-.85.27-1.27.4-1.51.45-3.05.86-4.6,1.23-1.55.36-3.11.68-4.7.94-1.58.26-3.18.48-4.8.64-2.52.26-5.08.39-7.67.39H209c-41.42,0-75-33.58-75-75v-235.5c0-38.48,28.95-70.17,66.25-74.5h115.3l33.43,14.26,36.66,15.64-.47.2h177.69c39.63,2.01,71.14,34.77,71.14,74.9Z"/>
    <path fill="#ffc60a" d="m634,277.24v187.47c0,8.42-1.39,16.52-3.94,24.08-.6,1.74-1.25,3.45-1.96,5.13-.71,1.68-1.49,3.34-2.31,4.96-1.06,2.08-2.22,4.09-3.46,6.05-.52.81-1.05,1.62-1.6,2.41-1.38,1.98-2.84,3.89-4.39,5.73-.31.36-.62.73-.94,1.09t0,.01c-1.14,1.3-2.33,2.56-3.56,3.78-8.29,8.22-18.48,14.52-29.86,18.19-.42.14-.85.27-1.27.4-1.51.45-3.05.86-4.6,1.23-1.55.36-3.11.67-4.7.94-1.58.26-3.18.48-4.8.64-2.52.26-5.08.39-7.67.39H209c-41.42,0-75-33.58-75-75v-187.5c0-19.24,14.48-35.09,33.12-37.25.81-.1,1.62-.17,2.45-.21.64-.03,1.28-.04,1.93-.04h425c.65,0,1.29.01,1.93.04.83.04,1.64.11,2.45.21,18.65,2.16,33.12,18.01,33.12,37.25Z"/>
  </svg>
)

export default function DrimeFilePicker({ isOpen, onClose, onSelect }: DrimeFilePickerProps) {
  const [files, setFiles] = useState<DrimeFile[]>([])
  const [folders, setFolders] = useState<DrimeFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'Drime' }])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<DrimeFile | null>(null)

  const fetchFiles = useCallback(async (folderId: string | null, search: string = '') => {
    setLoading(true)
    setError(null)
    setSelectedFile(null)
    
    try {
      let url = '/api/drime/files?perPage=100'
      if (folderId) {
        url += `&folderId=${folderId}`
      }
      if (search) {
        url += `&search=${encodeURIComponent(search)}`
      }
      
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
        setFiles(data.files || [])
      } else {
        setError('Impossible de charger les fichiers')
      }
    } catch {
      setError('Erreur de connexion à Drime')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setBreadcrumbs([{ id: null, name: 'Drime' }])
      setCurrentFolderId(null)
      setSelectedFile(null)
      fetchFiles(null)
    }
  }, [isOpen, fetchFiles])

  const handleFolderClick = (folder: DrimeFolder) => {
    setCurrentFolderId(folder.id)
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }])
    setSearchQuery('')
    fetchFiles(folder.id)
  }

  const handleBreadcrumbClick = (index: number) => {
    const item = breadcrumbs[index]
    setCurrentFolderId(item.id)
    setBreadcrumbs(breadcrumbs.slice(0, index + 1))
    setSearchQuery('')
    fetchFiles(item.id)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchFiles(currentFolderId, searchQuery)
  }

  const handleFileSelect = (file: DrimeFile) => {
    if (selectedFile?.id === file.id) {
      setSelectedFile(null)
    } else {
      setSelectedFile(file)
    }
  }

  const handleConfirmSelection = async () => {
    if (!selectedFile) return
    
    setDownloading(true)
    try {
      const res = await fetch('/api/drime/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: selectedFile.id, fileName: selectedFile.name }),
        credentials: 'include',
      })

      if (res.ok) {
        const blob = await res.blob()
        onSelect(selectedFile, blob)
        onClose()
      } else {
        setError('Échec du téléchargement')
      }
    } catch {
      setError('Échec du téléchargement')
    } finally {
      setDownloading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
        style={{ maxHeight: '600px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Drime logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <Image 
            src="/drime-logo-black.png" 
            alt="Drime" 
            width={100} 
            height={28}
            className="h-7 w-auto"
          />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-gray-200">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
              />
            </div>
          </form>
        </div>

        {/* Breadcrumbs */}
        <div className="px-5 py-2 border-b border-gray-200">
          <div className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <span className="mx-1 text-gray-400">/</span>}
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className={`hover:text-[#08CF65] transition-colors ${
                    index === breadcrumbs.length - 1 
                      ? 'text-gray-900 font-medium' 
                      : 'text-gray-500'
                  }`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-gray-500 text-sm mb-2">{error}</p>
              <button 
                onClick={() => fetchFiles(currentFolderId)}
                className="text-[#08CF65] text-sm font-medium hover:underline"
              >
                Réessayer
              </button>
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-gray-500 text-sm">Aucun fichier PDF trouvé</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Folders */}
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleFolderClick(folder)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-50 transition-colors text-left"
                >
                  <FolderIcon />
                  <span className="text-sm text-gray-900 truncate flex-1">{folder.name}</span>
                </button>
              ))}
              
              {/* PDF Files with checkbox */}
              {files.map((file) => {
                const isSelected = selectedFile?.id === file.id
                return (
                  <div
                    key={file.id}
                    onClick={() => handleFileSelect(file)}
                    className={`w-full flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-100' : 'hover:bg-blue-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <div 
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected 
                          ? 'bg-[#0061FE] border-[#0061FE]' 
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <PDFIcon />
                    <span className="text-sm text-gray-900 truncate flex-1">{file.name}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {selectedFile ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                1 sélectionné
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-500 hover:text-gray-700 ml-1"
                >
                  Désélectionner
                </button>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirmSelection}
              disabled={!selectedFile || downloading}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                selectedFile && !downloading
                  ? 'bg-[#0061FE] hover:bg-[#0052D4]' 
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {downloading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Chargement...
                </span>
              ) : (
                'Sélectionner'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
