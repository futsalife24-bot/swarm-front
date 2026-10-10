import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('dist-validation/balance-triage', { recursive: true });
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { FrontNetwork } = await vite.ssrLoadModule('/src/client/front-network.ts');
  const network = new FrontNetwork('http://localhost:8789');
  const sent = [];
  const socket = { readyState: 1, bufferedAmount: 5000, send: text => sent.push(JSON.parse(text)), close() { this.readyState = 3; } };
  network.ws = socket;
  const neutral = { seq: 1, mx: 0, my: 0, yaw: 0, pitch: 0, fire: false, reload: false, swap: false, dodge: false, jump: false };
  network.input({ ...neutral, dodge: true, reload: true });
  // App clearInput resets Controls and frame timing, but calls no FrontNetwork method.
  // Resume with a newly neutral Controls result after the congestion clears.
  socket.bufferedAmount = 0;
  network.input({ ...neutral, seq: 2 });
  const result = { scope: 'transport-only reproduction; not yet an actual browser/server reproduction', queuedDuringCongestion: true, neutralInputOnResume: { ...neutral, seq: 2 }, sent, staleDodge: sent[0]?.input?.dodge === true, staleReload: sent[0]?.input?.reload === true };
  writeFileSync('dist-validation/balance-triage/pending-input-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  network.close();
} finally { await vite.close(); }
