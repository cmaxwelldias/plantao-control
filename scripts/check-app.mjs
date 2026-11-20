import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const app = read('../app.js');
const serviceWorker = read('../sw.js');

new Script(app, { filename: 'app.js' });
assert.equal([...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m => !/\bsrc\s*=/.test(m[1])).length, 0, 'Application code must not be inline');
assert.match(html, /Content-Security-Policy/, 'A Content Security Policy must be present');
assert.match(html, /script-src 'self' https:\/\/accounts\.google\.com/, 'Only trusted script origins should be allowed');
assert.doesNotMatch(html, /script-src[^;]*unsafe-inline/, 'Inline scripts must remain blocked');
assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'HTML event-handler attributes must not be used');

assert.match(app, /calendar\.events\.readonly/, 'Calendar access must remain read-only');
assert.match(app, /nextPageToken/, 'Calendar import must handle pagination');
assert.match(app, /normalizeDB/, 'Backups must be validated before use');
assert.match(app, /google\.accounts\.oauth2\.revoke/, 'Disconnect must attempt OAuth revocation');
assert.doesNotMatch(app, /localStorage\.setItem\([^,]*(?:access.?token|refresh.?token)/i, 'OAuth tokens must not be persisted');
assert.match(serviceWorker, /app\.js/, 'The application script must be precached for offline use');

console.log('Plantão Control checks passed: app.js syntax and security invariants verified.');
