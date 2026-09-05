import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const variantStyles: Record<
  NonNullable<ConfirmDialogProps['variant']>,
  { iconWrap: string; icon: string; confirm: 'danger' | 'primary' }
> = {
  danger: { iconWrap: 'bg-red-100', icon: 'text-red-600', confirm: 'danger' },
  warning: { iconWrap: 'bg-amber-100', icon: 'text-amber-600', confirm: 'primary' },
  info: { iconWrap: 'bg-blue-100', icon: 'text-blue-600', confirm: 'primary' },
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'אישור',
  cancelText = 'ביטול',
  variant = 'warning',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const styles = variantStyles[variant]

  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 rounded-full p-2 ${styles.iconWrap}`}>
          <AlertTriangle className={styles.icon} size={22} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text)] mb-1">{title}</h3>
          <p className="text-sm text-[var(--color-text-sub)]">{message}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={styles.confirm} loading={loading} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}
