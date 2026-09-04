/**
 * The document checklist a case must satisfy.
 *
 * Pure, and free of the Firebase client, so both the case snapshot and the
 * borrowers panel can derive "what is still missing" from the same list.
 */
export interface ChecklistBorrower {
  name: string
  employmentType: 'שכיר' | 'עצמאי'
}

/**
 * Builds the document checklist. Identity and income documents are duplicated
 * per borrower with a name suffix; property documents are collected once for
 * the whole case.
 */
export function getChecklist(borrowers: ChecklistBorrower[]): { type: string; category: string }[] {
  const perBorrowerSalaried = [
    { type: 'תעודת זהות + ספח', category: 'זיהוי' },
    { type: '3 תלושי שכר אחרונים', category: 'הכנסות' },
    { type: '6 דפי חשבון בנק', category: 'חשבון_בנק' },
    { type: 'אישור עבודה / העסקה', category: 'הכנסות' },
  ]
  const perBorrowerSelfEmployed = [
    { type: 'תעודת זהות + ספח', category: 'זיהוי' },
    { type: '6 דפי חשבון בנק', category: 'חשבון_בנק' },
    { type: '2 דוחות מס שנתיים (1301)', category: 'הכנסות' },
    { type: 'אישור רואה חשבון', category: 'הכנסות' },
    { type: 'חשבון בנק עסקי', category: 'חשבון_בנק' },
    { type: 'ניהול ספרים', category: 'הכנסות' },
    { type: 'תעודת עוסק מורשה', category: 'זיהוי' },
    { type: 'דוח רווח והפסד', category: 'הכנסות' },
  ]
  // Property / case-level documents — collected once regardless of borrowers.
  const caseDocuments = [
    { type: 'הסכם רכישה', category: 'נכס' },
    { type: 'נסח טאבו', category: 'נכס' },
    { type: 'דוח פלאש BDI', category: 'כללי' },
    { type: 'הצהרת הון', category: 'כללי' },
  ]

  const list = borrowers.length > 0 ? borrowers : [{ name: '', employmentType: 'שכיר' as const }]
  const multiple = list.length > 1
  const perBorrower = list.flatMap(b => {
    const docs = b.employmentType === 'עצמאי' ? perBorrowerSelfEmployed : perBorrowerSalaried
    return docs.map(d => ({
      type: multiple && b.name ? `${d.type} — ${b.name}` : d.type,
      category: d.category,
    }))
  })

  return [...perBorrower, ...caseDocuments]
}
