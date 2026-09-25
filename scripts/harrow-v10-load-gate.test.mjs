import assert from 'node:assert/strict';
import {LatestRequest} from './harrow-v10-load-gate.mjs';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
}

async function reverseCompletion(firstVersion, secondVersion) {
  const gate = new LatestRequest();
  const pending = new Map([[firstVersion, deferred()], [secondVersion, deferred()]]);
  let installed = null;
  const load = async version => {
    const request = gate.begin(version);
    const asset = await pending.get(version).promise;
    if (!gate.isCurrent(request)) return false;
    installed = asset;
    return true;
  };

  const first = load(firstVersion);
  const second = load(secondVersion);
  pending.get(secondVersion).resolve({version: secondVersion, duration: secondVersion === 'v10' ? 16.8 : 4.2});
  assert.equal(await second, true);
  pending.get(firstVersion).resolve({version: firstVersion, duration: firstVersion === 'v10' ? 16.8 : 4.2});
  assert.equal(await first, false);
  assert.deepEqual(installed, {version: secondVersion, duration: secondVersion === 'v10' ? 16.8 : 4.2});
}

await reverseCompletion('v9', 'v10');
await reverseCompletion('v10', 'v9');
console.log('PASS latest HARROW version wins for both reverse completion orders');
