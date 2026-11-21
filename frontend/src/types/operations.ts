export type MonitorStatus = 'UNKNOWN' | 'UP' | 'DOWN'

export interface Monitor {
  id: string
  name: string
  url: string
  enabled: boolean
  status: MonitorStatus
  intervalSeconds: number
  timeoutSeconds: number
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

export interface Incident {
  id: string
  monitorId: string
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  reason: string
  openedAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
}
