import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import MortgageCalculatorPage from "./pages/MortgageCalculatorPage";
import PurchaseCalculatorPage from "./pages/PurchaseCalculatorPage";
import ConsolidationCalculatorPage from "./pages/ConsolidationCalculatorPage";
import BlogPage from "./pages/BlogPage";
import BlogAdminPage from "./pages/BlogAdminPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/mortgage-calculator" element={<MortgageCalculatorPage />} />
        <Route path="/purchase-calculator" element={<PurchaseCalculatorPage />} />
        <Route path="/consolidation-calculator" element={<ConsolidationCalculatorPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/admin" element={<BlogAdminPage />} />
      </Routes>
    </Layout>
  );
}
