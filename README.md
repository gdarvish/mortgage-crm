# MortgageCRM

מערכת CRM ליועצי משכנתאות בישראל: ניהול לקוחות ולידים, תיקי משכנתא ומסלולים, מסמכים עם OCR ובדיקת תקינות מבוססי AI, שאלון לקוח ציבורי, חתימה דיגיטלית, הודעות וואטסאפ, התראות אוטומטיות ונתוני ריבית בנק ישראל.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS
- **Backend:** Firebase — Auth, Firestore, Storage, Cloud Functions v2 (region `europe-west1`)
- **AI:** Anthropic Claude (OCR תלושי שכר, בדיקת מסמכים, המלצת תמהיל)
- **Messaging:** WhatsApp Business Cloud API (Meta Graph API)

## הרצה מקומית

```bash
npm install
cp .env.example .env   # ומלא את ערכי Firebase
npm run dev
```

להרצת ה-Cloud Functions מקומית:

```bash
cd functions
npm install
npm run serve   # builds + starts the functions emulator
```

אפשר להפנות את הקליינט לאמולטורים עם `VITE_USE_FIREBASE_EMULATOR=true` ב-`.env`.

## משתני סביבה (קליינט)

ראה `.env.example`:

| משתנה | תיאור |
|---|---|
| `VITE_FIREBASE_*` | קונפיגורציית Firebase Web SDK (מה-Console) |
| `VITE_USE_FIREBASE_EMULATOR` | `true` לעבודה מול אמולטורים מקומיים |
| `VITE_RECAPTCHA_SITE_KEY` | מפתח reCAPTCHA v3 (אופציונלי) להגנת הטפסים הציבוריים |

## Cloud Functions

הפונקציות יושבות תחת `functions/src`:

| מודול | תוכן |
|---|---|
| `index.ts` | טפסים ציבוריים (שאלון, חתימה, פורטל לקוח), מחיקות מדורגות, התראות מתוזמנות |
| `ai.ts` | ניסוח הודעות, בדיקת מסמכים, המלצת תמהיל (Claude) |
| `ocr.ts` | OCR לתלושי שכר (Claude) |
| `whatsapp.ts` | שליחת הודעות + webhook נכנס (עם אימות חתימת Meta) |
| `rates.ts` | סנכרון יומי של ריבית בנק ישראל ל-`interest_rates/current` |
| `activity.ts`, `audit.ts` | פיד פעילות ויומן ביקורת |

### סודות (Secrets)

מוגדרים עם `firebase functions:secrets:set <NAME>`:

| Secret | שימוש |
|---|---|
| `ANTHROPIC_API_KEY` | קריאות Claude (AI/OCR) |
| `WHATSAPP_TOKEN` | טוקן גישה ל-Graph API |
| `WHATSAPP_PHONE_NUMBER_ID` | מזהה מספר הטלפון העסקי |
| `WHATSAPP_VERIFY_TOKEN` | אימות ה-handshake של ה-webhook |
| `WHATSAPP_APP_SECRET` | App Secret מ-Meta — אימות חתימת `X-Hub-Signature-256` |

משתני סביבה נוספים לפונקציות:

| משתנה | שימוש |
|---|---|
| `RECAPTCHA_SECRET_KEY` | אימות reCAPTCHA בצד שרת |
| `ENFORCE_RECAPTCHA` | `true` בפרודקשן — נכשל אם reCAPTCHA לא מוגדר במקום לדלג |

## פריסה

```bash
npm run build                      # frontend (Vercel — ראה vercel.json)
firebase deploy --only functions   # Cloud Functions
firebase deploy --only firestore:rules,storage
```

## סקריפטים

| פקודה | תיאור |
|---|---|
| `npm run dev` | שרת פיתוח Vite |
| `npm run build` | בניית פרודקשן (כולל `tsc -b`) |
| `npm run lint` | ESLint |
| `cd functions && npm run build` | קומפילציית הפונקציות |
