'use client'

import { motion } from 'framer-motion'

interface PageThumbnailsProps {
  pages: { width: number; height: number; imageUrl?: string | null }[]
  currentPage: number
  onPageSelect: (pageIndex: number) => void
  fieldsPerPage: number[]
  signedFieldsPerPage: number[]
}

export default function PageThumbnails({
  pages,
  currentPage,
  onPageSelect,
  fieldsPerPage,
  signedFieldsPerPage,
}: PageThumbnailsProps) {
  if (pages.length === 0) return null

  return (
    <div className="w-32 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 bg-white">
        <h3 className="text-xs font-semibold text-gray-600 text-center">Pages</h3>
      </div>

      {/* Thumbnails */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pages.map((page, index) => {
          const fieldCount = fieldsPerPage[index] || 0
          const signedCount = signedFieldsPerPage[index] || 0
          const isComplete = fieldCount > 0 && signedCount === fieldCount
          const hasUnsigned = fieldCount > 0 && signedCount < fieldCount

          return (
            <motion.button
              key={index}
              onClick={() => onPageSelect(index)}
              className={`
                w-full relative rounded-lg overflow-hidden transition-all
                ${currentPage === index 
                  ? 'ring-2 ring-[#08CF65] shadow-md' 
                  : 'ring-1 ring-gray-200 hover:ring-gray-300 hover:shadow-sm'
                }
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Thumbnail Image */}
              <div className="aspect-[3/4] bg-white relative">
                {page.imageUrl ? (
                  <img
                    src={page.imageUrl}
                    alt={`Page ${index + 1}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <span className="text-xs text-gray-400">{index + 1}</span>
                  </div>
                )}

                {/* Current page indicator */}
                {currentPage === index && (
                  <div className="absolute inset-0 bg-[#08CF65]/10 pointer-events-none" />
                )}
              </div>

              {/* Page number & field indicator */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-white">{index + 1}</span>
                  {fieldCount > 0 && (
                    <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium ${
                      isComplete 
                        ? 'bg-emerald-500 text-white' 
                        : hasUnsigned 
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-500 text-white'
                    }`}>
                      {isComplete ? (
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span>{signedCount}/{fieldCount}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Footer with page count */}
      <div className="px-3 py-2 border-t border-gray-200 bg-white">
        <p className="text-xs text-gray-500 text-center">
          {pages.length} page{pages.length > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}
