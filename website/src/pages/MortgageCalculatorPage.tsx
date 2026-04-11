import { useState, useMemo } from "react";
import SEOHead from "../components/seo/SEOHead";
import {
  generateAmortizationWithGrace,
  generateCPILinkedSchedule,
  formatCurrency,
  formatPercent,
  type GraceType,
  type AmortizationRow,
} from "../utils/mortgageCalculations";

interface MortgageTrack {
  id: number;
  name: string;
  amount: number;
  years: number;
  rate: number;
  expectedCPI: number;
  graceMonths: number;
  graceType: GraceType;
}

const TRACK_TYPE_OPTIONS = [
  'ריבית קבועה לא צמודה (קל"צ)',
  "ריבית משתנה כל 5 שנים לא צמודה",
  "פריים (ריבית משתנה)",
  "ריבית קבועה צמודת מדד",
  "ריבית משתנה כל 5 שנים צמודת מדד",
];

function isTrackCPILinked(name: string): boolean {
  return name.includes("צמודת מדד");
}

function getTrackSchedule(t: MortgageTrack): AmortizationRow[] {
  if (isTrackCPILinked(t.name)) {
    return generateCPILinkedSchedule(t.amount, t.rate, t.years, t.expectedCPI, t.graceMonths, t.graceType);
  }
  return generateAmortizationWithGrace(t.amount, t.rate, t.years, t.graceMonths, t.graceType);
}

interface MixTab {
  id: number;
  label: string;
  tracks: MortgageTrack[];
}

const defaultTracks: MortgageTrack[] = [
  { id: 1, name: 'ריבית קבועה לא צמודה (קל"צ)', amount: 450000, years: 25, rate: 4.8, expectedCPI: 2.5, graceMonths: 0, graceType: "none" },
  { id: 2, name: "פריים (ריבית משתנה)", amount: 350000, years: 30, rate: 6.25, expectedCPI: 2.5, graceMonths: 0, graceType: "none" },
];

let nextTrackId = 3;
let nextMixId = 2;

export default function MortgageCalculatorPage() {
  const [mixes, setMixes] = useState<MixTab[]>([
    { id: 1, label: "תמהיל 1", tracks: defaultTracks },
  ]);
  const [activeMixId, setActiveMixId] = useState(1);
  const [analysisTab, setAnalysisTab] = useState<"amortization" | "interest" | "graph">("amortization");
  const [showAllMonths, setShowAllMonths] = useState(false);

  const activeMix = mixes.find((m) => m.id === activeMixId) ?? mixes[0];
  const tracks = activeMix.tracks;

  const updateTrack = (trackId: number, field: keyof MortgageTrack, value: number | string) => {
    setMixes((prev) =>
      prev.map((mix) =>
        mix.id === activeMixId
          ? {
              ...mix,
              tracks: mix.tracks.map((t) =>
                t.id === trackId ? { ...t, [field]: value } : t
              ),
            }
          : mix
      )
    );
  };

  const removeTrack = (trackId: number) => {
    setMixes((prev) =>
      prev.map((mix) =>
        mix.id === activeMixId
          ? { ...mix, tracks: mix.tracks.filter((t) => t.id !== trackId) }
          : mix
      )
    );
  };

  const addTrack = () => {
    const newTrack: MortgageTrack = {
      id: nextTrackId++,
      name: 'ריבית קבועה לא צמודה (קל"צ)',
      amount: 200000,
      years: 20,
      rate: 5.0,
      expectedCPI: 2.5,
      graceMonths: 0,
      graceType: "none",
    };
    setMixes((prev) =>
      prev.map((mix) =>
        mix.id === activeMixId
          ? { ...mix, tracks: [...mix.tracks, newTrack] }
          : mix
      )
    );
  };

  const addMix = () => {
    if (mixes.length >= 3) return;
    const newMix: MixTab = {
      id: nextMixId++,
      label: `תמהיל ${mixes.length + 1}`,
      tracks: [{ id: nextTrackId++, name: 'ריבית קבועה לא צמודה (קל"צ)', amount: 400000, years: 25, rate: 5.0, expectedCPI: 2.5, graceMonths: 0, graceType: "none" }],
    };
    setMixes((prev) => [...prev, newMix]);
    setActiveMixId(newMix.id);
  };

  // Build per-track schedules using proper CPI/grace logic
  const trackSchedules = useMemo(
    () => tracks.map((t) => ({ id: t.id, schedule: getTrackSchedule(t) })),
    [tracks]
  );

  const combinedSchedule = useMemo(() => {
    if (trackSchedules.length === 0) return [];
    const maxMonths = Math.max(...trackSchedules.map((ts) => ts.schedule.length), 0);
    const combined: AmortizationRow[] = [];
    for (let m = 0; m < maxMonths; m++) {
      let principalPayment = 0;
      let interestPayment = 0;
      let totalPayment = 0;
      let remainingBalance = 0;
      for (const ts of trackSchedules) {
        if (m < ts.schedule.length) {
          principalPayment += ts.schedule[m].principalPayment;
          interestPayment += ts.schedule[m].interestPayment;
          totalPayment += ts.schedule[m].totalPayment;
          remainingBalance += ts.schedule[m].remainingBalance;
        }
      }
      combined.push({ month: m + 1, principalPayment, interestPayment, totalPayment, remainingBalance });
    }
    return combined;
  }, [trackSchedules]);

  // Derive summary from actual schedules (not flat formulas)
  const totalMonthly = useMemo(() => {
    if (combinedSchedule.length === 0) return 0;
    // First regular payment (skip grace months with 0 payment)
    const firstPayment = combinedSchedule.find((r) => r.totalPayment > 0);
    return firstPayment?.totalPayment ?? 0;
  }, [combinedSchedule]);

  const totalRepayment = useMemo(
    () => combinedSchedule.reduce((sum, r) => sum + r.totalPayment, 0),
    [combinedSchedule]
  );

  const totalPrincipal = useMemo(
    () => tracks.reduce((sum, t) => sum + t.amount, 0),
    [tracks]
  );

  const creditCost = totalRepayment - totalPrincipal;

  const displayedSchedule = showAllMonths
    ? combinedSchedule
    : combinedSchedule.slice(0, 5);

  const downloadCSV = () => {
    const headers = ["חודש", "קרן", "ריבית", 'סה"כ', "יתרה"];
    const rows = combinedSchedule.map((row) => [
      row.month,
      Math.round(row.principalPayment),
      Math.round(row.interestPayment),
      Math.round(row.totalPayment),
      Math.round(row.remainingBalance),
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "amortization_schedule.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "" });

  return (
    <>
      <SEOHead
        title="מחשבון משכנתא מקצועי | הבית הכלכלי"
        description="חשבו את ההחזר החודשי, עלות האשראי ולוח הסילוקין של המשכנתא שלכם. השוו בין תמהילי משכנתא שונים בקלות."
      />

      <main dir="rtl" className="min-h-screen bg-surface pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 12-col grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* ===== Input Panel (5 cols) ===== */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <h1 className="font-headline text-3xl font-bold text-primary mb-2">
                  מחשבון משכנתא מקצועי
                </h1>
                <p className="text-on-surface-variant text-sm">
                  <span className="inline-block bg-secondary/10 text-secondary text-xs font-medium px-2 py-0.5 rounded-full ml-2">
                    חינם
                  </span>
                  הזינו את פרטי המשכנתא וקבלו ניתוח מלא בזמן אמת
                </p>
              </div>

              {/* Mix Tabs */}
              <div className="flex items-center gap-2">
                {mixes.map((mix) => (
                  <button
                    key={mix.id}
                    onClick={() => setActiveMixId(mix.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeMixId === mix.id
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {mix.label}
                  </button>
                ))}
                {mixes.length < 3 && (
                  <button
                    onClick={addMix}
                    className="px-3 py-2 text-sm text-secondary hover:text-secondary/80 transition-colors"
                  >
                    + תמהיל חדש
                  </button>
                )}
              </div>

              {/* Track Cards */}
              <div className="space-y-4">
                {tracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="bg-surface-container-lowest rounded-xl p-5 border-r-4 border-secondary editorial-shadow"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-headline text-sm font-bold text-primary">
                        מסלול {idx + 1}: {track.name}
                      </h3>
                      {tracks.length > 1 && (
                        <button
                          onClick={() => removeTrack(track.id)}
                          className="text-on-surface-variant hover:text-error transition-colors"
                          aria-label="מחק מסלול"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-on-surface-variant mb-1">
                          סוג מסלול
                        </label>
                        <select
                          value={track.name}
                          onChange={(e) => updateTrack(track.id, "name", e.target.value)}
                          className="editorial-input w-full py-2 text-sm text-on-surface bg-surface-container-lowest"
                        >
                          {TRACK_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      {isTrackCPILinked(track.name) && (
                        <div>
                          <label className="block text-xs text-on-surface-variant mb-1">
                            מדד צפוי שנתי (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={track.expectedCPI}
                            onChange={(e) =>
                              updateTrack(track.id, "expectedCPI", Number(e.target.value))
                            }
                            className="editorial-input w-full py-2 text-sm text-on-surface"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-on-surface-variant mb-1">
                            תקופת גרייס (חודשים)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="36"
                            value={track.graceMonths}
                            onChange={(e) =>
                              updateTrack(track.id, "graceMonths", Number(e.target.value))
                            }
                            className="editorial-input w-full py-2 text-sm text-on-surface"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-on-surface-variant mb-1">
                            סוג גרייס
                          </label>
                          <select
                            value={track.graceType}
                            onChange={(e) => updateTrack(track.id, "graceType", e.target.value)}
                            className="editorial-input w-full py-2 text-sm text-on-surface bg-surface-container-lowest"
                          >
                            <option value="none">ללא</option>
                            <option value="interest-only">ריבית בלבד</option>
                            <option value="full">גרייס מלא</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-on-surface-variant mb-1">
                            סכום (₪)
                          </label>
                          <input
                            type="number"
                            value={track.amount}
                            onChange={(e) =>
                              updateTrack(track.id, "amount", Number(e.target.value))
                            }
                            className="editorial-input w-full py-2 text-sm text-on-surface"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-on-surface-variant mb-1">
                            שנים
                          </label>
                          <input
                            type="number"
                            value={track.years}
                            onChange={(e) =>
                              updateTrack(track.id, "years", Number(e.target.value))
                            }
                            className="editorial-input w-full py-2 text-sm text-on-surface"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-on-surface-variant mb-1">
                            ריבית (%)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            value={track.rate}
                            onChange={(e) =>
                              updateTrack(track.id, "rate", Number(e.target.value))
                            }
                            className="editorial-input w-full py-2 text-sm text-on-surface"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Track */}
                <button
                  onClick={addTrack}
                  className="w-full py-4 border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant text-sm font-medium hover:border-secondary hover:text-secondary transition-colors"
                >
                  <span className="material-symbols-outlined text-base align-middle ml-1">add</span>
                  הוספת מסלול חדש
                </button>
              </div>
            </div>

            {/* ===== Results Panel (7 cols) ===== */}
            <div className="lg:col-span-7 space-y-6">
              {/* Summary Card */}
              <div className="bg-primary rounded-2xl p-6 text-on-primary">
                <h2 className="font-headline text-lg font-bold mb-4">סיכום המשכנתא</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-on-primary/70 mb-1">החזר חודשי</p>
                    <p className="text-2xl font-bold font-headline">
                      {formatCurrency(totalMonthly)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-on-primary/70 mb-1">סה״כ החזר</p>
                    <p className="text-2xl font-bold font-headline">
                      {formatCurrency(totalRepayment)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-on-primary/70 mb-1">עלות אשראי</p>
                    <p className="text-2xl font-bold font-headline text-on-tertiary-container">
                      {formatCurrency(creditCost)}
                    </p>
                  </div>
                </div>

                {/* Per-track breakdown */}
                <div className="mt-4 pt-4 border-t border-on-primary/20 space-y-2">
                  {tracks.map((t, idx) => {
                    const ts = trackSchedules.find((s) => s.id === t.id);
                    const firstPayment = ts?.schedule.find((r) => r.totalPayment > 0);
                    const mp = firstPayment?.totalPayment ?? 0;
                    return (
                      <div key={t.id} className="flex justify-between text-sm">
                        <span className="text-on-primary/80">
                          מסלול {idx + 1} ({formatPercent(t.rate)}{isTrackCPILinked(t.name) ? ` + מדד ${formatPercent(t.expectedCPI)}` : ""}{t.graceType !== "none" ? ` | גרייס ${t.graceMonths} חודשים` : ""})
                        </span>
                        <span className="font-medium">{formatCurrency(mp)}/חודש</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Analysis Section */}
              <div className="bg-surface-container-lowest rounded-2xl editorial-shadow overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-outline-variant/30">
                  {[
                    { key: "amortization" as const, label: "לוח סילוקין" },
                    { key: "interest" as const, label: "פילוח ריביות" },
                    { key: "graph" as const, label: "גרף החזרים" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setAnalysisTab(tab.key)}
                      className={`flex-1 py-3 text-sm font-medium transition-colors ${
                        analysisTab === tab.key
                          ? "text-secondary border-b-2 border-secondary"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {analysisTab === "amortization" && (
                    <div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          onClick={downloadCSV}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-secondary bg-secondary/10 rounded-lg hover:bg-secondary/20 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                          הורדה
                        </button>
                        <button
                          onClick={handlePrint}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-secondary bg-secondary/10 rounded-lg hover:bg-secondary/20 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">print</span>
                          הדפסה
                        </button>
                      </div>

                      {/* Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-surface-container-low text-on-surface-variant">
                              <th className="py-2 px-3 text-right font-medium">חודש</th>
                              <th className="py-2 px-3 text-right font-medium">קרן</th>
                              <th className="py-2 px-3 text-right font-medium">ריבית</th>
                              <th className="py-2 px-3 text-right font-medium">סה״כ</th>
                              <th className="py-2 px-3 text-right font-medium">יתרה</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayedSchedule.map((row) => (
                              <tr
                                key={row.month}
                                className="border-b border-outline-variant/20 hover:bg-surface-container-low/50"
                              >
                                <td className="py-2 px-3">{row.month}</td>
                                <td className="py-2 px-3">{formatCurrency(row.principalPayment)}</td>
                                <td className="py-2 px-3">{formatCurrency(row.interestPayment)}</td>
                                <td className="py-2 px-3 font-medium">{formatCurrency(row.totalPayment)}</td>
                                <td className="py-2 px-3">{formatCurrency(row.remainingBalance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {!showAllMonths && combinedSchedule.length > 5 && (
                        <button
                          onClick={() => setShowAllMonths(true)}
                          className="mt-4 w-full py-2 text-sm font-medium text-secondary hover:text-secondary/80 transition-colors"
                        >
                          הצג את כל {combinedSchedule.length} החודשים
                        </button>
                      )}
                      {showAllMonths && (
                        <button
                          onClick={() => setShowAllMonths(false)}
                          className="mt-4 w-full py-2 text-sm font-medium text-secondary hover:text-secondary/80 transition-colors"
                        >
                          הסתר
                        </button>
                      )}
                    </div>
                  )}

                  {analysisTab === "interest" && (
                    <div className="space-y-4">
                      <h3 className="font-headline text-sm font-bold text-primary">
                        פילוח ריביות לפי מסלול
                      </h3>
                      {tracks.map((t, idx) => {
                        const ts = trackSchedules.find((s) => s.id === t.id);
                        const totalTrack = ts?.schedule.reduce((s, r) => s + r.totalPayment, 0) ?? 0;
                        const interestTotal = ts?.schedule.reduce((s, r) => s + r.interestPayment, 0) ?? 0;
                        const interestPct = totalTrack > 0 ? (interestTotal / totalTrack) * 100 : 0;
                        return (
                          <div key={t.id} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-on-surface-variant">
                                מסלול {idx + 1}: {t.name}
                              </span>
                              <span className="font-medium text-on-surface">
                                {formatCurrency(interestTotal)} ריבית
                              </span>
                            </div>
                            <div className="w-full bg-surface-container-high rounded-full h-2">
                              <div
                                className="bg-secondary rounded-full h-2 transition-all"
                                style={{ width: `${Math.min(interestPct, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-on-surface-variant">
                              {formatPercent(interestPct)} מסך ההחזר
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {analysisTab === "graph" && (
                    <div className="space-y-3">
                      <h3 className="font-headline text-sm font-bold text-primary">
                        גרף החזרים חודשיים
                      </h3>
                      <div className="h-48 flex items-center justify-center text-on-surface-variant text-sm">
                        {/* Simplified bar visualization */}
                        <div className="w-full space-y-2">
                          {tracks.map((t, idx) => {
                            const ts = trackSchedules.find((s) => s.id === t.id);
                            const firstPayment = ts?.schedule.find((r) => r.totalPayment > 0);
                            const mp = firstPayment?.totalPayment ?? 0;
                            const allMps = tracks.map((tr) => {
                              const s = trackSchedules.find((s) => s.id === tr.id);
                              return s?.schedule.find((r) => r.totalPayment > 0)?.totalPayment ?? 0;
                            });
                            const maxMp = Math.max(...allMps);
                            const widthPct = maxMp > 0 ? (mp / maxMp) * 100 : 0;
                            return (
                              <div key={t.id} className="flex items-center gap-3">
                                <span className="text-xs w-20 text-left">מסלול {idx + 1}</span>
                                <div className="flex-1 bg-surface-container-high rounded-full h-6">
                                  <div
                                    className="bg-secondary rounded-full h-6 flex items-center justify-end px-2 transition-all"
                                    style={{ width: `${widthPct}%` }}
                                  >
                                    <span className="text-xs text-white font-medium">
                                      {formatCurrency(mp)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== Contact Section ===== */}
          <section className="mt-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Image overlay */}
              <div className="relative rounded-2xl overflow-hidden min-h-[300px] bg-primary">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-primary/40" />
                <div className="relative z-10 flex flex-col justify-end h-full p-8">
                  <h2 className="font-headline text-2xl font-bold text-on-primary mb-2">
                    רוצים ייעוץ משכנתא אישי?
                  </h2>
                  <p className="text-on-primary/80 text-sm">
                    המומחים שלנו יבנו עבורכם תמהיל משכנתא מותאם אישית שיחסוך לכם עשרות אלפי שקלים
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
