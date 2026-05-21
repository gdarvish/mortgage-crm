/**
 * אימותים ישראליים — ת.ז, טלפון, אימייל.
 */

/**
 * אימות תעודת זהות ישראלית כולל ספרת ביקורת.
 * פורמט: 9 ספרות, הספרה האחרונה היא ה-checksum.
 */
export function validateIsraeliId(id: string): boolean {
  if (!id) return false
  const clean = id.trim().replace(/[\s-]/g, '')
  if (!/^\d{1,9}$/.test(clean)) return false
  const padded = clean.padStart(9, '0')
  return (
    padded
      .split('')
      .map(Number)
      .reduce((sum, digit, i) => {
        const step = digit * ((i % 2) + 1)
        return sum + (step > 9 ? step - 9 : step)
      }, 0) %
      10 ===
    0
  )
}

/**
 * אימות מספר טלפון ישראלי.
 * מקבל: 05X / 07X (נייד), 0X (קווי), וגם קידומת בינלאומית 972.
 */
export function validateIsraeliPhone(phone: string): boolean {
  if (!phone) return false
  const clean = phone.replace(/[^\d]/g, '')
  // נייד: 05X או 07X + 7 ספרות
  if (/^0(5\d|7[2-9])\d{7}$/.test(clean)) return true
  // קווי: 02/03/04/08/09 + 7 ספרות
  if (/^0[23489]\d{7}$/.test(clean)) return true
  // פורמט בינלאומי: 972 + נייד/קווי
  if (/^972(5\d|7[2-9])\d{7}$/.test(clean)) return true
  if (/^972[23489]\d{7}$/.test(clean)) return true
  return false
}

/**
 * נרמול טלפון לפורמט בינלאומי (972...) עבור וואטסאפ/SMS.
 */
export function normalizePhone(phone: string): string {
  const clean = phone.replace(/[^\d]/g, '')
  if (clean.startsWith('972')) return clean
  if (clean.startsWith('0')) return '972' + clean.slice(1)
  return clean
}

/**
 * אימות כתובת אימייל (RFC 5322 מפושט).
 */
export function validateEmail(email: string): boolean {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export interface FormErrors {
  [field: string]: string
}

/**
 * אימות טופס פרטים אישיים. מחזיר מפה של שדה → הודעת שגיאה.
 * שדות ריקים אינם נבדקים (פרט לשם פרטי/משפחה כשהם מועברים במפורש).
 */
export function validatePersonalForm(form: {
  id_number?: string
  phone?: string
  email?: string
  first_name?: string
  last_name?: string
}): FormErrors {
  const errors: FormErrors = {}

  if (form.id_number && !validateIsraeliId(form.id_number)) {
    errors.id_number = 'ת.ז לא תקינה (בדוק ספרת ביקורת)'
  }
  if (form.phone && !validateIsraeliPhone(form.phone)) {
    errors.phone = 'מספר טלפון לא תקין (למשל 050-1234567)'
  }
  if (form.email && !validateEmail(form.email)) {
    errors.email = 'כתובת אימייל לא תקינה'
  }
  if (form.first_name !== undefined && form.first_name.trim().length < 2) {
    errors.first_name = 'שם פרטי חייב להיות לפחות 2 תווים'
  }
  if (form.last_name !== undefined && form.last_name.trim().length < 2) {
    errors.last_name = 'שם משפחה חייב להיות לפחות 2 תווים'
  }

  return errors
}
