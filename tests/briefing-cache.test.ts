import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

describe("presentation stays outside the game offline cache", () => {
  it.each(["https://game.example/", "https://game.example/swarm-front/"])(
    "preserves the game shell for scope %s",
    async (scope) => {
      const handlers = new Map<string, (event: any) => void>();
      const writes: string[] = [];
      const game = new Response("game shell");
      vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
        URL,
        Response,
        self: {
          registration: { scope },
          addEventListener: (name: string, handler: (event: any) => void) =>
            handlers.set(name, handler),
        },
        caches: {
          open: async () => ({
            put: async (key: URL) => writes.push(String(key)),
          }),
          match: async () => undefined,
        },
        fetch: async () => game.clone(),
      });
      const handle = handlers.get("fetch")!;
      for (const route of [
        "briefing",
        "briefing/",
        "briefing/index.html",
        "briefing/slides.html",
        "briefing/assets/update-concept.webp",
        "admin/",
        "api/health",
        "rebuild-p1a.html",
        "rebuild-p1a",
        "rebuild-p1a/",
      ]) {
        let intercepted = false;
        handle({
          request: {
            method: "GET",
            mode: "navigate",
            url: new URL(route, scope).href,
          },
          respondWith: () => {
            intercepted = true;
          },
        });
        expect(intercepted, route).toBe(false);
      }
      expect(writes).toEqual([]);
      let response: Promise<Response> | undefined;
      handle({
        request: { method: "GET", mode: "navigate", url: scope },
        respondWith: (result: Promise<Response>) => {
          response = result;
        },
      });
      expect(response).toBeDefined();
      expect(await (await response!).text()).toBe("game shell");
      // 2026-10-30のPWA事前保存以降、入口HTMLは通信優先で取得し、root/indexと
      // frontを別々の固定キーへ保存する（オフライン起動用）。
      expect(writes).toEqual([new URL("index.html", scope).href]);
      for (const route of ["front", "front/", "front.html"]) {
        writes.length = 0;
        let front: Promise<Response> | undefined;
        handle({
          request: {
            method: "GET",
            mode: "navigate",
            url: new URL(route, scope).href,
          },
          respondWith: (result: Promise<Response>) => {
            front = result;
          },
        });
        expect(front, route).toBeDefined();
        expect(await (await front!).text()).toBe("game shell");
        expect(writes, route).toEqual([new URL("front.html", scope).href]);
      }
    },
  );
});
