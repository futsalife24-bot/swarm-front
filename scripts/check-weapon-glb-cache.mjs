// Isolated origin and disposable browser contexts; never modifies product caches or player saves.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import vm from 'node:vm';

const glb = await fs.readFile('public/assets/weapons/unique-v1/medic_0.glb');
const original = await fs.readFile('public/assets/weapons/realism-v2/rifle_0.glb');
const sw = await fs.readFile('public/sw.js', 'utf8');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const glb64 = glb.toString('base64'), original64 = original.toString('base64');
const html = '<!doctype html><title>SPA fallback</title>';
let serverMode = 'html', assetRequests = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/' || url.pathname === '/index.html') return void res.end('<!doctype html><title>fixture</title>');
  if (url.pathname === '/sw.js') { res.setHeader('Content-Type', 'text/javascript'); return void res.end(sw); }
  if (url.pathname.startsWith('/assets/weapons/unique-v1/')) {
    assetRequests++;
    if (serverMode === 'error') return void res.writeHead(503).end('offline');
    if (serverMode === 'html') { res.setHeader('Content-Type', 'text/html'); return void res.end(html); }
    if (serverMode === 'binary-html') { res.setHeader('Content-Type', 'application/octet-stream'); return void res.end(html); }
    // octet-stream is a valid hosting configuration and must not be rejected.
    res.setHeader('Content-Type', 'application/octet-stream');
    if (req.headers.range === 'bytes=0-3') {
      res.writeHead(206, {'Content-Range': `bytes 0-3/${glb.length}`});
      return void res.end(glb.subarray(0, 4));
    }
    return void res.end(glb);
  }
  res.writeHead(404).end();
});

let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ channel: 'chrome' });
  async function setup() {
    const context = await browser.newContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    return { context, page, errors };
  }
  const first = await setup(), filename = '/assets/weapons/unique-v1/medic_0.glb';
  async function read(page, url, headers) {
    return page.evaluate(async ({ url, headers }) => {
      try {
        const response = await fetch(url, { headers });
        const bytes = await response.arrayBuffer();
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
        return { ok: response.ok, status: response.status, size: bytes.byteLength, digest };
      } catch (e) { return { ok: false, error: String(e) }; }
    }, { url, headers });
  }
  async function cached(page, cacheName, url) {
    return page.evaluate(async ({cacheName, url}) => {
      const r = await (await caches.open(cacheName)).match(url);
      if (!r) return null;
      const b = await r.arrayBuffer();
      return { size: b.byteLength, digest: [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join('') };
    }, {cacheName, url});
  }
  async function seed(page, cacheName, url, value) {
    await page.evaluate(async ({cacheName, url, value}) => {
      const cache = await caches.open(cacheName);
      const bytes = value === 'html' ? new TextEncoder().encode('<!doctype html><title>SPA fallback</title>') : Uint8Array.from(atob(value), c => c.charCodeAt(0));
      await cache.put(url, new Response(bytes, {status: 200, headers: {'content-type': value === 'html' ? 'text/html' : 'application/octet-stream'}}));
    }, {cacheName, url, value});
  }
  const baseline = process.argv.includes('--baseline');
  if (baseline) {
    const url = filename + '?case=baseline';
    const before = await read(first.page, url);
    assert.equal(before.digest, hash(Buffer.from(html)));
    serverMode = 'glb';
    const after = await read(first.page, url);
    assert.equal(after.digest, before.digest);
    assert.equal((await cached(first.page, 'swarm-front-shell-v1', url)).digest, before.digest);
    const report = { mode: 'before', scenario: 'HTML 200 cached then server corrected', before, after, assetRequests, errors: first.errors };
    await fs.mkdir('dist-validation', {recursive: true});
    await fs.writeFile('dist-validation/weapon-glb-cache-before.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } else {
    const report = { mode: 'after' };
    const url = filename + '?case=network-html';
    console.error('checking network fallback');
    report.html = await read(first.page, url);
    assert.notEqual(report.html.digest, hash(Buffer.from(html)));
    assert.equal(await cached(first.page, 'swarm-front-shell-v1', url), null);
    serverMode = 'binary-html';
    report.htmlWithBinaryMime = await read(first.page, filename + '?case=binary-html');
    assert.notEqual(report.htmlWithBinaryMime.digest, hash(Buffer.from(html)));
    assert.equal(await cached(first.page, 'swarm-front-shell-v1', filename + '?case=binary-html'), null);
    serverMode = 'glb';
    report.afterFixed = await read(first.page, url);
    assert.equal(report.afterFixed.digest, hash(glb));
    report.networkRange = await read(first.page, filename + '?case=network-range', {Range: 'bytes=0-3'});
    assert.equal(report.networkRange.status, 206); assert.equal(report.networkRange.digest, hash(glb.subarray(0,4)));
    assert.equal(await cached(first.page, 'swarm-front-shell-v1', filename + '?case=network-range'), null);
    const secondUrl = filename + '?case=preload-html';
    console.error('checking cached and offline paths');
    await seed(first.page, 'swarm-front-preload-v1', secondUrl, 'html');
    await seed(first.page, 'swarm-front-shell-v1', secondUrl, glb64);
    await first.context.setOffline(true);
    report.validShellOffline = await read(first.page, secondUrl);
    assert.equal(report.validShellOffline.digest, hash(glb));
    report.preloadRepaired = await cached(first.page, 'swarm-front-preload-v1', secondUrl);
    assert.equal(report.preloadRepaired.digest, hash(glb));
    const thirdUrl = filename + '?case=preload-valid';
    await seed(first.page, 'swarm-front-preload-v1', thirdUrl, glb64);
    await seed(first.page, 'swarm-front-shell-v1', thirdUrl, 'html');
    report.validPreloadOffline = await read(first.page, thirdUrl);
    assert.equal(report.validPreloadOffline.digest, hash(glb));
    report.range = await read(first.page, thirdUrl, {Range: 'bytes=0-3'});
    assert.equal(report.range.status, 206); assert.equal(report.range.digest, hash(glb.subarray(0,4)));
    const originalUrl = '/assets/weapons/realism-v2/rifle_0.glb?case=original';
    await seed(first.page, 'swarm-front-preload-v1', originalUrl, original64);
    report.originalOffline = await read(first.page, originalUrl);
    assert.equal(report.originalOffline.digest, hash(original));
    const fourthUrl = filename + '?case=both-html-offline';
    await seed(first.page, 'swarm-front-preload-v1', fourthUrl, 'html');
    await seed(first.page, 'swarm-front-shell-v1', fourthUrl, 'html');
    report.invalidOffline = await read(first.page, fourthUrl);
    assert.notEqual(report.invalidOffline.digest, hash(Buffer.from(html)));
    await first.context.setOffline(false);
    report.recovered = await read(first.page, fourthUrl);
    assert.equal(report.recovered.digest, hash(glb));
    report.recoveredPreload = await cached(first.page, 'swarm-front-preload-v1', fourthUrl);
    assert.equal(report.recoveredPreload.digest, hash(glb));
    await first.context.setOffline(true);
    report.recoveredOffline = await read(first.page, fourthUrl);
    assert.equal(report.recoveredOffline.digest, hash(glb));
    await first.context.setOffline(false);
    serverMode = 'error';
    report.network503 = await read(first.page, filename + '?case=503');
    assert.equal(report.network503.status, 503);
    assert.equal(await cached(first.page, 'swarm-front-shell-v1', filename + '?case=503'), null);
    console.error('checking simulated storage failure in Node');
    const listeners = {}, mockRequest = new Request('https://fixture.invalid' + filename);
    let offline = false;
    const invalid = new Response(html, {status: 200, headers: {'content-type': 'text/html'}});
    const storage = {
      async open(name) {
        return {
          async match() { return name === 'swarm-front-preload-v1' ? invalid.clone() : undefined; },
          async put() { throw new Error('simulated quota'); },
        };
      },
    };
    const worker = {
      registration: {scope: 'https://fixture.invalid/'},
      addEventListener(type, callback) { listeners[type] = callback; },
    };
    const network = async () => {
      if (offline) throw new Error('simulated offline');
      return new Response(glb, {status: 200, headers: {'content-type': 'application/octet-stream'}});
    };
    vm.runInNewContext(sw, {self: worker, caches: storage, fetch: network, URL, Response, DataView});
    const dispatch = () => {
      let result;
      listeners.fetch({request: mockRequest, respondWith(value) { result = value; }});
      return result;
    };
    const quotaResponse = await dispatch();
    report.quotaOnline = {status: quotaResponse.status, digest: hash(Buffer.from(await quotaResponse.arrayBuffer()))};
    assert.equal(report.quotaOnline.digest, hash(glb));
    offline = true;
    try { await dispatch(); report.quotaOffline = {failed: false}; }
    catch { report.quotaOffline = {failed: true}; }
    assert.equal(report.quotaOffline.failed, true);
    report.errors = first.errors;
    assert.deepEqual(report.errors, []);
    await fs.mkdir('dist-validation', {recursive: true});
    await fs.writeFile('dist-validation/weapon-glb-cache-after.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
