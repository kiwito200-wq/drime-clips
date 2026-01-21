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
    if (isSignMode && !isFilled) {
      onSign()
    } else if (!isPreviewMode && !isSignMode) {
      onSelect()
    }
  }, [isSignMode, isPreviewMode, isFilled, onSign, onSelect])

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

  // Get field icon
  const getFieldIcon = (type: FieldType) => {
    switch (type) {
      case 'signature':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )
      case 'initials':
        return <span className="text-xs font-bold">AB</span>
      case 'checkbox':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'date':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      case 'text':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
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
          <div className="w-full h-full flex items-center justify-center p-0.5">
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
              <span className="text-xs font-medium text-gray-900 truncate px-1">
                {field.value as string}
              </span>
            )}
          </div>
        ) : (
          /* Empty Field Content */
          <div className="flex items-center justify-center gap-1 text-gray-600 px-1 overflow-hidden">
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

      {/* Selection Controls */}
      {isSelected && !isPreviewMode && (
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
