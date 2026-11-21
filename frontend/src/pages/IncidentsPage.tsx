import { IncidentList } from '../components/OperationLists'
import { PageHeading } from '../components/PageHeading'
import { QueryState } from '../components/QueryState'
import { useIncidents, useMonitors } from '../hooks/useOperations'
import type { Incident, Monitor } from '../types/operations'

function IncidentSection({ title, incidents, monitors, emptyMessage }: {
  title: string
  incidents: Incident[]
  monitors?: Monitor[]
  emptyMessage: string
}) {
  return (
    <section aria-label={title} className="panel">
      <div className="panel-heading">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm text-muted">{incidents.length}</span>
      </div>
      {incidents.length ? <IncidentList incidents={incidents} monitors={monitors} /> : (
        <p className="px-5 py-8 text-sm text-muted">{emptyMessage}</p>
      )}
    </section>
  )
}

export function IncidentsPage() {
  const incidents = useIncidents()
  const monitors = useMonitors()

  return (
    <>
      <PageHeading title="Incidents" description="Review open, acknowledged, and resolved incidents." />
      <QueryState query={incidents} subject="incidents">
        {(data) => (
          <div className="space-y-5">
            <IncidentSection title="Active incidents" incidents={data.filter(({ status }) => status !== 'RESOLVED')}
              monitors={monitors.data} emptyMessage="No active incidents." />
            <IncidentSection title="Resolved incidents" incidents={data.filter(({ status }) => status === 'RESOLVED')}
              monitors={monitors.data} emptyMessage="No resolved incidents." />
          </div>
        )}
      </QueryState>
    </>
  )
}
