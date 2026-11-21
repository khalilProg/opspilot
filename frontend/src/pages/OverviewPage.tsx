import { Activity, BellRing, Radio } from 'lucide-react'
import { Link } from 'react-router'
import { IncidentList, MonitorList } from '../components/OperationLists'
import { PageHeading } from '../components/PageHeading'
import { QueryState } from '../components/QueryState'
import { useIncidents, useMonitors } from '../hooks/useOperations'

export function OverviewPage() {
  const monitors = useMonitors()
  const incidents = useIncidents()
  const summaries = [
    {
      label: 'Total monitors',
      value: monitors.isSuccess ? monitors.data.length : '—',
      icon: Radio,
      color: 'bg-blue-50 text-accent',
    },
    {
      label: 'Operational',
      value: monitors.isSuccess ? monitors.data.filter((monitor) => monitor.enabled && monitor.status === 'UP').length : '—',
      icon: Activity,
      color: 'bg-emerald-50 text-emerald-800',
    },
    {
      label: 'Active incidents',
      value: incidents.isSuccess ? incidents.data.filter((incident) => incident.status !== 'RESOLVED').length : '—',
      icon: BellRing,
      color: 'bg-amber-50 text-amber-900',
    },
  ]

  return (
    <>
      <PageHeading title="Overview" description="Track monitor health and incident activity." />
      <dl className="mb-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {summaries.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="panel flex items-center gap-3 p-4 lg:gap-4 lg:p-5">
            <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${color}`}>
              <Icon aria-hidden="true" size={20} />
            </span>
            <div>
              <dt className="text-sm font-medium text-muted">{label}</dt>
              <dd className="mt-0.5 text-2xl leading-none font-semibold tabular-nums">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <div className="grid items-start gap-4 xl:grid-cols-2 xl:gap-5">
        <section className="panel" aria-labelledby="monitor-heading">
          <div className="panel-heading">
            <h2 id="monitor-heading" className="font-semibold">Monitor status</h2>
            <Link to="/monitors" className="action-link">View monitors</Link>
          </div>
          <QueryState query={monitors} subject="monitors" emptyMessage="No monitors configured yet.">
            {(data) => <MonitorList monitors={data.slice(0, 5)} />}
          </QueryState>
        </section>
        <section className="panel" aria-labelledby="incident-heading">
          <div className="panel-heading">
            <h2 id="incident-heading" className="font-semibold">Recent incidents</h2>
            <Link to="/incidents" className="action-link">View incidents</Link>
          </div>
          <QueryState query={incidents} subject="incidents" emptyMessage="No incidents recorded yet.">
            {(data) => <IncidentList incidents={data.slice(0, 5)} monitors={monitors.data} />}
          </QueryState>
        </section>
      </div>
    </>
  )
}
