'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

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
    id: 'templates',
    title: 'Templates',
    description: 'Créez des modèles réutilisables pour vos documents fréquents. Gagnez du temps en préconfigurant les champs de signature.',
    target: '[data-onboarding="templates"]',
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
    id: 'templates',
    title: 'Templates',
    description: 'Create reusable templates for your frequent documents. Save time by preconfiguring signature fields.',
    target: '[data-onboarding="templates"]',
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
  const [direction, setDirection] = useState(1) // 1 for next, -1 for prev
  
  const steps = locale === 'fr' ? STEPS_FR : STEPS_EN
  const step = steps[currentStep]
  const isWelcome = currentStep === 0
  const isLast = currentStep === steps.length - 1

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

    // Small delay to allow DOM to settle
    const timeout = setTimeout(findElement, 100)
    window.addEventListener('resize', findElement)
    
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', findElement)
    }
  }, [step.target])

  const goToStep = useCallback((newStep: number) => {
    setDirection(newStep > currentStep ? 1 : -1)
    setCurrentStep(newStep)
  }, [currentStep])

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete()
    } else {
      goToStep(currentStep + 1)
    }
  }, [isLast, onComplete, currentStep, goToStep])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

  const handlePrev = useCallback(() => {
    if (currentStep === 0) return
    goToStep(currentStep - 1)
  }, [currentStep, goToStep])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext()
      else if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev, handleSkip])

  const getTooltipPosition = () => {
    if (!targetRect) return null

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
        return null
    }

    return { top, left }
  }

  const tooltipPosition = getTooltipPosition()

  // Smooth slide animation variants
  const cardVariants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir * 40,
      scale: 0.98,
    }),
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  }

  // Content animation for smooth text transitions
  const contentVariants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir * 20,
    }),
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.25,
        ease: 'easeOut',
      },
    },
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Dark overlay - always present, smooth transition */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 bg-black/60"
        onClick={handleNext}
      />

      {/* Spotlight for non-welcome steps */}
      {!isWelcome && targetRect && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
          transition={{ 
            duration: 0.35,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="absolute rounded-xl pointer-events-none"
          style={{
            boxShadow: `
              0 0 0 3px #08CF65,
              0 0 15px rgba(8, 207, 101, 0.5),
              0 0 0 9999px rgba(0, 0, 0, 0.6)
            `,
          }}
        />
      )}

      {/* Card - either centered (welcome) or positioned */}
      <div 
        className={`absolute ${isWelcome ? 'inset-0 flex items-center justify-center' : ''}`}
        style={!isWelcome && tooltipPosition ? {
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        } : undefined}
      >
        <motion.div
          key={`card-container-${isWelcome ? 'welcome' : 'positioned'}`}
          initial={false}
          animate={tooltipPosition || isWelcome ? {
            top: !isWelcome && tooltipPosition ? tooltipPosition.top : undefined,
            left: !isWelcome && tooltipPosition ? tooltipPosition.left : undefined,
          } : undefined}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={`w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto ${!isWelcome ? 'fixed' : ''}`}
          style={!isWelcome && tooltipPosition ? {
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          } : undefined}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <motion.h3 
                key={`title-${currentStep}`}
                custom={direction}
                variants={contentVariants}
                initial="initial"
                animate="animate"
                className="text-gray-900 font-semibold text-lg"
              >
                {step.title}
              </motion.h3>
              <span className="text-gray-400 text-sm tabular-nums">
                {currentStep + 1} / {steps.length}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-4 min-h-[72px]">
            <motion.p 
              key={`desc-${currentStep}`}
              custom={direction}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              className="text-gray-600 leading-relaxed"
            >
              {step.description}
            </motion.p>
          </div>

          {/* Progress dots */}
          <div className="px-6 pb-4 flex justify-center gap-1.5">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => goToStep(index)}
                className="h-2 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: index === currentStep ? 24 : 8,
                  backgroundColor: index === currentStep 
                    ? '#08CF65' 
                    : index < currentStep 
                      ? 'rgba(8, 207, 101, 0.5)' 
                      : '#E5E7EB',
                }}
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
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handlePrev}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {locale === 'fr' ? 'Précédent' : 'Previous'}
                </motion.button>
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
      </div>
    </div>
  )
}
