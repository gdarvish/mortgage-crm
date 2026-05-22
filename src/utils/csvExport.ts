import type { Customer } from '@/types/database'

const UTF8_BOM = '﻿'

/** Quote a CSV field, escaping embedded quotes. */
function quote(value: unknown): string {
  return `"${(value ?? '').toString().replace(/"/g, '""')}"`
}

export function customersToCsv(customers: Customer[]): string {
  const headers = ['שם פרטי', 'שם משפחה', 'ת.ז', 'טלפון', 'מייל', 'סטטוס', 'תאריך יצירה']
  const rows = customers.map((c) => [
    c.first_name,
    c.last_name,
    c.id_number,
    c.phone,
    c.email,
    c.status,
    c.created_at ? new Date(c.created_at).toLocaleDateString('he-IL') : '',
  ])
  return [headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n')
}

export function downloadCsv(csv: string, filename: string) {
  // Prepend a BOM so Excel reads the Hebrew text as UTF-8.
  const blob = new Blob([UTF8_BOM + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
