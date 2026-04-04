import { useState } from 'react'
import { FileText, Upload, Download, Search, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'

const statusIcons: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  'תקין': { icon: CheckCircle, color: 'text-green-500', label: '✅ תקין' },
  'ממתין': { icon: Clock, color: 'text-yellow-500', label: '🟡 ממתין' },
  'חסר': { icon: XCircle, color: 'text-red-500', label: '🔴 חסר' },
  'פג תוקף': { icon: AlertCircle, color: 'text-gray-500', label: '⚫ פג תוקף' },
}

const categories = ['הכל', 'זיהוי', 'הכנסות', 'חשבון בנק', 'נכס', 'כללי']

const mockDocuments = [
  { id: '1', customerName: 'יוסי כהן', type: 'תעודת זהות + ספח', category: 'זיהוי', status: 'תקין', fileName: 'tz_yossi.pdf', uploadedAt: '2026-03-20' },
  { id: '2', customerName: 'יוסי כהן', type: '3 תלושי שכר', category: 'הכנסות', status: 'תקין', fileName: 'salary_yossi.pdf', uploadedAt: '2026-03-20' },
  { id: '3', customerName: 'יוסי כהן', type: '6 דפי חשבון בנק', category: 'חשבון בנק', status: 'ממתין', fileName: 'bank_yossi.pdf', uploadedAt: '2026-03-21' },
  { id: '4', customerName: 'שרה לוי', type: 'תעודת זהות + ספח', category: 'זיהוי', status: 'תקין', fileName: 'tz_sara.pdf', uploadedAt: '2026-03-18' },
  { id: '5', customerName: 'שרה לוי', type: 'הסכם רכישה', category: 'נכס', status: 'חסר', fileName: '', uploadedAt: '' },
  { id: '6', customerName: 'שרה לוי', type: 'נסח טאבו', category: 'נכס', status: 'חסר', fileName: '', uploadedAt: '' },
  { id: '7', customerName: 'דוד אברהם', type: 'אישור עבודה', category: 'הכנסות', status: 'פג תוקף', fileName: 'work_david.pdf', uploadedAt: '2025-12-01' },
  { id: '8', customerName: 'רחל מזרחי', type: 'דוח פלאש BDI', category: 'כללי', status: 'תקין', fileName: 'bdi_rachel.pdf', uploadedAt: '2026-03-25' },
]

export default function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('הכל')
  const [statusFilter, setStatusFilter] = useState('הכל')

  const filtered = mockDocuments.filter(d => {
    const matchSearch = !search || d.customerName.includes(search) || d.type.includes(search)
    const matchCategory = categoryFilter === 'הכל' || d.category === categoryFilter
    const matchStatus = statusFilter === 'הכל' || d.status === statusFilter
    return matchSearch && matchCategory && matchStatus
  })

  const stats = {
    total: mockDocuments.length,
    ok: mockDocuments.filter(d => d.status === 'תקין').length,
    pending: mockDocuments.filter(d => d.status === 'ממתין').length,
    missing: mockDocuments.filter(d => d.status === 'חסר').length,
    expired: mockDocuments.filter(d => d.status === 'פג תוקף').length,
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">מסמכים</h1>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 bg-[#1a4f8a] text-white px-4 py-2 rounded-lg hover:bg-[#143d6b] transition-colors">
            <Upload size={18} />
            העלה מסמך
          </button>
          <button className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
            <Download size={18} />
            הורד הכל
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'סה"כ', value: stats.total, color: 'text-[#1a4f8a]', bg: 'bg-blue-50' },
          { label: 'תקין', value: stats.ok, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'ממתין', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'חסר', value: stats.missing, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'פג תוקף', value: stats.expired, color: 'text-gray-600', bg: 'bg-gray-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center cursor-pointer hover:shadow-sm transition-shadow`} onClick={() => setStatusFilter(s.label === 'סה"כ' ? 'הכל' : s.label)}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-600">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חפש לפי לקוח או סוג מסמך..." className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCategoryFilter(c)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${categoryFilter === c ? 'bg-[#1a4f8a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-right p-3 text-sm font-medium text-gray-600">לקוח</th>
              <th className="text-right p-3 text-sm font-medium text-gray-600">סוג מסמך</th>
              <th className="text-right p-3 text-sm font-medium text-gray-600">קטגוריה</th>
              <th className="text-right p-3 text-sm font-medium text-gray-600">סטטוס</th>
              <th className="text-right p-3 text-sm font-medium text-gray-600">קובץ</th>
              <th className="text-right p-3 text-sm font-medium text-gray-600">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(doc => {
              const si = statusIcons[doc.status]
              return (
                <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="p-3 font-medium text-gray-900">{doc.customerName}</td>
                  <td className="p-3 text-gray-700 text-sm">{doc.type}</td>
                  <td className="p-3 text-gray-500 text-sm">{doc.category}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 text-sm ${si.color}`}>
                      <si.icon size={14} />
                      {doc.status}
                    </span>
                  </td>
                  <td className="p-3 text-sm">
                    {doc.fileName ? (
                      <span className="flex items-center gap-1 text-[#1a4f8a]"><FileText size={14} />{doc.fileName}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {doc.fileName ? (
                        <button className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"><Download size={12} /></button>
                      ) : (
                        <button className="text-xs bg-[#e8f0fe] text-[#1a4f8a] px-2 py-1 rounded hover:bg-blue-100"><Upload size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">לא נמצאו מסמכים</p>
          </div>
        )}
      </div>
    </div>
  )
}
