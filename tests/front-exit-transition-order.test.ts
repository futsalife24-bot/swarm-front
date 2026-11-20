import { beforeEach, afterEach, expect, it, vi } from "vitest";

const ui = vi.hoisted(() => {
  const form = {
    onsubmit: undefined as undefined | ((event: Event) => Promise<void>),
  };
  const input = { value: "test-only" };
  const button = { disabled: false };
  const note = { textContent: "" };
  const dialog = {
    id: "",
    isConnected: true,
    addEventListener: vi.fn(),
    querySelector: (selector: string) =>
      selector === "form"
        ? form
        : selector.includes("password")
          ? input
          : selector.includes("submit")
            ? button
            : note,
  };
  return { form, input, button, note, dialog, menu: vi.fn(() => dialog) };
});
vi.mock("../src/client/menu-ui", () => ({ menuDialog: ui.menu }));

let target: EventTarget & { confirm: ReturnType<typeof vi.fn> };
let values: Map<string, string>;
let nativeRequests: number;
let locationMock: {
  href: string;
  search: string;
  reload: ReturnType<typeof vi.fn>;
  assign: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
};
let guard: typeof import("../src/client/exit-confirmation");
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  values = new Map();
  nativeRequests = 0;
  target = Object.assign(new EventTarget(), { confirm: vi.fn(() => false) });
  const depart = () => {
    const event = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(event);
    if (event.defaultPrevented) nativeRequests++;
  };
  locationMock = {
    href: "https://game.example/?developer=1",
    search: "?developer=1",
    reload: vi.fn(depart),
    assign: vi.fn(depart),
    replace: vi.fn(depart),
  };
  vi.stubGlobal("window", target);
  vi.stubGlobal("location", locationMock);
  vi.stubGlobal("document", { querySelector: () => null });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  guard = await import("../src/client/exit-confirmation");
  guard.installExitConfirmation();
});
afterEach(() => vi.unstubAllGlobals());

it("P2-01: 再試行取消→ホーム→後の更新でも予約を持ち越さない", () => {
  guard.retryGameDocument("retry", { mode: "normal", stage: 2 });
  expect(values.has("retry")).toBe(false);
  expect(locationMock.reload).not.toHaveBeenCalled();
  locationMock.reload();
  expect(nativeRequests).toBe(1);
  expect(values.has("retry")).toBe(false);
});
it("P2-01: 承認後だけ予約しreload、次のユーザー更新は保護する", () => {
  target.confirm.mockReturnValue(true);
  guard.retryGameDocument("retry", { stage: 2 });
  expect(JSON.parse(values.get("retry")!)).toEqual({ stage: 2 });
  expect(locationMock.reload).toHaveBeenCalledOnce();
  expect(nativeRequests).toBe(0);
  locationMock.reload();
  expect(nativeRequests).toBe(1);
});
it("P2-02: login成功後は保存とassignを完遂し二重取消を設けない", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ authenticated: true }),
    })),
  );
  const access = await import("../src/client/developer-access");
  access.openDeveloperLogin("playtest");
  await ui.form.onsubmit!(new Event("submit"));
  expect(values.get("swarm-front-developer-return")).toBe("playtest");
  expect(locationMock.assign).toHaveBeenCalledWith("/?developer=1");
  expect(nativeRequests).toBe(0);
  expect(target.confirm).not.toHaveBeenCalled();
});
it("P2-02: logout成功後は認証・記録・replaceを一致させる", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ authenticated: true }),
    })),
  );
  const access = await import("../src/client/developer-access");
  await access.checkDeveloperSession();
  values.set("swarm-front-developer-return", "playtest");
  values.set("swarm-front-developer-retry", "pending");
  await access.exitDeveloperMode();
  expect(access.developerAuthorized).toBe(false);
  expect(values.has("swarm-front-developer-retry")).toBe(false);
  expect(values.has("swarm-front-developer-return")).toBe(false);
  expect(values.get("swarm-front-playtest-mode")).toBe("normal");
  expect(locationMock.replace).toHaveBeenCalledWith("/");
  expect(nativeRequests).toBe(0);
});
it("P2-02: logout失敗なら認証・記録・画面を変更しない", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ authenticated: true }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  const access = await import("../src/client/developer-access");
  await access.checkDeveloperSession();
  values.set("swarm-front-developer-return", "playtest");
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({ authenticated: true }),
  });
  await access.exitDeveloperMode();
  expect(access.developerAuthorized).toBe(true);
  expect(values.get("swarm-front-developer-return")).toBe("playtest");
  expect(locationMock.replace).not.toHaveBeenCalled();
  expect(nativeRequests).toBe(0);
});
