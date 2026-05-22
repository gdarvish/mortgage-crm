import { useState, useRef, lazy, Suspense } from 'react'
import { FileText, Upload, Download, Search, CheckCircle, Clock, XCircle, AlertCircle, Loader2, Trash2, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useDocuments, useUploadDocument, useDeleteDocument, type DocumentWithCustomer } from '@/hooks/queries/useDocuments'
import { useCustomers } from '@/hooks/queries/useCustomers'
import { toast, ConfirmDialog } from '@/components/ui'

// react-pdf pulls in pdf.js (~370KB) — load it only when a preview opens.
const DocumentPreview = lazy(() =>
  import('@/components/DocumentPreview').then((m) => ({ default: m.DocumentPreview }))
)

const statusIcons: Record<string, { icon: typeof CheckCircle; color: string }> = {
  'תקין':    { icon: CheckCircle,  color: '#059669' },
  'ממתין':   { icon: Clock,        color: '#d97706' },
  'חסר':     { icon: XCircle,      color: '#dc2626' },
  'פג תוקף': { icon: AlertCircle,  color: '#a8a29e' },
}

const categories = ['הכל', 'זיהוי', 'הכנסות', 'חשבון בנק', 'נכס', 'כללי']
const docTypes = ['תעודת זהות + ספח', '3 תלושי שכר', 'הסכם רכישה', 'נסח טאבו', 'דוח פלאש BDI', 'אחר']

const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
}

type DocRow = DocumentWithCustomer

export default function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('הכל')
  const [statusFilter, setStatusFilter] = useState('הכל')
  const [uploadType, setUploadType] = useState(docTypes[0])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [docToDelete, setDocToDelete] = useState<DocRow | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocRow | null>(null)
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
        <Loader2 size={32} style={{ color: '#059669' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>מסמכים</h1>
          <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>{docs.length} מסמכים</p>
        </div>
        <div className="flex gap-2 shrink-0 items-center flex-wrap justify-end">
          <select
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            className="text-[12px] px-3 py-2 outline-none"
            style={{ border: '1.5px solid #e7e5e4', borderRadius: 10, color: selectedCustomerId ? '#1c1917' : '#a8a29e', background: '#fff' }}
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
            style={{ border: '1.5px solid #e7e5e4', borderRadius: 10, color: '#57534e', background: '#fff' }}
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
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ borderRadius: 12, background: '#059669', boxShadow: '0 4px 14px rgba(5,150,105,0.27)' }}
          >
            {uploadDocument.isPending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            העלה מסמך
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'סה"כ', value: stats.total, color: '#059669' },
          { label: 'תקין', value: stats.ok, color: '#059669' },
          { label: 'ממתין', value: stats.pending, color: '#d97706' },
          { label: 'חסר', value: stats.missing, color: '#dc2626' },
          { label: 'פג תוקף', value: stats.expired, color: '#a8a29e' },
        ].map(s => (
          <div
            key={s.label}
            onClick={() => setStatusFilter(s.label === 'סה"כ' ? 'הכל' : s.label)}
            className="text-center cursor-pointer transition-all hover:opacity-80"
            style={{ ...cardStyle, padding: '14px 12px' }}
          >
            <p className="font-black tabular-nums" style={{ fontSize: 22, color: s.color }}>{s.value}</p>
            <p className="text-[13px]" style={{ color: '#57534e' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute" style={{ right: 12, top: '50%', transform: 'translateY(-50%)', color: '#a8a29e' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש לפי לקוח או סוג מסמך..."
              className="w-full pr-10 pl-4 py-2 outline-none text-[13px]"
              style={{ border: '1.5px solid #e7e5e4', borderRadius: 10, color: '#1c1917' }}
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
                  background: categoryFilter === c ? '#059669' : '#f5f4f2',
                  color: categoryFilter === c ? '#fff' : '#57534e',
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
            <p className="text-[15px] font-semibold" style={{ color: '#57534e' }}>לא נמצאו מסמכים</p>
            <p className="text-[13px] mt-1" style={{ color: '#a8a29e' }}>העלה מסמך ראשון באמצעות הכפתור למעלה</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: '#faf9f7', borderBottom: '1px solid #f5f4f2' }}>
                {['לקוח', 'סוג מסמך', 'קטגוריה', 'סטטוס', 'תאריך', 'פעולות'].map(h => (
                  <th key={h} className="text-right p-3 text-[11px] font-bold uppercase" style={{ color: '#a8a29e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const si = statusIcons[d.status ?? ''] ?? { icon: FileText, color: '#a8a29e' }
                return (
                  <tr key={d.id} className="border-b transition-colors hover:bg-[#faf9f7]" style={{ borderColor: '#f5f4f2' }}>
                    <td className="p-3 text-[13px] font-semibold" style={{ color: '#1c1917' }}>{d.customerName || '—'}</td>
                    <td className="p-3 text-[13px]" style={{ color: '#57534e' }}>{d.type || '—'}</td>
                    <td className="p-3 text-[12px]" style={{ color: '#a8a29e' }}>{d.category || '—'}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold">
                        <si.icon size={13} style={{ color: si.color }} />
                        <span style={{ color: si.color }}>{d.status || '—'}</span>
                      </span>
                    </td>
                    <td className="p-3 text-[12px]" style={{ color: '#a8a29e' }}>{d.uploaded_at ? formatDate(d.uploaded_at) : '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {d.file_url && (
                          <button
                            onClick={() => setPreviewDoc(d)}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-lg"
                            style={{ background: '#f5f4f2', color: '#57534e' }}
                          >
                            <Eye size={12} /> תצוגה
                          </button>
                        )}
                        {d.file_url && (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-lg"
                            style={{ background: '#d1fae5', color: '#065f46' }}
                          >
                            <Download size={12} /> הורד
                          </a>
                        )}
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

      {previewDoc?.file_url && (
        <Suspense fallback={null}>
          <DocumentPreview
            url={previewDoc.file_url}
            filename={previewDoc.file_name ?? 'מסמך'}
            onClose={() => setPreviewDoc(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
