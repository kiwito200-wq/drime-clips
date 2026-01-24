'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface OnboardingStep {
  id: string
  title: string
  description: string
  target: string // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right'
}

const STEPS_FR: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue sur Drime Sign ! 🎉',
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
    title: 'Welcome to Drime Sign! 🎉',
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
        
        // Scroll element into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }
    }

    // Small delay to ensure DOM is ready
    const timeout = setTimeout(findElement, 100)
    
    // Update position on resize
    window.addEventListener('resize', findElement)
    
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', findElement)
    }
  }, [step.target])

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }, [isLast, onComplete])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (!targetRect || isWelcome) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const padding = 16
    const tooltipWidth = 360
    const tooltipHeight = 200

    switch (step.position) {
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.right + padding}px`,
          transform: 'translateY(-50%)',
        }
      case 'left':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.left - tooltipWidth - padding}px`,
          transform: 'translateY(-50%)',
        }
      case 'bottom':
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        }
      case 'top':
        return {
          top: `${targetRect.top - tooltipHeight - padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        }
      default:
        return {}
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999]"
      >
        {/* Overlay with spotlight effect */}
        <div className="absolute inset-0 bg-black/60" />
        
        {/* Spotlight cutout */}
        {targetRect && !isWelcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bg-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="absolute w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={getTooltipStyle()}
        >
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-[#08CF65] to-[#06B557] px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-lg">{step.title}</h3>
              <span className="text-white/80 text-sm">
                {currentStep + 1} / {steps.length}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-gray-600 leading-relaxed">{step.description}</p>
          </div>

          {/* Progress dots */}
          <div className="px-6 pb-4 flex justify-center gap-1.5">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-[#08CF65] w-6'
                    : index < currentStep
                    ? 'bg-[#08CF65]/50'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {locale === 'fr' ? 'Passer la visite' : 'Skip tour'}
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {locale === 'fr' ? 'Précédent' : 'Previous'}
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-5 py-2 text-sm font-medium text-white bg-[#08CF65] rounded-lg hover:bg-[#06B557] transition-colors flex items-center gap-1"
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
              </button>
            </div>
          </div>
        </motion.div>

        {/* Keyboard hint */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-white/10 rounded text-xs">←</kbd>
            <kbd className="px-2 py-1 bg-white/10 rounded text-xs">→</kbd>
            {locale === 'fr' ? 'Naviguer' : 'Navigate'}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Esc</kbd>
            {locale === 'fr' ? 'Fermer' : 'Close'}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
