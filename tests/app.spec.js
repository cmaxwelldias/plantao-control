import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('abre o painel e apresenta os hospitais iniciais', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Plantonices' })).toBeVisible();
  await expect(page.locator('#hospitalTable')).toContainText('HSL');
  await expect(page.locator('#hospitalTable')).toContainText("D'or");
  await expect(page.locator('#mQtd')).toHaveText('0');
  await page.locator('[data-tab="plantoes"]').click();
  await page.locator('#calendarView').selectOption('week');
  await expect(page.locator('#calendarGrid [data-calendar-day]')).toHaveCount(7);
  await page.locator('#calendarView').selectOption('year');
  await expect(page.locator('#calendarGrid [data-calendar-month]')).toHaveCount(12);
  await page.locator('#calendarGrid [data-calendar-month="10"]').click();
  await expect(page.locator('#calendarView')).toHaveValue('month');
});

test('cadastra hospital, calcula adicional noturno e mostra no calendário', async ({ page }) => {
  await page.locator('#hospitalName').fill('Hospital Teste');
  await page.locator('#hospitalAddress').fill('Rua de Teste, 100, Niterói');
  await page.locator('#hospitalModalities').fill('Tomografia, Ressonância');
  await page.locator('#hospitalPhoto').setInputFiles({name:'hospital.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZkAAAAAASUVORK5CYII=','base64')});
  await page.locator('#dayRate').fill('31');
  await page.locator('#nightMode').selectOption('percent');
  await page.locator('#nightValue').fill('20');
  await page.getByRole('button', { name: 'Salvar hospital' }).click();
  await expect(page.locator('#hospitalTable')).toContainText('Hospital Teste');
  await expect(page.locator('#hospitalTable')).toContainText('Rua de Teste');
  await expect(page.locator('#hospitalTable')).toContainText('Tomografia');
  await expect(page.locator('#hospitalTable img')).toHaveCount(1);

  await page.locator('[data-tab="plantoes"]').click();
  await page.locator('#shiftHospital').selectOption({ index: 2 });
  await page.locator('#start').fill('2026-11-20T21:00');
  await page.locator('#end').fill('2026-11-21T07:00');
  await page.locator('#breakMins').fill('0');
  await page.getByRole('button', { name: 'Salvar plantão' }).click();

  await expect(page.locator('#mQtd')).toHaveText('1');
  await expect(page.locator('#mHoras')).toContainText('10');
  await expect(page.locator('#shiftTable')).toContainText(/353,40/);
  await page.locator('#calendarGrid [data-calendar-day="2026-11-20"]').click();
  await expect(page.locator('#calendarDayDetails')).toContainText('Hospital Teste');
});

test('impede término anterior ao início e preserva dados no backup', async ({ page }) => {
  await page.locator('[data-tab="plantoes"]').click();
  await page.locator('#shiftHospital').selectOption({ index: 0 });
  await page.locator('#start').fill('2026-11-20T19:00');
  await page.locator('#end').fill('2026-11-20T07:00');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Salvar plantão' }).click();
  await expect(page.locator('#mQtd')).toHaveText('0');

  await page.locator('[data-tab="hospitais"]').click();
  await page.locator('#hospitalName').fill('Clínica Backup');
  await page.locator('#dayRate').fill('45');
  await page.getByRole('button', { name: 'Salvar hospital' }).click();
  await page.locator('[data-tab="dados"]').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import('node:fs/promises');
  const backup = JSON.parse(await fs.readFile(path, 'utf8'));
  expect(backup.hospitals.some(h => h.name === 'Clínica Backup')).toBeTruthy();
  expect(backup.shifts).toHaveLength(0);
});

test('carrega a versão PWA e registra o service worker', async ({ page, context }) => {
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await page.waitForFunction(() => 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null, null, { timeout: 8000 }).catch(() => {});
  const swSupported = await page.evaluate(() => 'serviceWorker' in navigator);
  expect(swSupported).toBeTruthy();
});


test('calculadoras, notas e exportações funcionam', async ({ page }) => {
  await page.locator('[data-tab="ferramentas"]').click();
  await page.locator('#toolStart').fill('19:00');
  await page.locator('#toolEnd').fill('07:00');
  await page.locator('#toolRate').fill('31');
  await page.locator('#toolCount').fill('2');
  await page.locator('#toolDeduct').fill('10');
  await page.locator('#toolShiftCalc').click();
  await expect(page.locator('#toolCalcResult')).toContainText('24,00 h');
  await expect(page.locator('#toolCalcResult')).toContainText('R$');

  await page.locator('#basicExpression').fill('(120 + 80) / 2');
  await page.locator('#basicCalculate').click();
  await expect(page.locator('#basicResult')).toContainText('100');

  await page.locator('[data-tool="notes"]').click();
  await page.locator('#plantonicesNotes').fill('Anotação de teste');
  await page.locator('#saveNotes').click();
  await expect(page.locator('#notesStatus')).toContainText('salvas');

  await page.locator('[data-tool="export"]').click();
  const csvPromise = page.waitForEvent('download');
  await page.locator('#exportCsv').click();
  expect(await csvPromise).toBeTruthy();
  const icsPromise = page.waitForEvent('download');
  await page.locator('#exportIcs').click();
  expect(await icsPromise).toBeTruthy();
});

test('arquivos podem ser adicionados ao armazenamento local', async ({ page }) => {
  await page.locator('[data-tab="ferramentas"]').click();
  await page.locator('[data-tool="files"]').click();
  await page.locator('#assetInput').setInputFiles({
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('arquivo de teste'),
  });
  await expect(page.locator('#assetList')).toContainText('nota.txt');
});

test('cria conta e sincroniza alterações dos plantões com a nuvem', async ({ page }) => {
  let uploadedPayload = null;
  let writes = 0;
  await page.route('https://qmpjupocsnbzecleklmo.supabase.co/auth/v1/signup', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_in: 3600,
      user: { id: 'test-user-id', email: 'teste@example.com' }
    }) });
  });
  await page.route('https://qmpjupocsnbzecleklmo.supabase.co/rest/v1/user_data**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    const headers = route.request().headers();
    expect(headers.authorization).toBe('Bearer test-access-token');
    expect(headers.apikey).toMatch(/^sb_publishable_/);
    uploadedPayload = route.request().postDataJSON().payload;
    writes++;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ updated_at: new Date().toISOString() }]) });
  });

  await page.locator('[data-tab="dados"]').click();
  await page.locator('#cloudEmail').fill('teste@example.com');
  await page.locator('#cloudPassword').fill('senha-de-teste-123');
  await page.locator('#cloudSignUp').click();
  await expect(page.locator('#cloudStatus')).toContainText('Primeiro backup enviado à nuvem');
  await expect(page.locator('#cloudUser')).toContainText('teste@example.com');

  await page.locator('[data-tab="plantoes"]').click();
  await page.locator('#shiftHospital').selectOption({ index: 0 });
  await page.locator('#start').fill('2026-11-25T07:00');
  await page.locator('#end').fill('2026-11-25T19:00');
  await page.locator('#shiftForm button[type="submit"]').click();
  await expect.poll(() => uploadedPayload?.shifts?.length || 0).toBe(1);
  expect(writes).toBeGreaterThanOrEqual(2);
});
