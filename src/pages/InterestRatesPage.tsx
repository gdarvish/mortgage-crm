import { TrendingUp, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const currentRates = {
  prime: 6.0,
  lastCpi: 0.3,
  lastUpdate: '2026-04-01',
}

const bankRates = [
  { bank: 'בנק הפועלים', prime: 6.0, fixedNonLinked: 4.45, fixedLinked: 3.75, variableLinked: 3.20 },
  { bank: 'בנק לאומי', prime: 6.0, fixedNonLinked: 4.50, fixedLinked: 3.80, variableLinked: 3.25 },
  { bank: 'בנק דיסקונט', prime: 6.0, fixedNonLinked: 4.40, fixedLinked: 3.70, variableLinked: 3.15 },
  { bank: 'בנק מזרחי', prime: 6.0, fixedNonLinked: 4.55, fixedLinked: 3.85, variableLinked: 3.30 },
  { bank: 'בנק בינלאומי', prime: 6.0, fixedNonLinked: 4.35, fixedLinked: 3.65, variableLinked: 3.10 },
]

const primeHistory = [
  { date: 'ינו 25', rate: 5.75 }, { date: 'מרץ 25', rate: 5.50 }, { date: 'מאי 25', rate: 5.50 },
  { date: 'יול 25', rate: 5.75 }, { date: 'ספט 25', rate: 5.75 }, { date: 'נוב 25', rate: 6.00 },
  { date: 'ינו 26', rate: 6.00 }, { date: 'מרץ 26', rate: 6.00 },
]

export default function InterestRatesPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="text-[#1a4f8a]" size={28} />
          שוק הריביות
        </h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw size={14} />
          עדכון אחרון: {currentRates.lastUpdate}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center" style={{ borderRight: '4px solid #1a4f8a' }}>
          <p className="text-sm text-gray-500">ריבית פריים</p>
          <p className="text-3xl font-bold text-[#1a4f8a]">{currentRates.prime}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center" style={{ borderRight: '4px solid #f59e0b' }}>
          <p className="text-sm text-gray-500">מדד אחרון</p>
          <p className="text-3xl font-bold text-[#f59e0b]">{currentRates.lastCpi}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center" style={{ borderRight: '4px solid #22c55e' }}>
          <p className="text-sm text-gray-500">ריבית בנק ישראל</p>
          <p className="text-3xl font-bold text-green-600">{(currentRates.prime - 1.5).toFixed(1)}%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">מגמת ריבית פריים</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={primeHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" />
            <YAxis domain={[5, 6.5]} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Line type="monotone" dataKey="rate" stroke="#1a4f8a" strokeWidth={2} dot={{ fill: '#1a4f8a' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <h2 className="font-semibold text-gray-900 p-4 border-b border-gray-100">ריביות לפי בנק</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-right p-3 font-medium text-gray-600">בנק</th>
              <th className="text-right p-3 font-medium text-gray-600">פריים</th>
              <th className="text-right p-3 font-medium text-gray-600">קל"צ</th>
              <th className="text-right p-3 font-medium text-gray-600">קל"ב</th>
              <th className="text-right p-3 font-medium text-gray-600">משתנה צמודה</th>
            </tr>
          </thead>
          <tbody>
            {bankRates.map(bank => (
              <tr key={bank.bank} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-900">{bank.bank}</td>
                <td className="p-3 text-gray-700">{bank.prime}%</td>
                <td className="p-3 text-gray-700">{bank.fixedNonLinked}%</td>
                <td className="p-3 text-gray-700">{bank.fixedLinked}%</td>
                <td className="p-3 text-gray-700">{bank.variableLinked}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
