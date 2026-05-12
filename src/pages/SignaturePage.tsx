import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { PenTool, CheckCircle, RotateCcw } from 'lucide-react'

export default function SignaturePage() {
  const { token: _ } = useParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signed, setSigned] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
    setSigned(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1a4f8a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  const endDraw = () => setIsDrawing(false)

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    setSigned(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">המסמך נחתם!</h1>
          <p className="text-gray-600">החתימה שלך נשמרה בהצלחה. תודה!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" dir="rtl">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#1a4f8a] rounded-xl mx-auto mb-3 flex items-center justify-center">
            <PenTool size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">חתימה דיגיטלית</h1>
          <p className="text-sm text-gray-500">אנא חתום על המסמך למטה</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h2 className="font-semibold text-gray-900 mb-2">ייפוי כוח</h2>
            <p className="text-sm text-gray-600">
              אני הח"מ מאשר/ת בזאת ליועץ המשכנתאות לפעול בשמי מול הבנקים
              לצורך קבלת הצעות ואישורי משכנתא. ייפוי כוח זה בתוקף ל-90 יום.
            </p>
          </div>

          <p className="text-sm font-medium text-gray-700 mb-2">חתימה:</p>
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={460}
              height={200}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
              className="w-full cursor-crosshair touch-none"
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={clearCanvas} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
              <RotateCcw size={14} /> נקה
            </button>
          </div>

          <button
            onClick={() => setSubmitted(true)}
            disabled={!signed}
            className="w-full mt-4 bg-[#1a4f8a] text-white py-3 rounded-lg hover:bg-[#143d6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle size={18} />
            אשר וחתום
          </button>
        </div>
      </div>
    </div>
  )
}
