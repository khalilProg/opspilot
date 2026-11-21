export type MonitorStatus = 'UNKNOWN' | 'UP' | 'DOWN'

export interface MonitorConfiguration {
  name: string
  url: string
  enabled: boolean
  intervalSeconds: number
  timeoutSeconds: number
}

export interface Monitor extends MonitorConfiguration {
  id: string
  status: MonitorStatus
  consecutiveFailures: number
  createdAt: string
  updatedAt: string
}

export interface MonitorCheck {
  id: number
  checkedAt: string
  responseTimeMs: number
  httpStatus: number | null
  error: string | null
}

export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export interface Incident {
  id: string
  monitorId: string
  status: IncidentStatus
  severity: 'HIGH'
  reason: string
  openedAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
}

export interface IncidentTransition {
  fromStatus: IncidentStatus | null
  toStatus: IncidentStatus
  occurredAt: string
}
