import type { Incident, Monitor, MonitorCheck } from '../types/operations'

interface Collections {
  monitors: Monitor
  incidents: Incident
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId: string | null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getJson<T>(path: string, isExpected: (data: unknown) => boolean, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const requestId = response.headers.get('X-Request-ID')

  if (!response.ok) {
    throw new ApiError(`The gateway returned HTTP ${response.status}.`, response.status, requestId)
  }

  const data: unknown = await response.json().catch(() => null)
  if (!isExpected(data)) {
    throw new ApiError('The gateway returned an unexpected response.', response.status, requestId)
  }

  return data as T
}

export function getCollection<K extends keyof Collections>(collection: K, signal?: AbortSignal) {
  return getJson<Collections[K][]>(collection, Array.isArray, signal)
}

export function getMonitor(id: string, signal?: AbortSignal) {
  return getJson<Monitor>(`monitors/${encodeURIComponent(id)}`, (data) =>
    typeof data === 'object' && data !== null && 'id' in data && data.id === id, signal)
}

export function getMonitorChecks(id: string, signal?: AbortSignal) {
  return getJson<MonitorCheck[]>(`monitors/${encodeURIComponent(id)}/checks`, Array.isArray, signal)
}
