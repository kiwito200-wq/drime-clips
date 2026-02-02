'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/I18nContext'

interface Role {
  id: string
  name: string
  color: string
}

interface StepRolesProps {
  roles: Role[]
  onAddRole: (name: string) => void
  onRemoveRole: (id: string) => void
  onUpdateRole: (id: string, name: string) => void
  onBack: () => void
  onNext: () => void
  isLoading: boolean
}

const ROLE_COLORS = [
  '#7E33F7', // Purple
  '#FFAD12', // Orange
  '#ED3757', // Red/Pink
  '#08CF65', // Green
  '#4F46E5', // Blue/Indigo
  '#00B7FF', // Cyan
]

export default function StepRoles({
  roles,
  onAddRole,
  onRemoveRole,
  onUpdateRole,
  onBack,
  onNext,
  isLoading,
}: StepRolesProps) {
  const { locale } = useTranslation()
  const [newRoleName, setNewRoleName] = useState('')
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleAddRole = () => {
    const trimmed = newRoleName.trim()
    if (!trimmed) {
      setErrors({ newRole: locale === 'fr' ? 'Ce champ est requis' : 'This field is required' })
      return
    }
    
    if (roles.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrors({ newRole: locale === 'fr' ? 'Ce rôle existe déjà' : 'This role already exists' })
      return
    }

    onAddRole(trimmed)
    setNewRoleName('')
    setErrors({})
  }

  const handleStartEdit = (role: Role) => {
    setEditingRoleId(role.id)
    setEditingName(role.name)
    setErrors({})
  }

  const handleSaveEdit = (roleId: string) => {
    const trimmed = editingName.trim()
    if (!trimmed) {
      setErrors({ [roleId]: 'Ce champ est requis' })
      return
    }

    const role = roles.find(r => r.id === roleId)
    if (role && roles.some(r => r.id !== roleId && r.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrors({ [roleId]: locale === 'fr' ? 'Ce rôle existe déjà' : 'This role already exists' })
      return
    }

    onUpdateRole(roleId, trimmed)
    setEditingRoleId(null)
    setEditingName('')
    setErrors({})
  }

  const handleCancelEdit = () => {
    setEditingRoleId(null)
    setEditingName('')
    setErrors({})
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{locale === 'fr' ? 'Ajouter des rôles de signataires' : 'Add signer roles'}</h1>
        <p className="text-gray-500 mt-2">{locale === 'fr' ? 'Définissez les rôles qui devront signer ce template (ex: "Client", "Vendeur")' : 'Define the roles that will need to sign this template (e.g., "Client", "Vendor")'}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 p-6 mb-6"
      >

        {/* Roles list */}
        <div className="space-y-3 mb-4">
          {roles.map((role, index) => (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                style={{ backgroundColor: role.color }}
              >
                {getInitials(role.name)}
              </div>
              
              {editingRoleId === role.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => {
                      setEditingName(e.target.value)
                      setErrors({})
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit(role.id)
                      } else if (e.key === 'Escape') {
                        handleCancelEdit()
                      }
                    }}
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none ${
                      errors[role.id] ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(role.id)}
                    className="p-2 text-[#08CF65] hover:bg-[#08CF65]/10 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{role.name}</p>
                    <p className="text-xs text-gray-500">{locale === 'fr' ? 'Rôle de signataire' : 'Signer role'}</p>
                  </div>
                  <button
                    onClick={() => handleStartEdit(role)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onRemoveRole(role.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                    title={locale === 'fr' ? 'Supprimer' : 'Delete'}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
              {errors[role.id] && (
                <p className="text-xs text-red-600 mt-1">{errors[role.id]}</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Add new role */}
        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {locale === 'fr' ? 'Qui doit signer ?' : 'Who needs to sign?'} *
          </label>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => {
                    setNewRoleName(e.target.value)
                    setErrors({})
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddRole()
                    }
                  }}
                  placeholder={locale === 'fr' ? 'Nom du rôle (ex: "Client" ou "Vendeur")' : 'Role name (e.g., "Client" or "Vendor")'}
                  className={`w-full pl-10 pr-10 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none ${
                    errors.newRole ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                />
                {newRoleName && (
                  <button
                    onClick={() => {
                      setNewRoleName('')
                      setErrors({})
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {errors.newRole && (
                <p className="text-xs text-red-600 mt-1">{errors.newRole}</p>
              )}
            </div>
            <button
              onClick={handleAddRole}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {locale === 'fr' ? 'Ajouter un rôle' : 'Add a role'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <button
          onClick={onBack}
          className="px-5 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          {locale === 'fr' ? 'Retour' : 'Back'}
        </button>
        <button
          onClick={onNext}
          disabled={isLoading || roles.length === 0}
          className="px-6 py-2.5 bg-[#08CF65] text-white font-medium rounded-xl hover:bg-[#07b858] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {locale === 'fr' ? 'Chargement...' : 'Loading...'}
            </>
          ) : (
            <>
              {locale === 'fr' ? 'Continuer' : 'Continue'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
