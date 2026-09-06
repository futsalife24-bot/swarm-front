import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
// Explicit local-only setup. Never print the key. Wrangler loads this ignored file.
if (!existsSync('.dev.vars')) {
  writeFileSync('.dev.vars', `ROOM_CREATION_KEY="${randomBytes(32).toString('hex')}"\n`, {flag:'wx'});
}
console.log('Local creation credential ready in ignored .dev.vars; existing file preserved.');
