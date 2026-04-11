import SEOHead from "../components/seo/SEOHead";

export default function AccessibilityPage() {
  return (
    <>
      <SEOHead
        title="הצהרת נגישות | הבית הכלכלי"
        description="הצהרת הנגישות של אתר הבית הכלכלי - מחויבים לנגישות דיגיטלית לכלל האוכלוסייה."
      />

      <div className="min-h-screen bg-surface pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-headline text-3xl font-bold text-primary mb-8">הצהרת נגישות</h1>
          <div className="bg-surface-container-lowest rounded-2xl p-8 editorial-shadow prose-rtl space-y-6 text-on-surface-variant text-sm leading-relaxed">

            <p className="text-xs text-on-surface-variant/60">עדכון אחרון: אפריל 2026</p>

            <section>
              <h2 className="font-headline text-lg font-bold text-primary mb-3">1. מחויבותנו לנגישות</h2>
              <p>
                "הבית הכלכלי" מחויב להנגשת האתר ושירותיו לכלל האוכלוסייה, לרבות אנשים עם מוגבלויות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998, ותקנות הנגישות לשירותי אינטרנט (התשע"ג-2013), ובהתאם לתקן הישראלי ת"י 5568 המבוסס על הנחיות WCAG 2.1 ברמת AA.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-lg font-bold text-primary mb-3">2. פעולות הנגשה שבוצעו</h2>
              <p>במסגרת מחויבותנו לנגישות, בוצעו באתר ההתאמות הבאות:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>התאמה לקוראי מסך (Screen Readers) באמצעות תגיות ARIA ומבנה HTML סמנטי.</li>
                <li>ניווט מלא באמצעות מקלדת בלבד.</li>
                <li>ניגודיות צבעים מותאמת לתקן WCAG AA.</li>
                <li>אפשרות להגדלת טקסט ושינוי גודל גופן.</li>
                <li>אפשרות להפעלת מצב ניגודיות גבוהה.</li>
                <li>אפשרות להשבתת אנימציות לאנשים הרגישים לתנועה.</li>
                <li>כפתור נגישות צף בכל עמודי האתר לגישה מהירה לאפשרויות הנגישות.</li>
                <li>שימוש בטקסט חלופי (alt) לתמונות.</li>
                <li>מבנה כותרות היררכי ברור.</li>
                <li>טפסים מסומנים עם תוויות (labels) מתאימות.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-headline text-lg font-bold text-primary mb-3">3. כפתור הנגישות</h2>
              <p>
                בכל עמוד באתר מופיע כפתור נגישות (אייקון נגישות) בפינה השמאלית התחתונה של המסך. לחיצה עליו תפתח תפריט עם אפשרויות הנגשה:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>גודל טקסט:</strong> הגדלה והקטנה של גודל הטקסט באתר.</li>
                <li><strong>ניגודיות גבוהה:</strong> מעבר למצב ניגודיות גבוהה לנוחות קריאה.</li>
                <li><strong>השבתת אנימציות:</strong> עצירת כל האנימציות והמעברים באתר.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-headline text-lg font-bold text-primary mb-3">4. טכנולוגיות נתמכות</h2>
              <p>האתר נבנה לתמוך בטכנולוגיות הבאות:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>דפדפנים: Chrome, Firefox, Safari, Edge (גרסאות עדכניות).</li>
                <li>קוראי מסך: NVDA, JAWS, VoiceOver.</li>
                <li>מכשירים: מחשב שולחני, טאבלט וסמארטפון.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-headline text-lg font-bold text-primary mb-3">5. מגבלות ידועות</h2>
              <p>
                למרות מאמצינו להנגיש את האתר במלואו, ייתכן שחלקים מסוימים טרם הונגשו באופן מלא. אנו ממשיכים לעבוד על שיפור הנגישות בכל חלקי האתר.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-lg font-bold text-primary mb-3">6. משוב ודיווח על בעיות נגישות</h2>
              <p>
                נתקלתם בבעיית נגישות באתר? נשמח לשמוע ולטפל בכך. ניתן לפנות אלינו בכל אחד מהאמצעים הבאים:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>טלפון: <a href="tel:0542091980" className="text-primary hover:underline" dir="ltr">054-209-1980</a></li>
                <li>דוא"ל: <a href="mailto:habaithacalcali@gmail.com" className="text-primary hover:underline">habaithacalcali@gmail.com</a></li>
                <li>כתובת: רמת גן</li>
              </ul>
              <p className="mt-2">אנו מתחייבים לטפל בפניות נגישות תוך 14 ימי עבודה.</p>
            </section>

            <section>
              <h2 className="font-headline text-lg font-bold text-primary mb-3">7. נציב נגישות השירות</h2>
              <p>
                לפניות בנושא נגישות ניתן לפנות לנציב הנגישות של החברה בפרטי הקשר המופיעים לעיל.
              </p>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
