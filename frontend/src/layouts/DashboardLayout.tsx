import { Activity, BellRing, LayoutDashboard, Radio } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/monitors', label: 'Monitors', icon: Radio },
  { to: '/incidents', label: 'Incidents', icon: BellRing },
]

export function DashboardLayout() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-10 focus:rounded-md focus:bg-white focus:p-3">
        Skip to content
      </a>
      <aside className="bg-sidebar px-4 pt-4 text-white md:sticky md:top-0 md:h-dvh md:px-5 md:pt-7">
        <Link to="/" className="inline-flex items-center gap-3 rounded-sm px-1 text-xl font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-lg bg-blue-600">
            <Activity aria-hidden="true" size={20} />
          </span>
          OpsPilot
        </Link>
        <nav aria-label="Main navigation" className="mt-4 flex flex-wrap gap-1 pb-3 md:mt-10 md:flex-col md:pb-0">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors md:gap-3 md:px-3 ${
                  isActive ? 'bg-blue-500/25 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon aria-hidden="true" size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-7 md:py-10 lg:px-10">
        <Outlet />
      </main>
    </div>
  )
}
