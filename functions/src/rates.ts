import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue } from 'firebase-admin/firestore'
import { db, REGION } from './common'

const BOI_URL =
  'https://edge.boi.gov.il/FusionEdge/pages/CMSEditor/files/BankingSupervision/MadadMortgages.json'

interface BoiPoint {
  value?: string | number
  period?: string
}

/**
 * משיכת ריבית בנק ישראל פעם ביום וכתיבתה ל-interest_rates/current.
 * הקליינט קורא את המסמך הזה במקום לפנות ל-BOI ישירות (CORS חוסם בדפדפן).
 */
export const syncBoiRates = onSchedule(
  { schedule: 'every day 04:00', timeZone: 'Asia/Jerusalem', region: REGION },
  async () => {
    const res = await fetch(BOI_URL)
    if (!res.ok) {
      console.error('syncBoiRates: BOI fetch failed', res.status)
      return
    }
    const json = (await res.json()) as {
      resultSet?: { series?: { points?: BoiPoint[] }[] }
      series?: { points?: BoiPoint[] }[]
    }
    const series = json?.resultSet?.series?.[0]?.points ?? json?.series?.[0]?.points ?? []
    const latest = series[series.length - 1]
    if (!latest) {
      console.error('syncBoiRates: no data points in BOI response')
      return
    }
    const boiRate = parseFloat(String(latest.value))
    if (Number.isNaN(boiRate)) {
      console.error('syncBoiRates: invalid rate value', latest.value)
      return
    }
    await db.collection('interest_rates').doc('current').set(
      {
        boi_rate: boiRate,
        prime: boiRate + 1.5,
        period: latest.period ?? '',
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    console.log(`syncBoiRates: boi_rate=${boiRate}`)
  }
)
