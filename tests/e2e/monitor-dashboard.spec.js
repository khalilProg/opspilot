import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

const collection = '/api/monitors'
const fixture = 'http://monitor-fixture:8090'

test('shows a scheduled UP to DOWN transition without reloading', async ({ page, request }) => {
  const name = `Dashboard test ${randomUUID()}`
  const configuration = {
    name,
    url: `${fixture}/ok`,
    intervalSeconds: 1,
    timeoutSeconds: 2,
    enabled: false,
  }
  const created = await request.post(collection, { data: configuration })
  expect(
    created.status(),
    'Start the rebuilt gateway and monitor-fixture with compose.monitor-dev.yml before running this test.',
  ).toBe(201)
  const { id } = await created.json()
  const path = `${collection}/${id}`

  try {
    const emptyHistory = await request.get(`${path}/checks`)
    await expect(emptyHistory).toBeOK()
    expect(await emptyHistory.json()).toEqual([])
    const missingHistory = await request.get(`${collection}/${randomUUID()}/checks`)
    expect(missingHistory.status()).toBe(404)

    await page.goto('/monitors')
    const search = page.getByRole('searchbox', { name: 'Search monitors' })
    const status = page.getByLabel('Status', { exact: true })
    const monitor = page.getByRole('link', { name, exact: true })
    const row = page.getByRole('listitem').filter({ has: monitor })

    await search.fill(name.toUpperCase())
    await status.selectOption('PAUSED')
    await expect(row.getByText('Paused', { exact: true })).toBeVisible()
    await status.selectOption('DOWN')
    await expect(page.getByText('No monitors match your search and status filters.')).toBeVisible()
    await status.selectOption('')
    await search.fill(`${fixture}/ok`)
    await expect(monitor).toBeVisible()
    await search.fill(name)

    await expect(await request.patch(`${path}/enabled`, { data: { enabled: true } })).toBeOK()
    await expect(row.getByText('Up', { exact: true })).toBeVisible({ timeout: 45_000 })
    const counts = page.locator('dl[aria-label="Monitor counts"]')
    await expect(counts.locator(':scope > div').filter({ has: page.locator('dt', { hasText: /^Up$/ }) }).locator('dd'))
      .toHaveText(/^[1-9]\d*$/)

    const navigations = []
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url())
    })
    await expect(await request.put(path, {
      data: { ...configuration, enabled: true, url: `${fixture}/unavailable` },
    })).toBeOK()
    await expect(row.getByText('Down', { exact: true })).toBeVisible({ timeout: 60_000 })
    expect(navigations).toEqual([])

    await status.selectOption('DOWN')
    await expect(monitor).toBeVisible()
    await monitor.click()
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    await expect(page.getByText('Latest response time', { exact: true })).toBeVisible()
    const history = page.getByRole('table', { name: 'Recent monitor checks' })
    await expect(history.getByRole('cell', { name: 'HTTP 503', exact: true }).first()).toBeVisible()
    await expect(history.getByRole('cell', { name: 'HTTP 200', exact: true }).first()).toBeVisible()
    await expect(history.getByRole('cell', { name: /^\d+ ms$/ }).first()).toBeVisible()
    const response = await request.get(`${path}/checks`)
    await expect(response).toBeOK()
    const checks = await response.json()
    expect(checks.length).toBeLessThanOrEqual(20)
    expect(checks.map(({ id }) => id)).toEqual(checks.map(({ id }) => id).sort((a, b) => b - a))

    await test.step('restore the fixture endpoint and wait for recovery', async () => {
      await expect(await request.put(path, { data: { ...configuration, enabled: true } })).toBeOK()
      await expect(page.getByText('Up', { exact: true })).toBeVisible({ timeout: 45_000 })
    })
  } finally {
    const deleted = await request.delete(path)
    expect(deleted.status()).toBe(204)
  }
})
