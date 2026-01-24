'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface OnboardingStep {
  id: string
  title: string
  description: string
  target: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const STEPS_FR: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue sur Drime Sign',
    description: 'Découvrez comment envoyer et signer des documents en quelques clics. Cette visite rapide vous montrera les fonctionnalités principales.',
    target: '',
    position: 'bottom',
  },
  {
    id: 'home',
    title: 'Accueil',
    description: 'Votre tableau de bord principal. Voyez vos statistiques et uploadez rapidement des documents à faire signer.',
    target: '[data-onboarding="home"]',
    position: 'right',
  },
  {
    id: 'agreements',
    title: 'Mes documents',
    description: 'Retrouvez tous vos documents : brouillons, en cours de signature, et documents signés.',
    target: '[data-onboarding="agreements"]',
    position: 'right',
  },
  {
    id: 'received',
    title: 'Documents reçus',
    description: 'Les documents que d\'autres personnes vous ont envoyés pour signature.',
    target: '[data-onboarding="received"]',
    position: 'right',
  },
  {
    id: 'filters',
    title: 'Filtres rapides',
    description: 'Filtrez vos documents par statut : à signer, en cours, approuvés ou refusés.',
    target: '[data-onboarding="filters"]',
    position: 'right',
  },
  {
    id: 'upload',
    title: 'Envoyer un document',
    description: 'Glissez-déposez un PDF ou cliquez sur Import pour commencer à faire signer un document.',
    target: '[data-onboarding="upload"]',
    position: 'top',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Restez informé des signatures, invitations et mises à jour de vos documents.',
    target: '[data-onboarding="notifications"]',
    position: 'bottom',
  },
  {
    id: 'profile',
    title: 'Votre profil',
    description: 'Accédez à vos paramètres, gérez votre signature personnelle et changez de langue.',
    target: '[data-onboarding="profile"]',
    position: 'bottom',
  },
]

const STEPS_EN: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Drime Sign',
    description: 'Discover how to send and sign documents in just a few clicks. This quick tour will show you the main features.',
    target: '',
    position: 'bottom',
  },
  {
    id: 'home',
    title: 'Home',
    description: 'Your main dashboard. View your stats and quickly upload documents to get signed.',
    target: '[data-onboarding="home"]',
    position: 'right',
  },
  {
    id: 'agreements',
    title: 'My Documents',
    description: 'Find all your documents: drafts, pending signatures, and signed documents.',
    target: '[data-onboarding="agreements"]',
    position: 'right',
  },
  {
    id: 'received',
    title: 'Received Documents',
    description: 'Documents that others have sent you for signature.',
    target: '[data-onboarding="received"]',
    position: 'right',
  },
  {
    id: 'filters',
    title: 'Quick Filters',
    description: 'Filter your documents by status: to sign, in progress, approved or rejected.',
    target: '[data-onboarding="filters"]',
    position: 'right',
  },
  {
    id: 'upload',
    title: 'Send a Document',
    description: 'Drag and drop a PDF or click Import to start getting a document signed.',
    target: '[data-onboarding="upload"]',
    position: 'top',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Stay informed about signatures, invitations and document updates.',
    target: '[data-onboarding="notifications"]',
    position: 'bottom',
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Access your settings, manage your personal signature and change language.',
    target: '[data-onboarding="profile"]',
    position: 'bottom',
  },
]

interface OnboardingProps {
  locale: 'fr' | 'en'
  onComplete: () => void
}

export default function Onboarding({ locale, onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  
  const steps = locale === 'fr' ? STEPS_FR : STEPS_EN
  const step = steps[currentStep]
  const isWelcome = currentStep === 0
  const isLast = currentStep === steps.length - 1

  // Find and highlight the target element
  useEffect(() => {
    if (!step.target) {
      setTargetRect(null)
      return
    }

    const findElement = () => {
      const element = document.querySelector(step.target)
      if (element) {
        const rect = element.getBoundingClientRect()
        setTargetRect(rect)
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }
    }

    const timeout = setTimeout(findElement, 150)
    window.addEventListener('resize', findElement)
    
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', findElement)
    }
  }, [step.target])

  const goToStep = useCallback((newStep: number) => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrentStep(newStep)
    setTimeout(() => setIsAnimating(false), 400)
  }, [isAnimating])

  const handleNext = useCallback(() => {
    if (isAnimating) return
    if (isLast) {
      onComplete()
    } else {
      goToStep(currentStep + 1)
    }
  }, [isLast, onComplete, isAnimating, currentStep, goToStep])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

  const handlePrev = useCallback(() => {
    if (isAnimating || currentStep === 0) return
    goToStep(currentStep - 1)
  }, [currentStep, isAnimating, goToStep])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext()
      else if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev, handleSkip])

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (isWelcome || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const padding = 20
    const tooltipWidth = 360
    const tooltipHeight = 220

    let top: number
    let left: number

    switch (step.position) {
      case 'right':
        top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, targetRect.top + targetRect.height / 2 - tooltipHeight / 2))
        left = Math.min(window.innerWidth - tooltipWidth - 16, targetRect.right + padding)
        break
      case 'left':
        top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, targetRect.top + targetRect.height / 2 - tooltipHeight / 2))
        left = Math.max(16, targetRect.left - tooltipWidth - padding)
        break
      case 'bottom':
        top = Math.min(window.innerHeight - tooltipHeight - 16, targetRect.bottom + padding)
        left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2))
        break
      case 'top':
        top = Math.max(16, targetRect.top - tooltipHeight - padding)
        left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2))
        break
      default:
        top = window.innerHeight / 2 - tooltipHeight / 2
        left = window.innerWidth / 2 - tooltipWidth / 2
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
    }
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* For welcome screen: simple dark overlay */}
      {isWelcome && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 bg-black/60"
          onClick={handleNext}
        />
      )}
      
      {/* For other steps: spotlight effect using box-shadow only (no white background!) */}
      {!isWelcome && targetRect && (
        <motion.div
          key={`spotlight-${currentStep}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="absolute rounded-xl pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            // NO background - element stays visible!
            // box-shadow creates BOTH the green border AND the dark overlay
            boxShadow: `
              0 0 0 3px #08CF65,
              0 0 15px rgba(8, 207, 101, 0.5),
              0 0 0 9999px rgba(0, 0, 0, 0.6)
            `,
          }}
        />
      )}

      {/* Click catcher for non-welcome steps */}
      {!isWelcome && (
        <div 
          className="absolute inset-0" 
          onClick={handleNext}
          style={{ pointerEvents: targetRect ? 'auto' : 'none' }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ 
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1], // Custom spring-like easing
          }}
          className="w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
          style={getTooltipStyle()}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-900 font-semibold text-lg">{step.title}</h3>
              <span className="text-gray-400 text-sm">
                {currentStep + 1} / {steps.length}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-4">
            <p className="text-gray-600 leading-relaxed">{step.description}</p>
          </div>

          {/* Progress dots */}
          <div className="px-6 pb-4 flex justify-center gap-1.5">
            {steps.map((_, index) => (
              <motion.button
                key={index}
                onClick={() => goToStep(index)}
                className={`h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-[#08CF65]'
                    : index < currentStep
                    ? 'bg-[#08CF65]/50'
                    : 'bg-gray-200'
                }`}
                animate={{ 
                  width: index === currentStep ? 24 : 8,
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="px-6 pb-5 flex items-center justify-between">
            {isWelcome ? (
              <button
                onClick={handleSkip}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {locale === 'fr' ? 'Passer la visite' : 'Skip tour'}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <motion.button
                  onClick={handlePrev}
                  disabled={isAnimating}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {locale === 'fr' ? 'Précédent' : 'Previous'}
                </motion.button>
              )}
              <motion.button
                onClick={handleNext}
                disabled={isAnimating}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-5 py-2 text-sm font-medium text-white bg-[#08CF65] rounded-lg hover:bg-[#06B557] transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {isLast ? (
                  locale === 'fr' ? "C'est parti !" : "Let's go!"
                ) : (
                  <>
                    {locale === 'fr' ? 'Suivant' : 'Next'}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
