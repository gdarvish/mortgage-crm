import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusColors: Record<string, string> = {
  'ליד': 'bg-blue-100 text-blue-700',
  'פגישה': 'bg-yellow-100 text-yellow-700',
  'מסמכים': 'bg-orange-100 text-orange-700',
  'הגשה': 'bg-purple-100 text-purple-700',
  'אישור': 'bg-green-100 text-green-700',
  'סגירה': 'bg-emerald-100 text-emerald-700',
}

const statuses = ['הכל', 'ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'סגירה']

const mockCustomers = [
  { id: '1', first_name: 'יוסי', last_name: 'כהן', id_number: '012345678', phone: '050-1234567', status: 'מסמכים', lead_source: 'הפניה', monthly_income: 18000, loan_amount: 900000, created_at: '2026-03-15' },
  { id: '2', first_name: 'שרה', last_name: 'לוי', id_number: '023456789', phone: '052-2345678', status: 'הגשה', lead_source: 'פייסבוק', monthly_income: 22000, loan_amount: 1300000, created_at: '2026-03-10' },
  { id: '3', first_name: 'דוד', last_name: 'אברהם', id_number: '034567890', phone: '054-3456789', status: 'סגירה', lead_source: 'אתר', monthly_income: 25000, loan_amount: 1800000, created_at: '2026-02-28' },
  { id: '4', first_name: 'רחל', last_name: 'מזרחי', id_number: '045678901', phone: '050-4567890', status: 'אישור', lead_source: 'הפניה', monthly_income: 15000, loan_amount: 750000, created_at: '2026-03-20' },
  { id: '5', first_name: 'מוטי', last_name: 'פרץ', id_number: '056789012', phone: '053-5678901', status: 'ליד', lead_source: 'וואטסאפ', monthly_income: 20000, loan_amount: 1200000, created_at: '2026-04-01' },
  { id: '6', first_name: 'אסתר', last_name: 'גולד', id_number: '067890123', phone: '058-6789012', status: 'ליד', lead_source: 'טלפון', monthly_income: 12000, loan_amount: 800000, created_at: '2026-04-02' },
  { id: '7', first_name: 'יעקב', last_name: 'שמעון', id_number: '078901234', phone: '050-7890123', status: 'פגישה', lead_source: 'פייסבוק', monthly_income: 30000, loan_amount: 1500000, created_at: '2026-03-25' },
  { id: '8', first_name: 'נועה', last_name: 'ברק', id_number: '089012345', phone: '052-8901234', status: 'מסמכים', lead_source: 'הפניה', monthly_income: 16000, loan_amount: 1100000, created_at: '2026-03-18' },
  { id: '9', first_name: 'אמיר', last_name: 'חדד', id_number: '090123456', phone: '054-9012345', status: 'הגשה', lead_source: 'אתר', monthly_income: 19000, loan_amount: 950000, created_at: '2026-03-05' },
  { id: '10', first_name: 'ליאת', last_name: 'דיין', id_number: '001234567', phone: '050-0123456', status: 'פגישה', lead_source: 'וואטסאפ', monthly_income: 14000, loan_amount: 600000, created_at: '2026-03-28' },
]

type SortField = 'name' | 'created_at' | 'loan_amount'

export default function CustomersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('הכל')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)

  const filtered = mockCustomers
    .filter(c => {
      const matchSearch = !search ||
        `${c.first_name} ${c.last_name}`.includes(search) ||
        c.phone.includes(search) ||
        c.id_number.includes(search)
      const matchStatus = statusFilter === 'הכל' || c.status === statusFilter
      return matchSearch && matchStatus
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      else if (sortField === 'created_at') cmp = a.created_at.localeCompare(b.created_at)
      else if (sortField === 'loan_amount') cmp = (a.loan_amount || 0) - (b.loan_amount || 0)
      return sortAsc ? cmp : -cmp
    })

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={14} className="text-gray-300" />
    return sortAsc ? <ChevronUp size={14} className="text-[#1a4f8a]" /> : <ChevronDown size={14} className="text-[#1a4f8a]" />
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">לקוחות</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 bg-[#1a4f8a] text-white px-4 py-2 rounded-lg hover:bg-[#143d6b] transition-colors"
        >
          <Plus size={18} />
          לקוח חדש
        </button>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש לפי שם, טלפון או ת.ז..."
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] focus:border-transparent outline-none"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  statusFilter === s
                    ? 'bg-[#1a4f8a] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-right p-3 text-sm font-medium text-gray-600 cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">שם <SortIcon field="name" /></div>
                </th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">ת.ז</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">טלפון</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">סטטוס</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">מקור</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 cursor-pointer" onClick={() => handleSort('loan_amount')}>
                  <div className="flex items-center gap-1">סכום <SortIcon field="loan_amount" /></div>
                </th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 cursor-pointer" onClick={() => handleSort('created_at')}>
                  <div className="flex items-center gap-1">תאריך <SortIcon field="created_at" /></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-medium text-gray-900">{customer.first_name} {customer.last_name}</td>
                  <td className="p-3 text-gray-600 text-sm" dir="ltr">{customer.id_number}</td>
                  <td className="p-3 text-gray-600 text-sm" dir="ltr">{customer.phone}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[customer.status] || 'bg-gray-100 text-gray-600'}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 text-sm">{customer.lead_source}</td>
                  <td className="p-3 text-gray-600 text-sm">{formatCurrency(customer.loan_amount)}</td>
                  <td className="p-3 text-gray-500 text-sm">{formatDate(customer.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <Filter size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">לא נמצאו לקוחות</p>
            <p className="text-sm text-gray-400 mt-1">נסה לשנות את החיפוש או הפילטרים</p>
          </div>
        )}
      </div>

      {/* New Customer Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">לקוח חדש</h2>
            <form className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם פרטי</label>
                  <input className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם משפחה</label>
                  <input className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ת.ז</label>
                  <input className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                  <input className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                <input type="email" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מקור הגעה</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none bg-white">
                  <option value="">בחר...</option>
                  <option>הפניה</option>
                  <option>פייסבוק</option>
                  <option>אינסטגרם</option>
                  <option>אתר</option>
                  <option>וואטסאפ</option>
                  <option>טלפון</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#1a4f8a] text-white py-2 rounded-lg hover:bg-[#143d6b] transition-colors">
                  שמור
                </button>
                <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
