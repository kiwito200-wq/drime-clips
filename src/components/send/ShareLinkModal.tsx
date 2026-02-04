'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/I18nContext'

// Dynamic import of Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

interface SignerLink {
  id: string
  email: string
  name: string | null
  color: string
  signUrl: string
}

interface ShareLinkModalProps {
  isOpen: boolean
  onClose: () => void
  signerLinks: SignerLink[]
  documentName: string
  isGenerating?: boolean
  onGenerateLinks?: () => Promise<void>
  linksGenerated: boolean
}

export default function ShareLinkModal({
  isOpen,
  onClose,
  signerLinks,
  documentName,
  isGenerating = false,
  onGenerateLinks,
  linksGenerated,
}: ShareLinkModalProps) {
  const { locale } = useTranslation()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [checkAnimationData, setCheckAnimationData] = useState<any>(null)

  // Load check animation
  useEffect(() => {
    fetch('/check-animation.json')
      .then(res => res.json())
      .then(data => setCheckAnimationData(data))
      .catch(() => {})
  }, [])

  // Get initials from name/email
  const getInitials = (name: string | null, email: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    return email.slice(0, 2).toUpperCase()
  }

  // Copy link to clipboard
  const copyLink = async (signerId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(signerId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(signerId)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  {locale === 'fr' ? 'Partager le lien' : 'Share link'}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Generate links section (shown before links are generated) */}
                {!linksGenerated && (
                  <div className="bg-gray-50 rounded-xl p-5 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {locale === 'fr' 
                        ? 'Générer les liens pour partager le document' 
                        : 'Generate links to share the document'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {locale === 'fr'
                        ? <>Une fois les liens générés, le document sera en statut <span className="font-semibold text-gray-700">Envoyé</span>.</>
                        : <>Once links are generated, the document will be in <span className="font-semibold text-gray-700">Sent</span> status.</>}
                    </p>
                    <button
                      onClick={onGenerateLinks}
                      disabled={isGenerating}
                      className="px-5 py-2.5 bg-[#08CF65] text-white rounded-lg font-medium hover:bg-[#07b858] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {locale === 'fr' ? 'Génération...' : 'Generating...'}
                        </>
                      ) : (
                        locale === 'fr' ? 'Générer les liens' : 'Generate links'
                      )}
                    </button>
                  </div>
                )}

                {/* Individual links section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {locale === 'fr' ? 'Liens individuels' : 'Individual links'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    {locale === 'fr'
                      ? 'Les liens sont uniques pour chaque destinataire. Assurez-vous que seuls les signataires prévus accèdent au document via leur lien.'
                      : 'Links are unique for each recipient. Make sure that only the intended recipients/signers are accessing the document through their link.'}
                  </p>

                  <div className="space-y-3">
                    {signerLinks.map((signer) => {
                      const isCopied = copiedId === signer.id
                      
                      return (
                        <div
                          key={signer.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                        >
                          {/* Avatar */}
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                            style={{ backgroundColor: signer.color }}
                          >
                            {getInitials(signer.name, signer.email)}
                          </div>

                          {/* Signer info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {signer.name || signer.email}
                              </p>
                              <span className="text-xs px-2 py-0.5 bg-[#08CF65]/10 text-[#08CF65] rounded-full font-medium">
                                {locale === 'fr' ? 'Signataire' : 'Signer'}
                              </span>
                            </div>
                            {signer.name && (
                              <p className="text-xs text-gray-500 truncate">{signer.email}</p>
                            )}
                          </div>

                          {/* Link + Copy button container (Transfr style) */}
                          <div className={`flex items-center rounded-[10px] overflow-hidden transition-all duration-300 border ${
                            isCopied 
                              ? 'border-[#08CF65] bg-[#08CF65]/5' 
                              : 'border-gray-200 bg-white'
                          }`}>
                            {isCopied ? (
                              /* Copied state - centered with animation */
                              <div className="flex items-center justify-center gap-2 px-4 py-2">
                                {checkAnimationData ? (
                                  <div style={{ width: '20px', height: '20px', filter: 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(123deg) brightness(102%) contrast(101%)' }}>
                                    <Lottie 
                                      key={`copied-${signer.id}`}
                                      animationData={checkAnimationData} 
                                      loop={false}
                                      autoplay={true}
                                      style={{ width: '20px', height: '20px' }}
                                    />
                                  </div>
                                ) : (
                                  <svg className="w-5 h-5 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                <span className="text-sm font-medium text-[#08CF65]">
                                  {locale === 'fr' ? 'Lien copié !' : 'Link copied!'}
                                </span>
                              </div>
                            ) : (
                              /* Normal state - link + separator + copy button */
                              <>
                                <span className="px-3 py-2 text-xs text-gray-500 truncate max-w-[140px]">
                                  {linksGenerated ? signer.signUrl : 'https://sign.drime.cloud/...'}
                                </span>
                                {/* Vertical separator */}
                                <div className="self-stretch w-px bg-gray-200"></div>
                                {/* Copy button */}
                                <button
                                  onClick={() => copyLink(signer.id, signer.signUrl)}
                                  disabled={!linksGenerated}
                                  className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Image 
                                    src="/icons/copy-icon.svg" 
                                    alt="Copy" 
                                    width={20} 
                                    height={20} 
                                    className="w-5 h-5" 
                                    style={{ filter: 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(123deg) brightness(102%) contrast(101%)' }} 
                                  />
                                  <span className="text-sm font-medium text-[#08CF65]">
                                    {locale === 'fr' ? 'Copier' : 'Copy'}
                                  </span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              {linksGenerated && (
                <div className="p-5 border-t border-gray-100 bg-gray-50">
                  <div className="flex justify-end">
                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 bg-[#08CF65] text-white rounded-lg font-medium hover:bg-[#07b858] transition-colors"
                    >
                      {locale === 'fr' ? 'Terminé' : 'Done'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
