'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Edit page redirects to prepare page for drafts
export default function EditDocumentPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  useEffect(() => {
    // Redirect to prepare page
    router.replace(`/prepare/${slug}`)
  }, [slug, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Redirection vers l&apos;éditeur...</p>
      </div>
    </div>
  )
}
