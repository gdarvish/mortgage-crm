import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FileText,
  Calculator,
  RefreshCw,
  Layers,
  Bell,
  CalendarDays,
  MessageSquare,
  DollarSign,
  Share2,
  TrendingUp,
  PieChart,
  Settings,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

interface SidebarProps {
  open: boolean
  collapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

const navItems = [
  { to: '/dashboard', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/customers', label: 'לקוחות', icon: Users },
  { to: '/leads', label: 'לידים', icon: UserPlus },
  { to: '/documents', label: 'מסמכים', icon: FileText },
  { to: '/calculator', label: 'מחשבון משכנתא', icon: Calculator },
  { to: '/refinance', label: 'מחזור משכנתא', icon: RefreshCw },
  { to: '/consolidation', label: 'איחוד הלוואות', icon: Layers },
  { to: '/alerts', label: 'התראות', icon: Bell },
  { to: '/meetings', label: 'פגישות', icon: CalendarDays },
  { to: '/communication', label: 'תקשורת', icon: MessageSquare },
  { to: '/commissions', label: 'עמלות', icon: DollarSign },
  { to: '/referrals', label: 'מפנים', icon: Share2 },
  { to: '/interest-rates', label: 'ריביות', icon: TrendingUp },
  { to: '/family-economics', label: 'כלכלת משפחה', icon: PieChart },
  { to: '/settings', label: 'הגדרות', icon: Settings },
]

export default function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const { user, signOut } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
  }

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]'

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 right-0 z-50 flex h-full flex-col bg-[var(--color-card)] border-l border-[var(--color-border)] transition-all duration-300',
          sidebarWidth,
          // Mobile: slide in/out
          'lg:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo / Brand area */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--color-border-light)] px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white font-bold text-sm font-[var(--font-heebo)]">
                מ
              </div>
              <span className="text-lg font-bold text-[var(--color-primary)] font-[var(--font-heebo)]">
                משכנתא CRM
              </span>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white font-bold text-sm font-[var(--font-heebo)]">
              מ
            </div>
          )}

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-pill-bg)] hover:text-[var(--color-text-sub)] lg:hidden"
            aria-label="סגור תפריט"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Collapse toggle - desktop only */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute top-[18px] -left-3 z-10 h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-muted)] shadow-sm hover:text-[var(--color-text-sub)] transition-colors"
          aria-label={collapsed ? 'הרחב תפריט' : 'צמצם תפריט'}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => {
                    // Close mobile sidebar on navigation
                    if (window.innerWidth < 1024) {
                      onClose()
                    }
                  }}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      collapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-[#e8f0fe] text-[var(--color-primary)]'
                        : 'text-[var(--color-text-sub)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', collapsed && 'h-5 w-5')} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info & logout */}
        <div className="border-t border-[var(--color-border-light)] p-3">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[var(--color-primary)] text-sm font-bold">
                {user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                  {user?.email ?? 'משתמש'}
                </p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">יועץ משכנתאות</p>
              </div>
              <button
                onClick={handleSignOut}
                className="shrink-0 rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 transition-colors"
                title="התנתק"
                aria-label="התנתק"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignOut}
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 transition-colors"
              title="התנתק"
              aria-label="התנתק"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
