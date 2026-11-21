import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

test('creates, edits, enables, disables and deletes a monitor from the dashboard', async ({ page, request }) => {
  const collection = '/api/monitors'
  const name = `Management test ${randomUUID()}`
  const editedName = `${name} edited`
  const fixtureUrl = 'http://monitor-fixture:8090/ok'
  const editedUrl = new URL('/redirect-safe', fixtureUrl).href
  let path

  const watchWrite = (method, endpoint) => page.waitForResponse((response) =>
    new URL(response.url()).pathname === endpoint && response.request().method() === method)

  async function persisted() {
    const response = await request.get(path)
    await expect(response).toBeOK()
    return response.json()
  }

  try {
    await page.goto('/monitors')
    const newMonitor = page.getByRole('button', { name: 'New monitor', exact: true })
    await newMonitor.focus()
    await page.keyboard.press('Enter')
    const create = page.getByRole('dialog', { name: 'New monitor' })
    await expect(create).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(create).toHaveCount(0)
    await expect(newMonitor).toBeFocused()
    await newMonitor.click()
    await create.getByLabel('Name', { exact: true }).fill(name)
    await create.getByLabel('URL', { exact: true }).fill('http://localhost/health')
    await create.getByLabel('Enable checks', { exact: true }).uncheck()
    const rejected = watchWrite('POST', collection)
    await create.getByRole('button', { name: 'Create monitor' }).click()
    expect((await rejected).status()).toBe(400)
    await expect(create.getByLabel('URL', { exact: true }))
      .toHaveAccessibleDescription('Loopback destinations are blocked')
    await expect(create.getByLabel('Name', { exact: true })).toHaveValue(name)

    await create.getByLabel('URL', { exact: true }).fill(fixtureUrl)
    const creating = watchWrite('POST', collection)
    await create.getByRole('button', { name: 'Create monitor' }).click()
    const created = await creating
    expect(created.status(), 'Run Compose with compose.monitor-dev.yml and monitor-fixture.').toBe(201)
    const { id } = await created.json()
    path = `${collection}/${id}`
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    expect(await persisted()).toMatchObject({ name, url: fixtureUrl, enabled: false })

    await page.getByRole('button', { name: 'Edit monitor' }).click()
    const edit = page.getByRole('dialog', { name: 'Edit monitor' })
    await expect(edit.getByLabel('URL', { exact: true })).toHaveValue(fixtureUrl)
    await edit.getByLabel('Name', { exact: true }).fill(editedName)
    await edit.getByLabel('URL', { exact: true }).fill(editedUrl)
    await edit.getByLabel('Check interval (seconds)').fill('45')
    await edit.getByLabel('Timeout (seconds)').fill('6')
    await edit.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: editedName, exact: true })).toBeVisible()
    expect(await persisted()).toMatchObject({
      name: editedName, url: editedUrl, intervalSeconds: 45, timeoutSeconds: 6, enabled: false,
    })

    await page.getByRole('button', { name: 'Enable checks' }).click()
    await expect(page.getByRole('button', { name: 'Disable checks' })).toBeVisible()
    expect((await persisted()).enabled).toBe(true)
    await page.getByRole('button', { name: 'Disable checks' }).click()
    await expect(page.getByText('Paused', { exact: true })).toBeVisible()
    expect((await persisted()).enabled).toBe(false)

    await page.getByRole('button', { name: 'Delete monitor' }).click()
    const confirmation = page.getByRole('dialog', { name: 'Delete monitor' })
    await expect(confirmation).toContainText(editedName)
    await confirmation.getByRole('button', { name: 'Cancel' }).click()
    await expect(confirmation).toHaveCount(0)
    await persisted()

    await page.getByRole('button', { name: 'Delete monitor' }).click()
    await confirmation.getByRole('button', { name: 'Delete monitor' }).click()
    await expect(page.getByRole('heading', { name: 'Monitors', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: editedName })).toHaveCount(0)
    expect((await request.get(path)).status()).toBe(404)
    path = undefined
  } finally {
    if (path) {
      const cleanup = await request.delete(path)
      expect([204, 404]).toContain(cleanup.status())
    }
  }
})
