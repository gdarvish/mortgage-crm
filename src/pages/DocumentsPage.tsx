import { useState, useRef, lazy, Suspense } from 'react'
import { Search, Plus, FileText, CheckSquare, AlertTriangle, X, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeContext'
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  type DocumentWithCustomer,
} from '@/hooks/queries/useDocuments'
import { useCustomers } from '@/hooks/queries/useCustomers'
import { toast, ConfirmDialog } from '@/components/ui'
import type { DocumentStatus } from '@/types/database'

// react-pdf pulls in pdf.js (~370KB) — load it only when a preview opens.
const DocumentPreview = lazy(() =>
  import('@/components/DocumentPreview').then((m) => ({ default: m.DocumentPreview }))
)

const docTypes = ['תעודת זהות + ספח', '3 תלושי שכר', 'הסכם רכישה', 'נסח טאבו', 'דוח פלאש BDI', 'אחר']
const docStatuses: (DocumentStatus | 'הכל')[] = ['הכל', 'תקין', 'ממתין', 'חסר', 'פג תוקף']

// Reproduced from design crm-pages2.jsx dsColors (keyed to the real status model).
const dsColors: Record<string, { bg: string; text: string }> = {
  'תקין': { bg: '#d1fae5', text: '#065f46' },
  'ממתין': { bg: '#fef3c7', text: '#b45309' },
  'חסר': { bg: '#fee2e2', text: '#dc2626' },
  'פג תוקף': { bg: '#f3e8ff', text: '#7e22ce' },
}

type DocRow = DocumentWithCustomer

export default function DocumentsPage() {
  const t = useTheme()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'הכל'>('הכל')
  const [uploadType, setUploadType] = useState(docTypes[0])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [docToDelete, setDocToDelete] = useState<DocRow | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocRow | null>(null)
  const [hovRow, setHovRow] = useState<string | null>(null)
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

  const triggerUpload = () => {
    if (!selectedCustomerId) {
      toast.warning('בחר לקוח לפני ההעלאה')
      return
    }
    fileInputRef.current?.click()
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

  const filtered = docs.filter((d) => {
    const matchSearch =
      !search || (d.customerName ?? '').includes(search) || (d.type ?? '').includes(search)
    const matchStatus = statusFilter === 'הכל' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  const counts = {
    total: docs.length,
    ok: docs.filter((d) => d.status === 'תקין').length,
    pending: docs.filter((d) => d.status === 'ממתין').length,
    missing: docs.filter((d) => d.status === 'חסר').length,
  }

  const summaryCards = [
    { label: 'סה"כ מסמכים', value: counts.total, color: t.primary, Icon: FileText },
    { label: 'אושרו', value: counts.ok, color: '#059669', Icon: CheckSquare },
    { label: 'ממתינים', value: counts.pending, color: '#d97706', Icon: AlertTriangle },
    { label: 'חסרים', value: counts.missing, color: '#dc2626', Icon: X },
  ]

  const inputSt: React.CSSProperties = {
    border: `1.5px solid ${t.border}`,
    borderRadius: 9,
    fontSize: 13,
    color: t.text,
    background: t.cardBg,
    outline: 'none',
    fontFamily: 'Heebo,sans-serif',
    padding: '8px 12px',
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 28,
            flexWrap: 'wrap',
            animation: 'fadeUp 0.4s ease backwards',
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>מסמכים</h1>
            <p style={{ fontSize: 13, color: t.textMuted }}>{docs.length} מסמכים במערכת</p>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              style={{ ...inputSt, color: selectedCustomerId ? t.text : t.textMuted }}
            >
              <option value="">בחר לקוח...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              style={{ ...inputSt, color: t.textSub }}
            >
              {docTypes.map((dt) => (
                <option key={dt}>{dt}</option>
              ))}
            </select>
            <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} />
            <button
              onClick={triggerUpload}
              disabled={uploadDocument.isPending}
              className="crm-btn-primary"
              style={{
                background: t.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '10px 22px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Heebo,sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: `0 4px 14px ${t.primary}45`,
                opacity: uploadDocument.isPending ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              {uploadDocument.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} color="#fff" strokeWidth={2.5} />
              )}
              העלאת מסמך
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          style={{
            gap: 16,
            marginBottom: 22,
          }}
        >
          {summaryCards.map((c, i) => (
            <div
              key={c.label}
              style={{
                background: t.cardBg,
                borderRadius: 16,
                padding: '20px 22px',
                boxShadow: t.shadow,
                border: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                animation: `fadeUp 0.4s ease ${i * 0.07 + 0.05}s backwards`,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: c.color + '18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <c.Icon size={18} color={c.color} />
              </div>
              <div>
                <p
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: t.text,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {c.value}
                </p>
                <p style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>{c.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div
          style={{
            background: t.cardBg,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            boxShadow: t.shadow,
            padding: '14px 18px',
            marginBottom: 18,
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
            animation: 'fadeUp 0.4s ease 0.2s backwards',
          }}
        >
          <div style={{ position: 'relative', flex: 1, maxWidth: 280, minWidth: 200 }}>
            <span
              style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)' }}
            >
              <Search size={15} color={t.textMuted} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש לפי לקוח או סוג מסמך..."
              style={{
                width: '100%',
                paddingRight: 38,
                paddingLeft: 14,
                height: 38,
                borderRadius: 9,
                border: `1px solid ${t.border}`,
                background: t.inputBg,
                color: t.text,
                fontSize: 14,
                outline: 'none',
                fontFamily: 'Heebo,sans-serif',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = t.primary
                e.target.style.boxShadow = `0 0 0 3px ${t.primary}18`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = t.border
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {docStatuses.map((s) => {
              const active = statusFilter === s
              const sc = dsColors[s] || { bg: t.primary, text: '#fff' }
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="crm-btn"
                  style={{
                    padding: '5px 14px',
                    borderRadius: 20,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    background: active ? (s === 'הכל' ? t.primary : sc.bg) : t.bg,
                    color: active ? (s === 'הכל' ? '#fff' : sc.text) : t.textSub,
                    fontFamily: 'Heebo,sans-serif',
                    transition: 'all 0.15s',
                  }}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            background: t.cardBg,
            borderRadius: 18,
            border: `1px solid ${t.border}`,
            boxShadow: t.shadow,
            overflow: 'hidden',
            animation: 'fadeUp 0.4s ease 0.25s backwards',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <Loader2 size={28} color={t.primary} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: t.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <FileText size={24} color={t.textMuted} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: t.textSub }}>לא נמצאו מסמכים</p>
              <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
                העלה מסמך ראשון באמצעות הכפתור למעלה
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.bg, borderBottom: `1px solid ${t.border}` }}>
                  {['לקוח', 'סוג מסמך', 'סטטוס', 'הועלה', 'תפוגה', 'פעולות'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '13px 20px',
                        textAlign: 'right',
                        fontSize: 11,
                        fontWeight: 700,
                        color: t.textMuted,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => {
                  const sc = dsColors[d.status ?? ''] || { bg: t.pillBg, text: t.textSub }
                  const hov = hovRow === d.id
                  const expiry = d.expires_at ? formatDate(d.expires_at) : null
                  const av = (d.customerName ?? '').trim().charAt(0) || '—'
                  return (
                    <tr
                      key={d.id}
                      onMouseEnter={() => setHovRow(d.id)}
                      onMouseLeave={() => setHovRow(null)}
                      style={{
                        borderBottom:
                          i < filtered.length - 1 ? `1px solid ${t.borderLight}` : 'none',
                        background: hov ? t.bg : 'transparent',
                        transition: 'background 0.12s',
                        animation: `fadeUp 0.35s ease ${i * 0.04 + 0.3}s backwards`,
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 9,
                              background: t.primary + '20',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 800,
                              color: t.primary,
                              flexShrink: 0,
                            }}
                          >
                            {av}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                            {d.customerName || '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FileText size={14} color={t.textMuted} />
                          <span style={{ fontSize: 13, color: t.text }}>{d.type || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: 20,
                            background: sc.bg,
                            color: sc.text,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {d.status || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: t.textSub }}>
                        {d.uploaded_at ? formatDate(d.uploaded_at) : '—'}
                      </td>
                      <td
                        style={{
                          padding: '14px 20px',
                          fontSize: 13,
                          color:
                            d.status === 'פג תוקף' ? '#dc2626' : expiry ? '#d97706' : t.textMuted,
                          fontWeight: expiry ? 600 : 400,
                        }}
                      >
                        {expiry || '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            opacity: hov ? 1 : 0,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          {d.file_url && (
                            <button
                              className="crm-btn"
                              onClick={() => setPreviewDoc(d)}
                              style={{
                                background: t.primary + '15',
                                color: t.primary,
                                border: 'none',
                                borderRadius: 8,
                                padding: '5px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'Heebo,sans-serif',
                              }}
                            >
                              צפייה
                            </button>
                          )}
                          <button
                            className="crm-btn"
                            onClick={triggerUpload}
                            style={{
                              background: t.bg,
                              color: t.textSub,
                              border: `1px solid ${t.border}`,
                              borderRadius: 8,
                              padding: '5px 12px',
                              fontSize: 12,
                              cursor: 'pointer',
                              fontFamily: 'Heebo,sans-serif',
                            }}
                          >
                            העלה מחדש
                          </button>
                          <button
                            className="crm-btn"
                            onClick={() => setDocToDelete(d)}
                            style={{
                              background: t.dangerBg,
                              color: t.danger,
                              border: 'none',
                              borderRadius: 8,
                              padding: '5px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'Heebo,sans-serif',
                            }}
                          >
                            מחק
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
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
