import { IncidentList } from '../components/OperationLists'
import { PageHeading } from '../components/PageHeading'
import { QueryState } from '../components/QueryState'
import { useIncidents } from '../hooks/useOperations'

export function IncidentsPage() {
  const incidents = useIncidents()

  return (
    <>
      <PageHeading title="Incidents" description="Review open, acknowledged, and resolved incidents." />
      <section aria-label="Incident list" className="panel">
        <QueryState query={incidents} subject="incidents" emptyMessage="No incidents recorded yet.">
          {(data) => <IncidentList incidents={data} />}
        </QueryState>
      </section>
    </>
  )
}
