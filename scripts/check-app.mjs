import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const app = readFileSync(new URL('app.js', root), 'utf8');

new Script(app, { filename: 'app.js' });

assert.match(html, /Content-Security-Policy/i, 'A Content Security Policy must be present');
assert.match(html, /src=["']\.\/app\.js["']/i, 'The app must load its external script');
assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, 'Inline scripts must not bypass the CSP');
assert.match(app, /calendar\.events\.readonly/, 'Calendar access must remain read-only');
assert.match(app, /nextPageToken/, 'Calendar import must handle pagination');
assert.match(app, /normalizeDB/, 'Backups must be validated before use');
assert.match(app, /google\.accounts\.oauth2\.revoke/, 'Disconnect must attempt OAuth revocation');
assert.doesNotMatch(app, /localStorage\.setItem\([^,]*(?:access.?token|refresh.?token)/i, 'Google OAuth tokens must not be persisted');

console.log('Plantão Control checks passed: app.js syntax and security invariants verified.');
