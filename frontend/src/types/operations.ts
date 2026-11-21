export interface Monitor {
  id: string
  name: string
  url: string
  enabled: boolean
  status: 'UNKNOWN' | 'UP' | 'DOWN'
  intervalSeconds: number
  timeoutSeconds: number
  consecutiveFailures: number
  createdAt: string
  updatedAt: string
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
