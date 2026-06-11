import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Home, FileText, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

interface PortalDocument {
  type: string
  status: string
}

interface PortalData {
  customer_name: string
  status: string
  advisor_name: string
  advisor_phone: string
  documents: PortalDocument[]
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
  const [portal, setPortal] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    const fn = httpsCallable<{ token: string }, PortalData>(functions, 'getPortalByToken')
    fn({ token })
      .then((res) => setPortal(res.data))
      .catch(() => setPortal(null))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 size={32} className="text-[#059669] animate-spin" />
      </div>
    )
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">הקישור אינו בתוקף</h1>
          <p className="text-gray-600">נא לפנות ליועץ המשכנתאות לקבלת קישור חדש לפורטל.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-[#059669] text-white py-6 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 bg-white/20 rounded-xl mx-auto mb-3 flex items-center justify-center">
            <Home size={24} />
          </div>
          <h1 className="text-xl font-bold">{portal.advisor_name || 'יועץ המשכנתאות שלך'}</h1>
          <p className="text-blue-200 text-sm">
            יועץ משכנתאות{portal.advisor_phone ? ` | ${portal.advisor_phone}` : ''}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 -mt-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900">שלום {portal.customer_name}!</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
              שלב: {portal.status}
            </span>
          </div>
          <p className="text-gray-600 mt-3 text-sm">
            {portal.status === 'מסמכים'
              ? 'אנחנו בשלב איסוף המסמכים. ניתן לעקוב כאן אחר סטטוס המסמכים בתיק.'
              : `התיק שלך נמצא בסטטוס ${portal.status}.`}
          </p>
        </div>

        {/* Documents Checklist */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={18} className="text-[#059669]" />
            צ'קליסט מסמכים
          </h2>
          <div className="space-y-3">
            {portal.documents.map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {statusIcon(doc.status)}
                  <span className="text-sm text-gray-800">{doc.type}</span>
                </div>
                {doc.status === 'תקין' && (
                  <span className="text-xs text-green-600">הועלה ✓</span>
                )}
                {doc.status === 'ממתין' && (
                  <span className="text-xs text-yellow-600">בבדיקה...</span>
                )}
                {doc.status === 'חסר' && (
                  <span className="text-xs text-red-600">יש להעביר ליועץ</span>
                )}
              </div>
            ))}
            {portal.documents.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">אין מסמכים דרושים כרגע</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 py-4">
          פורטל לקוח{portal.advisor_name ? ` | ${portal.advisor_name} - יועץ משכנתאות` : ''}
        </p>
      </div>
    </div>
  )
}
