import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, Search, Bell, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onMenuToggle: () => void
  sidebarCollapsed: boolean
}

const routeTitles: Record<string, string> = {
  '/dashboard': 'דשבורד',
  '/customers': 'לקוחות',
  '/leads': 'לידים',
  '/documents': 'מסמכים',
  '/calculator': 'מחשבון משכנתא',
  '/refinance': 'מחזור משכנתא',
  '/consolidation': 'איחוד הלוואות',
  '/alerts': 'התראות',
  '/communication': 'תקשורת',
  '/commissions': 'עמלות',
  '/referrals': 'מפנים',
  '/interest-rates': 'ריביות',
  '/family-economics': 'כלכלת משפחה',
  '/settings': 'הגדרות',
}

function getPageTitle(pathname: string): string {
  // Exact match first
  if (routeTitles[pathname]) return routeTitles[pathname]

  // Try matching the base path (e.g., /customers/123 -> /customers)
  const basePath = '/' + pathname.split('/').filter(Boolean)[0]
  if (routeTitles[basePath]) return routeTitles[basePath]

  return 'דשבורד'
}

export default function Header({ onMenuToggle }: Omit<HeaderProps, 'sidebarCollapsed'> & { sidebarCollapsed?: boolean }) {
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const pageTitle = getPageTitle(location.pathname)

  // Notification count - this would come from a store in production
  const notificationCount = 3

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-100 bg-white px-4 shadow-sm transition-all duration-300 lg:px-6',
      )}
    >
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
        aria-label="פתח תפריט"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title */}
      <h1 className="text-xl font-bold text-gray-900 font-[var(--font-heebo)]">
        {pageTitle}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search bar */}
      <div
        className={cn(
          'relative transition-all duration-200',
          searchOpen ? 'w-64' : 'w-auto'
        )}
      >
        {searchOpen ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לקוחות, לידים..."
              className="w-full border-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                setSearchOpen(false)
                setSearchQuery('')
              }}
              className="shrink-0 text-gray-400 hover:text-gray-600"
              aria-label="סגור חיפוש"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="חיפוש"
          >
            <Search className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Notifications */}
      <button
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="התראות"
      >
        <Bell className="h-5 w-5" />
        {notificationCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </button>
    </header>
  )
}
