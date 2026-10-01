import { expect, test } from '@playwright/test';

test('navega do pleito ao local e volta pelo mapa', async ({ page }) => {
  await page.goto('/elections');
  await page.getByLabel('E-mail').fill('admin@eops.local');
  await page.getByLabel('Senha').fill(process.env.DEMO_ADMIN_PASSWORD ?? 'DemoElectionOps2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Gestão de Pleitos' })).toBeVisible();

  await page.getByTestId('election-link').first().click();
  await expect(page.getByRole('heading', { name: /Eleições/i })).toBeVisible();
  await page.getByRole('link', { name: 'Ver zonas' }).click();

  await page.getByTestId('zone-details-link').first().click();
  await expect(page.getByRole('heading', { name: /Zona \d+/ })).toBeVisible();
  await page.getByTestId('polling-place-link').first().click();

  await expect(page.getByRole('heading', { name: 'Seções eleitorais' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Seção \d+/ }).first()).toBeVisible();

  const mapResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/polling-places/map') &&
      response.request().method() === 'GET',
  );

  await page.getByRole('link', { name: /Mapa/ }).click();
  await expect(page.getByRole('heading', { name: 'Mapa Operacional' })).toBeVisible();

  const mapResponse = await mapResponsePromise;
  expect(mapResponse.ok()).toBeTruthy();

  const marker = page.locator('.leaflet-overlay-pane .leaflet-interactive').first();
  await expect(marker).toBeVisible({ timeout: 30_000 });
  await marker.click({ force: true });

  const viewPlaceLink = page.getByRole('link', { name: 'Ver local' });
  await expect(viewPlaceLink).toBeVisible();
  await viewPlaceLink.click();

  await expect(page).toHaveURL(/\/polling-places\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Seções eleitorais' })).toBeVisible();
});

test('abre módulos operacionais autenticados', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@eops.local');
  await page.getByLabel('Senha').fill(process.env.DEMO_ADMIN_PASSWORD ?? 'DemoElectionOps2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  await page.locator('a[href="/incidents"]').first().click();
  await expect(page.getByRole('heading', { name: 'Central de Incidentes' })).toBeVisible();

  await page.locator('a[href="/inventory"]').first().click();
  await expect(page.getByRole('heading', { name: 'Inventário e Ativos' })).toBeVisible();

  await page.locator('a[href="/simulator"]').first().click();
  await expect(page.getByRole('heading', { name: 'Simulador Operacional' })).toBeVisible();
});
