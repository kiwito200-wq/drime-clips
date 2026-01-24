'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Field, FieldType } from './types'

interface FieldOverlayProps {
  pageIndex: number
  fields: Field[]
  selectedFieldId: string | null
  onSelectField: (fieldId: string | null) => void
  onUpdateField: (fieldId: string, updates: Partial<Field>) => void
  onDeleteField: (fieldId: string) => void
  getRecipientColor: (recipientId: string) => string
  isPreviewMode: boolean
  isSignMode: boolean
  onSignField: (fieldId: string) => void
  scale: number
}

export default function FieldOverlay({
  pageIndex,
  fields,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onDeleteField,
  getRecipientColor,
  isPreviewMode,
  isSignMode,
  onSignField,
  scale,
}: FieldOverlayProps) {
  return (
    <>
      {fields.map((field) => (
        <FieldItem
          key={field.id}
          field={field}
          isSelected={selectedFieldId === field.id}
          onSelect={() => onSelectField(field.id)}
          onUpdate={(updates) => onUpdateField(field.id, updates)}
          onDelete={() => onDeleteField(field.id)}
          onSign={() => onSignField(field.id)}
          recipientColor={getRecipientColor(field.recipientId)}
          isPreviewMode={isPreviewMode}
          isSignMode={isSignMode}
          scale={scale}
        />
      ))}
    </>
  )
}

interface FieldItemProps {
  field: Field
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<Field>) => void
  onDelete: () => void
  onSign: () => void
  recipientColor: string
  isPreviewMode: boolean
  isSignMode: boolean
  scale: number
}

function FieldItem({
  field,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onSign,
  recipientColor,
  isPreviewMode,
  isSignMode,
  scale,
}: FieldItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, fieldX: 0, fieldY: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const fieldRef = useRef<HTMLDivElement>(null)
  
  // Check if field is filled
  const isFilled = field.value !== undefined && field.value !== '' && field.value !== false

  // Calculate position and size in pixels
  const style = {
    left: `${field.x * 100}%`,
    top: `${field.y * 100}%`,
    width: `${field.width * 100}%`,
    height: `${field.height * 100}%`,
  }

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isPreviewMode || isSignMode) return
    e.stopPropagation()
    e.preventDefault()
    
    onSelect()
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      fieldX: field.x,
      fieldY: field.y,
    })
  }, [isPreviewMode, isSignMode, onSelect, field.x, field.y])
  
  // Handle click for signing
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSignMode) {
      // For checkboxes, ALWAYS allow toggle (check/uncheck)
      if (field.type === 'checkbox') {
        onUpdate({ value: field.value === 'true' ? '' : 'true' })
      } else {
        // All other fields open a popup modal (signature, initials, date, text, name, email)
        onSign()
      }
    } else if (!isPreviewMode && !isSignMode) {
      onSelect()
    }
  }, [isSignMode, isPreviewMode, field.type, field.value, onSign, onSelect, onUpdate])

  // Handle drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const parent = fieldRef.current?.parentElement
      if (!parent) return

      const rect = parent.getBoundingClientRect()
      const deltaX = (e.clientX - dragStart.x) / rect.width
      const deltaY = (e.clientY - dragStart.y) / rect.height

      const newX = Math.max(0, Math.min(dragStart.fieldX + deltaX, 1 - field.width))
      const newY = Math.max(0, Math.min(dragStart.fieldY + deltaY, 1 - field.height))

      onUpdate({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, field.width, field.height, onUpdate])

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isPreviewMode) return
    e.stopPropagation()
    e.preventDefault()

    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: field.width,
      height: field.height,
    })
  }, [isPreviewMode, field.width, field.height])

  // Handle resize
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const parent = fieldRef.current?.parentElement
      if (!parent) return

      const rect = parent.getBoundingClientRect()
      const deltaX = (e.clientX - resizeStart.x) / rect.width
      const deltaY = (e.clientY - resizeStart.y) / rect.height

      // Minimum size
      const minWidth = 0.03
      const minHeight = 0.02

      const newWidth = Math.max(minWidth, Math.min(resizeStart.width + deltaX, 1 - field.x))
      const newHeight = Math.max(minHeight, Math.min(resizeStart.height + deltaY, 1 - field.y))

      onUpdate({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeStart, field.x, field.y, onUpdate])

  // Get field icon - same icons as in FieldPalette
  const getFieldIcon = (type: FieldType) => {
    switch (type) {
      case 'signature':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.74026 19.3407C3.47519 19.0384 1.81771 14.9873 3.96659 12.4958C5.08661 11.1972 6.80744 10.7845 8.17508 9.83821C9.46691 8.94372 10.4756 7.5041 9.95254 5.88117C9.56096 4.669 8.43326 3.95975 7.15583 3.88489" />
            <path d="M15.1577 8.72144L19.3972 11.8369" />
            <path d="M16.2097 7.21585C17.1707 5.90967 18.5034 6.60915 19.5118 7.35106C20.5202 8.09298 21.5846 9.15716 20.6236 10.4633L14.0888 19.0127C13.7968 19.4096 13.3583 19.6735 12.8709 19.7456L10.4195 20.1085C10.0849 20.158 9.773 19.9285 9.72072 19.5943L9.33765 17.1461C9.26148 16.6592 9.38289 16.1621 9.67492 15.7652L16.2097 7.21585Z" />
          </svg>
        )
      case 'initials':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.01582 5.96647C3.01874 4.5547 4.08608 3.28888 5.47158 3.0505C5.75568 3.00088 9.08808 3.00769 10.4668 3.00866C11.8309 3.00964 12.9936 3.50001 13.9568 4.4613C16.002 6.50257 18.0452 8.5458 20.0855 10.591C21.2929 11.8004 21.3095 13.6568 20.1069 14.8701C18.3721 16.6214 16.6285 18.364 14.8782 20.0988C13.6659 21.3004 11.8095 21.2848 10.5991 20.0774C8.53544 18.0195 6.47178 15.9617 4.41688 13.8951C3.62197 13.0954 3.15301 12.1292 3.0489 10.9996C2.96522 10.0967 3.01387 6.73998 3.01582 5.96647Z" />
            <path d="M9.90712 8.31531C9.90322 9.18514 9.17642 9.90027 8.29784 9.89832C7.42509 9.89638 6.69828 9.1686 6.70315 8.30169C6.70899 7.39683 7.42509 6.69144 8.33578 6.69533C9.19977 6.69825 9.91101 7.43089 9.90712 8.31531Z" />
          </svg>
        )
      case 'checkbox':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" />
            <path d="M8.53516 12.0003L10.845 14.3091L15.4627 9.69141" />
          </svg>
        )
      case 'date':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.98389 9.66447H20.0253" />
            <path d="M15.6388 3V5.96174" />
            <path d="M8.36832 3V5.96174" />
            <path d="M15.8145 4.42139H8.19413C5.55056 4.42139 3.90039 5.8935 3.90039 8.59935V16.7451C3.90039 19.4938 5.55056 20.9999 8.19413 20.9999H15.8067C18.4581 20.9999 20.1004 19.52 20.1004 16.8132V8.59935C20.1082 5.8935 18.4658 4.42139 15.8145 4.42139Z" />
            <path d="M14.2495 15.0766H9.74951" />
          </svg>
        )
      case 'text':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.4541 20.0781H12.6376" />
            <path d="M9.45312 3.91406H12.6366" />
            <path d="M11.0449 3.91406V20.0847" />
            <path d="M7.6021 17.3743H6.13293C4.40203 17.3743 3 15.9722 3 14.2413V9.75696C3 8.02703 4.40203 6.625 6.13293 6.625H7.6021" />
            <path d="M14.1992 6.625H17.8682C19.5982 6.625 21.0002 8.02703 21.0002 9.75793V14.2326C21.0002 15.9605 19.5865 17.3743 17.8575 17.3743H14.1992" />
          </svg>
        )
      case 'phone':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.3527 3H9.64729C7.98076 3 6.62305 4.35779 6.62305 6.02431V17.9758C6.62305 19.6423 7.98084 21.0001 9.64736 21.0001H14.3528C16.0193 21.0001 17.377 19.6424 17.377 17.9758V6.02431C17.3769 4.35771 16.0192 3 14.3527 3Z" />
            <path d="M10.8008 5.14062H13.199" />
            <path d="M12 18.6689V18.6777" />
          </svg>
        )
      default:
        return null
    }
  }

  // Get field label
  const getFieldLabel = (type: FieldType) => {
    const labels: Record<FieldType, string> = {
      signature: 'Signature',
      initials: 'Initials',
      stamp: 'Stamp',
      checkbox: '✓',
      radio: '○',
      select: 'Select',
      date: 'Date',
      text: 'Text',
      number: '123',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      image: 'Image',
      file: 'File',
    }
    return labels[type] || type
  }

  const bgColorWithOpacity = isFilled ? `${recipientColor}10` : `${recipientColor}20`
  const borderColor = isSelected ? recipientColor : isFilled ? '#22c55e' : `${recipientColor}80`
  const cursor = isSignMode && !isFilled ? 'cursor-pointer' : isPreviewMode ? 'cursor-default' : 'cursor-move'

  return (
    <motion.div
      ref={fieldRef}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`absolute group ${isDragging || isResizing ? 'z-50' : 'z-10'}`}
      style={style}
      data-field-id={field.id}
    >
      {/* Field Container */}
      <div
        className={`
          w-full h-full rounded-sm border-2 flex items-center justify-center overflow-hidden
          transition-all duration-150 ${cursor}
          ${isSelected ? 'shadow-md' : ''}
          ${isDragging ? 'opacity-80' : ''}
          ${isSignMode && !isFilled ? 'hover:scale-105 hover:shadow-lg' : ''}
        `}
        style={{
          backgroundColor: isFilled ? '#ffffff' : bgColorWithOpacity,
          borderColor: borderColor,
          borderStyle: isFilled ? 'solid' : isSelected ? 'solid' : 'dashed',
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {/* Filled Content */}
        {isFilled ? (
          <div className={`w-full h-full flex items-center justify-center p-0.5 ${
            field.type === 'signature' || field.type === 'initials' ? 'bg-white' : ''
          }`}>
            {field.type === 'signature' || field.type === 'initials' ? (
              <img 
                src={field.value as string} 
                alt={field.type} 
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            ) : field.type === 'checkbox' ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              /* Display value for text/date/name/email - clicking opens popup */
              <span className="text-xs font-medium text-gray-900 truncate px-1 cursor-pointer">
                {field.value as string}
              </span>
            )}
          </div>
        ) : (
          /* Empty Field Content - clicking opens popup */
          <div className="flex items-center justify-center gap-1 text-gray-600 px-1 overflow-hidden cursor-pointer">
            <span style={{ color: recipientColor }}>
              {getFieldIcon(field.type)}
            </span>
            {field.type !== 'checkbox' && (
              <span 
                className="text-xs font-medium truncate" 
                style={{ color: recipientColor }}
              >
                {field.label || field.placeholder || getFieldLabel(field.type)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Selection Controls - only show in edit mode, not in sign mode */}
      {isSelected && !isPreviewMode && !isSignMode && (
        <>
          {/* Delete Button */}
          <button
            className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors z-20"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Resize Handle */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 rounded-full cursor-nwse-resize z-20 shadow-sm hover:scale-110 transition-transform"
            style={{ borderColor: recipientColor }}
            onMouseDown={handleResizeStart}
          />

          {/* Required Indicator */}
          {field.required && (
            <div
              className="absolute -top-1 -left-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: recipientColor }}
              title="Required field"
            />
          )}
        </>
      )}
    </motion.div>
  )
}
