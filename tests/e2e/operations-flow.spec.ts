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

  await page.getByRole('link', { name: /Mapa/ }).click();
  await expect(page.getByRole('heading', { name: 'Mapa Operacional' })).toBeVisible();
  await page.locator('.operational-marker').first().click({ force: true });
  await page.getByRole('link', { name: 'Ver local' }).click();

  await expect(page).toHaveURL(/\/polling-places\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Seções eleitorais' })).toBeVisible();
});

test('abre módulos operacionais autenticados', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@eops.local');
  await page.getByLabel('Senha').fill(process.env.DEMO_ADMIN_PASSWORD ?? 'DemoElectionOps2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: /Incidentes/ }).click();
  await expect(page.getByRole('heading', { name: 'Central de Incidentes' })).toBeVisible();
  await page.getByRole('link', { name: /Inventário/ }).click();
  await expect(page.getByRole('heading', { name: 'Inventário e Ativos' })).toBeVisible();
  await page.getByRole('link', { name: /Simulador/ }).click();
  await expect(page.getByRole('heading', { name: 'Simulador Operacional' })).toBeVisible();
});
