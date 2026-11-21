import { expect, test } from '@playwright/test'

test('loads the production app on a deep link and keeps API errors separate', async ({ page }) => {
  const id = '00000000-0000-0000-0000-000000000000'
  const response = await page.goto(`/incidents/${id}`)
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('no-cache')
  expect(response.headers()['content-security-policy']).toContain("default-src 'self'")

  await expect(page.getByRole('alert')).toContainText('HTTP 404')
  await page.getByRole('link', { name: 'All incidents' }).click()
  await expect(page.getByRole('heading', { name: 'Incidents', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Active incidents' })).toBeVisible()
})

test('serves Settings directly and persists the selected theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  const response = await page.goto('/settings')
  expect(response.status()).toBe(200)
  const settings = page.getByRole('heading', { name: 'Settings', exact: true })
  await expect(settings).toBeVisible()
  await page.getByRole('radio', { name: 'Light' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked()
  await page.getByRole('radio', { name: 'System' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked()
})
