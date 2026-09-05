import { useState, useRef, lazy, Suspense } from 'react'
import { FileText, Upload, Download, Search, CheckCircle, Clock, XCircle, AlertCircle, Loader2, Trash2, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useDocuments, useUploadDocument, useDeleteDocument, type DocumentWithCustomer } from '@/hooks/queries/useDocuments'
import { useCustomers } from '@/hooks/queries/useCustomers'
import { documentService } from '@/services/documentService'
import { toast, ConfirmDialog } from '@/components/ui'

// react-pdf pulls in pdf.js (~370KB) — load it only when a preview opens.
const DocumentPreview = lazy(() =>
  import('@/components/DocumentPreview').then((m) => ({ default: m.DocumentPreview }))
)

const statusIcons: Record<string, { icon: typeof CheckCircle; color: string }> = {
  'תקין':    { icon: CheckCircle,  color: 'var(--color-primary)' },
  'ממתין':   { icon: Clock,        color: '#d97706' },
  'חסר':     { icon: XCircle,      color: '#dc2626' },
  'פג תוקף': { icon: AlertCircle,  color: 'var(--color-text-muted)' },
}

const categories = ['הכל', 'זיהוי', 'הכנסות', 'חשבון בנק', 'נכס', 'כללי']
const docTypes = ['תעודת זהות + ספח', '3 תלושי שכר', 'הסכם רכישה', 'נסח טאבו', 'דוח פלאש BDI', 'אחר']

const cardStyle = {
  background: 'var(--color-card)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--color-border)',
}

type DocRow = DocumentWithCustomer

export default function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('הכל')
  const [statusFilter, setStatusFilter] = useState('הכל')
  const [uploadType, setUploadType] = useState(docTypes[0])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [docToDelete, setDocToDelete] = useState<DocRow | null>(null)
  // A document is opened through a short-lived signed URL minted per request,
  // so the row holds no durable link to hand around.
  const [previewDoc, setPreviewDoc] = useState<{ row: DocRow; url: string } | null>(null)
  const [busyDocId, setBusyDocId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: docs = [], isLoading: loading } = useDocuments()
  const { data: customers = [] } = useCustomers()
  const uploadDocument = useUploadDocument()
  const deleteDocument = useDeleteDocument()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedCustomerId) return
    uploadDocument.mutate(
      { customerId: selectedCustomerId, file, type: uploadType, category: 'כללי' },
      {
        onSuccess: () => toast.success('המסמך הועלה בהצלחה'),
        onError: (err) => toast.error('שגיאה בהעלאה', err.message),
      }
    )
    e.target.value = ''
  }

  /** Mints a fresh signed URL for one document, or reports why it could not. */
  const documentUrl = async (d: DocRow): Promise<string | null> => {
    setBusyDocId(d.id)
    const { url, error } = await documentService.getUrl(d.id)
    setBusyDocId(null)
    if (!url) toast.error('שגיאה בפתיחת המסמך', error?.message)
    return url
  }

  const openPreview = async (d: DocRow) => {
    const url = await documentUrl(d)
    if (url) setPreviewDoc({ row: d, url })
  }

  const openInNewTab = async (d: DocRow) => {
    const url = await documentUrl(d)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleDeleteDoc = () => {
    if (!docToDelete) return
    deleteDocument.mutate(docToDelete.id, {
      onSuccess: () => {
        setDocToDelete(null)
        toast.success('המסמך נמחק')
      },
      onError: (err) => {
        setDocToDelete(null)
        toast.error('שגיאה במחיקה', err.message)
      },
    })
  }

  const filtered = docs.filter(d => {
    const matchSearch = !search || (d.customerName ?? '').includes(search) || (d.type ?? '').includes(search)
    const matchCategory = categoryFilter === 'הכל' || d.category === categoryFilter
    const matchStatus = statusFilter === 'הכל' || d.status === statusFilter
    return matchSearch && matchCategory && matchStatus
  })

  const stats = {
    total: docs.length,
    ok: docs.filter(d => d.status === 'תקין').length,
    pending: docs.filter(d => d.status === 'ממתין').length,
    missing: docs.filter(d => d.status === 'חסר').length,
    expired: docs.filter(d => d.status === 'פג תוקף').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} style={{ color: 'var(--color-primary)' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="crm-page animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black" style={{ fontSize: 24, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>מסמכים</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{docs.length} מסמכים</p>
        </div>
        <div className="flex gap-2 shrink-0 items-center flex-wrap justify-end">
          <select
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            className="text-[12px] px-3 py-2 outline-none"
            style={{ border: '1.5px solid var(--color-border)', borderRadius: 10, color: selectedCustomerId ? 'var(--color-text)' : 'var(--color-text-muted)', background: 'var(--color-card)' }}
          >
            <option value="">בחר לקוח...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
          <select
            value={uploadType}
            onChange={e => setUploadType(e.target.value)}
            className="text-[12px] px-3 py-2 outline-none"
            style={{ border: '1.5px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text-sub)', background: 'var(--color-card)' }}
          >
            {docTypes.map(t => <option key={t}>{t}</option>)}
          </select>
          <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} />
          <button
            onClick={() => {
              if (!selectedCustomerId) { toast.warning('בחר לקוח לפני ההעלאה'); return }
              fileInputRef.current?.click()
            }}
            disabled={uploadDocument.isPending}
            className="crm-btn-primary flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ borderRadius: 12, background: 'var(--color-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 27%, transparent)' }}
          >
            {uploadDocument.isPending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            העלה מסמך
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'סה"כ', value: stats.total, color: 'var(--color-primary)' },
          { label: 'תקין', value: stats.ok, color: 'var(--color-primary)' },
          { label: 'ממתין', value: stats.pending, color: '#d97706' },
          { label: 'חסר', value: stats.missing, color: '#dc2626' },
          { label: 'פג תוקף', value: stats.expired, color: 'var(--color-text-muted)' },
        ].map(s => (
          <div
            key={s.label}
            onClick={() => setStatusFilter(s.label === 'סה"כ' ? 'הכל' : s.label)}
            className="text-center cursor-pointer transition-all hover:opacity-80"
            style={{ ...cardStyle, padding: '14px 12px' }}
          >
            <p className="font-black tabular-nums" style={{ fontSize: 22, color: s.color }}>{s.value}</p>
            <p className="text-[13px]" style={{ color: 'var(--color-text-sub)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute" style={{ right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש לפי לקוח או סוג מסמך..."
              className="w-full pr-10 pl-4 py-2 outline-none text-[13px]"
              style={{ border: '1.5px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)' }}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className="px-3 py-1.5 text-[12px] font-semibold transition-all"
                style={{
                  borderRadius: 20,
                  background: categoryFilter === c ? 'var(--color-primary)' : 'var(--color-border-light)',
                  color: categoryFilter === c ? 'var(--color-primary-text)' : 'var(--color-text-sub)',
                }}
              >{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={40} style={{ color: '#d6d3d1', margin: '0 auto 12px' }} />
            <p className="text-[15px] font-semibold" style={{ color: 'var(--color-text-sub)' }}>לא נמצאו מסמכים</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>העלה מסמך ראשון באמצעות הכפתור למעלה</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-light)' }}>
                {['לקוח', 'סוג מסמך', 'קטגוריה', 'סטטוס', 'תאריך', 'פעולות'].map(h => (
                  <th key={h} className="text-right p-3 text-[11px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const si = statusIcons[d.status ?? ''] ?? { icon: FileText, color: 'var(--color-text-muted)' }
                return (
                  <tr key={d.id} className="border-b transition-colors hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border-light)' }}>
                    <td className="p-3 text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>{d.customerName || '—'}</td>
                    <td className="p-3 text-[13px]" style={{ color: 'var(--color-text-sub)' }}>{d.type || '—'}</td>
                    <td className="p-3 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{d.category || '—'}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold">
                        <si.icon size={13} style={{ color: si.color }} />
                        <span style={{ color: si.color }}>{d.status || '—'}</span>
                      </span>
                    </td>
                    <td className="p-3 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{d.uploaded_at ? formatDate(d.uploaded_at) : '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPreview(d)}
                          disabled={busyDocId === d.id}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-lg disabled:opacity-50"
                          style={{ background: 'var(--color-border-light)', color: 'var(--color-text-sub)' }}
                        >
                          <Eye size={12} /> תצוגה
                        </button>
                        <button
                          onClick={() => openInNewTab(d)}
                          disabled={busyDocId === d.id}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-lg disabled:opacity-50"
                          style={{ background: 'var(--color-success-bg)', color: '#065f46' }}
                        >
                          <Download size={12} /> הורד
                        </button>
                        <button
                          onClick={() => setDocToDelete(d)}
                          className="inline-flex items-center justify-center transition-colors hover:text-red-600"
                          style={{ color: '#d6d3d1' }}
                          aria-label="מחק מסמך"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!docToDelete}
        variant="danger"
        title="מחיקת מסמך"
        message="האם למחוק מסמך זה? פעולה זו אינה הפיכה."
        confirmText="מחק"
        loading={deleteDocument.isPending}
        onConfirm={handleDeleteDoc}
        onCancel={() => setDocToDelete(null)}
      />

      {previewDoc && (
        <Suspense fallback={null}>
          <DocumentPreview
            url={previewDoc.url}
            filename={previewDoc.row.file_name ?? 'מסמך'}
            onClose={() => setPreviewDoc(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
