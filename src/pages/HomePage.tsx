import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "../components/seo/SEOHead";

const HERO_IMG = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80";

const services = [
  { icon: "house", title: "משכנתא חדשה", desc: "ליווי מקיף לרכישת הבית הראשון שלכם. אנחנו נבנה עבורכם את התמהיל המדויק ונדאג לריביות הטובות ביותר.", large: true },
  { icon: "refresh", title: "מחזור משכנתא", desc: "בדיקה מקיפה של המשכנתא הקיימת. ייתכן שאתם משלמים אלפי שקלים מיותרים בכל חודש.", large: false },
  { icon: "real_estate_agent", title: "ייעוץ למשפרי דיור", desc: "עוברים לבית גדול יותר? נעזור לכם לגשר על הפער הפיננסי בחוכמה.", large: false },
  { icon: "payments", title: "משכנתא לכל מטרה", desc: "שיפוץ, סגירת חובות או השקעה? נשתמש בנכס הקיים שלכם כדי לגייס הון בתנאים מועדפים.", large: false },
];

const steps = [
  { num: "1", title: "פגישת הכרות", desc: "ניתוח הצרכים, היכולות הכלכליות והמטרות שלכם לעומק." },
  { num: "2", title: "בניית תמהיל אישי", desc: "תכנון פיננסי מקצועי שמותאם לחיים שלכם ולא רק לריבית של היום." },
  { num: "3", title: 'מו"מ מול הבנקים', desc: "אנחנו נלחמים עבורכם מול כל המוסדות הפיננסיים להשגת התנאים הכי טובים." },
  { num: "4", title: "חתימה וחיסכון", desc: "ליווי צמוד עד לחתימה בבנק והתחלת הדרך לחיסכון משמעותי." },
];

const testimonials = [
  { name: "יוסי כהן", role: "רכישת דירה בראשון לציון", text: "לא האמנתי כמה אפשר לחסוך עד שראיתי את התמהיל שקיבלתי. מקצועיות ללא פשרות ויחס אישי מדהים.", dark: false },
  { name: "מיכל לוי", role: "מחזור משכנתא", text: 'הגענו למחזור משכנתא וגילינו שאנחנו פשוט זורקים כסף לפח. התהליך היה מהיר, שקוף וחסך לנו 800 ש"ח בהחזר החודשי.', dark: true },
  { name: "אביב מזרחי", role: "משפרי דיור", text: "ייעוץ חובה לכל מי שקונה דירה. הליווי מול הבנקים חסך לנו המון כאב ראש ובעיקר המון כסף בריביות.", dark: false },
];

export default function HomePage() {
  const [contactForm, setContactForm] = useState({ name: "", phone: "", service: "משכנתא חדשה" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.phone.trim()) return;

    const message = `שלום, אני ${contactForm.name}.%0Aאשמח לקבל ייעוץ בנושא: ${contactForm.service}.%0Aטלפון: ${contactForm.phone}`;
    window.open(`https://wa.me/972542091980?text=${message}`, "_blank");
    setSubmitted(true);
  };

  return (
    <>
      <SEOHead
        title="הבית הכלכלי | יועץ משכנתאות מומחה"
        description="הבית הכלכלי - יועץ משכנתאות מומחה. ליווי מקצועי ברכישת דירה, מחזור משכנתא, איחוד הלוואות ותכנון פיננסי. חסכו עשרות אלפי שקלים."
        keywords="יועץ משכנתאות, משכנתא, מחזור משכנתא, רכישת דירה, איחוד הלוואות, ייעוץ פיננסי"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FinancialService",
          name: "הבית הכלכלי",
          description: "יועץ משכנתאות מומחה - ליווי מקצועי ברכישת דירה, מחזור משכנתא ואיחוד הלוואות",
          telephone: "054-209-1980",
          email: "habaithacalcali@gmail.com",
          address: { "@type": "PostalAddress", streetAddress: "רמת גן", addressLocality: "רמת גן", addressCountry: "IL" },
        }}
      />

      {/* Hero */}
      <section className="relative min-h-[600px] lg:min-h-[750px] flex items-center overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-container">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative z-10">
              <span className="inline-block px-4 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold tracking-widest mb-6">
                יועץ משכנתאות מומחה
              </span>
              <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6 tracking-tight">
                הדרך לבית החלומות מתחילה בייעוץ נכון
              </h1>
              <p className="text-lg md:text-xl text-on-primary-container max-w-xl mb-10">
                יועץ משכנתאות מומחה שעוזר לכם לחסוך עשרות אלפי שקלים ולהבטיח את עתידכם הכלכלי.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#contact" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-tertiary-container text-white rounded-lg text-base font-bold shadow-xl hover:opacity-90 transition-all active:scale-95">
                  <span className="material-symbols-outlined text-xl">calendar_month</span>
                  תיאום פגישת ייעוץ ללא עלות
                </a>
                <a href="#services" className="inline-flex items-center justify-center px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg text-base font-semibold hover:bg-white/20 transition-all">
                  צפה בשירותים שלנו
                </a>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl rotate-2 border-8 border-white/5">
                <img src={HERO_IMG} alt="בית מודרני" className="w-full h-full object-cover" loading="eager" />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-surface-container-lowest/80 backdrop-blur-2xl p-6 rounded-xl shadow-2xl max-w-[220px]">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-tertiary text-3xl">savings</span>
                  <div className="text-primary font-bold text-xl font-headline">₪120,000+</div>
                </div>
                <p className="text-on-surface-variant text-xs leading-relaxed">ממוצע חיסכון בתיקי המשכנתאות של הלקוחות שלנו</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-headline text-3xl md:text-4xl font-bold text-primary mb-4">השירותים שלנו</h2>
            <p className="text-on-surface-variant text-lg max-w-2xl mx-auto">מעטפת מקצועית מלאה לכל שלב בדרך לדירה, עם דגש על חיסכון מקסימלי וביטחון כלכלי.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((s) => (
              <article key={s.title} className={`rounded-xl p-8 transition-all hover:shadow-xl ${s.large ? "bg-surface-container-low md:col-span-2 md:flex md:items-start md:gap-8" : s.title === "מחזור משכנתא" ? "bg-primary text-white" : "bg-surface-container-lowest border border-outline-variant/20"}`}>
                <span className={`material-symbols-outlined text-4xl mb-4 block ${s.title === "מחזור משכנתא" ? "text-tertiary-fixed-dim" : "text-secondary"}`}>{s.icon}</span>
                <div>
                  <h3 className={`text-xl font-bold mb-2 ${s.title === "מחזור משכנתא" ? "" : "text-primary"}`}>{s.title}</h3>
                  <p className={`leading-relaxed ${s.title === "מחזור משכנתא" ? "text-on-primary-container" : "text-on-surface-variant"}`}>{s.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-surface-container-low">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-headline text-3xl md:text-4xl font-bold text-primary mb-16 text-center">איך זה עובד?</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.num} className="bg-surface-container-lowest p-8 rounded-xl shadow-sm text-center relative">
                <div className={`w-12 h-12 ${s.num === "4" ? "bg-tertiary" : "bg-primary"} text-white rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-6 absolute -top-6 left-1/2 -translate-x-1/2`}>{s.num}</div>
                <h4 className="text-lg font-bold text-primary mb-3 mt-4">{s.title}</h4>
                <p className="text-on-surface-variant text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-headline text-3xl md:text-4xl font-bold text-primary mb-4">לקוחות מספרים</h2>
          <p className="text-on-surface-variant text-lg mb-12 max-w-xl">ההצלחה שלנו נמדדת בביטחון של הלקוחות שלנו.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className={`p-8 rounded-2xl relative ${t.dark ? "bg-primary text-white shadow-xl" : "bg-surface-container-low"}`}>
                <span className={`material-symbols-outlined text-5xl absolute top-4 right-4 ${t.dark ? "text-white/10" : "text-tertiary-container/20"}`}>format_quote</span>
                <p className={`text-base leading-relaxed mb-6 relative z-10 italic ${t.dark ? "" : "text-primary"}`}>"{t.text}"</p>
                <div>
                  <h5 className={`font-bold text-sm ${t.dark ? "" : "text-primary"}`}>{t.name}</h5>
                  <p className={`text-xs ${t.dark ? "text-on-primary-container" : "text-on-surface-variant"}`}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calculators CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-surface-container-highest">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">כלים לתכנון פיננסי</h2>
          <p className="text-on-surface-variant mb-10 max-w-lg mx-auto">השתמשו במחשבונים המקצועיים שלנו לתכנון המשכנתא שלכם</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { to: "/mortgage-calculator", icon: "calculate", label: "מחשבון משכנתא" },
              { to: "/purchase-calculator", icon: "home_work", label: "מחשבון רכישת דירה" },
              { to: "/consolidation-calculator", icon: "account_balance", label: "מחשבון איחוד הלוואות" },
            ].map((c) => (
              <Link key={c.to} to={c.to} className="flex flex-col items-center gap-3 p-6 bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-lg transition-all group">
                <span className="material-symbols-outlined text-secondary text-4xl group-hover:scale-110 transition-transform">{c.icon}</span>
                <span className="font-headline font-bold text-primary text-sm">{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-surface-container-highest/50">
        <div className="max-w-5xl mx-auto bg-surface-container-lowest rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
          <div className="md:w-1/2 p-10 bg-primary text-white">
            <h2 className="font-headline text-3xl font-bold mb-6">בואו נתחיל לחסוך</h2>
            <p className="text-on-primary-container text-base mb-10">השאירו פרטים ויועץ מומחה יחזור אליכם לשיחת ייעוץ ראשונית ללא כל התחייבות.</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary-fixed-dim">call</span>
                <span dir="ltr">054-209-1980</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary-fixed-dim">mail</span>
                <span>habaithacalcali@gmail.com</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary-fixed-dim">location_on</span>
                <span>רמת גן</span>
              </div>
            </div>
          </div>
          <div className="md:w-1/2 p-10">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <span className="material-symbols-outlined text-6xl text-tertiary mb-4">check_circle</span>
                <h3 className="font-headline text-2xl font-bold text-primary mb-2">הפנייה נשלחה בהצלחה!</h3>
                <p className="text-on-surface-variant mb-6">ניצור איתך קשר בהקדם.</p>
                <button onClick={() => { setSubmitted(false); setContactForm({ name: "", phone: "", service: "משכנתא חדשה" }); }} className="px-6 py-2 bg-surface-container text-primary rounded-lg font-medium hover:bg-surface-container-high transition-all">
                  שליחת פנייה נוספת
                </button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">שם מלא</label>
                  <input type="text" required value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))} className="editorial-input w-full py-3 text-base" placeholder="ישראל ישראלי" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">טלפון</label>
                  <input type="tel" required value={contactForm.phone} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))} className="editorial-input w-full py-3 text-base" placeholder="050-0000000" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">סוג השירות</label>
                  <select value={contactForm.service} onChange={(e) => setContactForm((p) => ({ ...p, service: e.target.value }))} className="editorial-input w-full py-3 text-base bg-transparent">
                    <option>משכנתא חדשה</option>
                    <option>מחזור משכנתא</option>
                    <option>משכנתא לכל מטרה</option>
                    <option>ייעוץ כללי</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-4 bg-brand-gold text-white rounded-lg font-bold text-lg hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined">send</span>
                  שליחת בקשה בוואטסאפ
                </button>
                <p className="text-center text-xs text-on-surface-variant">או התקשרו ישירות: <a href="tel:0542091980" className="text-primary font-bold hover:underline" dir="ltr">054-209-1980</a></p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Mobile FAB */}
      <div className="fixed bottom-6 left-6 md:hidden z-40">
        <a href="tel:0542091980" className="w-14 h-14 bg-brand-gold text-white rounded-full shadow-2xl flex items-center justify-center" aria-label="התקשר עכשיו">
          <span className="material-symbols-outlined">call</span>
        </a>
      </div>
    </>
  );
}
