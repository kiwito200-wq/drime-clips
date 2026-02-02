'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DocumentData, Signer, SignField } from '@/app/send/page'
import PDFViewer from '@/components/sign/PDFViewer'
import FieldOverlay from '@/components/sign/FieldOverlay'
import FieldPalette from '@/components/sign/FieldPalette'
import PageThumbnails from '@/components/sign/PageThumbnails'
import SignaturePad from '@/components/sign/SignaturePad'
import { Field, FieldType, Recipient } from '@/components/sign/types'
import { useTranslation } from '@/lib/i18n/I18nContext'

interface StepFieldsProps {
  documentData: DocumentData
  signers: Signer[]
  fields: SignField[]
  onAddField: (field: Omit<SignField, 'id'>) => void
  onRemoveField: (id: string) => void
  onUpdateField: (id: string, updates: Partial<SignField>) => void
  onRemoveSigner?: (id: string) => void
  onUpdateSigner?: (id: string, updates: Partial<Signer>) => void
  onUpdateDocumentName?: (name: string) => Promise<boolean>
  onUpdatePdfUrl?: (newUrl: string) => void
  onBack: () => void
  onNext: () => void
  isLoading: boolean
}

export default function StepFields({
  documentData,
  signers,
  fields,
  onAddField,
  onRemoveField,
  onUpdateField,
  onRemoveSigner,
  onUpdateSigner,
  onUpdateDocumentName,
  onUpdatePdfUrl,
  onBack,
  onNext,
  isLoading,
}: StepFieldsProps) {
  const { locale } = useTranslation()
  // State
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(true)
  const [pages, setPages] = useState<{ width: number; height: number; imageUrl?: string | null }[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [scale, setScale] = useState(0.6)
  const [selectedRecipientId, setSelectedRecipientId] = useState(signers[0]?.id || '')
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(documentData.name)
  const [isSavingName, setIsSavingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Update selectedRecipientId when signers change (e.g., after saving to DB)
  useEffect(() => {
    if (signers.length > 0 && !signers.find(s => s.id === selectedRecipientId)) {
      setSelectedRecipientId(signers[0].id)
    }
  }, [signers, selectedRecipientId])
  const [dragFieldType, setDragFieldType] = useState<FieldType | null>(null)
  const [drawMode, setDrawMode] = useState<FieldType | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSignMode, setIsSignMode] = useState(false)
  const [signaturePadOpen, setSignaturePadOpen] = useState(false)
  const [signingFieldId, setSigningFieldId] = useState<string | null>(null)

  // Convert signers to Recipient format
  const recipients: Recipient[] = useMemo(() => 
    signers.map(s => ({
      id: s.id,
      name: s.name || s.email,
      email: s.email,
      color: s.color,
    })),
    [signers]
  )

  // Convert fields to internal format
  const internalFields: Field[] = useMemo(() =>
    fields.map(f => ({
      id: f.id,
      type: f.type as FieldType,
      recipientId: f.signerId,
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      required: f.required,
      label: f.label || '',
      placeholder: getFieldPlaceholder(f.type as FieldType),
    })),
    [fields]
  )

  // Selected field
  const selectedField = useMemo(() =>
    internalFields.find(f => f.id === selectedFieldId) || null,
    [internalFields, selectedFieldId]
  )

  // Fields per page
  const fieldsPerPage = useMemo(() => {
    const counts: number[] = []
    pages.forEach((_, pageIndex) => {
      counts[pageIndex] = internalFields.filter(f => f.page === pageIndex).length
    })
    return counts
  }, [pages, internalFields])

  // Signed fields per page
  const signedFieldsPerPage = useMemo(() => {
    const counts: number[] = []
    pages.forEach((_, pageIndex) => {
      counts[pageIndex] = internalFields.filter(f =>
        f.page === pageIndex && f.value !== undefined && f.value !== '' && f.value !== false
      ).length
    })
    return counts
  }, [pages, internalFields])

  // Fetch signed URL for PDF
  useEffect(() => {
    const fetchPdfUrl = async () => {
      if (!documentData.slug) return
      
      setLoadingPdf(true)
      try {
        const res = await fetch(`/api/envelopes/${documentData.slug}/pdf-url`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setPdfUrl(data.url)
        } else {
          console.error('Failed to get PDF URL')
        }
      } catch (error) {
        console.error('Error fetching PDF URL:', error)
      } finally {
        setLoadingPdf(false)
      }
    }
    fetchPdfUrl()
  }, [documentData.slug])

  // Get recipient color by ID
  const getRecipientColor = useCallback((recipientId: string) => {
    const recipient = recipients.find(r => r.id === recipientId)
    // Fallback to first recipient's color or Drime purple if no match
    return recipient?.color || recipients[0]?.color || '#7E33F7'
  }, [recipients])

  // Handle PDF pages loaded
  const handlePagesLoaded = useCallback((loadedPages: { width: number; height: number }[]) => {
    setPages(loadedPages)
  }, [])

  // Add field at position
  const addFieldAtPosition = useCallback((type: FieldType, page: number, x: number, y: number) => {
    const defaultSizes: Record<FieldType, { w: number; h: number }> = {
      signature: { w: 0.2, h: 0.06 },
      initials: { w: 0.1, h: 0.04 },
      stamp: { w: 0.12, h: 0.08 },
      checkbox: { w: 0.03, h: 0.03 },
      radio: { w: 0.03, h: 0.03 },
      select: { w: 0.18, h: 0.035 },
      date: { w: 0.15, h: 0.035 },
      text: { w: 0.2, h: 0.035 },
      number: { w: 0.12, h: 0.035 },
      name: { w: 0.2, h: 0.035 },
      email: { w: 0.25, h: 0.035 },
      phone: { w: 0.18, h: 0.035 },
      image: { w: 0.15, h: 0.1 },
      file: { w: 0.15, h: 0.05 },
    }

    const size = defaultSizes[type] || { w: 0.15, h: 0.04 }
    const newField: Omit<SignField, 'id'> = {
      type: type as SignField['type'],
      signerId: selectedRecipientId,
      page,
      x: Math.max(0, Math.min(x - size.w / 2, 1 - size.w)),
      y: Math.max(0, Math.min(y - size.h / 2, 1 - size.h)),
      width: size.w,
      height: size.h,
      required: true, // All fields are required by default, including checkboxes
      label: '',
    }

    onAddField(newField)
    setDrawMode(null)
    setDragFieldType(null)
  }, [selectedRecipientId, onAddField])

  // Handle drop on page
  const handleDropOnPage = useCallback((page: number, x: number, y: number) => {
    if (dragFieldType) {
      addFieldAtPosition(dragFieldType, page, x, y)
    }
  }, [dragFieldType, addFieldAtPosition])

  // Handle draw on page
  const handleDrawOnPage = useCallback((page: number, x: number, y: number) => {
    if (drawMode) {
      addFieldAtPosition(drawMode, page, x, y)
    }
  }, [drawMode, addFieldAtPosition])

  // Update field (convert between formats)
  const handleUpdateField = useCallback((fieldId: string, updates: Partial<Field>) => {
    const mappedUpdates: Partial<SignField> = {}
    if (updates.x !== undefined) mappedUpdates.x = updates.x
    if (updates.y !== undefined) mappedUpdates.y = updates.y
    if (updates.width !== undefined) mappedUpdates.width = updates.width
    if (updates.height !== undefined) mappedUpdates.height = updates.height
    if (updates.required !== undefined) mappedUpdates.required = updates.required
    if (updates.label !== undefined) mappedUpdates.label = updates.label
    if (updates.recipientId !== undefined) mappedUpdates.signerId = updates.recipientId
    if (updates.type !== undefined) mappedUpdates.type = updates.type as SignField['type']
    
    onUpdateField(fieldId, mappedUpdates)
  }, [onUpdateField])

  // Duplicate field
  const duplicateField = useCallback((fieldId: string) => {
    const field = fields.find(f => f.id === fieldId)
    if (!field) return

    const newField: Omit<SignField, 'id'> = {
      ...field,
      x: Math.min(field.x + 0.02, 1 - field.width),
      y: Math.min(field.y + 0.02, 1 - field.height),
    }

    onAddField(newField)
  }, [fields, onAddField])

  // Handle sign field click
  const handleSignField = useCallback((fieldId: string) => {
    const field = internalFields.find(f => f.id === fieldId)
    if (!field) return

    if (field.type === 'signature' || field.type === 'initials') {
      setSigningFieldId(fieldId)
      setSignaturePadOpen(true)
    } else if (field.type === 'checkbox' || field.type === 'radio') {
      handleUpdateField(fieldId, { value: !field.value })
    }
  }, [internalFields, handleUpdateField])

  // Handle signature saved
  const handleSignatureSaved = useCallback((signatureDataUrl: string) => {
    if (signingFieldId) {
      handleUpdateField(signingFieldId, { value: signatureDataUrl })
      setSigningFieldId(null)
      setSignaturePadOpen(false)
    }
  }, [signingFieldId, handleUpdateField])

  // Add recipient - go back to step 2 (signers step)
  const addRecipient = useCallback(() => {
    onBack()
  }, [onBack])

  // Name editing handlers
  const startEditingName = useCallback(() => {
    setEditedName(documentData.name)
    setIsEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [documentData.name])

  const saveName = useCallback(async () => {
    if (!onUpdateDocumentName || editedName.trim() === '' || editedName === documentData.name) {
      setIsEditingName(false)
      return
    }

    setIsSavingName(true)
    try {
      await onUpdateDocumentName(editedName.trim())
    } finally {
      setIsSavingName(false)
      setIsEditingName(false)
    }
  }, [editedName, documentData.name, onUpdateDocumentName])

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveName()
    } else if (e.key === 'Escape') {
      setIsEditingName(false)
    }
  }, [saveName])


  // Update recipient
  const updateRecipient = useCallback((id: string, updates: Partial<Recipient>) => {
    if (onUpdateSigner) {
      onUpdateSigner(id, updates)
    }
  }, [onUpdateSigner])

  // Delete recipient
  const deleteRecipient = useCallback((id: string) => {
    if (onRemoveSigner) {
      onRemoveSigner(id)
      // If we deleted the selected recipient, select the first one
      if (selectedRecipientId === id && signers.length > 1) {
        const remaining = signers.filter(s => s.id !== id)
        if (remaining.length > 0) {
          setSelectedRecipientId(remaining[0].id)
        }
      }
    }
  }, [onRemoveSigner, selectedRecipientId, signers])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedFieldId(null)
        setDrawMode(null)
        setDragFieldType(null)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFieldId && (window.document.activeElement as HTMLElement)?.tagName !== 'INPUT') {
          e.preventDefault()
          onRemoveField(selectedFieldId)
          setSelectedFieldId(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFieldId, onRemoveField])

  if (loadingPdf || !pdfUrl) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">{locale === 'fr' ? 'Chargement du document...' : 'Loading document...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-70px)] flex flex-col bg-gray-100 overflow-hidden">
      {/* Compact Top Bar - just document name and action button */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        {/* Left - Document info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={handleNameKeyDown}
                  disabled={isSavingName}
                  className="font-medium text-gray-900 bg-transparent border-b-2 border-[#08CF65] outline-none"
                  style={{ width: `${Math.max(editedName.length * 8, 100)}px` }}
                />
                {isSavingName && (
                  <div className="w-3 h-3 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            ) : (
              <button
                onClick={startEditingName}
                className="font-medium text-gray-900 flex items-center gap-1.5 hover:text-[#08CF65] transition-colors"
                title="Cliquez pour renommer"
              >
                {documentData.name}
                <img src="/icons/rename.svg" alt="" className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            )}
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{fields.length} champ{fields.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {locale === 'fr' ? 'Retour' : 'Back'}
          </button>
          <button
            onClick={onNext}
            disabled={fields.length === 0 || isLoading}
            className="px-4 py-1.5 text-sm font-medium text-white bg-[#08CF65] hover:bg-[#08CF65]/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {locale === 'fr' ? 'Continuer' : 'Continue'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - Page Thumbnails */}
        {pages.length > 0 && (
          <PageThumbnails
            pages={pages}
            currentPage={currentPage}
            onPageSelect={(pageIndex) => {
              setCurrentPage(pageIndex)
              const pageElement = window.document.querySelector(`[data-page="${pageIndex}"]`)
              if (pageElement) {
                pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
            fieldsPerPage={fieldsPerPage}
            signedFieldsPerPage={signedFieldsPerPage}
          />
        )}

        {/* PDF Viewer */}
        <div
          className={`flex-1 overflow-auto transition-all duration-300 ${
            isSidebarCollapsed ? '' : 'mr-80'
          }`}
        >
          <PDFViewer
            fileUrl={pdfUrl}
            onPagesLoaded={handlePagesLoaded}
            scale={scale}
            onScaleChange={setScale}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            isDrawMode={!!drawMode}
            onDraw={handleDrawOnPage}
            onDrop={handleDropOnPage}
            isDragging={!!dragFieldType}
          >
            {pages.map((_, pageIndex) => (
              <FieldOverlay
                key={pageIndex}
                pageIndex={pageIndex}
                fields={internalFields.filter(f => f.page === pageIndex)}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onUpdateField={handleUpdateField}
                onDeleteField={onRemoveField}
                getRecipientColor={getRecipientColor}
                isPreviewMode={isPreviewMode}
                isSignMode={isSignMode}
                onSignField={handleSignField}
                scale={scale}
              />
            ))}
          </PDFViewer>
        </div>

        {/* Right Sidebar */}
        <AnimatePresence>
          {!isSidebarCollapsed && (
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden z-10"
            >
              <FieldPalette
                recipients={recipients}
                selectedRecipientId={selectedRecipientId}
                onSelectRecipient={setSelectedRecipientId}
                onAddRecipient={addRecipient}
                onUpdateRecipient={updateRecipient}
                onDeleteRecipient={deleteRecipient}
                selectedField={selectedField}
                onUpdateField={handleUpdateField}
                onDeleteField={onRemoveField}
                onDuplicateField={duplicateField}
                drawMode={drawMode}
                onSetDrawMode={setDrawMode}
                onDragStart={setDragFieldType}
                onDragEnd={() => setDragFieldType(null)}
                isPreviewMode={isPreviewMode}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute z-20 bg-white border border-gray-200 rounded-l-lg p-2 shadow-sm transition-all duration-300 ${
            isSidebarCollapsed ? 'right-0' : 'right-80'
          }`}
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Draw Mode Indicator */}
      <AnimatePresence>
        {drawMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50"
          >
            <div className="w-2 h-2 bg-[#08CF65] rounded-full animate-pulse" />
            <span className="text-sm font-medium">
              Cliquez sur le document pour placer un champ {getFieldLabel(drawMode)}
            </span>
            <button
              onClick={() => setDrawMode(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Signature Pad Modal */}
      <SignaturePad
        isOpen={signaturePadOpen}
        onClose={() => {
          setSignaturePadOpen(false)
          setSigningFieldId(null)
        }}
        onSave={handleSignatureSaved}
        title={
          signingFieldId && internalFields.find(f => f.id === signingFieldId)?.type === 'initials'
            ? 'Dessinez vos initiales'
            : 'Dessinez votre signature'
        }
      />

    </div>
  )
}

// Helper functions
function getFieldLabel(type: FieldType): string {
  const labels: Record<FieldType, string> = {
    signature: 'Signature',
    initials: 'Initiales',
    stamp: 'Tampon',
    checkbox: 'Case',
    radio: 'Radio',
    select: 'Sélection',
    date: 'Date',
    text: 'Texte',
    number: 'Nombre',
    name: 'Nom',
    email: 'Email',
    phone: 'Téléphone',
    image: 'Image',
    file: 'Fichier',
  }
  return labels[type] || type
}

function getFieldPlaceholder(type: FieldType): string {
  const placeholders: Record<FieldType, string> = {
    signature: 'Signez ici',
    initials: 'Paraphez ici',
    stamp: 'Tampon ici',
    checkbox: '',
    radio: '',
    select: 'Sélectionner',
    date: 'JJ/MM/AAAA',
    text: 'Entrer du texte',
    number: '0',
    name: 'Nom complet',
    email: 'Adresse email',
    phone: 'Numéro de téléphone',
    image: 'Uploader une image',
    file: 'Uploader un fichier',
  }
  return placeholders[type] || ''
}
