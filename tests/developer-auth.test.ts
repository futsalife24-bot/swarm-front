import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { developerAuth } from "../server/developer-auth";
import { adminManifest, adminPage } from "../server/admin-page";
const origin = "https://game.example";
const password = "test-only-random-developer-password";
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
function fixture() {
  const values = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => structuredClone(values.get(key)),
    put: async (key: string, value: unknown) => {
      values.set(key, structuredClone(value));
    },
  } as unknown as DurableObjectStorage;
  const request = (
    action: string,
    body?: unknown,
    cookie?: string,
    ip = "one",
    from = origin,
  ) =>
    new Request(origin + "/api/developer/" + action, {
      method: action === "session" ? "GET" : "POST",
      headers: {
        Origin: from,
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(action === "login" ? { body: JSON.stringify(body) } : {}),
    });
  return { storage, request, values };
}
afterEach(() => vi.useRealTimers());
describe("developer authentication", () => {
  it("defines a separate portrait PWA identity for the admin page", () => {
    const manifest = JSON.parse(adminManifest) as Record<string, unknown>;
    expect(manifest.id).toBe("/admin/");
    expect(manifest.start_url).toBe("/admin/");
    expect(manifest.scope).toBe("/admin/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("portrait");
    expect(adminPage).toContain('rel="manifest" href="/admin/manifest.webmanifest"');
    expect(readFileSync("public/sw.js", "utf8")).toContain(
      "!url.pathname.startsWith(adminUrl.pathname)",
    );
    const handlers = new Map<string, (event: any) => void>();
    vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
      URL,
      self: {
        registration: { scope: "https://swarm-front.example/" },
        addEventListener: (name: string, handler: (event: any) => void) =>
          handlers.set(name, handler),
      },
      caches: {},
      fetch: () => Promise.resolve(),
      Response: { error: () => ({}) },
    });
    const fetchHandler = handlers.get("fetch");
    expect(fetchHandler).toBeDefined();
    for (const path of ["/admin", "/admin/", "/admin/manifest.webmanifest"] ) {
      let intercepted = false;
      fetchHandler!({
        request: { method: "GET", url: "https://swarm-front.example" + path, mode: "navigate" },
        respondWith: () => { intercepted = true; },
      });
      expect(intercepted, path).toBe(false);
    }
  });

  it("requires configuration and denies URL-only access", async () => {
    const f = fixture();
    expect(
      (await developerAuth(f.request("login", { password }), f.storage)).status,
    ).toBe(503);
    expect(
      await (
        await developerAuth(
          f.request("session"),
          f.storage,
          await hash(password),
        )
      ).json(),
    ).toEqual({ authenticated: false });
  });
  it("issues an HttpOnly secure cookie, validates it and revokes it on logout", async () => {
    const f = fixture(),
      credential = await hash(password);
    const r = await developerAuth(
      f.request("login", { password }),
      f.storage,
      credential,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    const cookie = r.headers.get("Set-Cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(JSON.stringify([...f.values])).not.toContain(password);
    const pair = cookie.split(";")[0];
    expect(
      await (
        await developerAuth(
          f.request("session", undefined, pair),
          f.storage,
          credential,
        )
      ).json(),
    ).toEqual({ authenticated: true });
    expect(
      await (
        await developerAuth(
          f.request("session", undefined, "swarm_developer=" + "f".repeat(64)),
          f.storage,
          credential,
        )
      ).json(),
    ).toEqual({ authenticated: false });
    expect(
      (
        await developerAuth(
          f.request("logout", undefined, pair),
          f.storage,
          credential,
        )
      ).headers.get("Set-Cookie"),
    ).toContain("Max-Age=0");
    expect(
      await (
        await developerAuth(
          f.request("session", undefined, pair),
          f.storage,
          credential,
        )
      ).json(),
    ).toEqual({ authenticated: false });
  });
  it("rejects cross-origin writes, malformed bodies and oversized uploads", async () => {
    const f = fixture(),
      credential = await hash(password);
    expect(
      (
        await developerAuth(
          f.request(
            "login",
            { password },
            undefined,
            "one",
            "https://evil.example",
          ),
          f.storage,
          credential,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await developerAuth(
          f.request("login", { password: 42 }),
          f.storage,
          credential,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await developerAuth(
          f.request("login", { password: "a".repeat(2000) }),
          f.storage,
          credential,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await developerAuth(
          new Request(origin + "/api/developer/login"),
          f.storage,
          credential,
        )
      ).status,
    ).toBe(405);
  });
  it("limits failed attempts per client and releases the lock after 15 minutes", async () => {
    vi.useFakeTimers();
    const f = fixture(),
      credential = await hash(password);
    for (let i = 0; i < 5; i++)
      expect(
        (
          await developerAuth(
            f.request("login", { password: "wrong" }),
            f.storage,
            credential,
          )
        ).status,
      ).toBe(401);
    expect(
      (
        await developerAuth(
          f.request("login", { password }),
          f.storage,
          credential,
        )
      ).status,
    ).toBe(429);
    expect(
      (
        await developerAuth(
          f.request("login", { password }, undefined, "two"),
          f.storage,
          credential,
        )
      ).status,
    ).toBe(200);
    vi.setSystemTime(Date.now() + 15 * 60 * 1000);
    expect(
      (
        await developerAuth(
          f.request("login", { password }),
          f.storage,
          credential,
        )
      ).status,
    ).toBe(200);
  });
  it("expires sessions and invalidates them when the fixed password is rotated", async () => {
    vi.useFakeTimers();
    const f = fixture(),
      credential = await hash(password);
    const cookie = (
      await developerAuth(
        f.request("login", { password }),
        f.storage,
        credential,
      )
    ).headers
      .get("Set-Cookie")!
      .split(";")[0];
    expect(
      await (
        await developerAuth(
          f.request("session", undefined, cookie),
          f.storage,
          await hash("new-password"),
        )
      ).json(),
    ).toEqual({ authenticated: false });
    vi.setSystemTime(Date.now() + 8 * 60 * 60 * 1000);
    expect(
      await (
        await developerAuth(
          f.request("session", undefined, cookie),
          f.storage,
          credential,
        )
      ).json(),
    ).toEqual({ authenticated: false });
  });
});
