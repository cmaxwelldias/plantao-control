import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const app = readFileSync(new URL('app.js', root), 'utf8');
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const schema = readFileSync(new URL('supabase/schema.sql', root), 'utf8');
const cloud = readFileSync(new URL('cloud-sync.js', root), 'utf8');
const config = readFileSync(new URL('supabase-config.js', root), 'utf8');
const mobilePrep = readFileSync(new URL('scripts/prepare-mobile.mjs', root), 'utf8');
const mobilePrep = readFileSync(new URL('scripts/prepare-mobile.mjs', root), 'utf8');

new Script(app, { filename: 'app.js' });
new Script(sw, { filename: 'sw.js' });
new Script(cloud, { filename: 'cloud-sync.js' });
new Script(config, { filename: 'supabase-config.js' });

assert.match(html, /Content-Security-Policy/i, 'A Content Security Policy must be present');
assert.match(html, /src=["']\.\/app\.js["']/i, 'The app must load its external script');
assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, 'Inline scripts must not bypass the CSP');
assert.match(html, /src=["']\.\/supabase-config\.js["']/i, 'The public cloud configuration must load');
assert.match(html, /src=["']\.\/cloud-sync\.js["']/i, 'The cloud synchronization module must load');
assert.match(html, /cloudSignUp/, 'The app must provide account creation');
assert.match(html, /qmpjupocsnbzecleklmo\.supabase\.co/, 'The CSP must allow the Supabase API');
assert.match(html, /calendarGrid/, 'The monthly calendar must be present');
assert.match(app, /calendarPrev/, 'The calendar must support month navigation');
assert.match(app, /calendarDayDetails/, 'The calendar must show daily details');
assert.match(app, /Notification\.requestPermission/, 'Shift alerts must request browser permission explicitly');
assert.match(app, /setInterval\(checkUpcomingShiftAlerts/, 'Shift alerts must periodically recheck while the app is open');
assert.match(app, /calendar\.events\.readonly/, 'Calendar access must remain read-only');
assert.match(app, /nextPageToken/, 'Calendar import must handle pagination');
assert.match(app, /normalizeDB/, 'Backups must be validated before use');
assert.match(app, /google\.accounts\.oauth2\.revoke/, 'Disconnect must attempt OAuth revocation');
assert.doesNotMatch(app, /localStorage\.setItem\([^,]*(?:access.?token|refresh.?token)/i, 'Google OAuth tokens must not be persisted');
assert.match(sw, /plantonices-v14/, 'The PWA cache must be versioned');
assert.match(sw, /cloud-sync\.js/, 'The cloud client must be cached for offline app startup');
assert.match(sw, /app\.js/, 'The app bundle must be cached for offline use');
assert.match(sw, /startsWith\('plantao-control-'\)/, 'Cache cleanup must not delete caches belonging to other apps on the same origin');
assert.match(schema, /enable row level security/i, 'Cloud data must use RLS');
assert.match(schema, /auth\.uid\(\)/i, 'Cloud policies must enforce per-user ownership');
assert.doesNotMatch(schema, /to anon/i, 'Anonymous users must not receive table access');
assert.match(cloud, /auth\/v1\/token\?grant_type=refresh_token/, 'Cloud sessions must refresh through Supabase Auth');
assert.match(cloud, /plantonices:data-changed/, 'Local edits must trigger cloud synchronization');
assert.doesNotMatch(config, /service_role|sb_secret_/i, 'Privileged Supabase secrets must never be shipped to the browser');

assert.ok(mobilePrep.includes("'supabase-config.js'"), 'Native bundles must include the Supabase public configuration');
assert.ok(mobilePrep.includes("'cloud-sync.js'"), 'Native bundles must include the cloud synchronization module');

console.log('Plantão Control checks passed: app and service-worker syntax plus security invariants verified.');
