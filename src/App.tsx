import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import CustomersPage from '@/pages/CustomersPage'
import CustomerDetailPage from '@/pages/CustomerDetailPage'
import LeadsPage from '@/pages/LeadsPage'
import DocumentsPage from '@/pages/DocumentsPage'
import MortgageCalculatorPage from '@/pages/MortgageCalculatorPage'
import RefinanceCalculatorPage from '@/pages/RefinanceCalculatorPage'
import ConsolidationCalculatorPage from '@/pages/ConsolidationCalculatorPage'
import AlertsPage from '@/pages/AlertsPage'
import CommunicationPage from '@/pages/CommunicationPage'
import CommissionsPage from '@/pages/CommissionsPage'
import ReferralsPage from '@/pages/ReferralsPage'
import InterestRatesPage from '@/pages/InterestRatesPage'
import FamilyEconomicsPage from '@/pages/FamilyEconomicsPage'
import SettingsPage from '@/pages/SettingsPage'
import ClientPortalPage from '@/pages/ClientPortalPage'
import QuestionnairePage from '@/pages/QuestionnairePage'
import SignaturePage from '@/pages/SignaturePage'
import { Toaster } from '@/components/ui/Toast'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuthStore()

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1a4f8a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">טוען...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
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
          <Route path="communication" element={<CommunicationPage />} />
          <Route path="commissions" element={<CommissionsPage />} />
          <Route path="referrals" element={<ReferralsPage />} />
          <Route path="interest-rates" element={<InterestRatesPage />} />
          <Route path="family-economics" element={<FamilyEconomicsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
