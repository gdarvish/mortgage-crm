import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MessageSquare, ClipboardList, Calculator, Upload,
  Send, Plus, Check, Mail, Phone, MapPin,
  FileText, Trash2, Loader2, Save, PenTool, Sparkles, ShieldCheck,
  ExternalLink, BarChart3,
} from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { formatCurrency, formatDate, generateToken, tokenExpiration } from '@/lib/utils'
import { validatePersonalForm, type FormErrors } from '@/utils/israeliValidations'
import { toast, ConfirmDialog } from '@/components/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useCustomer } from '@/hooks/queries/useCustomers'
import { customerService } from '@/services/customerService'
import { taskService } from '@/services/taskService'
import { messageService } from '@/services/messageService'
import { commissionService } from '@/services/commissionService'
import { documentService } from '@/services/documentService'
import { signatureService } from '@/services/signatureService'
import { useTheme } from '@/theme/ThemeContext'
import type {
  Customer, Document, Mortgage, LoanTrack, Message, Task, Commission, CustomerStatus,
  FinancialData,
} from '@/types/database'
import { AddressInput } from '@/components/AddressInput'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TabKey = 'personal' | 'financial' | 'documents' | 'mortgages' | 'communication' | 'tasks' | 'commission'

const DELIVERY_LABELS: Record<string, string> = {
  sent: '✓ נשלח',
  delivered: '✓✓ נמסר',
  read: '✓✓ נקרא',
  failed: '✗ נכשל',
}

interface Tab { key: TabKey; label: string }

interface MortgageWithTracks extends Mortgage {
  loan_tracks?: LoanTrack[]
}

// Design statusColors helper (crm-data.js) — Hebrew customer status → {bg,text}
function statusColors(status: string): { bg: string; text: string } {
  return (
    {
      'ליד': { bg: '#ede9fe', text: '#7c3aed' },
      'פגישה': { bg: '#fef3c7', text: '#b45309' },
      'מסמכים': { bg: '#ffedd5', text: '#c2410c' },
      'הגשה': { bg: '#f3e8ff', text: '#9333ea' },
      'אישור': { bg: '#d1fae5', text: '#065f46' },
      'סגירה': { bg: '#a7f3d0', text: '#064e3b' },
    }[status] || { bg: '#f1f5f9', text: '#64748b' }
  )
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const tabs: Tab[] = [
  { key: 'personal', label: 'פרטים אישיים' },
  { key: 'financial', label: 'פרטים פיננסיים' },
  { key: 'documents', label: 'מסמכים' },
  { key: 'mortgages', label: 'משכנתאות' },
  { key: 'communication', label: 'תקשורת' },
  { key: 'tasks', label: 'משימות' },
  { key: 'commission', label: 'עמלה' },
]

const statuses: CustomerStatus[] = ['ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'סגירה']

const messageTemplates = [
  'שלום {שם}, רציתי לעדכן אותך לגבי סטטוס התיק.',
  'היי {שם}, אנא שלח את המסמכים החסרים בהקדם.',
  'שלום {שם}, מצורפת הצעת תמהיל לעיונך.',
  'שלום {שם}, התיק אושר! נקבע פגישה לחתימה.',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CustomerDetailPage() {
  const t = useTheme()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('personal')
  const [saving, setSaving] = useState(false)

  const { data: full, isLoading, error: queryError } = useCustomer(id)
  const fetchError = queryError ? queryError.message : null
  const syncedFormsRef = useRef<string | null>(null)

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
  const [docToDelete, setDocToDelete] = useState<Document | null>(null)
  const [deletingDoc, setDeletingDoc] = useState(false)
  const [ocrDocId, setOcrDocId] = useState<string | null>(null)
  const [validateDocId, setValidateDocId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [aiPurpose, setAiPurpose] = useState('עדכון ללקוח')

  // BUG A2-22: clear form validation errors when navigating to a different customer
  useEffect(() => {
    setFormErrors({})
  }, [id])

  // -------------------------------------------------------------------------
  // Sync server data into local state
  // -------------------------------------------------------------------------
  const refreshCustomer = () => {
    if (id) qc.invalidateQueries({ queryKey: ['customer', id] })
  }

  // Display fields and lists always track the latest server data.
  useEffect(() => {
    if (!full) return
    setCustomer(full)
    setDocuments(full.documents || [])
    setMortgages((full.mortgages || []) as MortgageWithTracks[])
    setMessages(full.messages || [])
    setTasks(full.tasks || [])
    setCommission((full.commissions && full.commissions[0]) || null)
  }, [full])

  // Edit forms are populated once per customer so a background refetch
  // does not discard in-progress edits.
  useEffect(() => {
    if (!full || syncedFormsRef.current === full.id) return
    syncedFormsRef.current = full.id
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
  }, [full])

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
      refreshCustomer()
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
      refreshCustomer()
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
    qc.invalidateQueries({ queryKey: ['customers'] })
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
      refreshCustomer()
    }
  }

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'הושלמה' ? 'פתוחה' : 'הושלמה'
    const { error } = await taskService.update(task.id, { status: newStatus })
    if (!error) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
      refreshCustomer()
    }
  }

  const deleteTask = async (taskId: string) => {
    const { error } = await taskService.delete(taskId)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
      refreshCustomer()
    }
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingDoc(true)
    const { data } = await documentService.upload(id, file, docUploadType, 'required')
    if (data) {
      setDocuments(prev => [data, ...prev])
      refreshCustomer()
    }
    setUploadingDoc(false)
    e.target.value = ''
  }

  const handleDeleteDocument = async () => {
    if (!docToDelete || !id) return
    setDeletingDoc(true)
    try {
      const { error } = await documentService.delete(docToDelete.id)
      if (error) {
        toast.error('שגיאה במחיקת מסמך', error.message)
      } else {
        setDocuments(prev => prev.filter(d => d.id !== docToDelete.id))
        qc.invalidateQueries({ queryKey: ['documents', id] })
        toast.success('המסמך נמחק')
      }
    } finally {
      setDeletingDoc(false)
      setDocToDelete(null)
    }
  }

  const handleOcr = async (docId: string) => {
    setOcrDocId(docId)
    try {
      const ocrFn = httpsCallable(functions, 'ocrPayslip')
      const res = await ocrFn({ document_id: docId })
      const data = res.data as { gross_salary?: number | null; net_salary?: number | null }
      toast.success(
        'הנתונים חולצו מהמסמך',
        `ברוטו: ${data.gross_salary ?? '—'} · נטו: ${data.net_salary ?? '—'}`
      )
      if (typeof data.net_salary === 'number') {
        setFinancial(prev => ({ ...prev, monthly_income: data.net_salary as number }))
      }
    } catch (e) {
      toast.error('שגיאה בחילוץ נתונים', e instanceof Error ? e.message : undefined)
    } finally {
      setOcrDocId(null)
    }
  }

  const handleValidateDoc = async (docId: string) => {
    setValidateDocId(docId)
    try {
      const validateFn = httpsCallable(functions, 'validateDocument')
      const res = await validateFn({ document_id: docId })
      const r = res.data as { status: string; findings: string; document_type: string }
      if (r.status === 'valid') {
        toast.success('המסמך תקין', r.findings)
      } else {
        toast.error(r.status === 'issue' ? 'נמצאה בעיה במסמך' : 'המסמך אינו ברור', r.findings)
      }
    } catch (e) {
      toast.error('שגיאה בבדיקת המסמך', e instanceof Error ? e.message : undefined)
    } finally {
      setValidateDocId(null)
    }
  }

  const handleCompose = async () => {
    if (!id) return
    setComposing(true)
    try {
      const composeFn = httpsCallable(functions, 'composeMessage')
      const res = await composeFn({ customer_id: id, purpose: aiPurpose, tone: 'מקצועי וידידותי' })
      const { message } = res.data as { message: string }
      setMessageText(message)
      toast.success('ההודעה נוסחה', 'ניתן לערוך לפני השליחה')
    } catch (e) {
      toast.error('שגיאה בניסוח ההודעה', e instanceof Error ? e.message : undefined)
    } finally {
      setComposing(false)
    }
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
      refreshCustomer()
    }
    setSendingMsg(false)
  }

  const sendViaWhatsApp = async () => {
    if (!messageText.trim() || !id) return
    setSendingMsg(true)
    try {
      const waFn = httpsCallable(functions, 'sendWhatsAppMessage')
      await waFn({ customer_id: id, text: messageText })
      const { data } = await messageService.getByCustomer(id)
      if (data) setMessages(data)
      setMessageText('')
      refreshCustomer()
      toast.success('ההודעה נשלחה בוואטסאפ')
    } catch (e) {
      toast.error('שגיאה בשליחת WhatsApp', e instanceof Error ? e.message : undefined)
    } finally {
      setSendingMsg(false)
    }
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
    refreshCustomer()
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
    refreshCustomer()
    setSaving(false)
  }

  // -------------------------------------------------------------------------
  // Shared styles
  // -------------------------------------------------------------------------
  const card: React.CSSProperties = {
    background: t.cardBg, borderRadius: 18, padding: '22px 24px',
    boxShadow: t.shadow, border: `1px solid ${t.border}`,
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5,
  }
  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: `1.5px solid ${t.border}`,
    borderRadius: 9, fontSize: 14, color: t.text, background: t.inputBg,
    outline: 'none', fontFamily: 'Heebo,sans-serif',
  }
  const errInputSt = (hasErr: boolean): React.CSSProperties => ({
    ...inputSt, border: `1.5px solid ${hasErr ? t.danger : t.border}`,
  })
  const primaryBtn: React.CSSProperties = {
    background: t.primary, color: '#fff', border: 'none', borderRadius: 12,
    padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'Heebo,sans-serif', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, boxShadow: `0 4px 14px ${t.primary}45`,
  }
  const fieldRowClass: Record<number, string> = {
    2: 'grid grid-cols-1 sm:grid-cols-2',
    3: 'grid grid-cols-1 sm:grid-cols-3',
    4: 'grid grid-cols-1 sm:grid-cols-4',
  }
  const fieldRow = (cells: number): string => fieldRowClass[cells] ?? 'grid grid-cols-1'
  const fieldRowStyle: React.CSSProperties = { gap: 14 }

  // -------------------------------------------------------------------------
  // Loading / not found
  // -------------------------------------------------------------------------
  if (isLoading || (full && !customer)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <Loader2 size={32} style={{ color: t.primary }} className="animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: t.textMuted }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: t.textSub }}>לקוח לא נמצא</p>
        {fetchError && <p style={{ fontSize: 12, color: t.danger, marginTop: 8 }}>{fetchError}</p>}
        <button
          onClick={() => navigate('/customers')}
          style={{
            display: 'block', margin: '16px auto 0', background: 'none', border: 'none',
            color: t.primary, fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo,sans-serif',
          }}
        >
          חזרה לרשימת לקוחות
        </button>
      </div>
    )
  }

  const sc = statusColors(customer.status)
  const familyIncome = (customer.monthly_income || 0) + (customer.partner_income || 0)
  // Loan amount surfaced from the customer's mortgages (real data).
  const totalLoanAmount = mortgages.reduce(
    (s, m) => s + (m.loan_amount || (m.loan_tracks || []).reduce((ts, tr) => ts + (tr.amount || 0), 0)),
    0
  )

  // -------------------------------------------------------------------------
  // Tab renderers
  // -------------------------------------------------------------------------
  const renderPersonalTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Status selector */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 14 }}>סטטוס לקוח</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {statuses.map(s => {
            const ssc = statusColors(s)
            const active = statusValue === s
            return (
              <button
                key={s}
                onClick={() => setStatusValue(s)}
                className="crm-btn"
                style={{
                  padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10,
                  cursor: 'pointer', fontFamily: 'Heebo,sans-serif',
                  background: active ? ssc.bg : t.pillBg,
                  color: active ? ssc.text : t.textSub,
                  border: `1px solid ${active ? ssc.text + '50' : 'transparent'}`,
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>פרטים אישיים</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className={fieldRow(2)} style={fieldRowStyle}>
            <div>
              <label style={label}>שם פרטי</label>
              <input
                style={errInputSt(!!formErrors.first_name)}
                value={personal.first_name}
                onChange={e => setPersonal({ ...personal, first_name: e.target.value })}
              />
              {formErrors.first_name && <p style={{ fontSize: 11, color: t.danger, marginTop: 4 }}>{formErrors.first_name}</p>}
            </div>
            <div>
              <label style={label}>שם משפחה</label>
              <input
                style={errInputSt(!!formErrors.last_name)}
                value={personal.last_name}
                onChange={e => setPersonal({ ...personal, last_name: e.target.value })}
              />
              {formErrors.last_name && <p style={{ fontSize: 11, color: t.danger, marginTop: 4 }}>{formErrors.last_name}</p>}
            </div>
          </div>
          <div className={fieldRow(2)} style={fieldRowStyle}>
            <div>
              <label style={label}>ת.ז</label>
              <input
                style={errInputSt(!!formErrors.id_number)}
                dir="ltr"
                value={personal.id_number}
                onChange={e => setPersonal({ ...personal, id_number: e.target.value })}
              />
              {formErrors.id_number && <p style={{ fontSize: 11, color: t.danger, marginTop: 4 }}>{formErrors.id_number}</p>}
            </div>
            <div>
              <label style={label}>טלפון</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                  <Phone size={15} color={t.textMuted} />
                </span>
                <input
                  style={{ ...errInputSt(!!formErrors.phone), paddingRight: 34 }}
                  dir="ltr"
                  value={personal.phone}
                  onChange={e => setPersonal({ ...personal, phone: e.target.value })}
                />
              </div>
              {formErrors.phone && <p style={{ fontSize: 11, color: t.danger, marginTop: 4 }}>{formErrors.phone}</p>}
            </div>
          </div>
          <div className={fieldRow(2)} style={fieldRowStyle}>
            <div>
              <label style={label}>אימייל</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                  <Mail size={15} color={t.textMuted} />
                </span>
                <input
                  style={{ ...errInputSt(!!formErrors.email), paddingRight: 34 }}
                  dir="ltr"
                  type="email"
                  value={personal.email}
                  onChange={e => setPersonal({ ...personal, email: e.target.value })}
                />
              </div>
              {formErrors.email && <p style={{ fontSize: 11, color: t.danger, marginTop: 4 }}>{formErrors.email}</p>}
            </div>
            <div>
              <AddressInput
                label="כתובת"
                value={personal.address ?? ''}
                onChange={v => setPersonal({ ...personal, address: v })}
                placeholder="התחל להקליד כתובת..."
                icon={<MapPin size={16} />}
              />
            </div>
          </div>
          <div className={fieldRow(2)} style={fieldRowStyle}>
            <div>
              <label style={label}>מצב משפחתי</label>
              <select
                style={inputSt}
                value={personal.marital_status}
                onChange={e => setPersonal({ ...personal, marital_status: e.target.value })}
              >
                <option value="רווק">רווק</option>
                <option value="נשוי">נשוי</option>
                <option value="גרוש">גרוש</option>
                <option value="אלמן">אלמן</option>
              </select>
            </div>
            <div>
              <label style={label}>ילדים</label>
              <input
                style={inputSt}
                type="number"
                min={0}
                dir="ltr"
                value={personal.children}
                onChange={e => setPersonal({ ...personal, children: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={savePersonal} disabled={saving} className="crm-btn-primary" style={{ ...primaryBtn, opacity: saving ? 0.5 : 1 }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              שמור שינויים
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderFinancialTab = () => {
    const fd = (customer.financial_data ?? null) as FinancialData | null
    const fdIncome = (fd?.income1 ?? 0) + (fd?.income2 ?? 0)
    const fdExpensesTotal = (fd?.expenses ?? []).reduce((s, e) => s + (e.amount || 0), 0)
    const fdExpensesWithMortgage = fdExpensesTotal + (fd?.mortgagePayment ?? 0)
    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>מידע פיננסי</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className={fieldRow(2)} style={fieldRowStyle}>
          <div>
            <label style={label}>הכנסה חודשית</label>
            <input style={inputSt} type="number" dir="ltr" value={financial.monthly_income}
              onChange={e => setFinancial({ ...financial, monthly_income: parseInt(e.target.value) || 0 })} />
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{formatCurrency(financial.monthly_income)}</p>
          </div>
          <div>
            <label style={label}>הכנסת בן/בת זוג</label>
            <input style={inputSt} type="number" dir="ltr" value={financial.partner_income}
              onChange={e => setFinancial({ ...financial, partner_income: parseInt(e.target.value) || 0 })} />
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{formatCurrency(financial.partner_income)}</p>
          </div>
        </div>
        <div className={fieldRow(2)} style={fieldRowStyle}>
          <div>
            <label style={label}>הון עצמי</label>
            <input style={inputSt} type="number" dir="ltr" value={financial.own_capital}
              onChange={e => setFinancial({ ...financial, own_capital: parseInt(e.target.value) || 0 })} />
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{formatCurrency(financial.own_capital)}</p>
          </div>
          <div>
            <label style={label}>התחייבויות קיימות</label>
            <input style={inputSt} type="number" dir="ltr" value={financial.existing_obligations}
              onChange={e => setFinancial({ ...financial, existing_obligations: parseInt(e.target.value) || 0 })} />
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{formatCurrency(financial.existing_obligations)}</p>
          </div>
        </div>
        <div className={fieldRow(2)} style={fieldRowStyle}>
          <div>
            <label style={label}>מקור הגעה</label>
            <select style={inputSt} value={financial.lead_source}
              onChange={e => setFinancial({ ...financial, lead_source: e.target.value })}>
              <option value="">בחר...</option>
              {['הפניה', 'פייסבוק', 'אינסטגרם', 'אתר', 'וואטסאפ', 'טלפון'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ background: t.primary + '14', borderRadius: 12, padding: '10px 14px', width: '100%' }}>
              <p style={{ fontSize: 12, color: t.primary, fontWeight: 600 }}>סה"כ הכנסה משפחתית</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: t.text }}>
                {formatCurrency(financial.monthly_income + financial.partner_income)}
              </p>
            </div>
          </div>
        </div>
        <div>
          <label style={label}>הערות</label>
          <textarea style={{ ...inputSt, minHeight: 80, resize: 'vertical' }} value={financial.notes}
            onChange={e => setFinancial({ ...financial, notes: e.target.value })} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <button onClick={saveFinancial} disabled={saving} className="crm-btn-primary" style={{ ...primaryBtn, opacity: saving ? 0.5 : 1 }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            שמור שינויים
          </button>
        </div>
      </div>
    </div>
    {fd && (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text }}>נתונים מ-כלכלת המשפחה</h3>
          <button
            onClick={() => navigate(`/family-economics?customerId=${customer.id}`)}
            className="crm-btn"
            style={{
              background: t.primary + '14', color: t.primary, border: 'none', borderRadius: 10,
              padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Heebo,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <ExternalLink size={13} />
            ערוך בכלכלת המשפחה
          </button>
        </div>
        {fd.updated_at && (
          <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 12 }}>
            עודכן לאחרונה: {formatDate(fd.updated_at)}
          </p>
        )}
        <div className={fieldRow(2)} style={{ ...fieldRowStyle, marginBottom: 14 }}>
          <div style={{ background: t.successBg, borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 12, color: t.success, fontWeight: 600 }}>סה"כ הכנסה חודשית</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{formatCurrency(fdIncome)}</p>
          </div>
          <div style={{ background: t.warningBg, borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 12, color: t.warning, fontWeight: 600 }}>סה"כ הוצאות חודשיות</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{formatCurrency(fdExpensesWithMortgage)}</p>
          </div>
        </div>
        {(fd.expenses && fd.expenses.length > 0) || (fd.mortgagePayment ?? 0) > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>פירוט הוצאות</p>
            {(fd.expenses ?? []).map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.textSub, padding: '4px 0', borderBottom: `1px solid ${t.borderLight}` }}>
                <span>{e.category}</span>
                <span style={{ fontWeight: 600, color: t.text }}>{formatCurrency(e.amount)}</span>
              </div>
            ))}
            {(fd.mortgagePayment ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.textSub, padding: '4px 0' }}>
                <span>משכנתא</span>
                <span style={{ fontWeight: 600, color: t.primary }}>{formatCurrency(fd.mortgagePayment ?? 0)}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    )}
    </div>
  )
  }

  const renderDocumentsTab = () => {
    const docStatusColors: Record<string, { bg: string; text: string }> = {
      'תקין': { bg: t.successBg, text: t.success },
      'ממתין': { bg: t.warningBg, text: t.warning },
      'חסר': { bg: t.dangerBg, text: t.danger },
      'פג תוקף': { bg: t.dangerBg, text: t.danger },
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <p style={{ fontSize: 13, color: t.textMuted }}>
            {documents.filter(d => d.status === 'תקין').length} / {documents.length} מסמכים תקינים
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={docUploadType}
              onChange={e => setDocUploadType(e.target.value)}
              style={{ ...inputSt, width: 'auto', padding: '7px 10px', fontSize: 12 }}
            >
              {['תעודת זהות + ספח', '3 תלושי שכר', 'הסכם רכישה', 'נסח טאבו', 'דוח פלאש BDI', 'אחר'].map(ty => <option key={ty}>{ty}</option>)}
            </select>
            <input type="file" hidden ref={docFileInputRef} onChange={handleDocUpload} />
            <button
              onClick={() => docFileInputRef.current?.click()}
              disabled={uploadingDoc}
              className="crm-btn-primary"
              style={{ ...primaryBtn, padding: '8px 14px', fontSize: 13, opacity: uploadingDoc ? 0.5 : 1 }}
            >
              {uploadingDoc ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              העלאה
            </button>
          </div>
        </div>
        {documents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: t.textMuted }}>
            <FileText size={36} style={{ color: t.border, margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13 }}>אין מסמכים עדיין</p>
          </div>
        )}
        {documents.map((doc, i) => {
          const ds = docStatusColors[doc.status] || { bg: t.pillBg, text: t.textSub }
          return (
            <div
              key={doc.id}
              style={{
                background: t.cardBg, borderRadius: 14, padding: '14px 18px',
                boxShadow: t.shadow, border: `1px solid ${t.border}`,
                display: 'flex', alignItems: 'center', gap: 14,
                animation: `fadeUp 0.4s ease ${i * 0.06}s backwards`,
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 11, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={17} color={t.textMuted} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{doc.type}</p>
                <p style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {doc.uploaded_at ? `הועלה: ${formatDate(doc.uploaded_at)}` : ''}
                  {doc.file_name ? ` · ${doc.file_name}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: t.primary, fontWeight: 600, textDecoration: 'none' }}>צפה</a>
                )}
                <button
                  onClick={() => handleOcr(doc.id)}
                  disabled={ocrDocId === doc.id}
                  className="crm-btn"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: t.primary, fontFamily: 'Heebo,sans-serif', opacity: ocrDocId === doc.id ? 0.5 : 1 }}
                >
                  {ocrDocId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  חלץ נתונים
                </button>
                <button
                  onClick={() => handleValidateDoc(doc.id)}
                  disabled={validateDocId === doc.id}
                  className="crm-btn"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: t.primary, fontFamily: 'Heebo,sans-serif', opacity: validateDocId === doc.id ? 0.5 : 1 }}
                >
                  {validateDocId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  בדוק תקינות
                </button>
                <span style={{ padding: '4px 12px', borderRadius: 20, background: ds.bg, color: ds.text, fontSize: 12, fontWeight: 600 }}>
                  {doc.status}
                </span>
                <button
                  onClick={() => setDocToDelete(doc)}
                  className="crm-btn"
                  title="מחק מסמך"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.danger, display: 'flex', flexShrink: 0 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderMortgagesTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {mortgages.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '48px 24px', color: t.textMuted }}>
          <BarChart3 size={36} style={{ color: t.border, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13 }}>אין תמהילים עדיין</p>
        </div>
      )}
      {mortgages.map((mortgage, mi) => {
        const tracks = mortgage.loan_tracks || []
        const totalAmount = tracks.reduce((s, tr) => s + (tr.amount || 0), 0)
        const totalPayment = tracks.reduce((s, tr) => s + (tr.monthly_payment || 0), 0)
        const mStatusColors: Record<string, { bg: string; text: string }> = {
          'אושר': { bg: t.successBg, text: t.success },
          'הוגש': { bg: '#f3e8ff', text: '#9333ea' },
        }
        const ms = mStatusColors[mortgage.status] || { bg: t.pillBg, text: t.textSub }
        return (
          <div key={mortgage.id} style={{ ...card, padding: '20px 24px', animation: `fadeUp 0.4s ease ${mi * 0.1}s backwards` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.primary }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{mortgage.name || `משכנתא ${mortgage.type}`}</span>
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: ms.bg, color: ms.text, fontSize: 11, fontWeight: 600 }}>
                    {mortgage.status}
                  </span>
                </div>
                {mortgage.property_address && (
                  <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <MapPin size={12} />
                    {mortgage.property_address}
                  </p>
                )}
                <p style={{ fontSize: 13, color: t.textMuted, marginTop: 6 }}>
                  {mortgage.property_price ? `מחיר נכס: ${formatCurrency(mortgage.property_price)}` : ''}
                  {mortgage.property_price && mortgage.loan_amount ? ' · ' : ''}
                  {mortgage.loan_amount ? `סכום הלוואה: ${formatCurrency(mortgage.loan_amount)}` : ''}
                </p>
              </div>
              <button
                onClick={() => navigate('/calculator')}
                className="crm-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: t.primary, fontWeight: 600, fontFamily: 'Heebo,sans-serif' }}
              >
                <ExternalLink size={14} /> מחשבון
              </button>
            </div>
            {tracks.length > 0 && (
              <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                    {['מסלול', 'סכום', 'ריבית', 'תקופה', 'תאריך משיכה', 'תאריך סיום', 'החזר חודשי'].map(h => (
                      <th key={h} style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, fontWeight: 700, color: t.textMuted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tracks.map(track => (
                    <tr key={track.id} style={{ borderBottom: `1px solid ${t.borderLight}` }}>
                      <td style={{ padding: '9px 6px', color: t.text, fontWeight: 600 }}>{track.type}</td>
                      <td style={{ padding: '9px 6px', color: t.textSub }}>{track.amount ? formatCurrency(track.amount) : '—'}</td>
                      <td style={{ padding: '9px 6px', color: t.textSub }} dir="ltr">{track.interest_rate ? `${track.interest_rate}%` : '—'}</td>
                      <td style={{ padding: '9px 6px', color: t.textSub }}>{track.period_months ? `${track.period_months} חודשים` : '—'}</td>
                      <td style={{ padding: '9px 6px', color: t.textSub }}>{track.start_date ? formatDate(track.start_date) : '—'}</td>
                      <td style={{ padding: '9px 6px', color: t.textSub }}>{track.end_date ? formatDate(track.end_date) : '—'}</td>
                      <td style={{ padding: '9px 6px', color: t.text, fontWeight: 600 }}>{track.monthly_payment ? formatCurrency(track.monthly_payment) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: t.primary + '14' }}>
                    <td style={{ padding: '9px 6px', fontWeight: 800, color: t.text }}>סה"כ</td>
                    <td style={{ padding: '9px 6px', fontWeight: 800, color: t.primary }}>{formatCurrency(totalAmount)}</td>
                    <td /><td /><td /><td />
                    <td style={{ padding: '9px 6px', fontWeight: 800, color: t.primary }}>{formatCurrency(totalPayment)}</td>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <select
            style={{ ...inputSt, maxWidth: 320 }}
            value=""
            onChange={e => { if (e.target.value) setMessageText(e.target.value.replace('{שם}', customer.first_name)) }}
          >
            <option value="">בחר תבנית...</option>
            {messageTemplates.map((tpl, i) => (
              <option key={i} value={tpl}>{tpl.slice(0, 45)}...</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <select
            value={aiPurpose}
            onChange={e => setAiPurpose(e.target.value)}
            style={{ ...inputSt, maxWidth: 180 }}
          >
            {['עדכון ללקוח', 'תזכורת לפגישה', 'בקשת מסמכים', 'מעקב סטטוס', 'ברכה'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={handleCompose}
            disabled={composing}
            className="crm-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', fontFamily: 'Heebo,sans-serif',
              background: t.accentBg, color: t.accent, opacity: composing ? 0.5 : 1,
            }}
          >
            {composing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            נסח עם AI
          </button>
        </div>
        <textarea
          style={{ ...inputSt, minHeight: 80, resize: 'vertical' }}
          placeholder="הקלד הודעה..."
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={sendViaWhatsApp}
            disabled={sendingMsg || !messageText.trim()}
            className="crm-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none',
              fontFamily: 'Heebo,sans-serif', background: t.success, color: '#fff',
              opacity: sendingMsg || !messageText.trim() ? 0.5 : 1,
            }}
          >
            <MessageSquare size={16} /> WhatsApp
          </button>
          <button
            onClick={() => sendMessage('אימייל')}
            disabled={sendingMsg || !messageText.trim()}
            className="crm-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none',
              fontFamily: 'Heebo,sans-serif', background: t.info, color: '#fff',
              opacity: sendingMsg || !messageText.trim() ? 0.5 : 1,
            }}
          >
            <Mail size={16} /> אימייל
          </button>
        </div>
      </div>

      <div style={{ ...card }}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 13, color: t.textMuted, padding: '24px 0' }}>אין הודעות עדיין</p>
        )}
        {messages.map((msg, i) => {
          const out = msg.direction === 'נשלח'
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex', justifyContent: out ? 'flex-start' : 'flex-end', marginBottom: 14,
                animation: `fadeUp 0.35s ease ${i * 0.06}s backwards`,
              }}
            >
              <div style={{
                maxWidth: '70%', padding: '12px 16px', borderRadius: 14,
                background: out ? t.bg : t.primary + '18',
                border: `1px solid ${t.border}`,
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>
                  {msg.channel} · {msg.direction}
                </span>
                <p style={{ fontSize: 14, color: t.text, marginTop: 4 }}>{msg.content}</p>
                <p style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>
                  {formatDate(msg.sent_at)}
                  {out && msg.delivery_status && msg.delivery_status !== 'received' && (
                    <> · {DELIVERY_LABELS[msg.delivery_status] ?? msg.delivery_status}</>
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderTasksTab = () => {
    const priorityColors: Record<string, { bg: string; text: string }> = {
      'נמוכה': { bg: t.pillBg, text: t.textSub },
      'בינונית': { bg: t.infoBg, text: t.info },
      'גבוהה': { bg: t.warningBg, text: t.warning },
      'דחופה': { bg: t.dangerBg, text: t.danger },
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 14 }}>משימה חדשה</h3>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_auto]" style={{ gap: 10 }}>
            <input
              style={inputSt}
              placeholder="תיאור המשימה..."
              value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') addTask() }}
            />
            <input
              style={inputSt}
              type="date"
              value={newTask.due_date}
              onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
            />
            <select
              style={inputSt}
              value={newTask.priority}
              onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
            >
              {['נמוכה', 'בינונית', 'גבוהה', 'דחופה'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={addTask} className="crm-btn-primary" style={{ ...primaryBtn, padding: '0 14px' }}>
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: t.textMuted, padding: '24px 0' }}>אין משימות עדיין</p>
          )}
          {tasks.map((task, i) => {
            const done = task.status === 'הושלמה'
            const pc = priorityColors[task.priority] || { bg: t.pillBg, text: t.textSub }
            return (
              <div
                key={task.id}
                style={{
                  background: t.cardBg, borderRadius: 14, padding: '14px 18px',
                  boxShadow: t.shadow, border: `1px solid ${t.border}`,
                  display: 'flex', alignItems: 'center', gap: 14, opacity: done ? 0.55 : 1,
                  animation: `fadeUp 0.4s ease ${i * 0.05}s backwards`,
                }}
              >
                <button
                  onClick={() => toggleTask(task)}
                  className="crm-btn"
                  style={{
                    width: 21, height: 21, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${done ? t.primary : t.border}`,
                    background: done ? t.primary : 'transparent',
                  }}
                >
                  {done && <Check size={12} color="#fff" strokeWidth={3} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: t.text, textDecoration: done ? 'line-through' : 'none' }}>
                    {task.title}
                  </p>
                  {task.due_date && <p style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{formatDate(task.due_date)}</p>}
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 20, background: pc.bg, color: pc.text, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  {task.priority}
                </span>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="crm-btn"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', flexShrink: 0 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderCommissionTab = () => {
    const comm = commission || {
      id: '', customer_id: id!, amount: 0, status: 'ממתין' as const,
      payment_date: null, notes: '', mortgage_id: null, created_at: '',
    }
    const paid = comm.status === 'שולם'
    return (
      <div style={{ ...card, maxWidth: 520 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>פרטי עמלה</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>סכום עמלה</label>
            <input style={inputSt} type="number" dir="ltr" value={comm.amount || 0}
              onChange={e => setCommission({ ...comm, amount: parseInt(e.target.value) || 0 })} />
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{formatCurrency(comm.amount || 0)}</p>
          </div>
          <div>
            <label style={label}>סטטוס תשלום</label>
            <div>
              <button
                onClick={() => setCommission({
                  ...comm,
                  status: paid ? 'ממתין' : 'שולם',
                  payment_date: paid ? null : new Date().toISOString().split('T')[0],
                })}
                className="crm-btn"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                  borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                  fontFamily: 'Heebo,sans-serif',
                  background: paid ? t.successBg : t.warningBg,
                  color: paid ? t.success : t.warning,
                }}
              >
                {paid ? <Check size={15} /> : <Loader2 size={15} />}
                {comm.status}
              </button>
            </div>
          </div>
          <div>
            <label style={label}>תאריך תשלום</label>
            <input style={inputSt} type="date" value={comm.payment_date || ''}
              onChange={e => setCommission({ ...comm, payment_date: e.target.value })} />
          </div>
          <div>
            <label style={label}>הערות</label>
            <textarea style={{ ...inputSt, minHeight: 80, resize: 'vertical' }} value={comm.notes || ''}
              onChange={e => setCommission({ ...comm, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={saveCommission} disabled={saving} className="crm-btn-primary" style={{ ...primaryBtn, opacity: saving ? 0.5 : 1 }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              שמור שינויים
            </button>
          </div>
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
  // Header action buttons
  // -------------------------------------------------------------------------
  const heroActions: { label: string; icon: React.ReactNode; bg: string; fg: string; onClick: () => void }[] = [
    { label: 'שלח הודעה', icon: <Send size={15} />, bg: t.successBg, fg: t.success, onClick: () => { setActiveTab('communication'); setMessageText('') } },
    { label: 'שלח שאלון', icon: <ClipboardList size={15} />, bg: t.infoBg, fg: t.info, onClick: sendQuestionnaire },
    { label: 'שלח לחתימה', icon: <PenTool size={15} />, bg: t.accentBg, fg: t.accent, onClick: sendSignatureRequest },
    { label: 'צור תמהיל', icon: <Calculator size={15} />, bg: '#f3e8ff', fg: '#9333ea', onClick: () => navigate('/calculator') },
    { label: 'מחק לקוח', icon: <Trash2 size={15} />, bg: t.dangerBg, fg: t.danger, onClick: () => setShowDeleteConfirm(true) },
  ]

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        {/* Back */}
        <button
          onClick={() => navigate('/customers')}
          className="crm-btn"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: t.textMuted, fontSize: 13, marginBottom: 20,
            fontFamily: 'Heebo,sans-serif', borderRadius: 8, padding: '4px 8px',
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.background = t.bg }}
          onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.background = 'transparent' }}
        >
          ← חזרה ללקוחות
        </button>

        {/* Hero */}
        <div
          style={{
            background: t.cardBg, borderRadius: 20, padding: '24px 28px',
            boxShadow: t.shadow, border: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22,
            flexWrap: 'wrap',
            animation: 'fadeUp 0.4s ease 0.05s backwards',
          }}
        >
          <div
            style={{
              width: 64, height: 64, borderRadius: 18,
              background: t.primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: t.primary, flexShrink: 0,
            }}
          >
            {customer.first_name.charAt(0)}{customer.last_name.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{customer.first_name} {customer.last_name}</h2>
              <span style={{ padding: '4px 14px', borderRadius: 20, background: sc.bg, color: sc.text, fontSize: 13, fontWeight: 600 }}>
                {customer.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {customer.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.textSub }}>
                  <Phone size={13} color={t.textMuted} />
                  <span dir="ltr">{customer.phone}</span>
                </span>
              )}
              {customer.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.textSub }}>
                  <Mail size={13} color={t.textMuted} />
                  <span dir="ltr">{customer.email}</span>
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.textSub }}>
                <BarChart3 size={13} color={t.textMuted} />
                <span>הכנסה: {formatCurrency(familyIncome)}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.textSub }}>
                <ClipboardList size={13} color={t.textMuted} />
                <span>נוצר: {formatDate(customer.created_at)}</span>
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 10px' }}>
            <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>סכום הלוואה</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: t.primary }}>
              {totalLoanAmount > 0 ? formatCurrency(totalLoanAmount) : '—'}
            </p>
          </div>
        </div>

        {/* Hero action buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, animation: 'fadeUp 0.4s ease 0.08s backwards' }}>
          {heroActions.map(a => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="crm-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Heebo,sans-serif', background: a.bg, color: a.fg,
                border: `1px solid ${a.fg}30`,
              }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>

        {/* Tab bar */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex', gap: 4, marginBottom: 20,
            background: t.cardBg, borderRadius: 14, padding: 6,
            boxShadow: t.shadow, border: `1px solid ${t.border}`, width: 'fit-content',
            maxWidth: '100%', overflowX: 'auto',
            animation: 'fadeUp 0.4s ease 0.1s backwards',
          }}
        >
          {tabs.map(tb => {
            const active = activeTab === tb.key
            return (
              <button
                key={tb.key}
                onClick={() => setActiveTab(tb.key)}
                className="crm-btn"
                style={{
                  background: active ? t.primary : 'transparent',
                  color: active ? '#fff' : t.textSub,
                  border: 'none', borderRadius: 9,
                  padding: '8px 18px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Heebo,sans-serif', whiteSpace: 'nowrap',
                  transition: 'all 0.18s ease',
                  boxShadow: active ? `0 2px 8px ${t.primary}40` : 'none',
                }}
              >
                {tb.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div key={activeTab} style={{ animation: 'fadeUp 0.3s ease backwards' }}>
          {tabContent[activeTab]()}
        </div>
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

      {/* BUG A2-12: Delete document confirm dialog */}
      <ConfirmDialog
        open={!!docToDelete}
        variant="danger"
        title="מחיקת מסמך"
        message={`למחוק את המסמך "${docToDelete?.type || ''}"? פעולה זו אינה הפיכה.`}
        confirmText="מחק מסמך"
        loading={deletingDoc}
        onConfirm={handleDeleteDocument}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  )
}
