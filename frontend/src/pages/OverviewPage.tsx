import { Activity, ArrowUpRight, CircleCheck, CircleHelp, Radio, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { IncidentList, MonitorList } from '../components/OperationLists'
import { PageHeading } from '../components/PageHeading'
import { QueryState } from '../components/QueryState'
import { useIncidents, useMonitors } from '../hooks/useOperations'
import type { Monitor } from '../types/operations'

const count = new Intl.NumberFormat()
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

function Availability({ monitors }: { monitors: Monitor[] }) {
  const enabled = monitors.filter(({ enabled }) => enabled)
  const up = enabled.filter(({ status }) => status === 'UP').length
  const down = enabled.filter(({ status }) => status === 'DOWN').length
  const unknown = enabled.length - up - down
  const segments = [
    { label: 'Up', value: up, color: 'var(--good)' },
    { label: 'Down', value: down, color: 'var(--bad)' },
    { label: 'Unknown', value: unknown, color: 'var(--chart-muted)' },
  ]
  const Icon = down > 0 ? TriangleAlert : enabled.length > 0 && unknown === 0 ? CircleCheck : CircleHelp
  const tone = down > 0 ? 'text-bad' : enabled.length > 0 && unknown === 0 ? 'text-good' : 'text-muted'
  const headline = down > 0
    ? `${count.format(down)} ${down === 1 ? 'monitor' : 'monitors'} down`
    : unknown > 0 ? 'Waiting for check results'
    : enabled.length ? 'All enabled monitors are up' : 'No enabled monitors'

  return (
    <div className="px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-semibold"><Icon aria-hidden="true" size={20} className={`shrink-0 ${tone}`} />{headline}</p>
          <p className="mt-1 text-sm text-muted">
            {count.format(enabled.length)} enabled · {count.format(monitors.length - enabled.length)} paused
          </p>
        </div>
        <div>
          <p className="text-3xl leading-none font-semibold tracking-tight tabular-nums">{up + down > 0 ? percent.format(up / (up + down)) : '—'}</p>
          <p className="mt-1.5 text-sm text-muted">Up among known states</p>
        </div>
      </div>
      <div aria-hidden="true" className="mt-6 flex h-2.5 gap-1 overflow-hidden rounded-full bg-raised">
        {segments.filter(({ value }) => value > 0).map(({ label, value, color }) => (
          <span key={label} className="min-w-0 rounded-full" style={{ flex: value, backgroundColor: color }} />
        ))}
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {segments.map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: color }} />
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium tabular-nums">{count.format(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function OverviewPage() {
  const monitors = useMonitors()
  const incidents = useIncidents()
  const active = incidents.data?.filter(({ status }) => status !== 'RESOLVED').length
  const metrics = [
    { label: 'Total monitors', value: monitors.data?.length, icon: Radio },
    { label: 'Active incidents', value: active, icon: TriangleAlert },
  ]

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <PageHeading title="Overview" description="See which endpoints are healthy and where incidents need attention." />
        <Link to="/monitors" className="button-secondary">Manage monitors<ArrowUpRight aria-hidden="true" size={15} /></Link>
      </div>
      <section className="panel mb-6" aria-labelledby="availability-heading">
        <div className="panel-heading">
          <h2 id="availability-heading" className="flex items-center gap-2 font-semibold"><Activity aria-hidden="true" size={17} className="text-accent" />Current availability</h2>
          <span className="text-sm text-muted">{monitors.isError ? 'Update unavailable' : monitors.isSuccess ? 'Refreshes every 5 seconds while visible' : 'Loading…'}</span>
        </div>
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <QueryState query={monitors} subject="availability">
            {(data) => <Availability monitors={data} />}
          </QueryState>
          <dl className="grid grid-cols-2 divide-x divide-line border-t border-line lg:grid-cols-1 lg:divide-x-0 lg:divide-y lg:border-t-0 lg:border-l">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="min-w-0 px-4 py-4 sm:px-5">
                <dt className="flex items-center gap-2 text-sm text-muted"><Icon aria-hidden="true" size={15} className="shrink-0" />{label}</dt>
                <dd className="mt-1 text-2xl leading-tight font-semibold tabular-nums">{value === undefined ? '—' : count.format(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="panel" aria-labelledby="monitor-heading">
          <div className="panel-heading">
            <h2 id="monitor-heading" className="font-semibold">Monitor status</h2>
            <Link to="/monitors" className="action-link text-sm">View monitors</Link>
          </div>
          <QueryState query={monitors} subject="monitors" emptyMessage="No monitors configured yet.">
            {(data) => <MonitorList monitors={data.slice(0, 5)} />}
          </QueryState>
        </section>
        <section className="panel" aria-labelledby="incident-heading">
          <div className="panel-heading">
            <h2 id="incident-heading" className="font-semibold">Recent incidents</h2>
            <Link to="/incidents" className="action-link text-sm">View incidents</Link>
          </div>
          <QueryState query={incidents} subject="incidents" emptyMessage="No incidents recorded yet.">
            {(data) => <IncidentList incidents={data.slice(0, 5)} monitors={monitors.data} />}
          </QueryState>
        </section>
      </div>
    </>
  )
}
