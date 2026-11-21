import { Activity, ChevronRight, LayoutDashboard, Moon, Radio, Settings, Sun, TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useTheme } from '../hooks/theme'

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/monitors', label: 'Monitors', icon: Radio },
  { to: '/incidents', label: 'Incidents', icon: TriangleAlert },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function DashboardLayout() {
  const { theme, setPreference } = useTheme()
  const { pathname } = useLocation()
  const section = navigation.find(({ to }) => pathname === to || (to !== '/' && pathname.startsWith(to + '/')))
  const onDetail = section && (section.to === '/monitors' || section.to === '/incidents')
    && pathname.replace(/\/$/, '') !== section.to
  const detailTitle = section?.to === '/monitors' ? 'Monitor details' : 'Incident details'
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)

  useEffect(() => {
    const title = section?.label ?? 'Page not found'
    document.title = pathname === '/' ? 'OpsPilot' : `${onDetail ? detailTitle : title} | OpsPilot`
    if (previousPath.current !== pathname) {
      main.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
      previousPath.current = pathname
    }
  }, [pathname, section, onDetail, detailTitle])

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[12rem_minmax(0,1fr)] lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-10 focus:rounded-md focus:bg-surface focus:p-3">Skip to content</a>
      <aside className="border-b border-line bg-sidebar px-4 pt-4 md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0 md:pt-5">
        <Link to="/" className="inline-flex min-h-11 items-center gap-3 rounded-sm px-1 text-lg font-semibold tracking-tight" translate="no">
          <span className="grid size-9 place-items-center rounded-lg bg-accent-fill text-accent-ink">
            <Activity aria-hidden="true" size={21} />
          </span>
          OpsPilot
        </Link>
        <nav aria-label="Main navigation" className="mt-3 grid grid-cols-4 gap-1 pb-3 md:mt-9 md:flex md:flex-col md:pb-0">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
              `inline-flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium motion-safe:transition-colors md:min-h-11 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-sm ${
                isActive ? 'bg-raised text-accent' : 'text-muted hover:bg-raised hover:text-ink'
              }`
            }>
              <Icon aria-hidden="true" size={17} strokeWidth={1.8} />{label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-15 items-center justify-between gap-3 border-b border-line px-4 sm:px-7 lg:px-9">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
            {onDetail && section ? (
              <>
                <Link to={section.to} aria-label={section.to === '/monitors' ? 'All monitors' : 'All incidents'} className="action-link">{section.label}</Link>
                <ChevronRight aria-hidden="true" size={14} className="shrink-0 text-muted" />
                <span aria-current="page">{detailTitle}</span>
              </>
            ) : <span aria-current="page" className="font-medium text-muted">{section?.label ?? 'Page not found'}</span>}
          </nav>
          <button type="button" className="button-secondary size-11 shrink-0 !p-0"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
          </button>
        </header>
        <main ref={main} id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[90rem] px-4 pt-7 pb-10 sm:px-7 lg:px-9 lg:pt-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
