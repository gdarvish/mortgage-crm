import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Upload, Download, Search, CheckCircle, Clock, XCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { documentService } from '@/services/documentService'
import { customerService } from '@/services/customerService'
import type { Document, Customer } from '@/types/database'

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

type DocRow = Document & { customerName?: string }

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('הכל')
  const [statusFilter, setStatusFilter] = useState('הכל')
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState(docTypes[0])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = useCallback(async () => {
    const uid = auth.currentUser?.uid
    if (!uid) { setLoading(false); return }
    setLoading(true)
    try {
      // No orderBy — sort client-side to avoid composite index requirement
      const snap = await getDocs(
        query(collection(db, 'documents'), where('user_id', '==', uid))
      )
      const rows: DocRow[] = snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          uploaded_at: data.uploaded_at?.toDate?.()?.toISOString() ?? data.uploaded_at ?? '',
        } as DocRow
      })
      rows.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime())
      const custSnap = await getDocs(
        query(collection(db, 'customers'), where('user_id', '==', uid))
      )
      const custMap: Record<string, string> = {}
      custSnap.docs.forEach(d => {
        const c = d.data()
        custMap[d.id] = `${c.first_name} ${c.last_name}`
      })
      rows.forEach(r => { if (r.customer_id) r.customerName = custMap[r.customer_id] ?? '' })
      setDocs(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  useEffect(() => {
    customerService.getAll().then(({ data, error }) => {
      if (data) setCustomers(data)
      if (error) console.error('Failed to load customers for selector:', error.message)
    })
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedCustomerId) return
    setUploading(true)
    const { error } = await documentService.upload(selectedCustomerId, file, uploadType, 'כללי')
    if (error) alert('שגיאה בהעלאה: ' + error.message)
    await fetchDocs()
    setUploading(false)
    e.target.value = ''
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
              if (!selectedCustomerId) { alert('בחר לקוח לפני ההעלאה'); return }
              fileInputRef.current?.click()
            }}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ borderRadius: 12, background: '#059669', boxShadow: '0 4px 14px rgba(5,150,105,0.27)' }}
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
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
                          onClick={async () => {
                            if (!window.confirm('האם למחוק מסמך זה?')) return
                            const { error } = await documentService.delete(d.id)
                            if (error) { alert('שגיאה במחיקה: ' + error.message); return }
                            await fetchDocs()
                          }}
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
    </div>
  )
}
