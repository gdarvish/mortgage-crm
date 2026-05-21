import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendEmailVerification } from 'firebase/auth'
import { Mail, RefreshCw, LogOut } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui'

export default function VerifyEmailPage() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)

  const resend = async () => {
    if (!auth.currentUser) return
    setSending(true)
    try {
      await sendEmailVerification(auth.currentUser)
      toast.success('שלחנו לך מייל אימות חדש', 'בדוק את תיבת הדואר שלך')
    } catch {
      toast.error('שגיאה בשליחת המייל', 'נסה שוב בעוד מספר דקות')
    } finally {
      setSending(false)
    }
  }

  const checkVerified = async () => {
    if (!auth.currentUser) return
    setChecking(true)
    await auth.currentUser.reload()
    setChecking(false)
    if (auth.currentUser.emailVerified) {
      // Hard navigation so the auth store re-initialises with the verified user.
      window.location.href = '/dashboard'
    } else {
      toast.warning('המייל עדיין לא אומת', 'בדוק את תיבת הדואר ולחץ על הקישור שבמייל')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto flex items-center justify-center">
            <Mail className="text-emerald-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold mt-4 mb-2 text-gray-900">אימות כתובת מייל</h1>
          <p className="text-gray-600 mb-1">שלחנו מייל אימות לכתובת:</p>
          <p className="font-semibold text-gray-900 mb-4 break-all">{user?.email}</p>
          <p className="text-sm text-gray-500 mb-6">
            לחץ על הקישור שבמייל כדי להפעיל את החשבון. אם המייל לא הגיע, בדוק את תיקיית הספאם.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={checkVerified}
            disabled={checking}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
            כבר אימתתי — בדוק שוב
          </button>
          <button
            onClick={resend}
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            שלח לי מייל אימות שוב
          </button>
          <button
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <LogOut size={16} />
            יציאה
          </button>
        </div>
      </div>
    </div>
  )
}
