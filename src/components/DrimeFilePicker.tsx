'use client'

import { useState, useEffect, useCallback } from 'react'

interface DrimeFile {
  id: string
  name: string
  file_name: string
  extension: string
  mime: string
  file_size: number
  created_at: string
  updated_at: string
  thumbnail?: string
}

interface DrimeFilePickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (file: DrimeFile, blob: Blob) => void
}

export default function DrimeFilePicker({ isOpen, onClose, onSelect }: DrimeFilePickerProps) {
  const [files, setFiles] = useState<DrimeFile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setFiles([])
      setCurrentPage(1)
      setHasMore(false)
      fetchFiles(1)
    }
  }, [isOpen])

  const fetchFiles = useCallback(async (page: number) => {
    if (page === 1) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setError(null)
    
    try {
      const res = await fetch(`/api/drime/files?page=${page}&perPage=25`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (page === 1) {
          setFiles(data.files || [])
        } else {
          setFiles(prev => [...prev, ...(data.files || [])])
        }
        setCurrentPage(data.currentPage || page)
        setHasMore(data.hasMore || false)
      } else {
        setError('Failed to load files from Drime')
      }
    } catch (e) {
      setError('Failed to connect to Drime')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchFiles(currentPage + 1)
    }
  }

  const handleSelectFile = async (file: DrimeFile) => {
    setDownloading(file.id)
    try {
      const res = await fetch('/api/drime/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.id, fileName: file.name || file.file_name }),
        credentials: 'include',
      })

      if (res.ok) {
        const blob = await res.blob()
        onSelect(file, blob)
        onClose()
      } else {
        setError('Failed to download file')
      }
    } catch (e) {
      setError('Failed to download file')
    } finally {
      setDownloading(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#08CF65]/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[#08CF65]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1zm-7-9L4 9h16l-8-7z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Import from Drime</h3>
              <p className="text-sm text-gray-500">Select a PDF from your Drime storage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-500 text-sm">Loading your files...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-gray-900 font-medium mb-1">Error</p>
              <p className="text-gray-500 text-sm">{error}</p>
              <button 
                onClick={() => fetchFiles(1)}
                className="mt-4 text-[#08CF65] text-sm font-medium hover:underline"
              >
                Try again
              </button>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-900 font-medium mb-1">No PDF files found</p>
              <p className="text-gray-500 text-sm">Upload PDF files to your Drime storage first</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  disabled={downloading !== null}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                    downloading === file.id 
                      ? 'border-[#08CF65] bg-[#08CF65]/5' 
                      : 'border-gray-200 hover:border-[#08CF65] hover:bg-[#F5F5F5]'
                  } ${downloading !== null && downloading !== file.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {/* PDF Icon */}
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13.5a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2h-1a1 1 0 0 1-1-1zm0 3a1 1 0 0 1 1-1h5a1 1 0 0 1 0 2h-5a1 1 0 0 1-1-1z"/>
                    </svg>
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {file.name || file.file_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.file_size)} • {formatDate(file.updated_at || file.created_at)}
                    </p>
                  </div>

                  {/* Loading or select indicator */}
                  {downloading === file.id ? (
                    <div className="w-6 h-6 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}
              
              {/* Load more button */}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-3 text-center text-sm text-[#08CF65] font-medium hover:bg-[#08CF65]/5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
                      Chargement...
                    </span>
                  ) : (
                    'Charger plus de fichiers'
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
