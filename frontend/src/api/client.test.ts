import { afterEach, describe, expect, test, vi } from 'vitest'
import { acknowledgeIncident, createMonitor, deleteMonitor, getCollection, getMonitorChecks } from './client'

const configuration = {
  name: 'API check',
  url: 'https://example.com/health',
  enabled: false,
  intervalSeconds: 30,
  timeoutSeconds: 5,
}

function mockFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('gateway API client', () => {
  test('polls the same-origin API with cancellation and without browser caching', async () => {
    const fetch = mockFetch(Response.json([]))
    const { signal } = new AbortController()
    await expect(getCollection('incidents', signal)).resolves.toEqual([])
    expect(fetch).toHaveBeenCalledWith('/api/incidents', {
      headers: new Headers({ Accept: 'application/json' }),
      cache: 'no-store',
      signal,
    })
  })

  test('posts JSON and forwards validation errors and the request ID', async () => {
    const fetch = mockFetch(Response.json({
      message: 'Check the highlighted fields.',
      fieldErrors: { url: 'Loopback destinations are blocked' },
    }, { status: 400, headers: { 'X-Request-ID': 'validation-request' } }))
    await expect(createMonitor(configuration)).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Check the highlighted fields.',
      requestId: 'validation-request',
      fieldErrors: { url: 'Loopback destinations are blocked' },
    })
    expect(fetch).toHaveBeenCalledWith('/api/monitors', expect.objectContaining({
      method: 'POST',
      headers: new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' }),
      body: JSON.stringify(configuration),
    }))
  })

  test('handles an unavailable upstream and a mismatched SPA response', async () => {
    mockFetch(new Response('Bad Gateway', { status: 502, headers: { 'X-Request-ID': 'outage-request' } }))
    await expect(getCollection('monitors')).rejects.toMatchObject({ status: 502, requestId: 'outage-request' })
    mockFetch(new Response('<html>OpsPilot</html>'))
    await expect(getMonitorChecks('monitor-id')).rejects.toThrow('unexpected response')
  })

  test('acknowledges an encoded incident ID without a request body', async () => {
    const fetch = mockFetch(Response.json({ id: 'incident/id', status: 'ACKNOWLEDGED' }))
    await expect(acknowledgeIncident('incident/id')).resolves.toMatchObject({ status: 'ACKNOWLEDGED' })
    expect(fetch.mock.calls[0][0]).toBe('/api/incidents/incident%2Fid/acknowledge')
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(fetch.mock.calls[0][1].body).toBeUndefined()
  })

  test('accepts a bodyless deletion response', async () => {
    const fetch = mockFetch(new Response(null, { status: 204 }))
    await expect(deleteMonitor('monitor-id')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/monitors/monitor-id', expect.objectContaining({ method: 'DELETE' }))
  })
})
