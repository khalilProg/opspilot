import { CircleCheck } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { IncidentTime, SeverityBadge, Status } from '../components/OperationLists'
import { PageHeading } from '../components/PageHeading'
import { QueryState } from '../components/QueryState'
import { useAcknowledgeIncident, useIncident, useIncidentTransitions, useMonitors } from '../hooks/useOperations'
import type { Incident, Monitor } from '../types/operations'

const transitionLabels = {
  OPEN: 'Incident opened',
  ACKNOWLEDGED: 'Incident acknowledged',
  RESOLVED: 'Monitor recovered',
}

const lifecycleMessages = {
  OPEN: 'Waiting for acknowledgement or monitor recovery.',
  ACKNOWLEDGED: 'Waiting for monitor recovery.',
  RESOLVED: 'Monitor recovered and the incident is resolved.',
}

function TransitionHistory({ id }: { id: string }) {
  const transitions = useIncidentTransitions(id)
  return (
    <section className="panel mt-5" aria-labelledby="transitions-heading">
      <div className="panel-heading">
        <h2 id="transitions-heading" className="font-semibold">Transition history</h2>
      </div>
      <QueryState query={transitions} subject="incident history" emptyMessage="No transitions recorded.">
        {(data) => (
          <ol className="divide-y divide-line">
            {data.map(({ fromStatus, toStatus, occurredAt }) => (
              <li key={toStatus} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
                <div>
                  <p className="font-medium">{transitionLabels[toStatus]}</p>
                  {fromStatus && (
                    <p className="mt-1 text-sm text-muted">
                      From {fromStatus.toLowerCase()} to {toStatus.toLowerCase()}
                    </p>
                  )}
                </div>
                <span className="text-sm text-muted"><IncidentTime value={occurredAt} /></span>
              </li>
            ))}
          </ol>
        )}
      </QueryState>
    </section>
  )
}

function IncidentDetails({ incident, monitor }: { incident: Incident; monitor?: Monitor }) {
  const acknowledge = useAcknowledgeIncident(incident.id)
  const error = acknowledge.error instanceof ApiError ? acknowledge.error : null
  const timings = [
    { label: 'Opened', value: incident.openedAt, pending: 'Pending' },
    { label: 'Acknowledged', value: incident.acknowledgedAt, pending: 'Not acknowledged' },
    { label: 'Resolved', value: incident.resolvedAt, pending: 'Awaiting recovery' },
  ]

  return (
    <>
      <div className="mb-6"><PageHeading title={monitor?.name ?? 'Incident details'} description={incident.reason} /></div>
      <section className="panel" aria-labelledby="lifecycle-heading">
        <div className="panel-heading">
          <h2 id="lifecycle-heading" className="font-semibold">Incident lifecycle</h2>
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={incident.severity} />
            <Status status={incident.status} />
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p role="status" className={incident.status === 'RESOLVED'
            ? 'flex items-center gap-2 rounded-lg bg-good-soft px-3 py-2 text-pretty text-good'
            : 'text-pretty text-muted'}>
            {incident.status === 'RESOLVED' && <CircleCheck aria-hidden="true" size={18} className="shrink-0" />}
            {lifecycleMessages[incident.status]}
          </p>
          <dl className="grid gap-4 sm:grid-cols-3">
            {timings.map(({ label, value, pending }) => (
              <div key={label}>
                <dt className="text-sm font-medium text-muted">{label}</dt>
                <dd className="mt-1">{value ? <IncidentTime value={value} /> : pending}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted wrap-anywhere">
            {monitor
              ? <Link to={`/monitors/${monitor.id}`} className="action-link">View monitor</Link>
              : <>Monitor ID {incident.monitorId}</>}
          </p>
          {acknowledge.isError && (
            <div role="alert" className="rounded-lg border border-line bg-bad-soft px-3 py-2 text-sm text-bad">
              <p>{error?.status === 409 ? 'This incident has already been resolved.'
                : error?.message ?? 'Couldn’t reach the gateway. Try again.'}</p>
              {error?.requestId && <p className="mt-1 text-xs break-all">Request ID {error.requestId}</p>}
            </div>
          )}
          {incident.status === 'OPEN' && (
            <button type="button" className="button-primary" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
              {acknowledge.isPending ? 'Acknowledging…' : 'Acknowledge incident'}
            </button>
          )}
        </div>
      </section>
      <TransitionHistory id={incident.id} />
    </>
  )
}

export function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const incident = useIncident(incidentId!)
  const monitors = useMonitors()

  return (
    <>
      <QueryState query={incident} subject="incident">
        {(data) => (
          <IncidentDetails key={data.id} incident={data} monitor={monitors.data?.find(({ id }) => id === data.monitorId)} />
        )}
      </QueryState>
    </>
  )
}
