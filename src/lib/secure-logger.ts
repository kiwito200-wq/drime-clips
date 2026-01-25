/**
 * SECURITY: Secure Logging Module
 * 
 * Provides logging functions that automatically sanitize sensitive data
 * to prevent accidental exposure in logs.
 */

// Fields that should be masked in logs
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'sessionToken',
  'apiKey',
  'secret',
  'drimeToken',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'otp',
  'code',
  'signatureData',
]

// Fields that should be partially masked (show last 4 chars)
const PARTIAL_MASK_FIELDS = [
  'email',
  'phone',
  'phone2FANumber',
  'ipAddress',
]

/**
 * Mask a sensitive value completely
 */
function maskValue(value: unknown): string {
  if (value === null || value === undefined) return '[null]'
  const str = String(value)
  if (str.length === 0) return '[empty]'
  return '[REDACTED]'
}

/**
 * Partially mask a value, showing last 4 characters
 */
function partialMask(value: unknown): string {
  if (value === null || value === undefined) return '[null]'
  const str = String(value)
  if (str.length <= 4) return '****'
  return '****' + str.slice(-4)
}

/**
 * Check if a key is sensitive
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))
}

/**
 * Check if a key should be partially masked
 */
function isPartialMaskKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return PARTIAL_MASK_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))
}

/**
 * Recursively sanitize an object for logging
 */
export function sanitizeForLog(data: unknown, depth: number = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]'
  
  if (data === null || data === undefined) return data
  
  if (typeof data === 'string') {
    // Check if string looks like a JWT token
    if (data.match(/^eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*$/)) {
      return '[JWT_TOKEN]'
    }
    // Check if string looks like an API key
    if (data.length > 20 && data.match(/^[a-zA-Z0-9_-]+$/)) {
      return partialMask(data)
    }
    return data
  }
  
  if (typeof data !== 'object') return data
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item, depth + 1))
  }
  
  const sanitized: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = maskValue(value)
    } else if (isPartialMaskKey(key)) {
      sanitized[key] = partialMask(value)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value, depth + 1)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

/**
 * Secure console.log that sanitizes data
 */
export function secureLog(prefix: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(arg => sanitizeForLog(arg))
  console.log(prefix, ...sanitizedArgs)
}

/**
 * Secure console.error that sanitizes data
 */
export function secureError(prefix: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(arg => {
    if (arg instanceof Error) {
      return {
        name: arg.name,
        message: arg.message,
        // Don't include full stack in production
        stack: process.env.NODE_ENV === 'production' ? undefined : arg.stack,
      }
    }
    return sanitizeForLog(arg)
  })
  console.error(prefix, ...sanitizedArgs)
}

/**
 * Secure console.warn that sanitizes data
 */
export function secureWarn(prefix: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(arg => sanitizeForLog(arg))
  console.warn(prefix, ...sanitizedArgs)
}

/**
 * Create a scoped secure logger
 */
export function createSecureLogger(scope: string) {
  return {
    log: (...args: unknown[]) => secureLog(`[${scope}]`, ...args),
    error: (...args: unknown[]) => secureError(`[${scope}]`, ...args),
    warn: (...args: unknown[]) => secureWarn(`[${scope}]`, ...args),
    info: (...args: unknown[]) => secureLog(`[${scope}]`, ...args),
  }
}

// Export a default logger
export const logger = createSecureLogger('App')
