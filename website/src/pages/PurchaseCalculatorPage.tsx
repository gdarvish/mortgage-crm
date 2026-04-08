import { useState, useMemo } from "react";
import SEOHead from "../components/seo/SEOHead";
import {
  calculateMonthlyPayment,
  formatCurrency,
  formatPercent,
} from "../utils/mortgageCalculations";


type PropertyType = "residential" | "investment" | "commercial" | "land";

interface IncomeExpenses {
  salary: number;
  rental: number;
  benefits: number;
  other: number;
  loans: number;
  alimony: number;
  otherExpenses: number;
}

const defaultIncome: IncomeExpenses = {
  salary: 15000,
  rental: 0,
  benefits: 0,
  other: 0,
  loans: 0,
  alimony: 0,
  otherExpenses: 0,
};

export default function PurchaseCalculatorPage() {
  const [propertyType, setPropertyType] = useState<PropertyType>("residential");
  const [propertyValue, setPropertyValue] = useState(2500000);
  const [mortgageAmount, setMortgageAmount] = useState(1500000);
  const [years, setYears] = useState(30);

  const [isCoupleMode, setIsCoupleMode] = useState(false);
  const [borrower1, setBorrower1] = useState<IncomeExpenses>({ ...defaultIncome });
  const [borrower2, setBorrower2] = useState<IncomeExpenses>({ ...defaultIncome });

  const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "" });

  const financingRatio = useMemo(
    () => (propertyValue > 0 ? (mortgageAmount / propertyValue) * 100 : 0),
    [mortgageAmount, propertyValue]
  );

  const totalIncome = useMemo(() => {
    const b1 = borrower1.salary + borrower1.rental + borrower1.benefits + borrower1.other;
    const b2 = isCoupleMode
      ? borrower2.salary + borrower2.rental + borrower2.benefits + borrower2.other
      : 0;
    return b1 + b2;
  }, [borrower1, borrower2, isCoupleMode]);

  const totalExpenses = useMemo(() => {
    const b1 = borrower1.loans + borrower1.alimony + borrower1.otherExpenses;
    const b2 = isCoupleMode
      ? borrower2.loans + borrower2.alimony + borrower2.otherExpenses
      : 0;
    return b1 + b2;
  }, [borrower1, borrower2, isCoupleMode]);

  const disposableIncome = totalIncome - totalExpenses;

  const estimatedMonthly = useMemo(
    () => calculateMonthlyPayment(mortgageAmount, 5.0, years),
    [mortgageAmount, years]
  );

  const repaymentRatio = useMemo(
    () => (totalIncome > 0 ? (estimatedMonthly / totalIncome) * 100 : 0),
    [estimatedMonthly, totalIncome]
  );

  const b1Disposable = useMemo(() => {
    return (
      borrower1.salary +
      borrower1.rental +
      borrower1.benefits +
      borrower1.other -
      borrower1.loans -
      borrower1.alimony -
      borrower1.otherExpenses
    );
  }, [borrower1]);

  const renderIncomeFields = (
    data: IncomeExpenses,
    setData: React.Dispatch<React.SetStateAction<IncomeExpenses>>,
    label: string
  ) => (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-on-surface">{label}</h4>

      {/* Income */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-secondary">הכנסות</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">משכורת נטו (₪)</label>
            <input
              type="number"
              value={data.salary}
              onChange={(e) => setData((p) => ({ ...p, salary: Number(e.target.value) }))}
              className="editorial-input w-full py-2 text-sm text-on-surface"
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">הכנסות משכירות (₪)</label>
            <input
              type="number"
              value={data.rental}
              onChange={(e) => setData((p) => ({ ...p, rental: Number(e.target.value) }))}
              className="editorial-input w-full py-2 text-sm text-on-surface"
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">קצבאות (₪)</label>
            <input
              type="number"
              value={data.benefits}
              onChange={(e) => setData((p) => ({ ...p, benefits: Number(e.target.value) }))}
              className="editorial-input w-full py-2 text-sm text-on-surface"
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">הכנסות נוספות (₪)</label>
            <input
              type="number"
              value={data.other}
              onChange={(e) => setData((p) => ({ ...p, other: Number(e.target.value) }))}
              className="editorial-input w-full py-2 text-sm text-on-surface"
            />
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-tertiary">הוצאות והתחייבויות</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">
              הלוואות (מעל 18 חודש)
            </label>
            <input
              type="number"
              value={data.loans}
              onChange={(e) => setData((p) => ({ ...p, loans: Number(e.target.value) }))}
              className="editorial-input w-full py-2 text-sm text-on-surface"
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">דמי מזונות (₪)</label>
            <input
              type="number"
              value={data.alimony}
              onChange={(e) => setData((p) => ({ ...p, alimony: Number(e.target.value) }))}
              className="editorial-input w-full py-2 text-sm text-on-surface"
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">התחייבויות אחרות</label>
            <input
              type="number"
              value={data.otherExpenses}
              onChange={(e) =>
                setData((p) => ({ ...p, otherExpenses: Number(e.target.value) }))
              }
              className="editorial-input w-full py-2 text-sm text-on-surface"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="מחשבון רכישת נכס | הבית הכלכלי"
        description="חשבו את יכולת המימון שלכם, אחוז מימון, יחס החזר חודשי והתאמה לדרישות בנק ישראל. כלי תכנון רכישת נכס מקצועי."
      />

      <main dir="rtl" className="min-h-screen bg-surface pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-headline text-3xl font-bold text-primary mb-2">
              מחשבון רכישת נכס
            </h1>
            <p className="text-on-surface-variant text-sm">
              בדקו את יכולת המימון שלכם וקבלו תמונה מלאה לפני רכישת הנכס
            </p>
          </div>

          {/* 12-col grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* ===== Input Section (8 cols) ===== */}
            <div className="lg:col-span-8 space-y-6">
              {/* Property Details Card */}
              <div className="bg-surface-container-low rounded-2xl p-6 editorial-shadow">
                <div className="flex items-center gap-2 mb-5">
                  <span className="material-symbols-outlined text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    home_work
                  </span>
                  <h2 className="font-headline text-lg font-bold text-primary">פרטי הנכס</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">סוג נכס</label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                      className="editorial-input w-full py-2 text-sm text-on-surface bg-transparent"
                    >
                      <option value="residential">דירה למגורים</option>
                      <option value="investment">דירה להשקעה</option>
                      <option value="commercial">נכס מסחרי</option>
                      <option value="land">מגרש</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">שווי הנכס (₪)</label>
                    <input
                      type="number"
                      value={propertyValue}
                      onChange={(e) => setPropertyValue(Number(e.target.value))}
                      className="editorial-input w-full py-2 text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">סכום משכנתא (₪)</label>
                    <input
                      type="number"
                      value={mortgageAmount}
                      onChange={(e) => setMortgageAmount(Number(e.target.value))}
                      className="editorial-input w-full py-2 text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">תקופה בשנים</label>
                    <input
                      type="number"
                      value={years}
                      onChange={(e) => setYears(Number(e.target.value))}
                      className="editorial-input w-full py-2 text-sm text-on-surface"
                    />
                  </div>
                </div>
              </div>

              {/* Income & Expenses Card */}
              <div className="bg-surface-container-low rounded-2xl p-6 editorial-shadow">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      group
                    </span>
                    <h2 className="font-headline text-lg font-bold text-primary">
                      פרטי הכנסות והוצאות
                    </h2>
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center gap-2 bg-surface-container rounded-lg p-1">
                    <button
                      onClick={() => setIsCoupleMode(false)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        !isCoupleMode
                          ? "bg-primary text-on-primary"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      יחיד
                    </button>
                    <button
                      onClick={() => setIsCoupleMode(true)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        isCoupleMode
                          ? "bg-primary text-on-primary"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      זוג
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {renderIncomeFields(borrower1, setBorrower1, isCoupleMode ? "לווה 1" : "פרטי הלווה")}

                  {isCoupleMode && (
                    <>
                      <hr className="border-outline-variant/30" />
                      {renderIncomeFields(borrower2, setBorrower2, "לווה 2")}
                    </>
                  )}
                </div>

                {/* Summary bar */}
                <div className="mt-6 p-3 bg-secondary/10 rounded-xl flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary">
                    {isCoupleMode ? "הכנסה פנויה כוללת:" : "הכנסה פנויה ללווה 1:"}
                  </span>
                  <span className="text-sm font-bold text-secondary">
                    {formatCurrency(isCoupleMode ? disposableIncome : b1Disposable)}
                  </span>
                </div>
              </div>
            </div>

            {/* ===== Results Sticky Card (4 cols) ===== */}
            <div className="lg:col-span-4">
              <div className="sticky top-28 space-y-6">
                <div className="bg-primary rounded-2xl p-6 text-on-primary">
                  <h2 className="font-headline text-lg font-bold mb-5">תוצאות הניתוח</h2>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-on-primary/70">אחוז מימון</span>
                      <span className="text-lg font-bold font-headline">
                        {formatPercent(financingRatio)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-on-primary/70">סה״כ הכנסה פנויה</span>
                      <span className="text-lg font-bold font-headline">
                        {formatCurrency(disposableIncome)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-on-primary/70">החזר חודשי משוער</span>
                      <span className="text-lg font-bold font-headline">
                        {formatCurrency(estimatedMonthly)}
                      </span>
                    </div>

                    <hr className="border-on-primary/20" />

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-on-primary/70">יחס החזר</span>
                      <span
                        className={`text-lg font-bold font-headline ${
                          repaymentRatio > 40 ? "text-on-tertiary-container" : ""
                        }`}
                      >
                        {formatPercent(repaymentRatio)}
                      </span>
                    </div>

                    {repaymentRatio > 40 && (
                      <div className="bg-error/20 text-on-primary rounded-lg p-3 text-xs">
                        <span className="material-symbols-outlined text-sm align-middle ml-1">
                          warning
                        </span>
                        יחס ההחזר עולה על 40% מההכנסה הפנויה. לפי הנחיות בנק ישראל, ייתכן שלא
                        תאושרו לסכום זה. מומלץ להתייעץ עם יועץ משכנתאות.
                      </div>
                    )}
                  </div>

                  <div className="mt-6 space-y-2">
                    <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-on-primary/10 hover:bg-on-primary/20 rounded-xl text-sm font-medium transition-colors">
                      <span className="material-symbols-outlined text-base">download</span>
                      הורדת דו״ח ב-Excel
                    </button>
                    <button className="w-full py-2.5 bg-brand-gold text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                      קבלת המלצות לשיפור התמהיל
                    </button>
                  </div>

                  <p className="mt-4 text-[10px] text-on-primary/50 leading-relaxed">
                    * החישוב מבוסס על ריבית ממוצעת של 5% ומהווה הערכה בלבד. התנאים בפועל
                    ייקבעו ע״י הבנק בהתאם לנתונים האישיים שלכם.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ===== Tips Section ===== */}
          <section className="mt-16">
            <h2 className="font-headline text-2xl font-bold text-primary mb-6 text-center">
              טיפים לרכישה חכמה
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: "trending_up",
                  title: "שיפור יחס החזר",
                  desc: "הקטינו התחייבויות קיימות לפני הגשת בקשה למשכנתא. סגירת הלוואות קטנות יכולה לשפר משמעותית את יחס ההחזר שלכם.",
                },
                {
                  icon: "real_estate_agent",
                  title: "מינוף נכס קיים",
                  desc: "אם יש לכם נכס קיים, ניתן למנף אותו כבטוחה נוספת ולקבל תנאים טובים יותר מהבנק.",
                },
                {
                  icon: "calculate",
                  title: "תכנון מס",
                  desc: "תכנון מס נכון יכול לחסוך עשרות אלפי שקלים. בדקו האם אתם זכאים להקלות במס רכישה.",
                },
              ].map((tip) => (
                <div
                  key={tip.title}
                  className="bg-surface-container-lowest rounded-2xl p-6 editorial-shadow"
                >
                  <span className="material-symbols-outlined text-secondary text-3xl mb-3 block">
                    {tip.icon}
                  </span>
                  <h3 className="font-headline text-base font-bold text-primary mb-2">
                    {tip.title}
                  </h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{tip.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ===== Contact / Lead Form ===== */}
          <section className="mt-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Image overlay */}
              <div className="relative rounded-2xl overflow-hidden min-h-[300px] bg-primary">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-primary/40" />
                <div className="relative z-10 flex flex-col justify-end h-full p-8">
                  <h2 className="font-headline text-2xl font-bold text-on-primary mb-2">
                    מתכננים רכישת נכס?
                  </h2>
                  <p className="text-on-primary/80 text-sm">
                    הצוות שלנו ילווה אתכם בכל שלבי הרכישה - מבדיקת כדאיות ועד קבלת המשכנתא
                    הטובה ביותר
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="bg-surface-container-lowest rounded-2xl p-8 editorial-shadow">
                <h3 className="font-headline text-lg font-bold text-primary mb-6">
                  השאירו פרטים ונחזור אליכם
                </h3>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">שם מלא</label>
                    <input
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                      className="editorial-input w-full py-2 text-sm text-on-surface"
                      placeholder="הזינו את שמכם"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">טלפון</label>
                    <input
                      type="tel"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                      className="editorial-input w-full py-2 text-sm text-on-surface"
                      placeholder="050-0000000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">אימייל</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                      className="editorial-input w-full py-2 text-sm text-on-surface"
                      placeholder="email@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-brand-gold text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
                  >
                    שלח בקשה לייעוץ אישי
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
