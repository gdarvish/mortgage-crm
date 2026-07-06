# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## תפעול (Operations)

### ניהול ריביות מערכת

הריביות שמזינות את מחשבון המשכנתא ואת מנוע זיהוי הזדמנויות המחזור נשמרות באוסף
`interest_rates`. כתיבה ישירה מה-client חסומה ב-Firestore Rules; העדכון עובר דרך
פונקציית ה-Cloud `updateInterestRate`, שמוגבלת למשתמשים עם custom claim `admin: true`.

הענקת הרשאת מנהל למשתמש:

```bash
# דורש GOOGLE_APPLICATION_CREDENTIALS מכוון ל-service account key
cd functions
node scripts/grant-admin.mjs <UID>
```

ה-claim נטען רק לאחר שהמשתמש **מתנתק ומתחבר מחדש**. לאחר מכן, בעמוד "שוק הריביות"
יופיעו כפתורי עריכה ליד כל סוג מסלול, ועדכון יוצר רשומה חדשה ב-`interest_rates`
שהמחשבון והמנוע קוראים כ-`liveRate` העדכני.

### TTL על אוסף rate_limits

מסמכי הגבלת הקצב (`rate_limits`) נכתבים עם שדה `expireAt` (Timestamp). כדי ש-Firestore
ימחק אותם אוטומטית, יש להפעיל TTL policy פעם אחת:

```bash
gcloud firestore fields ttls update expireAt \
  --collection-group=rate_limits --enable-ttl
```
