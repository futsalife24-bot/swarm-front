import { test as base, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

// Audit every scenario, including battle and layout trials. A blocked attempt
// is still a failure even when application code catches the rejection.
export const test = base.extend<{ isolationAudit: void }>({
  isolationAudit: [
    async ({ page }, use, info) => {
      const forbidden: string[] = [],
        errors: string[] = [],
        failed: string[] = [],
        sockets: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
      });
      page.on("websocket", (s) => sockets.push(s.url()));
      await page.addInitScript(() => {
        const get = Storage.prototype.getItem;
        localStorage.setItem("swarm-front-save-v1", "production-sentinel");
        sessionStorage.setItem("production-sentinel", "keep");
        (window as any).__readSentinels = () => [
          get.call(localStorage, "swarm-front-save-v1"),
          get.call(sessionStorage, "production-sentinel"),
        ];
        const calls: { op: string; key: string }[] = [];
        (window as any).__storageCalls = calls;
        for (const name of ["getItem", "setItem", "removeItem"] as const) {
          const original = Storage.prototype[name];
          (Storage.prototype as any)[name] = function (
            key: string,
            ...args: unknown[]
          ) {
            calls.push({ op: name, key });
            return (original as any).call(this, key, ...args);
          };
        }
        const clear = Storage.prototype.clear;
        Storage.prototype.clear = function () {
          calls.push({ op: "clear", key: "*" });
          return clear.call(this);
        };
        (window as any).__swAttempts = 0;
        if (navigator.serviceWorker)
          navigator.serviceWorker.register = (() => {
            (window as any).__swAttempts++;
            return Promise.reject(Error("Mock must not register SW"));
          }) as any;
        (window as any).__socketAttempts = 0;
        window.WebSocket = new Proxy(window.WebSocket, {
          construct() {
            (window as any).__socketAttempts++;
            throw Error("Mock must not open WebSocket");
          },
        });
      });
      await page.route("**/*", (route) => {
        const r = route.request(),
          url = new URL(r.url());
        if (
          url.origin === "http://127.0.0.1:5197" &&
          ["GET", "HEAD"].includes(r.method()) &&
          !/^\/api(?:\/|$)/.test(url.pathname)
        )
          return route.continue();
        forbidden.push(`${r.method()} ${r.url()}`);
        return route.abort();
      });
      mkdirSync("dist-validation/orientation-mock", { recursive: true });
      await use();
      const storage = await page.evaluate(async () => ({
        calls: (window as any).__storageCalls ?? [],
        sentinels: (window as any).__readSentinels?.(),
        sw: (window as any).__swAttempts,
        socketAttempts: (window as any).__socketAttempts,
        registrations:
          (await navigator.serviceWorker?.getRegistrations())?.length ?? 0,
        cacheKeys: await caches.keys(),
      }));
      writeFileSync(
        `dist-validation/orientation-mock/isolation-${info.testId.replace(/[^a-zA-Z0-9-]/g, "_")}.json`,
        JSON.stringify(
          { title: info.title, forbidden, errors, failed, sockets, storage },
          null,
          2,
        ),
      );
      expect(forbidden).toEqual([]);
      expect(sockets).toEqual([]);
      expect(storage.socketAttempts).toBe(0);
      expect(storage.sw).toBe(0);
      expect(storage.registrations).toBe(0);
      expect(storage.cacheKeys).toEqual([]);
      expect(storage.sentinels).toEqual(["production-sentinel", "keep"]);
      expect(
        storage.calls.filter(
          (x: any) => !x.key.startsWith("swarm-front-orientation-mock-v1:"),
        ),
      ).toEqual([]);
      expect(errors).toEqual([]);
      expect(failed).toEqual([]);
    },
    { auto: true },
  ],
});
