/**
 * Drime Upload Module
 * 
 * Handles uploading signed documents to user's Drime account
 */

import { prisma } from './prisma'
import { safeDecrypt } from './encryption'

const DRIME_API_URL = process.env.DRIME_API_URL || 'https://front.preprod.drime.cloud'
const SIGNED_DOCS_FOLDER_NAME = 'Documents signés'

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
    
    // Search for existing folder
    const searchUrl = `${DRIME_API_URL}/api/v1/drive/file-entries?perPage=100&workspaceId=${workspaceId}&type=folder`
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: { ...headers, 'Accept': 'application/json' },
    })
    
    if (searchRes.ok) {
      const data = await searchRes.json()
      const entries = Array.isArray(data) ? data : (data.data || [])
      
      // Find folder by name
      const existingFolder = entries.find((f: any) => 
        f.type === 'folder' && f.name === SIGNED_DOCS_FOLDER_NAME
      )
      
      if (existingFolder) {
        return existingFolder.id
      }
    }
    
    // Create folder if not found
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
    
    if (createRes.ok) {
      const folderData = await createRes.json()
      return folderData.id || folderData.folder?.id || null
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
    
    // Create form data
    const formData = new FormData()
    // Convert Buffer to Uint8Array for Blob compatibility
    const uint8Array = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
    const blob = new Blob([uint8Array], { type: 'application/pdf' })
    formData.append('file', blob, fileName)
    formData.append('workspaceId', String(workspaceId))
    
    if (folderId) {
      formData.append('parentId', folderId)
    }
    
    // Upload file
    const uploadUrl = `${DRIME_API_URL}/api/v1/drive/uploads`
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...headers,
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData,
    })
    
    if (!uploadRes.ok) {
      const errorText = await uploadRes.text()
      console.error('[Drime Upload] Upload failed:', uploadRes.status, errorText)
      return { success: false, error: `Upload failed: ${uploadRes.status}` }
    }
    
    const uploadData = await uploadRes.json()
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
  try {
    // Get user with Drime token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { drimeToken: true, drimeUserId: true },
    })
    
    if (!user?.drimeToken) {
      return { success: false, error: 'User has no Drime token' }
    }
    
    // Decrypt the token
    const drimeToken = safeDecrypt(user.drimeToken)
    if (!drimeToken) {
      return { success: false, error: 'Failed to decrypt Drime token' }
    }
    
    // Find or create the signed documents folder
    const folderId = await findOrCreateFolder(drimeToken)
    
    // Generate filename with date
    const date = new Date()
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
    const safeDocName = documentName.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ\s\-_.]/g, '')
    const fileName = `${safeDocName} - Signé ${dateStr}.pdf`
    
    // Upload the file
    const uploadResult = await uploadFileToDrime(drimeToken, pdfBuffer, fileName, folderId)
    
    if (uploadResult.success) {
      return {
        success: true,
        fileId: uploadResult.fileId,
        folderId: folderId || undefined,
      }
    }
    
    return { success: false, error: uploadResult.error }
  } catch (error) {
    console.error('[Drime Upload] Error:', error)
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
