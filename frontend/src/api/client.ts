import type { Incident, Monitor, MonitorCheck, MonitorConfiguration } from '../types/operations'

interface Collections {
  monitors: Monitor
  incidents: Incident
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId: string | null,
    readonly fieldErrors: Readonly<Record<string, string>> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  })
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const problem = body && typeof body === 'object' ? body : {}
    const fields = 'fieldErrors' in problem && problem.fieldErrors && typeof problem.fieldErrors === 'object'
      ? Object.entries(problem.fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      : []
    const message = 'message' in problem && typeof problem.message === 'string' && problem.message
      ? problem.message
      : `The gateway returned HTTP ${response.status}.`
    throw new ApiError(message, response.status, response.headers.get('X-Request-ID'), Object.fromEntries(fields))
  }
  return response
}

async function readJson<T>(response: Response, isExpected: (data: unknown) => boolean): Promise<T> {
  const data: unknown = await response.json().catch(() => null)
  if (!isExpected(data)) {
    throw new ApiError('The gateway returned an unexpected response.', response.status, response.headers.get('X-Request-ID'))
  }

  return data as T
}

export async function getCollection<K extends keyof Collections>(collection: K, signal?: AbortSignal) {
  return readJson<Collections[K][]>(await request(collection, { signal }), Array.isArray)
}

function monitorPath(id: string) {
  return `monitors/${encodeURIComponent(id)}`
}

function isMonitor(data: unknown) {
  return typeof data === 'object' && data !== null && 'id' in data && typeof data.id === 'string'
}

export async function getMonitor(id: string, signal?: AbortSignal) {
  return readJson<Monitor>(await request(monitorPath(id), { signal }), isMonitor)
}

export async function getMonitorChecks(id: string, signal?: AbortSignal) {
  return readJson<MonitorCheck[]>(await request(`${monitorPath(id)}/checks`, { signal }), Array.isArray)
}

async function writeMonitor(path: string, method: string, data: MonitorConfiguration | { enabled: boolean }) {
  return readJson<Monitor>(await request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }), isMonitor)
}

export function createMonitor(configuration: MonitorConfiguration) {
  return writeMonitor('monitors', 'POST', configuration)
}

export function updateMonitor(id: string, configuration: MonitorConfiguration) {
  return writeMonitor(monitorPath(id), 'PUT', configuration)
}

export function setMonitorEnabled(id: string, enabled: boolean) {
  return writeMonitor(`${monitorPath(id)}/enabled`, 'PATCH', { enabled })
}

export async function deleteMonitor(id: string) {
  await request(monitorPath(id), { method: 'DELETE' })
}
