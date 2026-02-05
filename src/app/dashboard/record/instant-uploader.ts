'use client'

import type { ChunkUploadState } from './useWebRecorder'

const MIN_PART_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

interface UploadedPart {
  PartNumber: number
  ETag: string
}

interface UploaderOptions {
  videoId: string
  uploadId: string
  userId: string
  mimeType: string
  shareUrl: string
  onChunkStateChange?: (chunks: ChunkUploadState[]) => void
  onProgress?: (uploaded: number, total: number) => void
  onError?: (error: Error) => void
}

export class InstantUploader {
  private readonly videoId: string
  private readonly uploadId: string
  private readonly userId: string
  private readonly mimeType: string
  readonly shareUrl: string
  private readonly onChunkStateChange?: (chunks: ChunkUploadState[]) => void
  private readonly onProgress?: (uploaded: number, total: number) => void
  private readonly onError?: (error: Error) => void

  private bufferedChunks: Blob[] = []
  private bufferedBytes = 0
  private totalRecordedBytes = 0
  private uploadedBytes = 0
  private uploadQueue: Promise<void> = Promise.resolve()
  private parts: UploadedPart[] = []
  private nextPartNumber = 1
  private finished = false
  private aborted = false
  private finalTotalBytes: number | null = null
  private chunkStates = new Map<number, ChunkUploadState>()

  constructor(options: UploaderOptions) {
    this.videoId = options.videoId
    this.uploadId = options.uploadId
    this.userId = options.userId
    this.mimeType = options.mimeType
    this.shareUrl = options.shareUrl
    this.onChunkStateChange = options.onChunkStateChange
    this.onProgress = options.onProgress
    this.onError = options.onError
  }

  private emitChunkSnapshot() {
    if (!this.onChunkStateChange) return
    const ordered = Array.from(this.chunkStates.values()).sort(
      (a, b) => a.partNumber - b.partNumber
    )
    this.onChunkStateChange(ordered)
  }

  private updateChunkState(partNumber: number, updates: Partial<ChunkUploadState>) {
    const current = this.chunkStates.get(partNumber)
    if (!current) return

    const next: ChunkUploadState = { ...current, ...updates }

    if (updates.uploadedBytes !== undefined) {
      next.uploadedBytes = Math.max(0, Math.min(current.sizeBytes, updates.uploadedBytes))
    }

    if (updates.progress !== undefined) {
      next.progress = Math.min(1, Math.max(0, updates.progress))
    } else if (updates.uploadedBytes !== undefined) {
      next.progress = current.sizeBytes > 0 
        ? Math.min(1, next.uploadedBytes / current.sizeBytes)
        : 0
    }

    this.chunkStates.set(partNumber, next)
    this.emitChunkSnapshot()
  }

  private registerChunk(partNumber: number, sizeBytes: number) {
    this.chunkStates.set(partNumber, {
      partNumber,
      sizeBytes,
      uploadedBytes: 0,
      progress: 0,
      status: 'queued',
    })
    this.emitChunkSnapshot()
  }

  handleChunk(blob: Blob, recordedTotalBytes: number) {
    if (this.finished || this.aborted || blob.size === 0) return

    this.totalRecordedBytes = recordedTotalBytes
    this.bufferedChunks.push(blob)
    this.bufferedBytes += blob.size

    if (this.bufferedBytes >= MIN_PART_SIZE_BYTES) {
      this.flushBuffer()
    }
  }

  private flushBuffer(force = false) {
    if (this.bufferedBytes === 0) return
    if (!force && this.bufferedBytes < MIN_PART_SIZE_BYTES) return

    const chunk = new Blob(this.bufferedChunks, { type: this.mimeType })
    this.bufferedChunks = []
    this.bufferedBytes = 0

    this.enqueueUpload(chunk)
  }

  private enqueueUpload(part: Blob) {
    const partNumber = this.nextPartNumber++
    this.registerChunk(partNumber, part.size)
    
    this.uploadQueue = this.uploadQueue
      .then(() => this.uploadPartWithRetry(partNumber, part))
      .catch((error) => {
        this.updateChunkState(partNumber, { status: 'error' })
        this.onError?.(error)
      })
  }

  private async uploadPartWithRetry(partNumber: number, part: Blob, attempt = 1): Promise<void> {
    if (this.aborted) return

    try {
      await this.uploadPart(partNumber, part)
    } catch (error) {
      if (attempt < MAX_RETRIES && !this.aborted) {
        console.warn(`[Uploader] Part ${partNumber} failed, retrying (${attempt}/${MAX_RETRIES})...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
        return this.uploadPartWithRetry(partNumber, part, attempt + 1)
      }
      throw error
    }
  }

  private async uploadPart(partNumber: number, part: Blob): Promise<void> {
    // Get presigned URL
    const presignRes = await fetch('/api/upload/simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'presign',
        videoId: this.videoId,
        uploadId: this.uploadId,
        userId: this.userId,
        partNumber,
      }),
    })

    if (!presignRes.ok) {
      throw new Error(`Failed to get presigned URL for part ${partNumber}`)
    }

    const { presignedUrl } = await presignRes.json()
    if (!presignedUrl) {
      throw new Error(`Missing presigned URL for part ${partNumber}`)
    }

    // Upload with XMLHttpRequest for progress tracking
    const etag = await this.uploadBlobWithProgress(presignedUrl, partNumber, part)

    this.parts.push({ PartNumber: partNumber, ETag: etag })
    this.uploadedBytes += part.size
    this.emitProgress()
  }

  private uploadBlobWithProgress(url: string, partNumber: number, part: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.aborted) {
        reject(new Error('Upload aborted'))
        return
      }

      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.responseType = 'text'
      
      if (this.mimeType) {
        xhr.setRequestHeader('Content-Type', this.mimeType)
      }

      this.updateChunkState(partNumber, {
        status: 'uploading',
        uploadedBytes: 0,
        progress: 0,
      })

      xhr.upload.onprogress = (event) => {
        if (this.aborted) {
          xhr.abort()
          return
        }
        
        const uploaded = event.lengthComputable ? event.loaded : Math.min(part.size, event.loaded)
        const total = event.lengthComputable ? event.total : part.size
        const ratio = total > 0 ? Math.min(1, uploaded / total) : 0
        
        this.updateChunkState(partNumber, {
          status: 'uploading',
          uploadedBytes: uploaded,
          progress: ratio,
        })
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etagHeader = xhr.getResponseHeader('ETag')
          const etag = etagHeader?.replace(/"/g, '') || `part-${partNumber}`
          
          this.updateChunkState(partNumber, {
            status: 'complete',
            uploadedBytes: part.size,
            progress: 1,
          })
          
          resolve(etag)
        } else {
          this.updateChunkState(partNumber, { status: 'error' })
          reject(new Error(`Failed to upload part ${partNumber}: ${xhr.status} ${xhr.statusText}`))
        }
      }

      xhr.onerror = () => {
        this.updateChunkState(partNumber, { status: 'error' })
        reject(new Error(`Network error uploading part ${partNumber}`))
      }

      xhr.onabort = () => {
        this.updateChunkState(partNumber, { status: 'error' })
        reject(new Error('Upload aborted'))
      }

      xhr.send(part)
    })
  }

  private emitProgress() {
    const totalBytes = this.finalTotalBytes ?? Math.max(this.totalRecordedBytes, this.uploadedBytes)
    this.onProgress?.(this.uploadedBytes, totalBytes)
  }

  async finalize(finalBlob: Blob, thumbnail?: string): Promise<string | null> {
    console.log('[Uploader] Finalize called, blob size:', finalBlob.size)
    console.log('[Uploader] finished:', this.finished, 'aborted:', this.aborted)
    
    if (this.finished || this.aborted) {
      console.log('[Uploader] Already finished or aborted, returning null')
      return null
    }

    this.finalTotalBytes = finalBlob.size
    console.log('[Uploader] Flushing buffer, bufferedBytes:', this.bufferedBytes)
    this.flushBuffer(true)

    // Wait for all pending uploads
    console.log('[Uploader] Waiting for pending uploads...')
    await this.uploadQueue
    console.log('[Uploader] Pending uploads complete, parts:', this.parts.length)

    // If no parts were uploaded, upload the entire blob as one part
    if (this.parts.length === 0) {
      console.log('[Uploader] No parts uploaded yet, uploading entire blob')
      this.enqueueUpload(finalBlob)
      await this.uploadQueue
      console.log('[Uploader] Full blob upload complete, parts:', this.parts.length)
    }

    // Complete multipart upload
    try {
      console.log('[Uploader] Completing multipart upload...')
      console.log('[Uploader] VideoId:', this.videoId)
      console.log('[Uploader] UploadId:', this.uploadId)
      console.log('[Uploader] Parts:', JSON.stringify(this.parts))
      console.log('[Uploader] Has thumbnail:', !!thumbnail)
      
      const res = await fetch('/api/upload/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'complete',
          videoId: this.videoId,
          uploadId: this.uploadId,
          userId: this.userId,
          parts: this.parts.sort((a, b) => a.PartNumber - b.PartNumber),
          thumbnail,
        }),
      })

      console.log('[Uploader] Complete response status:', res.status)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('[Uploader] Complete failed:', errorText)
        throw new Error(`Failed to complete upload: ${errorText}`)
      }

      const responseData = await res.json()
      console.log('[Uploader] Complete response:', responseData)

      this.finished = true
      this.uploadedBytes = this.finalTotalBytes ?? this.uploadedBytes
      this.emitProgress()

      console.log('[Uploader] Finalize SUCCESS, shareUrl:', this.shareUrl)
      return this.shareUrl
    } catch (error) {
      console.error('[Uploader] Failed to finalize:', error)
      this.onError?.(error as Error)
      return null
    }
  }

  async cancel() {
    if (this.finished) return
    
    this.aborted = true
    this.finished = true
    this.bufferedChunks = []
    this.bufferedBytes = 0
    this.chunkStates.clear()
    this.emitChunkSnapshot()

    // Wait for pending uploads to finish/fail
    await this.uploadQueue.catch(() => {})

    // Abort multipart upload on server
    try {
      await fetch('/api/upload/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'abort',
          videoId: this.videoId,
          uploadId: this.uploadId,
        }),
      })
    } catch (error) {
      console.error('[Uploader] Failed to abort multipart upload:', error)
    }
  }

  getUploadedBytes() {
    return this.uploadedBytes
  }

  getTotalBytes() {
    return this.finalTotalBytes ?? this.totalRecordedBytes
  }

  getParts() {
    return [...this.parts]
  }
}

export const initializeUpload = async (): Promise<{
  videoId: string
  uploadId: string
  userId: string
  shareUrl: string
} | null> => {
  try {
    const res = await fetch('/api/upload/simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'create' }),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${res.status}`)
    }

    const data = await res.json()
    
    if (!data.videoId || !data.uploadId || !data.userId) {
      throw new Error('Missing required upload data')
    }

    return {
      videoId: data.videoId,
      uploadId: data.uploadId,
      userId: data.userId,
      shareUrl: data.shareUrl || `${window.location.origin}/share/${data.videoId}`,
    }
  } catch (error) {
    console.error('[Uploader] Failed to initialize upload:', error)
    return null
  }
}
