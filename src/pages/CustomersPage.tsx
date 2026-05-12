import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { customerService } from '@/services/customerService'
import type { Customer } from '@/types/database'

const statusColors: Record<string, string> = {
  'ליד': 'bg-blue-100 text-blue-700',
  'פגישה': 'bg-yellow-100 text-yellow-700',
  'מסמכים': 'bg-orange-100 text-orange-700',
  'הגשה': 'bg-purple-100 text-purple-700',
  'אישור': 'bg-green-100 text-green-700',
  'סגירה': 'bg-emerald-100 text-emerald-700',
}

const statuses = ['הכל', 'ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'סגירה']

type SortField = 'name' | 'created_at' | 'monthly_income'

export default function CustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('הכל')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    first_name: '', last_name: '', id_number: '', phone: '', email: '', lead_source: '',
  })

  const fetchCustomers = useCallback(async (isMounted: () => boolean) => {
    setLoading(true)
    const { data, error } = await customerService.getAll({
      status: statusFilter !== 'הכל' ? statusFilter : undefined,
      search: search || undefined,
    })
    if (!isMounted()) return
    if (error) {
      console.error('Error fetching customers:', error)
    } else {
      setCustomers(data || [])
    }
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => {
    let mounted = true
    fetchCustomers(() => mounted)
    return () => { mounted = false }
  }, [fetchCustomers])

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomer.first_name || !newCustomer.last_name) return

    setSaving(true)
    const { error } = await customerService.create({
      ...newCustomer,
      status: 'ליד',
      children: 0,
      existing_obligations: 0,
      questionnaire_completed: false,
      id_number: newCustomer.id_number || null,
      phone: newCustomer.phone || null,
      email: newCustomer.email || null,
      address: null,
      marital_status: null,
      monthly_income: null,
      partner_income: null,
      own_capital: null,
      lead_source: newCustomer.lead_source || null,
      notes: null,
      referral_partner_id: null,
      questionnaire_token: null,
    })

    if (error) {
      console.error('Error creating customer:', error)
      alert('שגיאה ביצירת לקוח: ' + error.message)
    } else {
      setShowNewModal(false)
      setNewCustomer({ first_name: '', last_name: '', id_number: '', phone: '', email: '', lead_source: '' })
      fetchCustomers(() => true)
    }
    setSaving(false)
  }

  const sorted = [...customers].sort((a, b) => {
    let cmp = 0
    if (sortField === 'name') cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
    else if (sortField === 'created_at') cmp = (a.created_at || '').localeCompare(b.created_at || '')
    else if (sortField === 'monthly_income') cmp = (a.monthly_income || 0) - (b.monthly_income || 0)
    return sortAsc ? cmp : -cmp
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronDown size={14} className="text-gray-300" />
    return sortAsc ? <ChevronUp size={14} className="text-[#1a4f8a]" /> : <ChevronDown size={14} className="text-[#1a4f8a]" />
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">לקוחות ({customers.length})</h1>
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
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={32} className="mx-auto text-[#1a4f8a] animate-spin mb-3" />
            <p className="text-gray-500">טוען לקוחות...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-right p-3 text-sm font-medium text-gray-600 cursor-pointer" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">שם {renderSortIcon('name')}</div>
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-gray-600">ת.ז</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-600">טלפון</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-600">סטטוס</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-600">מקור</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-600 cursor-pointer" onClick={() => handleSort('monthly_income')}>
                      <div className="flex items-center gap-1">הכנסה {renderSortIcon('monthly_income')}</div>
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-gray-600 cursor-pointer" onClick={() => handleSort('created_at')}>
                      <div className="flex items-center gap-1">תאריך {renderSortIcon('created_at')}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-medium text-gray-900">{customer.first_name} {customer.last_name}</td>
                      <td className="p-3 text-gray-600 text-sm" dir="ltr">{customer.id_number || '—'}</td>
                      <td className="p-3 text-gray-600 text-sm" dir="ltr">{customer.phone || '—'}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[customer.status] || 'bg-gray-100 text-gray-600'}`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 text-sm">{customer.lead_source || '—'}</td>
                      <td className="p-3 text-gray-600 text-sm">{customer.monthly_income ? formatCurrency(customer.monthly_income) : '—'}</td>
                      <td className="p-3 text-gray-500 text-sm">{formatDate(customer.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sorted.length === 0 && (
              <div className="p-12 text-center">
                <Filter size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">לא נמצאו לקוחות</p>
                <p className="text-sm text-gray-400 mt-1">לחץ "לקוח חדש" כדי להוסיף את הלקוח הראשון</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Customer Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">לקוח חדש</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם פרטי *</label>
                  <input
                    value={newCustomer.first_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם משפחה *</label>
                  <input
                    value={newCustomer.last_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ת.ז</label>
                  <input
                    value={newCustomer.id_number}
                    onChange={(e) => setNewCustomer({ ...newCustomer, id_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                  <input
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מקור הגעה</label>
                <select
                  value={newCustomer.lead_source}
                  onChange={(e) => setNewCustomer({ ...newCustomer, lead_source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none bg-white"
                >
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
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#1a4f8a] text-white py-2 rounded-lg hover:bg-[#143d6b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
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
