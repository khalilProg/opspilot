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
