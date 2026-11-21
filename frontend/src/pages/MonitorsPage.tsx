import { Activity, CircleCheck, CircleHelp, CircleX, Pause, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { MonitorForm } from '../components/MonitorDialogs'
import { MonitorList, monitorStatus } from '../components/OperationLists'
import { PageHeading } from '../components/PageHeading'
import { QueryState } from '../components/QueryState'
import { useMonitors } from '../hooks/useOperations'
import type { Monitor } from '../types/operations'

const metrics = [
  { status: 'UP', label: 'Up', icon: CircleCheck, color: 'bg-emerald-50 text-emerald-800' },
  { status: 'DOWN', label: 'Down', icon: CircleX, color: 'bg-rose-50 text-rose-800' },
  { status: 'UNKNOWN', label: 'Unknown', icon: CircleHelp, color: 'bg-amber-50 text-amber-900' },
  { status: 'PAUSED', label: 'Paused', icon: Pause, color: 'bg-slate-100 text-slate-700' },
] as const

function MonitorCounts({ monitors }: { monitors: Monitor[] | undefined }) {
  const counts = { UP: 0, DOWN: 0, UNKNOWN: 0, PAUSED: 0 }
  for (const monitor of monitors ?? []) {
    counts[monitorStatus(monitor)]++
  }

  return (
    <dl aria-label="Monitor counts" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {[
        { label: 'Total monitors', value: monitors?.length, icon: Activity, color: 'bg-blue-50 text-accent' },
        ...metrics.map((metric) => ({ ...metric, value: monitors && counts[metric.status] })),
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="panel flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
          <span className={`grid size-8 shrink-0 place-items-center rounded-lg sm:size-9 ${color}`}>
            <Icon aria-hidden="true" size={17} />
          </span>
          <div>
            <dt className="text-sm font-medium text-muted">{label}</dt>
            <dd className="text-2xl leading-tight font-semibold tabular-nums">{value ?? '—'}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}

export function MonitorsPage() {
  const monitors = useMonitors()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const normalizedSearch = search.trim().toLowerCase()

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <PageHeading title="Monitors" description="Check the current status of configured endpoints." />
        <button type="button" className="button-primary mb-5" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" size={17} />
          New monitor
        </button>
      </div>
      {creating && <MonitorForm onDismiss={() => setCreating(false)} onSaved={(monitor) => navigate(`/monitors/${monitor.id}`)} />}
      <MonitorCounts monitors={monitors.data} />
      <section aria-label="Monitor list" className="panel">
        <div className="panel-heading justify-start sm:gap-4">
          <label className="w-full sm:max-w-sm">
            <span className="mb-1.5 block text-sm font-medium">Search monitors</span>
            <span className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted" />
              <input
                type="search"
                placeholder="Name or URL"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-line bg-white py-2 pr-3 pl-9"
              />
            </span>
          </label>
          <div className="w-full sm:w-40">
            <label htmlFor="monitor-status" className="mb-1.5 block text-sm font-medium">Status</label>
            <select
              id="monitor-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2"
            >
              <option value="">All statuses</option>
              {metrics.map(({ status, label }) => <option key={status} value={status}>{label}</option>)}
            </select>
          </div>
        </div>
        <QueryState query={monitors} subject="monitors" emptyMessage="No monitors configured yet.">
          {(data) => {
            const matches = data.filter((monitor) =>
              (!status || monitorStatus(monitor) === status)
              && (monitor.name.toLowerCase().includes(normalizedSearch) || monitor.url.toLowerCase().includes(normalizedSearch)),
            )
            return matches.length > 0 ? (
              <MonitorList monitors={matches} />
            ) : (
              <p className="px-5 py-8 text-sm text-muted">No monitors match your search and status filters.</p>
            )
          }}
        </QueryState>
      </section>
    </>
  )
}
