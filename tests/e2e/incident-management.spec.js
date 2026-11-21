import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

test('follows an outage through acknowledgement and recovery from the dashboard', async ({ page, request }) => {
  const name = `Incident UI test ${randomUUID()}`
  const config = {
    name,
    url: 'http://monitor-fixture:8090/ok',
    intervalSeconds: 1,
    timeoutSeconds: 2,
    enabled: true,
  }
  const created = await request.post('/api/monitors', { data: config })
  expect(created.status(), 'Run Compose with compose.monitor-dev.yml and monitor-fixture.').toBe(201)
  const { id } = await created.json()
  const monitorPath = `/api/monitors/${id}`
  let outage = false

  async function waitForUp() {
    await expect.poll(async () => {
      const response = await request.get(monitorPath)
      await expect(response).toBeOK()
      return (await response.json()).status
    }, { timeout: 40_000 }).toBe('UP')
  }

  try {
    await waitForUp()
    await page.goto('/incidents')
    const active = page.getByRole('region', { name: 'Active incidents' })
    const resolved = page.getByRole('region', { name: 'Resolved incidents' })
    const activeLink = active.getByRole('link', { name, exact: true })

    const failure = { ...config, url: 'http://monitor-fixture:8090/unavailable' }
    await expect(await request.put(monitorPath, { data: failure })).toBeOK()
    outage = true
    await expect(activeLink).toBeVisible({ timeout: 50_000 })
    await expect(active.getByRole('listitem').filter({
      has: page.getByRole('link', { name, exact: true }),
    })).toContainText('High severity')
    await activeLink.click()

    const lifecycle = page.getByRole('region', { name: 'Incident lifecycle' })
    const history = page.getByRole('region', { name: 'Transition history' }).getByRole('listitem')
    const acknowledge = page.getByRole('button', { name: 'Acknowledge incident' })
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    await expect(lifecycle.getByText('Open', { exact: true })).toBeVisible()
    await expect(lifecycle.locator('time')).toHaveCount(1)
    await expect(history).toHaveText([/Incident opened/])

    await acknowledge.click()
    await expect(lifecycle.getByRole('status')).toHaveText('Waiting for monitor recovery.')
    await expect(lifecycle.locator('time')).toHaveCount(2)
    await expect(history).toHaveText([/Incident opened/, /Incident acknowledged/])
    await expect(acknowledge).toHaveCount(0)

    const navigations = []
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url())
    })
    await expect(await request.put(monitorPath, { data: config })).toBeOK()
    await expect(lifecycle.getByRole('status'))
      .toHaveText('Monitor recovered and the incident is resolved.', { timeout: 50_000 })
    outage = false
    await expect(lifecycle.locator('time')).toHaveCount(3)
    await expect(history).toHaveText([/Incident opened/, /Incident acknowledged/, /Monitor recovered/])
    await expect(acknowledge).toHaveCount(0)
    expect(navigations).toEqual([])

    await page.getByRole('link', { name: 'All incidents' }).click()
    await expect(resolved.getByRole('link', { name, exact: true })).toBeVisible()
    await expect(activeLink).toHaveCount(0)
  } finally {
    try {
      if (outage) {
        await expect(await request.put(monitorPath, { data: config })).toBeOK()
        await waitForUp()
      }
    } finally {
      const deleted = await request.delete(monitorPath)
      expect(deleted.status()).toBe(204)
    }
  }
})
