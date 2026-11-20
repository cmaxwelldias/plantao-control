import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = resolve(root, '.' + pathname);
    if (target !== root && !target.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const filePath = target === root || pathname.endsWith('/') ? resolve(target, 'index.html') : target;
    const file = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': types[extname(filePath)] || 'application/octet-stream' });
    res.end(file);
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ timezoneId: 'America/Sao_Paulo' });
  await context.addInitScript(() => {
    window.__revoked = false;
    window.google = { accounts: { oauth2: {
      initTokenClient: ({ callback }) => ({ requestAccessToken: () => callback({ access_token: 'mock-access-token' }) }),
      revoke: (token, callback) => { window.__revoked = token === 'mock-access-token'; callback(); }
    } } };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  page.on('console', message => console.log('[browser]', message.type(), message.text()));
  page.on('pageerror', error => console.error('[browser page error]', error));
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.locator('[data-tab="plantoes"]').click();
  await page.waitForSelector('#shiftForm');
  console.log('Smoke test: application loaded and shifts tab opened.');

  await page.locator('#shiftHospital').selectOption({ index: 0 });
  await page.locator('#start').fill('2026-11-23T20:00');
  await page.locator('#end').fill('2026-11-24T06:00');
  await page.locator('#status').selectOption('Recebido');
  await page.locator('#shiftForm button[type="submit"]').click();
  assert.equal(await page.locator('#mQtd').innerText(), '1');
  assert.match(await page.locator('#mHoras').innerText(), /10/);
  assert.match(await page.locator('#mPago').innerText(), /310/);
  console.log('Smoke test: manual shift totals passed.');

  await page.route(/https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/primary\/events/, async route => {
    const url = new URL(route.request().url());
    const secondPage = url.searchParams.get('pageToken') === 'page-2';
    const items = secondPage ? [{
      id: 'google-event-2', summary: "D'or - plantão",
      start: { dateTime: '2026-11-24T22:00:00-03:00' },
      end: { dateTime: '2026-11-25T05:00:00-03:00' }
    }] : [{
      id: 'google-event-1', summary: 'HSL - plantão',
      start: { dateTime: '2026-11-23T18:00:00-03:00' },
      end: { dateTime: '2026-11-23T20:00:00-03:00' }
    }];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(secondPage ? { items } : { items, nextPageToken: 'page-2' })
    });
  });

  await page.locator('#googleClientId').fill('1234567890-test.apps.googleusercontent.com');
  await page.locator('#connectGoogle').click();
  await page.locator('#calFrom').fill('2026-11-23');
  await page.locator('#calTo').fill('2026-11-24');
  await page.locator('#importCalendar').click();
  await page.waitForFunction(() => document.querySelector('#calendarStatus').textContent.includes('2 evento(s) importado(s)'), null, { timeout: 15000 });
  console.log('Smoke test: Google Calendar pagination passed.');
  assert.equal(await page.locator('#mQtd').innerText(), '3', 'Both Calendar pages should import without losing the manual shift');
  assert.match(await page.locator('#mHoras').innerText(), /19/);
  const saved = await page.evaluate(() => localStorage.getItem('plantao-control-v1'));
  assert.ok(saved && !saved.includes('mock-access-token'), 'OAuth token must not be persisted');

  await page.locator('#disconnectGoogle').click();
  assert.match(await page.locator('#calendarStatus').innerText(), /revogado/i);
  assert.equal(await page.evaluate(() => window.__revoked), true);
  console.log('Smoke test: OAuth revocation passed.');

  await page.locator('[data-tab="hospitais"]').click();
  await page.locator('#hospitalName').fill('<img src=x onerror=alert(1)>');
  await page.locator('#dayRate').fill('10');
  await page.locator('#hospitalForm button[type="submit"]').click();
  assert.equal(await page.locator('#hospitalTable img').count(), 0, 'Hospital names must be rendered as text, not HTML');
  assert.equal(dialogs.length, 0, 'Untrusted names must not execute script');
  console.log('Smoke test: HTML escaping passed.');

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('Service worker registration was not created.');
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker readiness timed out.')), 10000))
    ]);
  });
  console.log('Smoke test: service worker is ready.');
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator('#mQtd').innerText(), '3', 'The PWA should reopen offline with saved shifts');
  console.log('Smoke test: offline reload passed.');
  console.log('Browser smoke tests passed: shift totals, Calendar pagination, OAuth revocation, HTML escaping, and offline reload.');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
