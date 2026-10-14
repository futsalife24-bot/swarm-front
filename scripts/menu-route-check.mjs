import { stripTypeScriptTypes } from "node:module";
import fs from "node:fs";
import assert from "node:assert/strict";

// Unit checks use DOM/event/storage substitutes, not a browser rendering check.
const guardSource = fs.readFileSync("src/client/menu-transition-input.ts", "utf8");
const guardUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(guardSource)).toString("base64")}`;
const source = fs.readFileSync("src/client/menu-route.ts", "utf8")
  .replace('"./menu-transition-input"', JSON.stringify(guardUrl));
const encoded = Buffer.from(stripTypeScriptTypes(source)).toString("base64");
const load = (name) => import(`data:text/javascript;base64,${encoded}#${name}`);
const route = await load("no-dom");
route.navigateMenu("/no-dom");
globalThis.window = {};
globalThis.location = {
  href: "https://example.test/front",
  origin: "https://example.test",
};
const stored = new Map();
globalThis.sessionStorage = {
  removeItem: (key) => stored.delete(key),
  setItem: (key, value) => stored.set(key, value),
};
route.navigateMenu("/?solo=1");
assert.equal(location.href, "/?solo=1");
const ticket = JSON.parse([...stored.values()][0]);
assert.equal(ticket.href, "https://example.test/?solo=1");
assert(ticket.expires > Date.now() && ticket.expires <= Date.now() + 8000);
location.href = "https://example.test/front";
route.navigateMenu("https://other.test/?coop=1");
assert.equal(location.href, "https://other.test/?coop=1");
assert.equal(stored.size, 0);
globalThis.sessionStorage = {
  removeItem() { throw Error("blocked"); },
};
route.navigateMenu("/front?solo=1");
assert.equal(location.href, "/front?solo=1");
console.log("合格: DOMなし・同一origin・クロスorigin・保存拒否時の遷移");

location.href = "https://example.test/front?solo=1";
let mediaCalls = 0;
globalThis.matchMedia = () => { mediaCalls++; return { matches: true }; };
globalThis.document = { hidden: false, documentElement: { dataset: {} } };
globalThis.localStorage = { getItem: () => null };
for (const [name, value, type, expected] of [
  ["no-ticket", null, "navigate", 0],
  ["expired", { href: location.href, expires: Date.now() - 1 }, "navigate", 0],
  ["mismatch", { href: "https://example.test/other", expires: Date.now() + 8000 }, "navigate", 0],
  ["reload", { href: location.href, expires: Date.now() + 8000 }, "reload", 0],
  ["reduced", { href: location.href, expires: Date.now() + 8000 }, "navigate", 1],
]) {
  let serialized = value ? JSON.stringify(value) : null;
  mediaCalls = 0;
  globalThis.sessionStorage = {
    getItem: () => serialized,
    removeItem: () => { serialized = null; },
  };
  globalThis.performance = { getEntriesByType: () => [{ type }] };
  await load(name);
  assert.equal(serialized, null);
  assert.equal(mediaCalls, expected);
}
console.log("合格: 初回・期限切れ・URL不一致・リロード・軽減設定・一回消費");

for (const mode of ["resize", "fullscreenchange", "timeout"]) {
  let ready = false, observeCallback, removed = 0, cancelled = 0;
  const timers = new Map();
  let nextTimer = 0;
  globalThis.setTimeout = (fn, ms) => {
    timers.set(++nextTimer, { fn, ms });
    return nextTimer;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  Object.assign(document, {
    hidden: false,
    documentElement: { dataset: {} },
    querySelector: () => ready ? {} : null,
    body: { append() {} },
    createElement: () => ({
      style: {}, setAttribute() {}, append() {},
      remove() { removed++; },
      animate() { return { cancel() { cancelled++; } }; },
    }),
  });
  globalThis.sessionStorage = {
    getItem: () => JSON.stringify({ href: location.href, expires: Date.now() + 8000 }),
    removeItem() {},
  };
  globalThis.performance = { getEntriesByType: () => [{ type: "navigate" }] };
  const preference = new EventTarget();
  preference.matches = false;
  globalThis.matchMedia = () => preference;
  globalThis.MutationObserver = class {
    constructor(fn) { observeCallback = fn; }
    observe() {}
    disconnect() {}
  };
  await load(mode);
  const fire = (type, fields = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, fields);
    document.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(fire("click"), false, "表示待ちは入力を許可");
  ready = true;
  observeCallback();
  for (const type of ["pointerdown", "click", "keydown"])
    assert.equal(fire(type), true, `表示中は${type}を遮断`);
  fire("pointerdown", { pointerId: 77 });
  fire("keydown", { code: "Enter", repeat: false });
  if (mode === "resize") window.dispatchEvent(new Event(mode));
  else if (mode === "fullscreenchange") document.dispatchEvent(new Event(mode));
  else [...timers.values()].find((timer) => timer.ms === 550).fn();
  assert.equal(fire("pointerup", { pointerId: 77 }), true, `${mode}後の長押し解放を遮断`);
  assert.equal(fire("click", { pointerId: 77, detail: 1 }), true, `${mode}後の長押しクリックを遮断`);
  assert.equal(fire("keydown", { code: "Enter", repeat: true }), true, `${mode}後のキーリピートを遮断`);
  assert.equal(fire("keyup", { code: "Enter" }), true, `${mode}後のキー解放を遮断`);
  assert.equal(fire("click", { detail: 0 }), true, `${mode}後のキー由来クリックを遮断`);
  fire("keydown", { code: "Enter", repeat: false });
  for (const type of ["pointerdown", "click", "keydown"])
    assert.equal(fire(type), false, `解除後は${type}を許可`);
  assert.equal(removed, 1);
  assert.equal(cancelled, 6);
}
console.log("合格: 待機中の入力・表示中の入力遮断・resize/fullscreen/550ms後の入力復帰と装飾解除");
