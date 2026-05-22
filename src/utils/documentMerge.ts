import type { Document } from '@/types/database'

export interface MergeResult {
  /** Number of source documents successfully merged into the output PDF. */
  merged: number
  /** Names of documents that could not be merged (unsupported type or fetch error). */
  skipped: string[]
}

function extensionOf(name: string | null): string {
  if (!name) return ''
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match ? match[1] : ''
}

/**
 * Fetches every document of a customer and concatenates them into a single PDF
 * which is then downloaded in the browser. PDF sources are appended page-by-page;
 * JPG/PNG sources each become one image-sized page. Other file types are skipped.
 */
export async function exportCustomerDocumentsPdf(
  customerName: string,
  documents: Document[]
): Promise<MergeResult> {
  const { PDFDocument } = await import('pdf-lib')
  const merged = await PDFDocument.create()
  const skipped: string[] = []
  let count = 0

  for (const item of documents) {
    const displayName = item.file_name || item.type
    if (!item.file_url) {
      skipped.push(displayName)
      continue
    }
    try {
      const res = await fetch(item.file_url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      const contentType = (res.headers.get('content-type') || '').toLowerCase()
      const ext = extensionOf(item.file_name)
      const isPdf = ext === 'pdf' || contentType.includes('pdf')
      const isPng = ext === 'png' || contentType.includes('png')
      const isJpg =
        ext === 'jpg' || ext === 'jpeg' || contentType.includes('jpeg') || contentType.includes('jpg')

      if (isPdf) {
        const source = await PDFDocument.load(bytes, { ignoreEncryption: true })
        const pages = await merged.copyPages(source, source.getPageIndices())
        pages.forEach((page) => merged.addPage(page))
        count++
      } else if (isPng || isJpg) {
        const image = isPng ? await merged.embedPng(bytes) : await merged.embedJpg(bytes)
        const page = merged.addPage([image.width, image.height])
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
        count++
      } else {
        skipped.push(displayName)
      }
    } catch {
      skipped.push(displayName)
    }
  }

  if (count === 0) {
    return { merged: 0, skipped }
  }

  const output = await merged.save()
  // Copy into a fresh ArrayBuffer-backed array so the Blob constructor accepts it.
  const blob = new Blob([new Uint8Array(output)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `מסמכי-${customerName}-${new Date().toISOString().slice(0, 10)}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return { merged: count, skipped }
}
