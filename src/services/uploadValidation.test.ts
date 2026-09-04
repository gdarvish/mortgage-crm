import { describe, it, expect } from 'vitest'
import { validateUploadFile, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from './uploadValidation'

/** A File stand-in with the only two properties the validator reads. */
function file(type: string, size: number): File {
  return { type, size, name: 'x' } as File
}

describe('validateUploadFile', () => {
  it('accepts every allowed type', () => {
    for (const type of ALLOWED_UPLOAD_TYPES) {
      expect(validateUploadFile(file(type, 1024))).toBeNull()
    }
  })

  it('rejects an executable', () => {
    const error = validateUploadFile(file('application/x-msdownload', 1024))
    expect(error).toContain('סוג קובץ לא נתמך')
  })

  it('rejects a file with no type at all', () => {
    expect(validateUploadFile(file('', 1024))).not.toBeNull()
  })

  it('rejects a file over the size cap', () => {
    const error = validateUploadFile(file('application/pdf', MAX_UPLOAD_BYTES + 1))
    expect(error).toContain('גדול')
  })

  it('accepts a file exactly at the cap', () => {
    expect(validateUploadFile(file('application/pdf', MAX_UPLOAD_BYTES))).toBeNull()
  })
})
