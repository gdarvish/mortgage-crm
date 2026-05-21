import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowRight, MessageSquare, ClipboardList, Calculator, Upload,
  Send, Plus, Check, Mail, Phone, MapPin, User, CreditCard,
  FileText, Home, MessagesSquare, ListTodo, Banknote, ExternalLink,
  Trash2, Loader2, Save, PenTool,
} from 'lucide-react'
import { formatCurrency, formatDate, generateToken, tokenExpiration } from '@/lib/utils'
import { validatePersonalForm, type FormErrors } from '@/utils/israeliValidations'
import { toast, ConfirmDialog } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { customerService } from '@/services/customerService'
import { taskService } from '@/services/taskService'
import { messageService } from '@/services/messageService'
import { commissionService } from '@/services/commissionService'
import { documentService } from '@/services/documentService'
import { signatureService } from '@/services/signatureService'
import type {
  Customer, Document, Mortgage, LoanTrack, Message, Task, Commission, CustomerStatus
} from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TabKey = 'personal' | 'financial' | 'documents' | 'mortgages' | 'communication' | 'tasks' | 'commission'

interface Tab { key: TabKey; label: string; icon: React.ElementType }

interface MortgageWithTracks extends Mortgage {
  loan_tracks?: LoanTrack[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const tabs: Tab[] = [
  { key: 'personal', label: 'פרטים אישיים', icon: User },
  { key: 'financial', label: 'פרטים פיננסיים', icon: CreditCard },
  { key: 'documents', label: 'מסמכים', icon: FileText },
  { key: 'mortgages', label: 'משכנתאות', icon: Home },
  { key: 'communication', label: 'תקשורת', icon: MessagesSquare },
  { key: 'tasks', label: 'משימות', icon: ListTodo },
  { key: 'commission', label: 'עמלה', icon: Banknote },
]

const statusColors: Record<string, string> = {
  'ליד': 'bg-blue-100 text-blue-700',
  'פגישה': 'bg-yellow-100 text-yellow-700',
  'מסמכים': 'bg-orange-100 text-orange-700',
  'הגשה': 'bg-purple-100 text-purple-700',
  'אישור': 'bg-green-100 text-green-700',
  'סגירה': 'bg-emerald-100 text-emerald-700',
}

const priorityColors: Record<string, string> = {
  'נמוכה': 'bg-gray-100 text-gray-600',
  'בינונית': 'bg-blue-100 text-blue-700',
  'גבוהה': 'bg-orange-100 text-orange-700',
  'דחופה': 'bg-red-100 text-red-700',
}

const statuses: CustomerStatus[] = ['ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'סגירה']

const messageTemplates = [
  'שלום {שם}, רציתי לעדכן אותך לגבי סטטוס התיק.',
  'היי {שם}, אנא שלח את המסמכים החסרים בהקדם.',
  'שלום {שם}, מצורפת הצעת תמהיל לעיונך.',
  'שלום {שם}, התיק אושר! נקבע פגישה לחתימה.',
]

const docStatusIcon = (status: string) => {
  if (status === 'תקין') return '✅'
  if (status === 'ממתין') return '🟡'
  return '🔴'
}

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#059669] focus:border-transparent outline-none text-sm'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabKey>('personal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Real data state
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [mortgages, setMortgages] = useState<MortgageWithTracks[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [commission, setCommission] = useState<Commission | null>(null)

  // Local edit state
  const [personal, setPersonal] = useState({
    first_name: '', last_name: '', id_number: '', phone: '', email: '', address: '', marital_status: '', children: 0,
  })
  const [financial, setFinancial] = useState({
    monthly_income: 0, partner_income: 0, own_capital: 0, existing_obligations: 0, lead_source: '', notes: '',
  })
  const [statusValue, setStatusValue] = useState<CustomerStatus>('ליד')
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Task form
  const [newTask, setNewTask] = useState({ title: '', due_date: '', priority: 'בינונית' })

  // Communication
  const [messageText, setMessageText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  // Documents upload
  const docFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docUploadType, setDocUploadType] = useState('תעודת זהות + ספח')

  // -------------------------------------------------------------------------
  // Fetch all customer data
  // -------------------------------------------------------------------------
  const fetchAll = useCallback(async (isMounted: () => boolean) => {
    if (!id) return
    setLoading(true)

    const { data: full, error: fetchErr } = await customerService.getById(id)
    if (!isMounted()) return
    if (fetchErr) setFetchError(fetchErr.message)
    if (full) {
      setCustomer(full)
      setStatusValue(full.status)
      setPersonal({
        first_name: full.first_name || '',
        last_name: full.last_name || '',
        id_number: full.id_number || '',
        phone: full.phone || '',
        email: full.email || '',
        address: full.address || '',
        marital_status: full.marital_status || 'רווק',
        children: full.children || 0,
      })
      setFinancial({
        monthly_income: full.monthly_income || 0,
        partner_income: full.partner_income || 0,
        own_capital: full.own_capital || 0,
        existing_obligations: full.existing_obligations || 0,
        lead_source: full.lead_source || '',
        notes: full.notes || '',
      })
      setDocuments(full.documents || [])
      setMortgages((full.mortgages || []) as MortgageWithTracks[])
      setMessages(full.messages || [])
      setTasks(full.tasks || [])
      setCommission((full.commissions && full.commissions[0]) || null)
    }

    setLoading(false)
  }, [id, user])

  useEffect(() => {
    if (!user) return
    let mounted = true
    fetchAll(() => mounted)
    return () => { mounted = false }
  }, [fetchAll, user])

  // -------------------------------------------------------------------------
  // Save handlers
  // -------------------------------------------------------------------------
  const savePersonal = async () => {
    if (!id) return
    const errors = validatePersonalForm(personal)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error('יש שגיאות בטופס', 'אנא תקן את השדות המסומנים ונסה שוב')
      return
    }
    setSaving(true)
    const { error } = await customerService.update(id, { ...personal, status: statusValue })
    if (!error) {
      setCustomer(prev => prev ? { ...prev, ...personal, status: statusValue } : prev)
      toast.success('הפרטים נשמרו בהצלחה')
    } else {
      toast.error('שגיאה בשמירה', error.message)
    }
    setSaving(false)
  }

  const saveFinancial = async () => {
    if (!id) return
    setSaving(true)
    const { error } = await customerService.update(id, financial)
    if (!error) {
      setCustomer(prev => prev ? { ...prev, ...financial } : prev)
      toast.success('הפרטים הפיננסיים נשמרו')
    } else {
      toast.error('שגיאה בשמירה', error.message)
    }
    setSaving(false)
  }

  const handleDeleteCustomer = async () => {
    if (!id) return
    setDeleting(true)
    const { error } = await customerService.delete(id)
    setDeleting(false)
    setShowDeleteConfirm(false)
    if (error) {
      toast.error('שגיאה במחיקה', error.message)
      return
    }
    toast.success('הלקוח נמחק')
    navigate('/customers')
  }

  const addTask = async () => {
    if (!newTask.title.trim() || !id) return
    const { data, error } = await taskService.create({
      customer_id: id,
      title: newTask.title,
      due_date: newTask.due_date || null,
      priority: newTask.priority as Task['priority'],
      status: 'פתוחה',
      notes: null,
    })
    if (data && !error) {
      setTasks(prev => [data, ...prev])
      setNewTask({ title: '', due_date: '', priority: 'בינונית' })
    }
  }

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'הושלמה' ? 'פתוחה' : 'הושלמה'
    const { error } = await taskService.update(task.id, { status: newStatus })
    if (!error) setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  const deleteTask = async (taskId: string) => {
    const { error } = await taskService.delete(taskId)
    if (!error) setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingDoc(true)
    const { data } = await documentService.upload(id, file, docUploadType, 'required')
    if (data) setDocuments(prev => [data, ...prev])
    setUploadingDoc(false)
    e.target.value = ''
  }

  const sendMessage = async (channel: Message['channel']) => {
    if (!messageText.trim() || !id) return
    setSendingMsg(true)
    const { data, error } = await messageService.create({
      customer_id: id,
      channel,
      direction: 'נשלח',
      content: messageText,
    })
    if (data && !error) {
      setMessages(prev => [...prev, data])
      setMessageText('')
    }
    setSendingMsg(false)
  }

  const sendQuestionnaire = async () => {
    if (!id) return
    const token = generateToken()
    const { error } = await customerService.update(id, {
      questionnaire_token: token,
      questionnaire_token_expires_at: tokenExpiration(30),
    })
    if (error) {
      toast.error('שגיאה ביצירת קישור', error.message)
      return
    }
    const url = `${window.location.origin}/questionnaire/${token}`
    setMessageText(`שלום ${customer?.first_name}, אנא מלא את שאלון הפרטים בקישור הבא: ${url}`)
    setActiveTab('communication')
    toast.success('קישור השאלון נוצר', 'הקישור בתוקף ל-30 יום')
  }

  const sendSignatureRequest = async () => {
    if (!id || !customer) return
    const { data, error } = await signatureService.createRequest({
      customer_id: id,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      document_name: 'ייפוי כוח',
    })
    if (error || !data) {
      toast.error('שגיאה ביצירת בקשת חתימה', error?.message)
      return
    }
    setMessageText(`שלום ${customer.first_name}, אנא חתום/חתמי על המסמך בקישור הבא: ${data.url}`)
    setActiveTab('communication')
    toast.success('קישור החתימה נוצר', 'הקישור בתוקף ל-14 יום')
  }

  const saveCommission = async () => {
    if (!commission || !id) return
    setSaving(true)
    if (commission.id) {
      await commissionService.update(commission.id, {
        amount: commission.amount,
        status: commission.status,
        payment_date: commission.payment_date,
        notes: commission.notes,
      })
    } else {
      const { data } = await commissionService.create({
        customer_id: id,
        mortgage_id: null,
        amount: commission.amount,
        status: commission.status,
        payment_date: commission.payment_date,
        notes: commission.notes,
      })
      if (data) setCommission(data)
    }
    setSaving(false)
  }

  // -------------------------------------------------------------------------
  // Loading / not found
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="text-[#059669] animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-16 text-gray-500">
        לקוח לא נמצא
        {fetchError && <p className="text-xs text-red-400 mt-2">{fetchError}</p>}
        <button onClick={() => navigate('/customers')} className="block mx-auto mt-4 text-[#059669] hover:underline text-sm">
          חזרה לרשימת לקוחות
        </button>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Tab renderers
  // -------------------------------------------------------------------------
  const renderPersonalTab = () => (
    <div className="space-y-4">
      {/* Status selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">סטטוס לקוח</label>
        <div className="flex gap-2 flex-wrap">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setStatusValue(s)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                statusValue === s ? statusColors[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">שם פרטי</label>
          <input className={`${inputClass} ${formErrors.first_name ? 'border-red-500' : ''}`} value={personal.first_name}
            onChange={e => setPersonal({ ...personal, first_name: e.target.value })} />
          {formErrors.first_name && <p className="text-xs text-red-600 mt-1">{formErrors.first_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">שם משפחה</label>
          <input className={`${inputClass} ${formErrors.last_name ? 'border-red-500' : ''}`} value={personal.last_name}
            onChange={e => setPersonal({ ...personal, last_name: e.target.value })} />
          {formErrors.last_name && <p className="text-xs text-red-600 mt-1">{formErrors.last_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ת.ז</label>
          <input className={`${inputClass} ${formErrors.id_number ? 'border-red-500' : ''}`} dir="ltr" value={personal.id_number}
            onChange={e => setPersonal({ ...personal, id_number: e.target.value })} />
          {formErrors.id_number && <p className="text-xs text-red-600 mt-1">{formErrors.id_number}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
          <div className="relative">
            <Phone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={`${inputClass} pr-9 ${formErrors.phone ? 'border-red-500' : ''}`} dir="ltr" value={personal.phone}
              onChange={e => setPersonal({ ...personal, phone: e.target.value })} />
          </div>
          {formErrors.phone && <p className="text-xs text-red-600 mt-1">{formErrors.phone}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
          <div className="relative">
            <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={`${inputClass} pr-9 ${formErrors.email ? 'border-red-500' : ''}`} dir="ltr" type="email" value={personal.email}
              onChange={e => setPersonal({ ...personal, email: e.target.value })} />
          </div>
          {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
          <div className="relative">
            <MapPin size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={`${inputClass} pr-9`} value={personal.address}
              onChange={e => setPersonal({ ...personal, address: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">מצב משפחתי</label>
          <select className={`${inputClass} bg-white`} value={personal.marital_status}
            onChange={e => setPersonal({ ...personal, marital_status: e.target.value })}>
            <option value="רווק">רווק</option>
            <option value="נשוי">נשוי</option>
            <option value="גרוש">גרוש</option>
            <option value="אלמן">אלמן</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ילדים</label>
          <input className={inputClass} type="number" min={0} value={personal.children}
            onChange={e => setPersonal({ ...personal, children: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="md:col-span-2 flex justify-end pt-2">
          <button onClick={savePersonal} disabled={saving}
            className="inline-flex items-center gap-2 bg-[#059669] text-white px-6 py-2 rounded-lg hover:bg-[#047857] transition-colors text-sm disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            שמור שינויים
          </button>
        </div>
      </div>
    </div>
  )

  const renderFinancialTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">הכנסה חודשית</label>
        <input className={inputClass} type="number" dir="ltr" value={financial.monthly_income}
          onChange={e => setFinancial({ ...financial, monthly_income: parseInt(e.target.value) || 0 })} />
        <p className="text-xs text-gray-400 mt-1">{formatCurrency(financial.monthly_income)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">הכנסת בן/בת זוג</label>
        <input className={inputClass} type="number" dir="ltr" value={financial.partner_income}
          onChange={e => setFinancial({ ...financial, partner_income: parseInt(e.target.value) || 0 })} />
        <p className="text-xs text-gray-400 mt-1">{formatCurrency(financial.partner_income)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">הון עצמי</label>
        <input className={inputClass} type="number" dir="ltr" value={financial.own_capital}
          onChange={e => setFinancial({ ...financial, own_capital: parseInt(e.target.value) || 0 })} />
        <p className="text-xs text-gray-400 mt-1">{formatCurrency(financial.own_capital)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">התחייבויות קיימות</label>
        <input className={inputClass} type="number" dir="ltr" value={financial.existing_obligations}
          onChange={e => setFinancial({ ...financial, existing_obligations: parseInt(e.target.value) || 0 })} />
        <p className="text-xs text-gray-400 mt-1">{formatCurrency(financial.existing_obligations)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">מקור הגעה</label>
        <select className={`${inputClass} bg-white`} value={financial.lead_source}
          onChange={e => setFinancial({ ...financial, lead_source: e.target.value })}>
          <option value="">בחר...</option>
          {['הפניה', 'פייסבוק', 'אינסטגרם', 'אתר', 'וואטסאפ', 'טלפון'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <div className="bg-blue-50 rounded-lg p-3 w-full">
          <p className="text-sm text-blue-700 font-medium">סה"כ הכנסה משפחתית</p>
          <p className="text-lg font-bold text-blue-900">
            {formatCurrency(financial.monthly_income + financial.partner_income)}
          </p>
        </div>
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
        <textarea className={`${inputClass} min-h-[80px]`} value={financial.notes}
          onChange={e => setFinancial({ ...financial, notes: e.target.value })} />
      </div>
      <div className="md:col-span-2 flex justify-end pt-2">
        <button onClick={saveFinancial} disabled={saving}
          className="inline-flex items-center gap-2 bg-[#059669] text-white px-6 py-2 rounded-lg hover:bg-[#047857] transition-colors text-sm disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          שמור שינויים
        </button>
      </div>
    </div>
  )

  const renderDocumentsTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {documents.filter(d => d.status === 'תקין').length} / {documents.length} מסמכים תקינים
        </p>
        <div className="flex items-center gap-2">
          <select
            value={docUploadType}
            onChange={e => setDocUploadType(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white outline-none"
          >
            {['תעודת זהות + ספח', '3 תלושי שכר', 'הסכם רכישה', 'נסח טאבו', 'דוח פלאש BDI', 'אחר'].map(t => <option key={t}>{t}</option>)}
          </select>
          <input type="file" hidden ref={docFileInputRef} onChange={handleDocUpload} />
          <button
            onClick={() => docFileInputRef.current?.click()}
            disabled={uploadingDoc}
            className="inline-flex items-center gap-1 text-xs bg-[#059669] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {uploadingDoc ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            העלאה
          </button>
        </div>
      </div>
      {documents.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          <FileText size={36} className="mx-auto mb-3 text-gray-300" />
          אין מסמכים עדיין
        </div>
      )}
      {documents.map(doc => (
        <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-lg">{docStatusIcon(doc.status)}</span>
            <div>
              <p className="text-sm font-medium text-gray-900">{doc.type}</p>
              {doc.uploaded_at && <p className="text-xs text-gray-400">הועלה: {formatDate(doc.uploaded_at)}</p>}
              {doc.file_name && <p className="text-xs text-gray-400">{doc.file_name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              doc.status === 'תקין' ? 'bg-green-100 text-green-700' :
              doc.status === 'ממתין' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
            }`}>{doc.status}</span>
            {doc.file_url && (
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#059669] hover:underline">צפה</a>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  const renderMortgagesTab = () => (
    <div className="space-y-4">
      {mortgages.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          <Home size={36} className="mx-auto mb-3 text-gray-300" />
          אין תמהילים עדיין
        </div>
      )}
      {mortgages.map(mortgage => {
        const tracks = mortgage.loan_tracks || []
        const totalAmount = tracks.reduce((s, t) => s + (t.amount || 0), 0)
        const totalPayment = tracks.reduce((s, t) => s + (t.monthly_payment || 0), 0)
        return (
          <div key={mortgage.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">משכנתא {mortgage.type}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    mortgage.status === 'אושר' ? 'bg-green-100 text-green-700' :
                    mortgage.status === 'הוגש' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}>{mortgage.status}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {mortgage.property_price ? `מחיר נכס: ${formatCurrency(mortgage.property_price)} | ` : ''}
                  {mortgage.loan_amount ? `סכום הלוואה: ${formatCurrency(mortgage.loan_amount)}` : ''}
                </p>
              </div>
              <button onClick={() => navigate('/calculator')}
                className="inline-flex items-center gap-1 text-sm text-[#059669] hover:text-[#047857] transition-colors">
                <ExternalLink size={14} />מחשבון
              </button>
            </div>
            {tracks.length > 0 && (
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-right pb-2 font-medium text-gray-600">מסלול</th>
                      <th className="text-right pb-2 font-medium text-gray-600">סכום</th>
                      <th className="text-right pb-2 font-medium text-gray-600">ריבית</th>
                      <th className="text-right pb-2 font-medium text-gray-600">תקופה</th>
                      <th className="text-right pb-2 font-medium text-gray-600">החזר חודשי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map(track => (
                      <tr key={track.id} className="border-b border-gray-50">
                        <td className="py-2 text-gray-900">{track.type}</td>
                        <td className="py-2 text-gray-700">{track.amount ? formatCurrency(track.amount) : '—'}</td>
                        <td className="py-2 text-gray-700" dir="ltr">{track.interest_rate ? `${track.interest_rate}%` : '—'}</td>
                        <td className="py-2 text-gray-700">{track.period_months ? `${track.period_months} חודשים` : '—'}</td>
                        <td className="py-2 font-medium text-gray-900">{track.monthly_payment ? formatCurrency(track.monthly_payment) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50">
                      <td className="py-2 font-bold text-gray-900">סה"כ</td>
                      <td className="py-2 font-bold text-gray-900">{formatCurrency(totalAmount)}</td>
                      <td /><td />
                      <td className="py-2 font-bold text-gray-900">{formatCurrency(totalPayment)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const renderCommunicationTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
        <div>
          <select className={`${inputClass} bg-white max-w-xs`} value=""
            onChange={e => { if (e.target.value) setMessageText(e.target.value.replace('{שם}', customer.first_name)) }}>
            <option value="">בחר תבנית...</option>
            {messageTemplates.map((t, i) => (
              <option key={i} value={t}>{t.slice(0, 45)}...</option>
            ))}
          </select>
        </div>
        <textarea className={`${inputClass} min-h-[80px]`} placeholder="הקלד הודעה..."
          value={messageText} onChange={e => setMessageText(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={() => sendMessage('וואטסאפ')} disabled={sendingMsg || !messageText.trim()}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50">
            <MessageSquare size={16} />WhatsApp
          </button>
          <button onClick={() => sendMessage('אימייל')} disabled={sendingMsg || !messageText.trim()}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50">
            <Mail size={16} />אימייל
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">אין הודעות עדיין</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.direction === 'נשלח' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] rounded-xl p-3 ${
              msg.direction === 'נשלח' ? 'bg-[#059669] text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'
            }`}>
              <span className={`text-xs font-medium ${msg.direction === 'נשלח' ? 'text-blue-200' : 'text-gray-500'}`}>
                {msg.channel} · {msg.direction}
              </span>
              <p className="text-sm mt-1">{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.direction === 'נשלח' ? 'text-blue-200' : 'text-gray-400'}`}>
                {formatDate(msg.sent_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderTasksTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-3">משימה חדשה</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <input className={inputClass} placeholder="תיאור המשימה..."
              value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') addTask() }} />
          </div>
          <div>
            <input className={inputClass} type="date" value={newTask.due_date}
              onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <select className={`${inputClass} bg-white`} value={newTask.priority}
              onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
              {['נמוכה', 'בינונית', 'גבוהה', 'דחופה'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={addTask}
              className="bg-[#059669] text-white px-3 py-2 rounded-lg hover:bg-[#047857] transition-colors">
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">אין משימות עדיין</p>
        )}
        {tasks.map(task => (
          <div key={task.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
            task.status === 'הושלמה' ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleTask(task)}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  task.status === 'הושלמה' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-[#059669]'
                }`}>
                {task.status === 'הושלמה' && <Check size={14} />}
              </button>
              <div>
                <p className={`text-sm ${task.status === 'הושלמה' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {task.title}
                </p>
                {task.due_date && <p className="text-xs text-gray-400">{formatDate(task.due_date)}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>{task.priority}</span>
              <button onClick={() => deleteTask(task.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderCommissionTab = () => {
    const comm = commission || { id: '', customer_id: id!, amount: 0, status: 'ממתין' as const, payment_date: null, notes: '', mortgage_id: null, created_at: '' }
    return (
      <div className="max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">סכום עמלה</label>
          <input className={inputClass} type="number" dir="ltr" value={comm.amount || 0}
            onChange={e => setCommission({ ...comm, amount: parseInt(e.target.value) || 0 })} />
          <p className="text-xs text-gray-400 mt-1">{formatCurrency(comm.amount || 0)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס תשלום</label>
          <button onClick={() => setCommission({
            ...comm,
            status: comm.status === 'ממתין' ? 'שולם' : 'ממתין',
            payment_date: comm.status === 'ממתין' ? new Date().toISOString().split('T')[0] : null,
          })}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              comm.status === 'שולם' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}>
            {comm.status === 'שולם' ? <Check size={16} /> : <CreditCard size={16} />}
            {comm.status}
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">תאריך תשלום</label>
          <input className={inputClass} type="date" value={comm.payment_date || ''}
            onChange={e => setCommission({ ...comm, payment_date: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
          <textarea className={`${inputClass} min-h-[80px]`} value={comm.notes || ''}
            onChange={e => setCommission({ ...comm, notes: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <button onClick={saveCommission} disabled={saving}
            className="inline-flex items-center gap-2 bg-[#059669] text-white px-6 py-2 rounded-lg hover:bg-[#047857] transition-colors text-sm disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            שמור שינויים
          </button>
        </div>
      </div>
    )
  }

  const tabContent: Record<TabKey, () => React.ReactNode> = {
    personal: renderPersonalTab,
    financial: renderFinancialTab,
    documents: renderDocumentsTab,
    mortgages: renderMortgagesTab,
    communication: renderCommunicationTab,
    tasks: renderTasksTab,
    commission: renderCommissionTab,
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  return (
    <div className="animate-fade-in space-y-4">
      {/* Back */}
      <button onClick={() => navigate('/customers')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#059669] transition-colors">
        <ArrowRight size={16} />חזרה לרשימת לקוחות
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#059669] text-white rounded-full flex items-center justify-center text-lg font-bold">
              {customer.first_name[0]}{customer.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{customer.first_name} {customer.last_name}</h1>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[customer.status] || 'bg-gray-100 text-gray-600'}`}>
                  {customer.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {[customer.phone, customer.email, `נוצר: ${formatDate(customer.created_at)}`].filter(Boolean).join(' | ')}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setActiveTab('communication'); setMessageText('') }}
              className="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100 transition-colors text-sm">
              <Send size={16} />שלח הודעה
            </button>
            <button
              onClick={sendQuestionnaire}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm">
              <ClipboardList size={16} />שלח שאלון
            </button>
            <button
              onClick={sendSignatureRequest}
              className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors text-sm">
              <PenTool size={16} />שלח לחתימה
            </button>
            <button onClick={() => navigate('/calculator')}
              className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 border border-purple-200 px-3 py-2 rounded-lg hover:bg-purple-100 transition-colors text-sm">
              <Calculator size={16} />צור תמהיל
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm">
              <Trash2 size={16} />מחק לקוח
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive ? 'border-[#059669] text-[#059669]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                <Icon size={16} />{tab.label}
              </button>
            )
          })}
        </div>
        <div className="p-5">{tabContent[activeTab]()}</div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        variant="danger"
        title="מחיקת לקוח"
        message="פעולה זו תמחק את הלקוח וכל הנתונים הקשורים אליו (משכנתאות, מסמכים, משימות, עמלות). פעולה זו אינה הפיכה."
        confirmText="מחק לקוח"
        loading={deleting}
        onConfirm={handleDeleteCustomer}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
