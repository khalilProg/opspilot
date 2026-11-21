import { Link } from 'react-router'
import type { Incident, Monitor } from '../types/operations'

const statusStyles = {
  UP: ['Up', 'bg-emerald-50 text-emerald-800'],
  DOWN: ['Down', 'bg-rose-50 text-rose-800'],
  UNKNOWN: ['Unknown', 'bg-slate-100 text-slate-700'],
  PAUSED: ['Paused', 'bg-slate-100 text-slate-700'],
  OPEN: ['Open', 'bg-rose-50 text-rose-800'],
  ACKNOWLEDGED: ['Acknowledged', 'bg-amber-50 text-amber-900'],
  RESOLVED: ['Resolved', 'bg-emerald-50 text-emerald-800'],
} as const

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function Status({ status }: { status: keyof typeof statusStyles }) {
  const [label, color] = statusStyles[status] ?? statusStyles.UNKNOWN
  return <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-sm font-medium ${color}`}>{label}</span>
}

export function monitorStatus(monitor: Monitor) {
  return monitor.enabled ? monitor.status : 'PAUSED'
}

export function MonitorList({ monitors }: { monitors: Monitor[] }) {
  return (
    <ul className="divide-y divide-line">
      {monitors.map((monitor) => (
        <li key={monitor.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0 flex-1 basis-44">
            <Link to={`/monitors/${monitor.id}`} className="action-link text-base wrap-anywhere">
              {monitor.name}
            </Link>
            <p className="mt-1 text-sm text-muted wrap-anywhere">{monitor.url}</p>
          </div>
          <Status status={monitorStatus(monitor)} />
        </li>
      ))}
    </ul>
  )
}

export function IncidentList({ incidents }: { incidents: Incident[] }) {
  return (
    <ul className="divide-y divide-line">
      {incidents.map((incident) => (
        <li key={incident.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0 flex-1 basis-44">
            <p className="font-semibold wrap-anywhere">{incident.reason || 'Monitor reported down'}</p>
            <time dateTime={incident.openedAt} className="mt-1 block text-sm text-muted">
              {dateFormat.format(new Date(incident.openedAt))}
            </time>
          </div>
          <Status status={incident.status} />
        </li>
      ))}
    </ul>
  )
}
