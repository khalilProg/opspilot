import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DeleteMonitorDialog, MonitorActionError, MonitorForm } from '../components/MonitorDialogs'
import { monitorStatus, Status } from '../components/OperationLists'
import { PageHeading } from '../components/PageHeading'
import { QueryState } from '../components/QueryState'
import { useToggleMonitor } from '../hooks/useMonitorManagement'
import { useMonitor, useMonitorChecks } from '../hooks/useOperations'
import type { Monitor, MonitorCheck } from '../types/operations'

const timestampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

function CheckHistory({ checks }: { checks: MonitorCheck[] }) {
  const latest = checks[0]
  return (
    <>
      <div className="p-5">
        <p className="text-sm font-medium text-muted">Latest response time</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{latest.responseTimeMs} ms</p>
        <div className="mt-5 h-56 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[...checks].reverse()} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#dfe6f0" vertical={false} />
              <XAxis
                dataKey="checkedAt"
                tickFormatter={(value: string) => timeFormat.format(new Date(value))}
                tick={{ fill: '#52617a', fontSize: 12 }}
                minTickGap={30}
              />
              <YAxis domain={[0, 'auto']} unit=" ms" tick={{ fill: '#52617a', fontSize: 12 }} width={78} />
              <Tooltip labelFormatter={(value) => timestampFormat.format(new Date(String(value)))} />
              <Line
                type="linear"
                dataKey="responseTimeMs"
                name="Response time"
                unit=" ms"
                stroke="#2851bd"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Recent monitor checks</caption>
          <thead className="border-y border-line bg-canvas text-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Checked at</th>
              <th scope="col" className="px-4 py-3 font-medium">Response time</th>
              <th scope="col" className="px-5 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {checks.map((check) => (
              <tr key={check.id}>
                <td className="px-5 py-3">
                  <time dateTime={check.checkedAt}>{timestampFormat.format(new Date(check.checkedAt))}</time>
                </td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums">{check.responseTimeMs} ms</td>
                <td className={`px-5 py-3 ${check.error ? 'text-rose-800' : 'text-emerald-800'}`}>
                  {check.error || `HTTP ${check.httpStatus}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function RecentChecks({ monitorId }: { monitorId: string }) {
  const checks = useMonitorChecks(monitorId)
  return (
    <section className="panel" aria-labelledby="checks-heading">
      <div className="panel-heading">
        <h2 id="checks-heading" className="font-semibold">Recent checks</h2>
      </div>
      <QueryState query={checks} subject="check history" emptyMessage="No checks recorded yet.">
        {(data) => <CheckHistory checks={data} />}
      </QueryState>
    </section>
  )
}

function MonitorConfiguration({ monitor }: { monitor: Monitor }) {
  const navigate = useNavigate()
  const toggle = useToggleMonitor(monitor.id)
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)
  const dismiss = () => setDialog(null)

  return (
    <section className="panel mb-5" aria-labelledby="configuration-heading">
      <div className="panel-heading">
        <h2 id="configuration-heading" className="font-semibold">Configuration</h2>
        <button type="button" className="button-secondary" disabled={toggle.isPending} onClick={() => setDialog('edit')}>
          <Pencil aria-hidden="true" size={15} />
          Edit monitor
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-medium text-muted">Check interval</dt>
          <dd className="mt-1">{monitor.intervalSeconds} seconds</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted">Timeout</dt>
          <dd className="mt-1">{monitor.timeoutSeconds} seconds</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted">Scheduled checks</dt>
          <dd className="mt-1">{monitor.enabled ? 'Enabled' : 'Disabled'}</dd>
        </div>
      </dl>
      {toggle.error && <div className="px-5 pb-4"><MonitorActionError error={toggle.error} /></div>}
      <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
        <button
          type="button"
          className="button-secondary"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(!monitor.enabled)}
        >
          {toggle.isPending ? 'Updating…' : monitor.enabled ? 'Disable checks' : 'Enable checks'}
        </button>
        <button
          type="button"
          className="button-secondary ml-auto text-rose-800"
          disabled={toggle.isPending}
          onClick={() => setDialog('delete')}
        >
          Delete monitor
        </button>
      </div>
      {dialog === 'edit' && <MonitorForm monitor={monitor} onDismiss={dismiss} onSaved={dismiss} />}
      {dialog === 'delete' && (
        <DeleteMonitorDialog monitor={monitor} onDismiss={dismiss} onDeleted={() => navigate('/monitors', { replace: true })} />
      )}
    </section>
  )
}

export default function MonitorDetailPage() {
  const { monitorId } = useParams<{ monitorId: string }>()
  const monitor = useMonitor(monitorId!)

  return (
    <>
      <p className="mb-5"><Link to="/monitors" className="action-link">All monitors</Link></p>
      <QueryState query={monitor} subject="monitor">
        {(data) => (
          <>
            <div className="flex flex-wrap items-start justify-between gap-x-4">
              <div className="min-w-0 wrap-anywhere">
                <PageHeading title={data.name} description={data.url} />
              </div>
              <Status status={monitorStatus(data)} />
            </div>
            <MonitorConfiguration key={data.id} monitor={data} />
            <RecentChecks monitorId={data.id} />
          </>
        )}
      </QueryState>
    </>
  )
}
