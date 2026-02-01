/**
 * Convertit une URL R2 en URL proxy pour contourner CORS
 * @param pdfUrl URL du PDF sur R2
 * @returns URL proxy locale
 */
export function getPdfProxyUrl(pdfUrl: string): string {
  if (!pdfUrl) return ''
  
  // Si c'est déjà une URL locale ou blob, la retourner telle quelle
  if (pdfUrl.startsWith('/') || pdfUrl.startsWith('blob:')) {
    return pdfUrl
  }
  
  // Si c'est déjà une URL proxy Drime, la retourner telle quelle
  if (pdfUrl.startsWith('/api/drime/pdf/')) {
    return pdfUrl
  }
  
  // Extraire le chemin depuis l'URL R2
  // Format: https://pub-xxx.r2.dev/pdfs/timestamp-filename.pdf
  // Ou: https://xxx.r2.cloudflarestorage.com/bucket/pdfs/timestamp-filename.pdf
  try {
    const url = new URL(pdfUrl)
    // Récupérer le pathname (ex: /pdfs/123-doc.pdf)
    const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
    return `/api/pdf/${path}`
  } catch {
    // Si l'URL n'est pas valide, retourner telle quelle
    return pdfUrl
  }
}
