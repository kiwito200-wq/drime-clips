import { customAlphabet } from 'nanoid'

// Generate URL-safe tokens
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21)

export function generateSlug(): string {
  return nanoid(10)
}

export function generateToken(): string {
  return nanoid(32)
}

// Signer colors
const SIGNER_COLORS = [
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
]

export function getSignerColor(index: number): string {
  return SIGNER_COLORS[index % SIGNER_COLORS.length]
}

export function getNextSignerColor(existingColors: string[]): string {
  for (const color of SIGNER_COLORS) {
    if (!existingColors.includes(color)) {
      return color
    }
  }
  return SIGNER_COLORS[existingColors.length % SIGNER_COLORS.length]
}

// Status helpers
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending',
    completed: 'Completed',
    expired: 'Expired',
    cancelled: 'Cancelled',
  }
  return labels[status] || status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-700',
    cancelled: 'bg-yellow-100 text-yellow-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

// Format date
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
