import { expect, test } from '@playwright/test';

const password = process.env.DEMO_ADMIN_PASSWORD ?? 'DemoElectionOps2026!';

test('autentica e consulta módulos persistidos no PostgreSQL', async ({ request }) => {
  const login = await request.post('http://127.0.0.1:3001/api/auth/login', { data: { email: 'admin@eops.local', password } });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json() as { token: string };
  const headers = { Authorization: `Bearer ${token}` };

  const me = await request.get('http://127.0.0.1:3001/api/auth/me', { headers });
  expect(me.status()).toBe(200);

  const incidents = await request.get('http://127.0.0.1:3001/api/incidents', { headers });
  expect(incidents.status()).toBe(200);
  expect((await incidents.json() as { total: number }).total).toBeGreaterThanOrEqual(3);

  const inventory = await request.get('http://127.0.0.1:3001/api/inventory', { headers });
  expect(inventory.status()).toBe(200);
  expect((await inventory.json() as { total: number }).total).toBeGreaterThanOrEqual(12);

  for (const endpoint of ['notifications', 'simulations']) {
    const response = await request.get(`http://127.0.0.1:3001/api/${endpoint}`, { headers });
    expect(response.status()).toBe(200);
  }

  // A auditoria exige janela explícita: consultar sem período não é uma leitura
  // válida do domínio.
  const auditWindow = new URLSearchParams({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date(Date.now() + 60_000).toISOString(),
  });
  const audit = await request.get(
    `http://127.0.0.1:3001/api/audit?${auditWindow.toString()}`,
    { headers },
  );
  expect(audit.status()).toBe(200);

  const auditWithoutWindow = await request.get('http://127.0.0.1:3001/api/audit', { headers });
  expect(auditWithoutWindow.status()).toBe(400);
});

test('RBAC bloqueia mutação sem permissão', async ({ request }) => {
  const login = await request.post('http://127.0.0.1:3001/api/auth/login', { data: { email: 'viewer@eops.local', password } });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json() as { token: string };
  const response = await request.post('http://127.0.0.1:3001/api/inventory', { headers: { Authorization: `Bearer ${token}` }, data: {} });
  expect(response.status()).toBe(403);
});
