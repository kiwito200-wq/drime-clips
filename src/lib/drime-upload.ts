/**
 * Drime Upload Module
 * 
 * Handles uploading signed documents to user's Drime account
 */

import { prisma } from './prisma'
import { safeDecrypt } from './encryption'

const DRIME_API_URL = process.env.DRIME_API_URL || 'https://front.preprod.drime.cloud'
const SIGNED_DOCS_FOLDER_NAME = 'Documents signés'

// Enable debug logging
const DEBUG = true
function debugLog(...args: any[]) {
  if (DEBUG) console.log('[Drime Upload]', ...args)
}

interface DrimeUploadResult {
  success: boolean
  fileId?: string
  folderId?: string
  error?: string
}

/**
 * Get headers for Drime API requests
 */
function getDrimeHeaders(drimeToken: string, xsrfToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Cookie': `drime_session=${drimeToken}`,
    'Accept': 'application/json',
    'Origin': DRIME_API_URL,
    'Referer': `${DRIME_API_URL}/`,
  }
  
  if (xsrfToken) {
    headers['X-XSRF-TOKEN'] = xsrfToken
  }
  
  return headers
}

/**
 * Find or create the "Documents signés" folder in user's Drime
 */
async function findOrCreateFolder(drimeToken: string, workspaceId: number = 0): Promise<string | null> {
  try {
    const headers = getDrimeHeaders(drimeToken)
    debugLog('Finding/creating folder with token length:', drimeToken?.length)
    
    // Search for existing folder
    const searchUrl = `${DRIME_API_URL}/api/v1/drive/file-entries?perPage=100&workspaceId=${workspaceId}&type=folder`
    debugLog('Searching folders at:', searchUrl)
    
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: { ...headers, 'Accept': 'application/json' },
    })
    
    debugLog('Search response status:', searchRes.status)
    
    if (searchRes.ok) {
      const data = await searchRes.json()
      const entries = Array.isArray(data) ? data : (data.data || [])
      debugLog('Found', entries.length, 'folder entries')
      
      // Find folder by name
      const existingFolder = entries.find((f: any) => 
        f.type === 'folder' && f.name === SIGNED_DOCS_FOLDER_NAME
      )
      
      if (existingFolder) {
        debugLog('Found existing folder:', existingFolder.id)
        return existingFolder.id
      }
    } else {
      const errorText = await searchRes.text()
      debugLog('Search failed:', searchRes.status, errorText.substring(0, 200))
    }
    
    // Create folder if not found
    debugLog('Creating new folder:', SIGNED_DOCS_FOLDER_NAME)
    const createUrl = `${DRIME_API_URL}/api/v1/drive/folders`
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { 
        ...headers, 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: SIGNED_DOCS_FOLDER_NAME,
        workspaceId,
      }),
    })
    
    debugLog('Create folder response status:', createRes.status)
    
    if (createRes.ok) {
      const folderData = await createRes.json()
      debugLog('Created folder:', folderData)
      return folderData.id || folderData.folder?.id || null
    } else {
      const errorText = await createRes.text()
      debugLog('Create folder failed:', createRes.status, errorText.substring(0, 200))
    }
    
    return null
  } catch (error) {
    console.error('[Drime Upload] Error finding/creating folder:', error)
    return null
  }
}

/**
 * Upload a PDF file to Drime
 */
async function uploadFileToDrime(
  drimeToken: string,
  pdfBuffer: Buffer,
  fileName: string,
  folderId: string | null,
  workspaceId: number = 0
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    const headers = getDrimeHeaders(drimeToken)
    debugLog('Uploading file:', fileName, 'size:', pdfBuffer.length, 'bytes')
    debugLog('Folder ID:', folderId, 'Workspace ID:', workspaceId)
    
    // Create form data
    const formData = new FormData()
    // Convert Buffer to ArrayBuffer for Blob compatibility
    const arrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    ) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
    formData.append('file', blob, fileName)
    formData.append('workspaceId', String(workspaceId))
    
    if (folderId) {
      formData.append('parentId', folderId)
    }
    
    // Upload file
    const uploadUrl = `${DRIME_API_URL}/api/v1/drive/uploads`
    debugLog('Upload URL:', uploadUrl)
    
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...headers,
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData,
    })
    
    debugLog('Upload response status:', uploadRes.status)
    
    if (!uploadRes.ok) {
      const errorText = await uploadRes.text()
      console.error('[Drime Upload] Upload failed:', uploadRes.status, errorText.substring(0, 500))
      return { success: false, error: `Upload failed: ${uploadRes.status}` }
    }
    
    const uploadData = await uploadRes.json()
    debugLog('Upload success:', uploadData)
    return { 
      success: true, 
      fileId: uploadData.id || uploadData.fileEntry?.id || uploadData.file?.id 
    }
  } catch (error) {
    console.error('[Drime Upload] Error uploading file:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Upload signed document to user's Drime account
 * Creates a "Documents signés" folder if it doesn't exist
 */
export async function uploadSignedDocumentToDrime(
  userId: string,
  pdfBuffer: Buffer,
  documentName: string
): Promise<DrimeUploadResult> {
  debugLog('========== Starting Drime Upload ==========')
  debugLog('User ID:', userId)
  debugLog('Document:', documentName)
  debugLog('PDF size:', pdfBuffer.length, 'bytes')
  
  try {
    // Get user with Drime token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { drimeToken: true, drimeUserId: true, email: true },
    })
    
    debugLog('User found:', user?.email, 'has token:', !!user?.drimeToken)
    
    if (!user?.drimeToken) {
      debugLog('ERROR: User has no Drime token')
      return { success: false, error: 'User has no Drime token' }
    }
    
    // Decrypt the token
    const drimeToken = safeDecrypt(user.drimeToken)
    debugLog('Token decrypted:', !!drimeToken, 'length:', drimeToken?.length)
    
    if (!drimeToken) {
      debugLog('ERROR: Failed to decrypt Drime token')
      return { success: false, error: 'Failed to decrypt Drime token' }
    }
    
    // Find or create the signed documents folder
    const folderId = await findOrCreateFolder(drimeToken)
    debugLog('Folder ID result:', folderId)
    
    // Generate filename with date
    const date = new Date()
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
    const safeDocName = documentName.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ\s\-_.]/g, '')
    const fileName = `${safeDocName} - Signé ${dateStr}.pdf`
    debugLog('Filename:', fileName)
    
    // Upload the file
    const uploadResult = await uploadFileToDrime(drimeToken, pdfBuffer, fileName, folderId)
    debugLog('Upload result:', uploadResult)
    
    if (uploadResult.success) {
      debugLog('========== Drime Upload SUCCESS ==========')
      return {
        success: true,
        fileId: uploadResult.fileId,
        folderId: folderId || undefined,
      }
    }
    
    debugLog('========== Drime Upload FAILED ==========')
    return { success: false, error: uploadResult.error }
  } catch (error) {
    console.error('[Drime Upload] Error:', error)
    debugLog('========== Drime Upload ERROR ==========', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Upload signed document for a specific signer (if they have a Drime account)
 */
export async function uploadSignedDocumentForSigner(
  signerEmail: string,
  pdfBuffer: Buffer,
  documentName: string
): Promise<DrimeUploadResult> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: signerEmail },
      select: { id: true, drimeToken: true },
    })
    
    if (!user?.drimeToken) {
      // Signer doesn't have a Drime account or isn't connected
      return { success: false, error: 'Signer has no Drime account' }
    }
    
    return uploadSignedDocumentToDrime(user.id, pdfBuffer, documentName)
  } catch (error) {
    console.error('[Drime Upload] Error for signer:', error)
    return { success: false, error: String(error) }
  }
}
