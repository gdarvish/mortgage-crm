import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  MessageSquare,
  ClipboardList,
  Calculator,
  Upload,
  Send,
  Plus,
  Check,
  Mail,
  Phone,
  MapPin,
  User,
  CreditCard,
  FileText,
  Home,
  MessagesSquare,
  ListTodo,
  Banknote,
  ExternalLink,
  Trash2,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TabKey =
  | 'personal'
  | 'financial'
  | 'documents'
  | 'mortgages'
  | 'communication'
  | 'tasks'
  | 'commission'

interface Tab {
  key: TabKey
  label: string
  icon: React.ElementType
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

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------
const mockCustomer = {
  id: '1',
  first_name: 'יוסי',
  last_name: 'כהן',
  id_number: '012345678',
  phone: '050-1234567',
  email: 'yossi@example.com',
  address: 'רחוב הרצל 15, תל אביב',
  marital_status: 'נשוי',
  children: 2,
  monthly_income: 18000,
  partner_income: 12000,
  own_capital: 350000,
  existing_obligations: 1200,
  lead_source: 'הפניה',
  status: 'מסמכים',
  notes: 'לקוח רציני, מעוניין בדירה ראשונה',
  created_at: '2026-03-15',
}

const mockDocuments = [
  { id: '1', type: 'תעודת זהות', status: 'תקין' as const, uploaded_at: '2026-03-16' },
  { id: '2', type: 'תלושי שכר (3 אחרונים)', status: 'תקין' as const, uploaded_at: '2026-03-16' },
  { id: '3', type: 'אישור ניהול חשבון', status: 'ממתין' as const, uploaded_at: null },
  { id: '4', type: 'דו"ח עו"ש 6 חודשים', status: 'ממתין' as const, uploaded_at: null },
  { id: '5', type: 'שומת מס', status: 'חסר' as const, uploaded_at: null },
  { id: '6', type: 'חוזה רכישה', status: 'חסר' as const, uploaded_at: null },
  { id: '7', type: 'אישור זכויות / נסח טאבו', status: 'תקין' as const, uploaded_at: '2026-03-18' },
]

const mockMortgages = [
  {
    id: '1',
    type: 'חדשה',
    property_price: 1800000,
    loan_amount: 900000,
    status: 'הוגש',
    created_at: '2026-03-20',
    tracks: [
      { id: '1', type: 'פריים', amount: 300000, interest_rate: 1.5, period_months: 240, monthly_payment: 1448 },
      { id: '2', type: 'קל"צ', amount: 350000, interest_rate: 3.8, period_months: 300, monthly_payment: 1820 },
      { id: '3', type: 'משתנה_לא_צמודה', amount: 250000, interest_rate: 4.2, period_months: 180, monthly_payment: 1878 },
    ],
  },
]

const mockMessages = [
  { id: '1', channel: 'וואטסאפ' as const, direction: 'נשלח' as const, content: 'שלום יוסי, מצורף קישור למילוי שאלון.', sent_at: '2026-03-16T10:30:00' },
  { id: '2', channel: 'וואטסאפ' as const, direction: 'התקבל' as const, content: 'תודה רבה, מילאתי את השאלון.', sent_at: '2026-03-16T14:22:00' },
  { id: '3', channel: 'אימייל' as const, direction: 'נשלח' as const, content: 'שלום יוסי, רציתי לעדכן שהתיק הוגש לבנק. נעדכן בהמשך.', sent_at: '2026-03-20T09:15:00' },
  { id: '4', channel: 'וואטסאפ' as const, direction: 'נשלח' as const, content: 'היי יוסי, אנא שלח אישור ניהול חשבון ודוח עו"ש.', sent_at: '2026-03-25T11:00:00' },
]

const mockTasks = [
  { id: '1', title: 'להתקשר ללקוח - מסמכים חסרים', due_date: '2026-04-05', priority: 'גבוהה' as const, status: 'פתוחה' as const },
  { id: '2', title: 'לשלוח הצעת תמהיל מעודכנת', due_date: '2026-04-06', priority: 'בינונית' as const, status: 'פתוחה' as const },
  { id: '3', title: 'לקבוע פגישה לחתימה', due_date: '2026-04-10', priority: 'נמוכה' as const, status: 'פתוחה' as const },
  { id: '4', title: 'להגיש תיק לבנק לאומי', due_date: '2026-03-19', priority: 'דחופה' as const, status: 'הושלמה' as const },
]

const mockCommission = {
  amount: 9000,
  status: 'ממתין' as const,
  payment_date: null as string | null,
  notes: 'עמלה עבור תיק משכנתא 900,000 ש"ח',
}

const messageTemplates = [
  'שלום {שם}, רציתי לעדכן אותך לגבי סטטוס התיק.',
  'היי {שם}, אנא שלח את המסמכים החסרים בהקדם.',
  'שלום {שם}, מצורפת הצעת תמהיל לעיונך.',
  'שלום {שם}, התיק אושר! נקבע פגישה לחתימה.',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const docStatusIcon = (status: string) => {
  if (status === 'תקין') return '✅'
  if (status === 'ממתין') return '🟡'
  return '🔴'
}

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] focus:border-transparent outline-none text-sm'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('personal')

  // Editable personal details
  const [personal, setPersonal] = useState({
    first_name: mockCustomer.first_name,
    last_name: mockCustomer.last_name,
    id_number: mockCustomer.id_number,
    phone: mockCustomer.phone,
    email: mockCustomer.email,
    address: mockCustomer.address,
    marital_status: mockCustomer.marital_status,
    children: mockCustomer.children,
  })

  // Editable financial details
  const [financial, setFinancial] = useState({
    monthly_income: mockCustomer.monthly_income,
    partner_income: mockCustomer.partner_income,
    own_capital: mockCustomer.own_capital,
    existing_obligations: mockCustomer.existing_obligations,
    lead_source: mockCustomer.lead_source,
  })

  // Tasks state
  const [tasks, setTasks] = useState(mockTasks)
  const [newTask, setNewTask] = useState({ title: '', due_date: '', priority: 'בינונית' as string })

  // Commission state
  const [commission, setCommission] = useState(mockCommission)

  // Communication state
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [messageText, setMessageText] = useState('')

  const customer = mockCustomer

  // -------------------------------------------------------------------------
  // Tab content renderers
  // -------------------------------------------------------------------------
  const renderPersonalTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">שם פרטי</label>
        <input
          className={inputClass}
          value={personal.first_name}
          onChange={(e) => setPersonal({ ...personal, first_name: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">שם משפחה</label>
        <input
          className={inputClass}
          value={personal.last_name}
          onChange={(e) => setPersonal({ ...personal, last_name: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ת.ז</label>
        <input
          className={inputClass}
          dir="ltr"
          value={personal.id_number}
          onChange={(e) => setPersonal({ ...personal, id_number: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
        <div className="relative">
          <Phone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={`${inputClass} pr-9`}
            dir="ltr"
            value={personal.phone}
            onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
        <div className="relative">
          <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={`${inputClass} pr-9`}
            dir="ltr"
            type="email"
            value={personal.email}
            onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
        <div className="relative">
          <MapPin size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={`${inputClass} pr-9`}
            value={personal.address}
            onChange={(e) => setPersonal({ ...personal, address: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">מצב משפחתי</label>
        <select
          className={`${inputClass} bg-white`}
          value={personal.marital_status}
          onChange={(e) => setPersonal({ ...personal, marital_status: e.target.value })}
        >
          <option value="רווק">רווק</option>
          <option value="נשוי">נשוי</option>
          <option value="גרוש">גרוש</option>
          <option value="אלמן">אלמן</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ילדים</label>
        <input
          className={inputClass}
          type="number"
          min={0}
          value={personal.children}
          onChange={(e) => setPersonal({ ...personal, children: parseInt(e.target.value) || 0 })}
        />
      </div>
      <div className="md:col-span-2 flex justify-end pt-2">
        <button className="bg-[#1a4f8a] text-white px-6 py-2 rounded-lg hover:bg-[#143d6b] transition-colors text-sm">
          שמור שינויים
        </button>
      </div>
    </div>
  )

  const renderFinancialTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">הכנסה חודשית</label>
        <input
          className={inputClass}
          type="number"
          dir="ltr"
          value={financial.monthly_income}
          onChange={(e) => setFinancial({ ...financial, monthly_income: parseInt(e.target.value) || 0 })}
        />
        <p className="text-xs text-gray-400 mt-1">{formatCurrency(financial.monthly_income)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">הכנסת בן/בת זוג</label>
        <input
          className={inputClass}
          type="number"
          dir="ltr"
          value={financial.partner_income}
          onChange={(e) => setFinancial({ ...financial, partner_income: parseInt(e.target.value) || 0 })}
        />
        <p className="text-xs text-gray-400 mt-1">{formatCurrency(financial.partner_income)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">הון עצמי</label>
        <input
          className={inputClass}
          type="number"
          dir="ltr"
          value={financial.own_capital}
          onChange={(e) => setFinancial({ ...financial, own_capital: parseInt(e.target.value) || 0 })}
        />
        <p className="text-xs text-gray-400 mt-1">{formatCurrency(financial.own_capital)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">התחייבויות</label>
        <input
          className={inputClass}
          type="number"
          dir="ltr"
          value={financial.existing_obligations}
          onChange={(e) => setFinancial({ ...financial, existing_obligations: parseInt(e.target.value) || 0 })}
        />
        <p className="text-xs text-gray-400 mt-1">{formatCurrency(financial.existing_obligations)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">מקור הגעה</label>
        <select
          className={`${inputClass} bg-white`}
          value={financial.lead_source}
          onChange={(e) => setFinancial({ ...financial, lead_source: e.target.value })}
        >
          <option value="הפניה">הפניה</option>
          <option value="פייסבוק">פייסבוק</option>
          <option value="אינסטגרם">אינסטגרם</option>
          <option value="אתר">אתר</option>
          <option value="וואטסאפ">וואטסאפ</option>
          <option value="טלפון">טלפון</option>
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
      <div className="md:col-span-2 flex justify-end pt-2">
        <button className="bg-[#1a4f8a] text-white px-6 py-2 rounded-lg hover:bg-[#143d6b] transition-colors text-sm">
          שמור שינויים
        </button>
      </div>
    </div>
  )

  const renderDocumentsTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">
          {mockDocuments.filter((d) => d.status === 'תקין').length} / {mockDocuments.length} מסמכים תקינים
        </p>
      </div>
      {mockDocuments.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{docStatusIcon(doc.status)}</span>
            <div>
              <p className="text-sm font-medium text-gray-900">{doc.type}</p>
              {doc.uploaded_at && (
                <p className="text-xs text-gray-400">הועלה: {formatDate(doc.uploaded_at)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                doc.status === 'תקין'
                  ? 'bg-green-100 text-green-700'
                  : doc.status === 'ממתין'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {doc.status}
            </span>
            <button className="inline-flex items-center gap-1 text-xs text-[#1a4f8a] hover:text-[#143d6b] bg-white border border-gray-200 px-2 py-1 rounded-lg transition-colors">
              <Upload size={14} />
              העלאה
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  const renderMortgagesTab = () => (
    <div className="space-y-4">
      {mockMortgages.map((mortgage) => (
        <div key={mortgage.id} className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">משכנתא {mortgage.type}</h4>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    mortgage.status === 'אושר'
                      ? 'bg-green-100 text-green-700'
                      : mortgage.status === 'הוגש'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {mortgage.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                מחיר נכס: {formatCurrency(mortgage.property_price)} | סכום הלוואה:{' '}
                {formatCurrency(mortgage.loan_amount)}
              </p>
            </div>
            <button
              onClick={() => navigate('/calculator')}
              className="inline-flex items-center gap-1 text-sm text-[#1a4f8a] hover:text-[#143d6b] transition-colors"
            >
              <ExternalLink size={14} />
              מחשבון
            </button>
          </div>
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
                {mortgage.tracks.map((track) => (
                  <tr key={track.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">{track.type}</td>
                    <td className="py-2 text-gray-700">{formatCurrency(track.amount)}</td>
                    <td className="py-2 text-gray-700" dir="ltr">
                      {track.interest_rate}%
                    </td>
                    <td className="py-2 text-gray-700">{track.period_months} חודשים</td>
                    <td className="py-2 font-medium text-gray-900">{formatCurrency(track.monthly_payment)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50">
                  <td className="py-2 font-bold text-gray-900">סה"כ</td>
                  <td className="py-2 font-bold text-gray-900">
                    {formatCurrency(mortgage.tracks.reduce((s, t) => s + t.amount, 0))}
                  </td>
                  <td className="py-2" />
                  <td className="py-2" />
                  <td className="py-2 font-bold text-gray-900">
                    {formatCurrency(mortgage.tracks.reduce((s, t) => s + t.monthly_payment, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
      {mockMortgages.length === 0 && (
        <p className="text-center text-gray-400 py-8">אין תמהילים עדיין</p>
      )}
    </div>
  )

  const renderCommunicationTab = () => (
    <div className="space-y-4">
      {/* Send message area */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
        <div className="flex items-center gap-2">
          <select
            className={`${inputClass} bg-white max-w-[200px]`}
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedTemplate(e.target.value)
              if (e.target.value) {
                setMessageText(e.target.value.replace('{שם}', customer.first_name))
              }
            }}
          >
            <option value="">בחר תבנית...</option>
            {messageTemplates.map((t, i) => (
              <option key={i} value={t}>
                {t.slice(0, 40)}...
              </option>
            ))}
          </select>
        </div>
        <textarea
          className={`${inputClass} min-h-[80px]`}
          placeholder="הקלד הודעה..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm">
            <MessageSquare size={16} />
            WhatsApp
          </button>
          <button className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
            <Mail size={16} />
            אימייל
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {mockMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'נשלח' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[75%] rounded-xl p-3 ${
                msg.direction === 'נשלח'
                  ? 'bg-[#1a4f8a] text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-medium ${
                    msg.direction === 'נשלח' ? 'text-blue-200' : 'text-gray-500'
                  }`}
                >
                  {msg.channel} - {msg.direction}
                </span>
              </div>
              <p className="text-sm">{msg.content}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.direction === 'נשלח' ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
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
      {/* Add task form */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-3">משימה חדשה</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <input
              className={inputClass}
              placeholder="תיאור המשימה..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
          </div>
          <div>
            <input
              className={inputClass}
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <select
              className={`${inputClass} bg-white`}
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
            >
              <option value="נמוכה">נמוכה</option>
              <option value="בינונית">בינונית</option>
              <option value="גבוהה">גבוהה</option>
              <option value="דחופה">דחופה</option>
            </select>
            <button
              onClick={() => {
                if (!newTask.title.trim()) return
                setTasks([
                  {
                    id: String(Date.now()),
                    title: newTask.title,
                    due_date: newTask.due_date || null,
                    priority: newTask.priority as typeof mockTasks[0]['priority'],
                    status: 'פתוחה',
                  },
                  ...tasks,
                ])
                setNewTask({ title: '', due_date: '', priority: 'בינונית' })
              }}
              className="bg-[#1a4f8a] text-white px-3 py-2 rounded-lg hover:bg-[#143d6b] transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              task.status === 'הושלמה'
                ? 'bg-gray-50 border-gray-100 opacity-60'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setTasks(
                    tasks.map((t) =>
                      t.id === task.id
                        ? { ...t, status: t.status === 'הושלמה' ? 'פתוחה' : 'הושלמה' }
                        : t
                    )
                  )
                }
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  task.status === 'הושלמה'
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-[#1a4f8a]'
                }`}
              >
                {task.status === 'הושלמה' && <Check size={14} />}
              </button>
              <div>
                <p
                  className={`text-sm ${
                    task.status === 'הושלמה' ? 'line-through text-gray-400' : 'text-gray-900'
                  }`}
                >
                  {task.title}
                </p>
                {task.due_date && (
                  <p className="text-xs text-gray-400">{formatDate(task.due_date)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>
              <button
                onClick={() => setTasks(tasks.filter((t) => t.id !== task.id))}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderCommissionTab = () => (
    <div className="max-w-lg space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">סכום עמלה</label>
        <input
          className={inputClass}
          type="number"
          dir="ltr"
          value={commission.amount}
          onChange={(e) => setCommission({ ...commission, amount: parseInt(e.target.value) || 0 })}
        />
        <p className="text-xs text-gray-400 mt-1">{formatCurrency(commission.amount)}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס תשלום</label>
        <button
          onClick={() =>
            setCommission({
              ...commission,
              status: commission.status === 'ממתין' ? 'שולם' : 'ממתין',
              payment_date: commission.status === 'ממתין' ? new Date().toISOString().split('T')[0] : null,
            })
          }
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            commission.status === 'שולם'
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
          }`}
        >
          {commission.status === 'שולם' ? <Check size={16} /> : <CreditCard size={16} />}
          {commission.status}
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">תאריך תשלום</label>
        <input
          className={inputClass}
          type="date"
          value={commission.payment_date || ''}
          onChange={(e) => setCommission({ ...commission, payment_date: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
        <textarea
          className={`${inputClass} min-h-[80px]`}
          value={commission.notes}
          onChange={(e) => setCommission({ ...commission, notes: e.target.value })}
        />
      </div>
      <div className="flex justify-end pt-2">
        <button className="bg-[#1a4f8a] text-white px-6 py-2 rounded-lg hover:bg-[#143d6b] transition-colors text-sm">
          שמור שינויים
        </button>
      </div>
    </div>
  )

  const tabContent: Record<TabKey, () => JSX.Element> = {
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
      {/* Back button */}
      <button
        onClick={() => navigate('/customers')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#1a4f8a] transition-colors"
      >
        <ArrowRight size={16} />
        חזרה לרשימת לקוחות
      </button>

      {/* Header: Name + Status + Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#1a4f8a] text-white rounded-full flex items-center justify-center text-lg font-bold">
              {customer.first_name[0]}{customer.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {customer.first_name} {customer.last_name}
                </h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    statusColors[customer.status] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {customer.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {customer.phone} | {customer.email} | נוצר: {formatDate(customer.created_at)}
              </p>
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button className="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100 transition-colors text-sm">
              <Send size={16} />
              שלח הודעה
            </button>
            <button className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm">
              <ClipboardList size={16} />
              שלח שאלון
            </button>
            <button className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 border border-purple-200 px-3 py-2 rounded-lg hover:bg-purple-100 transition-colors text-sm">
              <Calculator size={16} />
              צור תמהיל
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'border-[#1a4f8a] text-[#1a4f8a]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="p-5">{tabContent[activeTab]()}</div>
      </div>
    </div>
  )
}
