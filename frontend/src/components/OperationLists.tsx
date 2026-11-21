import { Link } from 'react-router'
import type { Incident, Monitor } from '../types/operations'

const statusStyles = {
  UP: ['Up', 'bg-good-soft text-good'],
  DOWN: ['Down', 'bg-bad-soft text-bad'],
  UNKNOWN: ['Unknown', 'bg-raised text-muted'],
  PAUSED: ['Paused', 'bg-raised text-muted'],
  OPEN: ['Open', 'bg-bad-soft text-bad'],
  ACKNOWLEDGED: ['Acknowledged', 'bg-warn-soft text-warn'],
  RESOLVED: ['Resolved', 'bg-good-soft text-good'],
} as const

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })

export function Status({ status }: { status: keyof typeof statusStyles }) {
  const [label, color] = statusStyles[status] ?? statusStyles.UNKNOWN
  return (
    <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${color}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{label}
    </span>
  )
}

export function monitorStatus(monitor: Monitor) {
  return monitor.enabled ? monitor.status : 'PAUSED'
}

export function MonitorList({ monitors }: { monitors: Monitor[] }) {
  return (
    <ul className="operation-list divide-y divide-line">
      {monitors.map((monitor) => (
        <li key={monitor.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0 flex-1 basis-44">
            <Link to={`/monitors/${monitor.id}`} className="action-link leading-snug wrap-anywhere">
              {monitor.name}
            </Link>
            <p className="mt-1 text-sm text-muted wrap-anywhere" translate="no">{monitor.url}</p>
          </div>
          <Status status={monitorStatus(monitor)} />
        </li>
      ))}
    </ul>
  )
}

export function IncidentTime({ value }: { value: string }) {
  return <time dateTime={value}>{dateFormat.format(new Date(value))}</time>
}

export function SeverityBadge({ severity }: { severity: Incident['severity'] }) {
  return (
    <span className="w-fit rounded-full bg-raised px-2.5 py-1 text-sm font-medium text-muted">
      {severity === 'HIGH' ? 'High severity' : 'Severity unavailable'}
    </span>
  )
}

export function IncidentList({ incidents, monitors }: { incidents: Incident[]; monitors?: Monitor[] }) {
  const names = new Map(monitors?.map(({ id, name }) => [id, name]))
  return (
    <ul className="operation-list divide-y divide-line">
      {incidents.map((incident) => (
        <li key={incident.id} className="px-5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <Link to={`/incidents/${incident.id}`} className="action-link leading-snug wrap-anywhere">
              {names.get(incident.monitorId) ?? `Monitor ${incident.monitorId.slice(0, 8)}`}
            </Link>
            <div className="flex flex-wrap gap-1.5">
              <SeverityBadge severity={incident.severity} />
              <Status status={incident.status} />
            </div>
          </div>
          <p className="mt-1.5 wrap-anywhere">{incident.reason}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
            <p>Opened <IncidentTime value={incident.openedAt} /></p>
            {incident.resolvedAt && (
              <p>Resolved <IncidentTime value={incident.resolvedAt} /></p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
