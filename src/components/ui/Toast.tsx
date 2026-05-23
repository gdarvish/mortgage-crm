import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

// ── Store ──────────────────────────────────────────────────────────────

interface ToastStore {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => void
  removeToast: (id: string) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

// ── toast() function ───────────────────────────────────────────────────

export function toast(options: Omit<ToastItem, 'id'>) {
  useToastStore.getState().addToast(options)
}

toast.success = (title: string, description?: string) =>
  toast({ type: 'success', title, description })

toast.error = (title: string, description?: string) =>
  toast({ type: 'error', title, description })

toast.warning = (title: string, description?: string) =>
  toast({ type: 'warning', title, description })

toast.info = (title: string, description?: string) =>
  toast({ type: 'info', title, description })

// ── Icon map ───────────────────────────────────────────────────────────

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
}

const bgMap: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50',
  error: 'border-red-200 bg-red-50',
  warning: 'border-yellow-200 bg-yellow-50',
  info: 'border-blue-200 bg-blue-50',
}

// ── Single toast ───────────────────────────────────────────────────────

function ToastCard({ item }: { item: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast)

  useEffect(() => {
    const timeout = setTimeout(() => {
      removeToast(item.id)
    }, item.duration || 4000)
    return () => clearTimeout(timeout)
  }, [item.id, item.duration, removeToast])

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-top-2 fade-in duration-300',
        bgMap[item.type]
      )}
      role="alert"
    >
      <span className="shrink-0 mt-0.5">{iconMap[item.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{item.title}</p>
        {item.description && (
          <p className="mt-1 text-sm text-gray-600">{item.description}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(item.id)}
        className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-600"
        aria-label="סגור"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Toaster (renders all toasts) ───────────────────────────────────────

function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed top-4 start-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>,
    document.body
  )
}

export { Toaster, useToastStore }
