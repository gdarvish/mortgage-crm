import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";

const MortgageCalculatorPage = lazy(() => import("./pages/MortgageCalculatorPage"));
const PurchaseCalculatorPage = lazy(() => import("./pages/PurchaseCalculatorPage"));
const ConsolidationCalculatorPage = lazy(() => import("./pages/ConsolidationCalculatorPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogAdminPage = lazy(() => import("./pages/BlogAdminPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const AccessibilityPage = lazy(() => import("./pages/AccessibilityPage"));

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="text-on-surface-variant">טוען...</span></div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/mortgage-calculator" element={<MortgageCalculatorPage />} />
          <Route path="/purchase-calculator" element={<PurchaseCalculatorPage />} />
          <Route path="/consolidation-calculator" element={<ConsolidationCalculatorPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/admin" element={<BlogAdminPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
