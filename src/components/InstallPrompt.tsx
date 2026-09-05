import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setPromptEvent(null)
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!promptEvent || hidden) return null

  const handleInstall = async () => {
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setPromptEvent(null)
    else setHidden(true)
  }

  return (
    <div
      dir="rtl"
      className="fixed z-50 left-4 right-4 bottom-4 sm:left-auto sm:right-4 sm:max-w-sm animate-fade-in"
    >
      <div
        className="flex items-center gap-3"
        style={{
          background: 'var(--color-card)',
          borderRadius: 16,
          padding: '14px 16px',
          boxShadow: '0 8px 30px rgba(28,25,23,0.18)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--color-success-bg)' }}
        >
          <Download size={20} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold" style={{ color: 'var(--color-text)' }}>התקן את MortgageCRM</p>
          <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>גישה מהירה ועבודה גם ללא חיבור</p>
        </div>
        <button
          onClick={handleInstall}
          className="text-[13px] font-semibold text-white px-3 py-2 rounded-lg shrink-0 transition-opacity hover:opacity-90"
          style={{ background: 'var(--color-primary)' }}
        >
          התקן
        </button>
        <button
          onClick={() => setHidden(true)}
          className="shrink-0 transition-colors hover:text-stone-600"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="סגור"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
