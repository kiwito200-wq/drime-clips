'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'

const locales: Record<string, typeof fr | typeof enUS> = {
  fr,
  en: enUS,
}

interface CustomDatePickerProps {
  value: string // ISO date string (YYYY-MM-DD)
  onChange: (date: string) => void
  min?: string // ISO date string
  max?: string // ISO date string
  language?: string
  placeholder?: string
  className?: string
}

export default function CustomDatePicker({ 
  value, 
  onChange, 
  min, 
  max, 
  language = 'fr',
  placeholder = 'Sélectionner une date',
  className = '' 
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date())
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const pickerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  const locale = locales[language] || fr

  // Wait for client-side mount for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 300),
      })
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (pickerRef.current && !pickerRef.current.contains(target) &&
          inputRef.current && !inputRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on ESC
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen])

  const minDate = min ? new Date(min) : null
  const maxDate = max ? new Date(max) : null
  const selectedDate = value ? new Date(value) : null

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { locale })
  const calendarEnd = endOfWeek(monthEnd, { locale })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const handleDateClick = (day: Date) => {
    if (minDate && day < minDate) return
    if (maxDate && day > maxDate) return
    
    const dateStr = format(day, 'yyyy-MM-dd')
    onChange(dateStr)
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setIsOpen(false)
  }

  const isDisabled = (day: Date) => {
    if (minDate && day < minDate) return true
    if (maxDate && day > maxDate) return true
    return false
  }

  const displayValue = value ? format(new Date(value), 'dd MMMM yyyy', { locale }) : ''

  const weekDays = language === 'fr' 
    ? ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={pickerRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 99999,
          }}
          className="bg-white rounded-xl border border-gray-200 shadow-xl p-4 min-w-[300px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-900 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Week days */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-400 py-1 uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isTodayDate = isToday(day)
              const disabled = isDisabled(day)

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => !disabled && handleDateClick(day)}
                  disabled={disabled}
                  className={`
                    w-9 h-9 text-sm rounded-lg transition-colors
                    ${!isCurrentMonth ? 'text-gray-300' : ''}
                    ${isSelected ? 'bg-[#08CF65] text-white font-semibold' : ''}
                    ${!isSelected && isTodayDate ? 'bg-[#08CF65]/10 text-[#08CF65] font-semibold' : ''}
                    ${!isSelected && !isTodayDate && isCurrentMonth && !disabled ? 'hover:bg-gray-100 text-gray-900' : ''}
                    ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          {/* Clear button */}
          {value && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleClear}
                className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {language === 'fr' ? 'Supprimer la date' : 'Clear date'}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className="relative">
      <div ref={inputRef} className="relative">
        <input
          type="text"
          readOnly
          onClick={() => setIsOpen(!isOpen)}
          value={displayValue || ''}
          placeholder={placeholder}
          className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm outline-none cursor-pointer bg-white transition-all ${
            isOpen ? 'ring-2 ring-[#08CF65]/20 border-[#08CF65]' : 'hover:border-gray-300'
          } ${value ? 'text-gray-900' : 'text-gray-400'} ${className}`}
        />
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer pointer-events-auto"
        >
          {/* Calendar icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3.09" y1="9.4" x2="20.92" y2="9.4" />
            <line x1="16.44" y1="13.31" x2="16.45" y2="13.31" />
            <line x1="12" y1="13.31" x2="12.01" y2="13.31" />
            <line x1="7.56" y1="13.31" x2="7.57" y2="13.31" />
            <line x1="16.44" y1="17.2" x2="16.45" y2="17.2" />
            <line x1="12" y1="17.2" x2="12.01" y2="17.2" />
            <line x1="7.56" y1="17.2" x2="7.57" y2="17.2" />
            <line x1="16.04" y1="2" x2="16.04" y2="5.29" />
            <line x1="7.97" y1="2" x2="7.97" y2="5.29" />
            <path d="M16.24,3.58H7.77C4.83,3.58,3,5.21,3,8.22V15.27C3,18.33,4.83,20,7.77,20H16.23C19.17,20,21,18.35,21,15.35V8.22C21.01,5.21,19.18,3.58,16.24,3.58Z" />
          </svg>
        </div>
      </div>
      
      {/* Render dropdown via portal to escape overflow:hidden */}
      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  )
}
