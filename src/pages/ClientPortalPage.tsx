import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Home, FileText, CheckCircle, Clock, XCircle, PenTool, Loader2, AlertCircle, Phone } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

interface PortalDocument {
  type: string
  status: string
}

interface PendingSignature {
  document_name: string
  sign_url_token: string | null
}

interface PortalData {
  first_name: string
  status: string
  documents: PortalDocument[]
  pending_signatures: PendingSignature[]
  advisor: {
    name: string
    phone: string
    title: string
  }
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'תקין': return <CheckCircle size={16} className="text-green-500" />
    case 'ממתין': return <Clock size={16} className="text-yellow-500" />
    case 'חסר': return <XCircle size={16} className="text-red-500" />
    default: return null
  }
}

export default function ClientPortalPage() {
  const { token } = useParams()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setErrorMessage('קישור לא תקין')
      setLoading(false)
      return
    }
    const fn = httpsCallable(functions, 'getPortalDataByToken')
    fn({ token })
      .then((res) => {
        setData(res.data as PortalData)
      })
      .catch((e: { code?: string }) => {
        if (e.code === 'functions/deadline-exceeded') {
          setErrorMessage('הקישור פג תוקף. אנא פנה ליועץ המשכנתאות לקבלת קישור חדש.')
        } else {
          setErrorMessage('הקישור אינו תקין. אנא בדוק את הכתובת או פנה ליועץ המשכנתאות.')
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
        <Loader2 size={32} className="text-[var(--color-primary)] animate-spin" />
      </div>
    )
  }

  if (errorMessage || !data) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4" dir="rtl">
        <div className="bg-[var(--color-card)] rounded-2xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle size={56} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">לא ניתן לטעון את הפורטל</h1>
          <p className="text-[var(--color-text-sub)]">{errorMessage || 'הקישור אינו בתוקף. נא לפנות ליועץ המשכנתאות.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]" dir="rtl">
      {/* Header */}
      <div className="bg-[var(--color-primary)] text-white py-6 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 bg-[var(--color-card)]/20 rounded-xl mx-auto mb-3 flex items-center justify-center">
            <Home size={24} />
          </div>
          <h1 className="text-xl font-bold">{data.advisor.name || data.advisor.title}</h1>
          <p className="text-emerald-200 text-sm">
            {data.advisor.title}
            {data.advisor.phone && (
              <>
                {' | '}
                <a href={`tel:${data.advisor.phone}`} className="underline hover:text-white">
                  {data.advisor.phone}
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 -mt-4 space-y-4">
        {/* Status Card */}
        <div className="bg-[var(--color-card)] rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-[var(--color-text)]">שלום {data.first_name}!</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
              שלב: {data.status}
            </span>
          </div>
          <p className="text-[var(--color-text-sub)] mt-3 text-sm">
            {data.status === 'מסמכים'
              ? 'אנחנו בשלב איסוף המסמכים. אנא בדוק את הצ\'קליסט למטה.'
              : `התיק שלך נמצא בסטטוס ${data.status}.`}
          </p>
          {data.advisor.phone && (
            <a
              href={`tel:${data.advisor.phone}`}
              className="inline-flex items-center gap-2 mt-3 text-sm text-[var(--color-primary)] hover:underline"
            >
              <Phone size={14} />
              צור קשר עם היועץ
            </a>
          )}
        </div>

        {/* Documents Checklist */}
        <div className="bg-[var(--color-card)] rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <FileText size={18} className="text-[var(--color-primary)]" />
            צ'קליסט מסמכים
          </h2>
          <div className="space-y-3">
            {data.documents.map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-lg">
                <div className="flex items-center gap-2">
                  {statusIcon(doc.status)}
                  <span className="text-sm text-[var(--color-text)]">{doc.type}</span>
                </div>
                {doc.status === 'תקין' && (
                  <span className="text-xs text-green-600">הועלה ✓</span>
                )}
                {doc.status === 'ממתין' && (
                  <span className="text-xs text-yellow-600">בבדיקה...</span>
                )}
                {doc.status === 'חסר' && (
                  <span className="text-xs text-red-600">חסר</span>
                )}
              </div>
            ))}
            {data.documents.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-4">אין מסמכים דרושים כרגע</p>
            )}
          </div>
        </div>

        {/* Pending Signatures */}
        {data.pending_signatures.length > 0 && (
          <div className="bg-[var(--color-card)] rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <PenTool size={18} className="text-[var(--color-primary)]" />
              ממתין לחתימה
            </h2>
            {data.pending_signatures.map((sig, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg mb-2 last:mb-0">
                <span className="text-sm text-[var(--color-text)]">{sig.document_name}</span>
                {sig.sign_url_token && (
                  <a
                    href={`/sign/${sig.sign_url_token}`}
                    className="text-xs bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-[var(--color-primary-hover)] transition-colors"
                  >
                    <PenTool size={12} /> חתום
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-[var(--color-text-muted)] py-4">
          פורטל לקוח | {data.advisor.name || data.advisor.title}
        </p>
      </div>
    </div>
  )
}
