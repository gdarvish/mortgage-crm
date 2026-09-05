/**
 * Upload constraints, enforced on the client for a useful error message and
 * again in storage.rules, which is what actually holds — a client-side check
 * is a courtesy, not a control.
 *
 * Kept apart from documentService so it can be tested without pulling in the
 * Firebase client.
 */
export const ALLOWED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
]

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** Rejects a file the rules would reject anyway, with an explanation. */
export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return 'סוג קובץ לא נתמך — PDF או תמונה בלבד'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `הקובץ גדול מ-${MAX_UPLOAD_BYTES / 1024 / 1024}MB`
  }
  return null
}
