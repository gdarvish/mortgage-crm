import { useState, useMemo, useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import SEOHead from "../components/seo/SEOHead";
import { calculateMonthlyPayment, formatCurrency } from "../utils/mortgageCalculations";

Chart.register(...registerables);

interface Loan {
  id: number;
  name: string;
  balance: number;
  rate: number;
  months: number;
  included: boolean;
}

let nextId = 3;

const defaultLoans: Loan[] = [
  { id: 1, name: "הלוואה אישית", balance: 50000, rate: 8, months: 48, included: true },
  { id: 2, name: "רכב", balance: 85000, rate: 6.5, months: 60, included: true },
];

export default function ConsolidationCalculatorPage() {
  const [loans, setLoans] = useState<Loan[]>(defaultLoans);
  const [newRate, setNewRate] = useState(4.5);
  const [newMonths, setNewMonths] = useState(120);
  const [contactForm, setContactForm] = useState({ name: "", phone: "" });
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const includedLoans = useMemo(() => loans.filter((l) => l.included), [loans]);

  const totalBalance = useMemo(() => includedLoans.reduce((s, l) => s + l.balance, 0), [includedLoans]);

  const currentMonthly = useMemo(
    () => includedLoans.reduce((s, l) => s + calculateMonthlyPayment(l.balance, l.rate, l.months / 12), 0),
    [includedLoans]
  );

  const consolidatedMonthly = useMemo(
    () => calculateMonthlyPayment(totalBalance, newRate, newMonths / 12),
    [totalBalance, newRate, newMonths]
  );

  const monthlySaving = currentMonthly - consolidatedMonthly;
  const savingPct = currentMonthly > 0 ? Math.round((monthlySaving / currentMonthly) * 100) : 0;

  const currentTotalInterest = useMemo(
    () => includedLoans.reduce((s, l) => {
      const mp = calculateMonthlyPayment(l.balance, l.rate, l.months / 12);
      return s + (mp * l.months - l.balance);
    }, 0),
    [includedLoans]
  );

  const consolidatedTotalInterest = useMemo(
    () => consolidatedMonthly * newMonths - totalBalance,
    [consolidatedMonthly, newMonths, totalBalance]
  );

  const updateLoan = (id: number, field: keyof Loan, value: string | number | boolean) => {
    setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const removeLoan = (id: number) => setLoans((prev) => prev.filter((l) => l.id !== id));

  const addLoan = () => {
    setLoans((prev) => [...prev, { id: nextId++, name: "הלוואה חדשה", balance: 30000, rate: 7, months: 36, included: true }]);
  };

  const loadDemo = () => setLoans(defaultLoans.map((l, i) => ({ ...l, id: nextId++ + i })));

  // Chart
  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    const g1 = ctx.createLinearGradient(0, 0, 0, 300);
    g1.addColorStop(0, "rgba(20,105,109,0.2)");
    g1.addColorStop(1, "rgba(20,105,109,0)");
    const g2 = ctx.createLinearGradient(0, 0, 0, 300);
    g2.addColorStop(0, "rgba(255,155,62,0.2)");
    g2.addColorStop(1, "rgba(255,155,62,0)");

    const maxMonth = Math.max(newMonths, ...includedLoans.map((l) => l.months));
    const labels = Array.from({ length: 6 }, (_, i) => `חודש ${Math.round((maxMonth / 5) * i) || 1}`);
    const currentData = labels.map((_, i) => {
      const m = Math.round((maxMonth / 5) * i);
      return includedLoans.reduce((s, l) => s + (m < l.months ? calculateMonthlyPayment(l.balance, l.rate, l.months / 12) : 0), 0);
    });
    const consolidatedData = labels.map((_, i) => {
      const m = Math.round((maxMonth / 5) * i);
      return m < newMonths ? consolidatedMonthly : 0;
    });

    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "החזר נוכחי", data: currentData, borderColor: "#14696d", backgroundColor: g1, fill: true, tension: 0.4, borderWidth: 3 },
          { label: "החזר מאוחד", data: consolidatedData, borderColor: "#ff9b3e", backgroundColor: g2, fill: true, tension: 0, borderWidth: 3, borderDash: [5, 5] },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", rtl: true, labels: { font: { family: "Assistant", size: 12 }, usePointStyle: true, padding: 20 } } },
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
          x: { grid: { display: false } },
        },
      },
    });

    return () => { chartInstance.current?.destroy(); };
  }, [includedLoans, newRate, newMonths, consolidatedMonthly]);

  return (
    <>
      <SEOHead
        title="מחשבון איחוד הלוואות | הבית הכלכלי"
        description="אחדו את כל ההלוואות שלכם להלוואה אחת בריבית נמוכה. חשבו את החיסכון החודשי וקבלו ייעוץ מקצועי."
        keywords="איחוד הלוואות, איחוד חובות, הלוואה מאוחדת, מחשבון הלוואות"
      />

      <div className="min-h-screen bg-surface pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10 max-w-3xl">
            <span className="text-secondary font-bold tracking-widest uppercase text-xs mb-3 block">ניהול חובות חכם</span>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-primary mb-4">מחשבון איחוד הלוואות</h1>
            <p className="text-on-surface-variant text-base leading-relaxed">הפוך את הלחץ הכלכלי לשקט נפשי. איחוד הלוואות חכם מאפשר לך להפחית את ההחזר החודשי.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left - Inputs */}
            <div className="lg:col-span-8 space-y-6">
              {/* Loans Table */}
              <div className="bg-surface-container-lowest p-6 rounded-xl editorial-shadow">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <h2 className="font-headline text-xl font-bold text-primary">הלוואות קיימות</h2>
                  <div className="flex gap-2">
                    <button onClick={loadDemo} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-all">
                      <span className="material-symbols-outlined text-sm">database</span>נתוני דמו
                    </button>
                    <button onClick={addLoan} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:opacity-90 transition-all">
                      <span className="material-symbols-outlined text-sm">add</span>הוספת הלוואה
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="bg-surface-container-high text-on-surface-variant font-bold">
                        <th className="p-3 rounded-r-lg">שם</th>
                        <th className="p-3">יתרה (₪)</th>
                        <th className="p-3">ריבית (%)</th>
                        <th className="p-3">חודשים</th>
                        <th className="p-3">כלול</th>
                        <th className="p-3 rounded-l-lg"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {loans.map((l) => (
                        <tr key={l.id}>
                          <td className="p-3"><input type="text" value={l.name} onChange={(e) => updateLoan(l.id, "name", e.target.value)} className="editorial-input w-full" /></td>
                          <td className="p-3"><input type="number" value={l.balance} onChange={(e) => updateLoan(l.id, "balance", Number(e.target.value))} className="editorial-input w-full" /></td>
                          <td className="p-3"><input type="number" step="0.1" value={l.rate} onChange={(e) => updateLoan(l.id, "rate", Number(e.target.value))} className="editorial-input w-full" /></td>
                          <td className="p-3"><input type="number" value={l.months} onChange={(e) => updateLoan(l.id, "months", Number(e.target.value))} className="editorial-input w-full" /></td>
                          <td className="p-3 text-center"><input type="checkbox" checked={l.included} onChange={(e) => updateLoan(l.id, "included", e.target.checked)} className="w-4 h-4 rounded text-secondary" /></td>
                          <td className="p-3 text-center"><button onClick={() => removeLoan(l.id)} className="text-error/70 hover:text-error"><span className="material-symbols-outlined text-lg">delete</span></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Consolidated Parameters */}
              <div className="bg-surface-container-lowest p-6 rounded-xl editorial-shadow">
                <h2 className="font-headline text-xl font-bold text-primary mb-6">פרמטרים להלוואה המאוחדת</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">סכום מאוחד (₪)</label>
                    <div className="text-xl font-bold text-primary">{formatCurrency(totalBalance)}</div>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">ריבית שנתית (%)</label>
                    <input type="number" step="0.1" value={newRate} onChange={(e) => setNewRate(Number(e.target.value))} className="editorial-input w-full text-xl font-bold text-secondary" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">תקופה (חודשים)</label>
                    <input type="number" value={newMonths} onChange={(e) => setNewMonths(Number(e.target.value))} className="editorial-input w-full text-xl font-bold text-secondary" />
                  </div>
                </div>
              </div>

              {/* Download/Print */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const rows = [
                      ["שם הלוואה", "יתרה", "ריבית", "חודשים", "החזר חודשי"],
                      ...includedLoans.map(l => [l.name, l.balance.toString(), l.rate.toString(), l.months.toString(), Math.round(calculateMonthlyPayment(l.balance, l.rate, l.months / 12)).toString()]),
                      [],
                      ["סיכום", "", "", "", ""],
                      ["החזר נוכחי", Math.round(currentMonthly).toString()],
                      ["החזר מאוחד", Math.round(consolidatedMonthly).toString()],
                      ["חיסכון חודשי", Math.round(monthlySaving).toString()],
                    ];
                    const csv = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "consolidation-report.csv"; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-container-lowest rounded-xl editorial-shadow text-sm font-medium text-secondary hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  הורדת דו״ח
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-container-lowest rounded-xl editorial-shadow text-sm font-medium text-secondary hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  הדפסה
                </button>
              </div>

              {/* Chart */}
              <div className="bg-surface-container-lowest p-6 rounded-xl editorial-shadow">
                <h2 className="font-headline text-xl font-bold text-primary mb-6">השוואת החזר חודשי</h2>
                <div className="h-64 md:h-80 relative">
                  <canvas ref={chartRef} />
                </div>
              </div>
            </div>

            {/* Right - Summary */}
            <div className="lg:col-span-4 space-y-6">
              <div className="sticky top-24 space-y-6">
                <div className="bg-primary text-white p-6 rounded-xl editorial-shadow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-28 h-28 bg-primary-container/20 -mr-14 -mt-14 rounded-full" />
                  <h3 className="font-headline text-lg font-bold mb-6 relative z-10">סיכום תמונת מצב</h3>
                  <div className="space-y-6 relative z-10">
                    <div>
                      <p className="text-primary-fixed/70 text-xs mb-1 uppercase font-bold tracking-widest">החזר חודשי נוכחי</p>
                      <p className="text-3xl font-extrabold font-headline">{formatCurrency(currentMonthly)}</p>
                    </div>
                    <div className="pt-4 border-t border-primary-container">
                      <p className="text-primary-fixed/70 text-xs mb-1 uppercase font-bold tracking-widest">החזר חודשי מאוחד</p>
                      <p className="text-3xl font-extrabold font-headline text-on-tertiary-container">{formatCurrency(consolidatedMonthly)}</p>
                    </div>
                    <div className="pt-4 border-t border-primary-container">
                      <div className="flex items-center justify-between">
                        <p className="text-primary-fixed/70 text-xs uppercase font-bold tracking-widest">חיסכון חודשי</p>
                        {savingPct > 0 && <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-xs font-bold">{savingPct}% פחות</span>}
                      </div>
                      <p className="text-4xl font-black font-headline text-white mt-1">{formatCurrency(monthlySaving)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-on-surface-variant text-xs font-bold uppercase mb-1">ריבית קיימת</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(currentTotalInterest)}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-on-surface-variant text-xs font-bold uppercase mb-1">ריבית באיחוד</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(consolidatedTotalInterest)}</p>
                    </div>
                  </div>
                  <hr className="border-surface-container-highest" />
                  <div>
                    <p className="text-on-surface-variant text-xs font-bold uppercase mb-2">תובנת מומחה</p>
                    <p className="text-on-surface-variant text-sm leading-relaxed italic">
                      {consolidatedTotalInterest > currentTotalInterest
                        ? "איחוד זה מקטין את ההחזר החודשי אך מגדיל את סך הריבית עקב הארכת התקופה. מומלץ רק אם הצורך בתזרים חודשי קריטי."
                        : "איחוד זה חוסך גם בהחזר החודשי וגם בסך הריבית הכוללת. עסקה מצוינת!"}
                    </p>
                  </div>
                </div>

                {/* Lead form */}
                <div className="bg-primary p-6 rounded-xl text-white">
                  <h3 className="font-headline text-lg font-bold mb-4">רוצים להתחיל?</h3>
                  <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                    <div>
                      <label className="block text-xs text-white/50 uppercase tracking-widest mb-1">שם מלא</label>
                      <input type="text" value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))} className="w-full bg-transparent border-0 border-b-2 border-outline-variant focus:border-secondary-fixed-dim focus:ring-0 text-white p-2" placeholder="הכנס את שמך" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 uppercase tracking-widest mb-1">טלפון</label>
                      <input type="tel" value={contactForm.phone} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))} className="w-full bg-transparent border-0 border-b-2 border-outline-variant focus:border-secondary-fixed-dim focus:ring-0 text-white p-2" placeholder="050-0000000" />
                    </div>
                    <button type="submit" className="w-full bg-tertiary-container text-white font-bold py-4 rounded-lg shadow-xl hover:opacity-90 transition-all active:scale-95">
                      שלח בקשה לייעוץ
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
