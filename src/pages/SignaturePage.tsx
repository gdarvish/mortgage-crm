import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { httpsCallable } from 'firebase/functions'
import { PenTool, CheckCircle, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { functions } from '@/lib/firebase'
import { validateIsraeliId } from '@/utils/israeliValidations'
import { toast } from '@/components/ui'

interface SignatureRequestInfo {
  id: string
  document_name: string
  customer_name: string
  document_type: string | null
}

export default function SignaturePage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [request, setRequest] = useState<SignatureRequestInfo | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerId, setSignerId] = useState('')
  const [signed, setSigned] = useState(false)
  const [canvasWidth, setCanvasWidth] = useState(460)
  const sigRef = useRef<SignatureCanvas | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) {
      setLoadError('קישור לא תקין')
      setLoading(false)
      return
    }
    const fn = httpsCallable(functions, 'getSignatureByToken')
    fn({ token })
      .then((res) => setRequest(res.data as SignatureRequestInfo))
      .catch((e: { code?: string }) => {
        if (e.code === 'functions/deadline-exceeded') {
          setLoadError('הקישור פג תוקף. אנא פנה ליועץ המשכנתאות לקבלת קישור חדש.')
        } else if (e.code === 'functions/already-exists') {
          setLoadError('המסמך כבר נחתם. אין צורך בפעולה נוספת.')
        } else {
          setLoadError('הקישור אינו תקין. אנא בדוק את הכתובת או פנה ליועץ המשכנתאות.')
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (request && wrapRef.current) {
      setCanvasWidth(wrapRef.current.clientWidth)
    }
  }, [request])

  const clearCanvas = () => {
    sigRef.current?.clear()
    setSigned(false)
  }

  const handleSubmit = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error('יש לחתום לפני שליחה')
      return
    }
    if (signerName.trim().length < 2) {
      toast.error('יש למלא שם מלא')
      return
    }
    if (!validateIsraeliId(signerId)) {
      toast.error('ת.ז לא תקינה', 'בדוק את הספרות ונסה שוב')
      return
    }
    setSubmitting(true)
    try {
      const dataUrl = sigRef.current.getCanvas().toDataURL('image/png')
      const submit = httpsCallable(functions, 'submitSignature')
      await submit({
        token,
        signer_name: signerName.trim(),
        signer_id: signerId.trim(),
        signature_dataurl: dataUrl,
        user_agent: navigator.userAgent,
      })
      setSubmitted(true)
    } catch (e) {
      const err = e as { code?: string }
      if (err.code === 'functions/deadline-exceeded') {
        toast.error('הקישור פג תוקף', 'אנא פנה ליועץ לקבלת קישור חדש')
      } else if (err.code === 'functions/already-exists') {
        toast.error('המסמך כבר נחתם')
      } else {
        toast.error('שגיאה בשליחת החתימה', 'אנא נסה שוב')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 size={32} className="text-emerald-600 animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle size={56} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">לא ניתן לטעון את המסמך</h1>
          <p className="text-gray-600">{loadError}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <CheckCircle size={64} className="mx-auto text-emerald-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">המסמך נחתם!</h1>
          <p className="text-gray-600">החתימה שלך נשמרה בהצלחה. יועץ המשכנתאות שלך יקבל על כך הודעה. תודה!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" dir="rtl">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
            <PenTool size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">חתימה דיגיטלית</h1>
          <p className="text-sm text-gray-500">{request?.document_name}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-1">{request?.document_name || 'מסמך לחתימה'}</h2>
            {request?.customer_name && (
              <p className="text-sm text-gray-600">לקוח: {request.customer_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="ישראל ישראלי"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ת.ז *</label>
            <input
              type="text"
              dir="ltr"
              value={signerId}
              onChange={(e) => setSignerId(e.target.value)}
              maxLength={9}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="000000000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">חתימה *</label>
            <div
              ref={wrapRef}
              className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white"
              style={{ touchAction: 'none' }}
            >
              <SignatureCanvas
                ref={sigRef}
                penColor="#1c1917"
                canvasProps={{ width: canvasWidth, height: 200, className: 'touch-none' }}
                onEnd={() => setSigned(true)}
              />
            </div>
            <button
              onClick={clearCanvas}
              className="mt-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
            >
              <RotateCcw size={14} /> נקה חתימה
            </button>
          </div>

          <div className="bg-amber-50 border-r-4 border-amber-400 p-3 text-xs text-amber-900 leading-relaxed">
            <strong>הצהרה משפטית:</strong> בחתימתי כאן אני מאשר/ת את תוכן המסמך, ומסכים/ה
            שחתימה זו תהיה בעלת תוקף משפטי על פי חוק חתימה אלקטרונית, תשס"א-2001.
          </div>

          <button
            onClick={handleSubmit}
            disabled={!signed || submitting}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            חתום ושלח
          </button>
        </div>
      </div>
    </div>
  )
}
