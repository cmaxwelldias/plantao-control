import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1]));

assert.ok(blocks.length > 0, 'Expected at least one inline application script');
for (const [index, block] of blocks.entries()) {
  new Script(block[2], { filename: \`index.html:inline-script-\${index + 1}\` });
}

assert.match(html, /calendar\.events\.readonly/, 'Calendar access must remain read-only');
assert.match(html, /nextPageToken/, 'Calendar import must handle pagination');
assert.match(html, /normalizeDB/, 'Backups must be validated before use');
assert.match(html, /google\.accounts\.oauth2\.revoke/, 'Disconnect must attempt OAuth revocation');
assert.doesNotMatch(html, /localStorage\.setItem\([^,]*(?:access.?token|refresh.?token)/i, 'OAuth tokens must not be persisted');

console.log(\`Plantão Control checks passed: \${blocks.length} inline script(s) parsed and security invariants verified.\`);
