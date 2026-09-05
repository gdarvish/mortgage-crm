import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { functions } from '@/lib/firebase'
import { validatePersonalForm, type FormErrors } from '@/utils/israeliValidations'
import { toast } from '@/components/ui'

const steps = ['פרטים אישיים', 'מצב משפחתי', 'הכנסות', 'נכסים', 'התחייבויות', 'מטרת המשכנתא']

interface QuestionnaireCustomer {
  id: string
  first_name: string
  last_name: string
  id_number: string
  phone: string
  address: string
  marital_status: string
  children: number
  monthly_income: number
  partner_income: number
  own_capital: number
  existing_obligations: number
  questionnaire_completed: boolean
  employment_type?: string | null
  has_existing_property?: boolean | null
  existing_property_value?: number | null
  credit_card_frames?: number | null
  mortgage_purpose?: string | null
  requested_amount?: number | null
}

export default function QuestionnairePage() {
  const { token } = useParams()
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [customer, setCustomer] = useState<QuestionnaireCustomer | null>(null)
  const [_loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [_submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', idNumber: '', phone: '', address: '',
    maritalStatus: '', children: 0,
    employmentType: 'שכיר', income1: 0, income2: 0,
    hasProperty: false, propertyValue: 0,
    existingLoans: 0, creditCards: 0,
    purpose: 'דירה ראשונה', ownCapital: 0, requestedAmount: 0,
  })

  useEffect(() => {
    if (!token) {
      setLoadError('קישור לא תקין')
      setLoading(false)
      return
    }
    const fn = httpsCallable(functions, 'getCustomerByQuestionnaireToken')
    fn({ token })
      .then((res) => {
        const data = res.data as QuestionnaireCustomer
        setCustomer(data)
        setForm(f => ({
          ...f,
          firstName: data.first_name,
          lastName: data.last_name,
          idNumber: data.id_number || '',
          phone: data.phone || '',
          address: data.address || '',
          maritalStatus: data.marital_status || '',
          children: data.children || 0,
          income1: data.monthly_income || 0,
          income2: data.partner_income || 0,
          ownCapital: data.own_capital || 0,
          existingLoans: data.existing_obligations || 0,
          employmentType: data.employment_type || 'שכיר',
          hasProperty: data.has_existing_property ?? false,
          propertyValue: data.existing_property_value || 0,
          creditCards: data.credit_card_frames || 0,
          purpose: data.mortgage_purpose || 'דירה ראשונה',
          requestedAmount: data.requested_amount || 0,
        }))
      })
      .catch((e: { code?: string }) => {
        if (e.code === 'functions/deadline-exceeded') {
          setLoadError('הקישור פג תוקף. אנא פנה ליועץ המשכנתאות לקבלת קישור חדש.')
        } else {
          setLoadError('הקישור אינו תקין. אנא בדוק את הכתובת או פנה ליועץ המשכנתאות.')
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  const [qErrors, setQErrors] = useState<FormErrors>({})

  const update = (field: string, value: string | number | boolean) => setForm({ ...form, [field]: value })

  const validatePersonalStep = (): FormErrors =>
    validatePersonalForm({
      first_name: form.firstName,
      last_name: form.lastName,
      id_number: form.idNumber,
      phone: form.phone,
    })

  const handleNext = () => {
    if (currentStep === 0) {
      const errors = validatePersonalStep()
      setQErrors(errors)
      if (Object.keys(errors).length > 0) {
        toast.error('יש שגיאות בטופס', 'אנא תקן את הפרטים האישיים')
        return
      }
    }
    setCurrentStep(currentStep + 1)
  }

  if (_loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 size={32} className="text-[var(--color-primary)] animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle size={56} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">לא ניתן לטעון את השאלון</h1>
          <p className="text-gray-600">{loadError}</p>
        </div>
      </div>
    )
  }

  if (_submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">תודה!</h1>
          <p className="text-gray-600">השאלון נשלח בהצלחה. היועץ שלך יצור איתך קשר בהקדם.</p>
        </div>
      </div>
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0: return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם פרטי</label>
              <input value={form.firstName} onChange={e => update('firstName', e.target.value)} className={`w-full px-3 py-2 border rounded-lg ${qErrors.first_name ? 'border-red-500' : ''}`} />
              {qErrors.first_name && <p className="text-xs text-red-600 mt-1">{qErrors.first_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם משפחה</label>
              <input value={form.lastName} onChange={e => update('lastName', e.target.value)} className={`w-full px-3 py-2 border rounded-lg ${qErrors.last_name ? 'border-red-500' : ''}`} />
              {qErrors.last_name && <p className="text-xs text-red-600 mt-1">{qErrors.last_name}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ת.ז</label>
            <input value={form.idNumber} onChange={e => update('idNumber', e.target.value)} className={`w-full px-3 py-2 border rounded-lg ${qErrors.id_number ? 'border-red-500' : ''}`} dir="ltr" />
            {qErrors.id_number && <p className="text-xs text-red-600 mt-1">{qErrors.id_number}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
            <input value={form.phone} onChange={e => update('phone', e.target.value)} className={`w-full px-3 py-2 border rounded-lg ${qErrors.phone ? 'border-red-500' : ''}`} dir="ltr" />
            {qErrors.phone && <p className="text-xs text-red-600 mt-1">{qErrors.phone}</p>}
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label><input value={form.address} onChange={e => update('address', e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
        </div>
      )
      case 1: return (
        <div className="space-y-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">מצב משפחתי</label>
            <select value={form.maritalStatus} onChange={e => update('maritalStatus', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
              <option value="">בחר...</option><option>רווק/ה</option><option>נשוי/אה</option><option>גרוש/ה</option><option>אלמן/ה</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">מספר ילדים</label><input type="number" value={form.children} onChange={e => update('children', +e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
        </div>
      )
      case 2: return (
        <div className="space-y-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">סוג העסקה</label>
            <select value={form.employmentType} onChange={e => update('employmentType', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
              <option>שכיר</option><option>עצמאי</option><option>שכיר + עצמאי</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">הכנסה חודשית נטו</label><input type="number" value={form.income1} onChange={e => update('income1', +e.target.value)} className="w-full px-3 py-2 border rounded-lg" dir="ltr" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">הכנסת בן/בת זוג</label><input type="number" value={form.income2} onChange={e => update('income2', +e.target.value)} className="w-full px-3 py-2 border rounded-lg" dir="ltr" /></div>
        </div>
      )
      case 3: return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={form.hasProperty} onChange={e => update('hasProperty', e.target.checked)} className="w-4 h-4" />
            <label className="text-sm font-medium text-gray-700">יש לי נכס קיים</label>
          </div>
          {form.hasProperty && (
            <div><label className="block text-sm font-medium text-gray-700 mb-1">שווי מוערך</label><input type="number" value={form.propertyValue} onChange={e => update('propertyValue', +e.target.value)} className="w-full px-3 py-2 border rounded-lg" dir="ltr" /></div>
          )}
        </div>
      )
      case 4: return (
        <div className="space-y-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">הלוואות קיימות (סה"כ יתרה)</label><input type="number" value={form.existingLoans} onChange={e => update('existingLoans', +e.target.value)} className="w-full px-3 py-2 border rounded-lg" dir="ltr" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">מסגרות אשראי</label><input type="number" value={form.creditCards} onChange={e => update('creditCards', +e.target.value)} className="w-full px-3 py-2 border rounded-lg" dir="ltr" /></div>
        </div>
      )
      case 5: return (
        <div className="space-y-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">מטרת המשכנתא</label>
            <select value={form.purpose} onChange={e => update('purpose', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
              <option>דירה ראשונה</option><option>שיפור דיור</option><option>להשקעה</option><option>מחזור</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">הון עצמי</label><input type="number" value={form.ownCapital} onChange={e => update('ownCapital', +e.target.value)} className="w-full px-3 py-2 border rounded-lg" dir="ltr" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">סכום משכנתא מבוקש</label><input type="number" value={form.requestedAmount} onChange={e => update('requestedAmount', +e.target.value)} className="w-full px-3 py-2 border rounded-lg" dir="ltr" /></div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" dir="rtl">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[var(--color-primary)] rounded-xl mx-auto mb-3 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">שאלון פרטים</h1>
          <p className="text-sm text-gray-500">מלא את הפרטים הבאים כדי שנוכל להכין עבורך הצעה מותאמת</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-6">
          {steps.map((step, idx) => (
            <div key={idx} className="flex-1">
              <div className={`h-1.5 rounded-full ${idx <= currentStep ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`} />
              <p className={`text-[10px] mt-1 text-center ${idx === currentStep ? 'text-[var(--color-primary)] font-medium' : 'text-gray-400'}`}>{step}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{steps[currentStep]}</h2>
          {renderStep()}
          <div className="flex gap-3 mt-6">
            {currentStep > 0 && (
              <button onClick={() => setCurrentStep(currentStep - 1)} className="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200">
                <ChevronRight size={16} /> הקודם
              </button>
            )}
            {currentStep < steps.length - 1 ? (
              <button onClick={handleNext} className="flex-1 flex items-center justify-center gap-1 bg-[var(--color-primary)] text-white py-2.5 rounded-lg hover:bg-[var(--color-primary-hover)]">
                הבא <ChevronLeft size={16} />
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (!customer) return
                  const errors = validatePersonalStep()
                  if (Object.keys(errors).length > 0) {
                    setQErrors(errors)
                    setCurrentStep(0)
                    toast.error('יש שגיאות בטופס', 'אנא תקן את הפרטים האישיים')
                    return
                  }
                  setSubmitting(true)
                  try {
                    const recaptchaToken = executeRecaptcha
                      ? await executeRecaptcha('submit_questionnaire')
                      : undefined
                    const submit = httpsCallable(functions, 'submitQuestionnaire')
                    await submit({
                      token,
                      recaptcha_token: recaptchaToken,
                      payload: {
                        first_name: form.firstName,
                        last_name: form.lastName,
                        id_number: form.idNumber,
                        phone: form.phone,
                        address: form.address,
                        marital_status: form.maritalStatus,
                        children: form.children,
                        monthly_income: form.income1,
                        partner_income: form.income2,
                        own_capital: form.ownCapital,
                        existing_obligations: form.existingLoans,
                        employment_type: form.employmentType,
                        has_existing_property: form.hasProperty,
                        existing_property_value: form.hasProperty ? form.propertyValue : 0,
                        credit_card_frames: form.creditCards,
                        mortgage_purpose: form.purpose,
                        requested_amount: form.requestedAmount,
                      },
                    })
                    setSubmitted(true)
                  } catch (err) {
                    if ((err as { code?: string }).code === 'functions/deadline-exceeded') {
                      toast.error('הקישור פג תוקף', 'אנא פנה ליועץ לקבלת קישור חדש')
                    } else {
                      toast.error('שגיאה בשליחת השאלון', 'אנא נסה שוב')
                    }
                  } finally {
                    setSubmitting(false)
                  }
                }}
                disabled={submitting}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                שלח שאלון
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
