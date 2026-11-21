import type { Incident, Monitor } from '../types/operations'

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

export async function getCollection<K extends keyof Collections>(
  collection: K,
  signal?: AbortSignal,
): Promise<Collections[K][]> {
  const response = await fetch(`/api/${collection}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  const requestId = response.headers.get('X-Request-ID')

  if (!response.ok) {
    throw new ApiError(`The gateway returned HTTP ${response.status}.`, response.status, requestId)
  }

  const data: unknown = await response.json().catch(() => null)
  if (!Array.isArray(data)) {
    throw new ApiError('The gateway returned an unexpected response.', response.status, requestId)
  }

  return data
}
