import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import VerifyEmailPage from '@/pages/VerifyEmailPage'
import { Toaster } from '@/components/ui/Toast'
import { InstallPrompt } from '@/components/InstallPrompt'

// Route pages are code-split — each loads as a separate chunk on demand.
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const CustomersPage = lazy(() => import('@/pages/CustomersPage'))
const CustomerDetailPage = lazy(() => import('@/pages/CustomerDetailPage'))
const LeadsPage = lazy(() => import('@/pages/LeadsPage'))
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage'))
const MortgageCalculatorPage = lazy(() => import('@/pages/MortgageCalculatorPage'))
const RefinanceCalculatorPage = lazy(() => import('@/pages/RefinanceCalculatorPage'))
const ConsolidationCalculatorPage = lazy(() => import('@/pages/ConsolidationCalculatorPage'))
const AlertsPage = lazy(() => import('@/pages/AlertsPage'))
const MeetingsPage = lazy(() => import('@/pages/MeetingsPage'))
const CommunicationPage = lazy(() => import('@/pages/CommunicationPage'))
const CommissionsPage = lazy(() => import('@/pages/CommissionsPage'))
const ReferralsPage = lazy(() => import('@/pages/ReferralsPage'))
const InterestRatesPage = lazy(() => import('@/pages/InterestRatesPage'))
const FamilyEconomicsPage = lazy(() => import('@/pages/FamilyEconomicsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const AuditLogPage = lazy(() => import('@/pages/AuditLogPage'))
const ClientPortalPage = lazy(() => import('@/pages/ClientPortalPage'))
const QuestionnairePage = lazy(() => import('@/pages/QuestionnairePage'))
const SignaturePage = lazy(() => import('@/pages/SignaturePage'))

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">טוען...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuthStore()

  if (!initialized || loading) return <AuthLoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />

  return <>{children}</>
}

function VerifyEmailRoute() {
  const { user, loading, initialized } = useAuthStore()

  if (!initialized || loading) return <AuthLoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (user.emailVerified) return <Navigate to="/dashboard" replace />

  return <VerifyEmailPage />
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  return (
    <BrowserRouter>
      <Suspense fallback={<AuthLoadingScreen />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyEmailRoute />} />
          <Route path="/portal/:token" element={<ClientPortalPage />} />
          <Route path="/questionnaire/:token" element={<QuestionnairePage />} />
          <Route path="/sign/:token" element={<SignaturePage />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="calculator" element={<MortgageCalculatorPage />} />
            <Route path="refinance" element={<RefinanceCalculatorPage />} />
            <Route path="consolidation" element={<ConsolidationCalculatorPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="meetings" element={<MeetingsPage />} />
            <Route path="communication" element={<CommunicationPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="referrals" element={<ReferralsPage />} />
            <Route path="interest-rates" element={<InterestRatesPage />} />
            <Route path="family-economics" element={<FamilyEconomicsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
      <InstallPrompt />
    </BrowserRouter>
  )
}
