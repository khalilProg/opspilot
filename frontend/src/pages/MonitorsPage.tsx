import { Activity, CircleCheck, CircleHelp, CircleX, Pause, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { MonitorForm } from '../components/MonitorDialogs'
import { MonitorList, monitorStatus } from '../components/OperationLists'
import { PageHeading } from '../components/PageHeading'
import { QueryState } from '../components/QueryState'
import { useMonitors } from '../hooks/useOperations'
import type { Monitor } from '../types/operations'

const metrics = [
  { status: 'UP', label: 'Up', icon: CircleCheck, color: 'bg-good-soft text-good' },
  { status: 'DOWN', label: 'Down', icon: CircleX, color: 'bg-bad-soft text-bad' },
  { status: 'UNKNOWN', label: 'Unknown', icon: CircleHelp, color: 'bg-warn-soft text-warn' },
  { status: 'PAUSED', label: 'Paused', icon: Pause, color: 'bg-raised text-muted' },
] as const

function MonitorCounts({ monitors }: { monitors: Monitor[] | undefined }) {
  const counts = { UP: 0, DOWN: 0, UNKNOWN: 0, PAUSED: 0 }
  for (const monitor of monitors ?? []) {
    counts[monitorStatus(monitor)]++
  }

  return (
    <dl aria-label="Monitor counts" className="panel mb-5 grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-5">
      {[
        { label: 'Total monitors', value: monitors?.length, icon: Activity, color: 'bg-raised text-accent' },
        ...metrics.map((metric) => ({ ...metric, value: monitors && counts[metric.status] })),
      ].map(({ label, value, icon: Icon, color }, index) => (
        <div key={label} className={`flex items-center gap-2.5 bg-surface px-3 py-2.5 md:p-4 ${index === 0 ? 'col-span-2 lg:col-span-1' : ''}`}>
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
  const [filters, setFilters] = useSearchParams()
  const search = filters.get('q') ?? ''
  const requestedStatus = filters.get('status') ?? ''
  const status = metrics.some((metric) => metric.status === requestedStatus) ? requestedStatus : ''

  function updateFilter(key: 'q' | 'status', value: string) {
    const next = new URLSearchParams(filters)
    if (value) next.set(key, value)
    else next.delete(key)
    setFilters(next, { replace: key === 'q' })
  }
  const normalizedSearch = search.trim().toLowerCase()

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <PageHeading title="Monitors" description="Check the current status of configured endpoints." />
        <button type="button" className="button-primary" onClick={() => setCreating(true)}>
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
                name="q"
                autoComplete="off"
                placeholder="Name or URL…"
                value={search}
                onChange={(event) => updateFilter('q', event.target.value)}
                className="field pl-9"
              />
            </span>
          </label>
          <div className="w-full sm:w-40">
            <label htmlFor="monitor-status" className="mb-1.5 block text-sm font-medium">Status</label>
            <select
              id="monitor-status"
              name="status"
              value={status}
              onChange={(event) => updateFilter('status', event.target.value)}
              className="field"
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
              <div className="px-5 py-6 text-sm text-muted"><p role="status">No monitors match your search and status filters.</p><Link to="/monitors" className="action-link mt-2">Clear filters</Link></div>
            )
          }}
        </QueryState>
      </section>
    </>
  )
}
