import { MonitorList } from '../components/OperationLists'
import { PageHeading } from '../components/PageHeading'
import { QueryState } from '../components/QueryState'
import { useMonitors } from '../hooks/useOperations'

export function MonitorsPage() {
  const monitors = useMonitors()

  return (
    <>
      <PageHeading title="Monitors" description="Check the current status of configured endpoints." />
      <section aria-label="Monitor list" className="panel">
        <QueryState query={monitors} subject="monitors" emptyMessage="No monitors configured yet.">
          {(data) => <MonitorList monitors={data} />}
        </QueryState>
      </section>
    </>
  )
}
