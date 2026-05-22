import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']

interface DocumentPreviewProps {
  url: string
  filename: string
  onClose: () => void
}

export function DocumentPreview({ url, filename, onClose }: DocumentPreviewProps) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const isPdf = ext === 'pdf'
  const isImage = IMAGE_EXTS.includes(ext)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(28,25,23,0.7)' }}
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white w-full max-w-4xl max-h-[90vh] overflow-auto"
        style={{ borderRadius: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#f5f4f2' }}>
          <h3 className="font-semibold text-sm truncate" style={{ color: '#1c1917' }}>{filename}</h3>
          <div className="flex gap-1">
            <a
              href={url}
              download={filename}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg hover:bg-gray-100"
              style={{ color: '#57534e' }}
              aria-label="הורד"
            >
              <Download size={18} />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100"
              style={{ color: '#57534e' }}
              aria-label="סגור"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 flex flex-col items-center">
          {isPdf && (
            <>
              <Document
                file={url}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="py-12 text-sm" style={{ color: '#a8a29e' }}>טוען מסמך...</div>}
                error={<div className="py-12 text-sm" style={{ color: '#dc2626' }}>לא ניתן להציג את המסמך</div>}
              >
                <Page pageNumber={pageNumber} width={Math.min(760, window.innerWidth - 96)} />
              </Document>
              {numPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber((p) => p - 1)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                    style={{ color: '#57534e' }}
                    aria-label="עמוד קודם"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <span className="text-sm" style={{ color: '#57534e' }}>{pageNumber} / {numPages}</span>
                  <button
                    disabled={pageNumber >= numPages}
                    onClick={() => setPageNumber((p) => p + 1)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                    style={{ color: '#57534e' }}
                    aria-label="עמוד הבא"
                  >
                    <ChevronLeft size={20} />
                  </button>
                </div>
              )}
            </>
          )}

          {isImage && <img src={url} alt={filename} className="max-w-full h-auto" style={{ borderRadius: 8 }} />}

          {!isPdf && !isImage && (
            <div className="text-center py-12">
              <p className="text-sm mb-2" style={{ color: '#57534e' }}>תצוגה מקדימה לא זמינה עבור סוג קובץ זה.</p>
              <a href={url} target="_blank" rel="noreferrer" className="text-sm underline" style={{ color: '#059669' }}>
                הורד את הקובץ
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
