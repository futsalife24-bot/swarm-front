import { describe, it, expect, vi, afterEach } from "vitest";
import {
  defaultMockLayout,
  resolveMockLayout,
  layoutProblem,
  shortEdgeFov,
  type ViewportSnapshot,
} from "../src/client/orientation-mock/geometry";
import {
  createMockStore,
  MOCK_PREFIX,
} from "../src/client/orientation-mock/storage";
import { MockOrientation } from "../src/client/orientation-mock/orientation";
import { MockLayouts } from "../src/client/orientation-mock/layouts";

const view = (
  width: number,
  height: number,
  insets = { top: 0, right: 0, bottom: 0, left: 0 },
): ViewportSnapshot => ({
  width,
  height,
  insets,
  mode: width < height ? "portrait" : "landscape",
  screenAngle: 0,
  revision: 1,
});
describe("orientation mock geometry", () => {
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [412, 915],
    [640, 280],
    [844, 390],
    [915, 412],
    [768, 1024],
    [1024, 768],
  ]) {
    for (const safe of [false, true])
      it(`${w}×${h} safe=${safe}: controls remain usable`, () => {
        const v = view(
            w,
            h,
            safe ? { top: 28, right: 8, bottom: 24, left: 16 } : undefined,
          ),
          l = defaultMockLayout(v);
        l.secondScope = true;
        expect(layoutProblem(resolveMockLayout(l, v), v)).toBe("");
      });
  }
  it("preserves landscape and short-edge angle and scope ratio", () => {
    expect(shortEdgeFov(65, 2)).toBe(65);
    for (const aspect of [0.4, 0.5625, 0.75]) {
      const fov = shortEdgeFov(65, aspect),
        scoped = shortEdgeFov(20, aspect);
      expect(
        (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect) * 180) /
          Math.PI,
      ).toBeCloseTo(65);
      expect(
        Math.tan((fov * Math.PI) / 360) / Math.tan((scoped * Math.PI) / 360),
      ).toBeCloseTo(
        Math.tan((65 * Math.PI) / 360) / Math.tan((20 * Math.PI) / 360),
      );
    }
  });
});
describe("isolated storage", () => {
  it("never reads or writes a production key; failed writes preserve drafts", () => {
    const values = new Map([["swarm-front-save-v1", "sentinel"]]),
      reads: string[] = [];
    const store = createMockStore({
      getItem: (k) => {
        reads.push(k);
        return values.get(k) ?? null;
      },
      setItem: (k, v) => {
        values.set(k, v);
      },
    });
    store.write("settings", { test: true });
    expect(store.read("settings", {})).toEqual({ test: true });
    expect(reads.every((k) => k.startsWith(MOCK_PREFIX))).toBe(true);
    expect(values.get("swarm-front-save-v1")).toBe("sentinel");
    const layouts = new MockLayouts(store),
      portrait = view(390, 844),
      landscape = view(844, 390);
    const p = layouts.draft(portrait);
    p.opacity = 0.55;
    layouts.draft(landscape).opacity = 0.65;
    expect(layouts.draft(portrait).opacity).toBe(0.55);
    expect(layouts.save(portrait)).toBe("");
    expect(store.read("layout-landscape", null)).toBeNull();
    const broken = createMockStore({
      getItem: () => "invalid",
      setItem: () => {
        throw Error("quota");
      },
    });
    expect(broken.read("x", { fallback: true })).toEqual({ fallback: true });
    expect(broken.write("x", 1)).toBe(false);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function orientationEnvironment(lock?: (value: string) => Promise<void>) {
  const win = Object.assign(new EventTarget(), { top: null as unknown });
  win.top = win;
  vi.stubGlobal("window", win);
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { hidden: false, fullscreenElement: {} }),
  );
  vi.stubGlobal("screen", {
    orientation: { type: "portrait-primary", lock, unlock: vi.fn() },
  });
  return createMockStore({ getItem: () => null, setItem: () => {} });
}
describe("native orientation requests", () => {
  it("stores a preference when native locking is unavailable", () => {
    const controller = new MockOrientation(orientationEnvironment());
    controller.set("landscape");
    expect(controller.preference).toBe("landscape");
    expect(controller.status).toContain("端末の回転ロック");
  });
  it("a never-settling old request does not block the latest choice", async () => {
    vi.useFakeTimers();
    const values: string[] = [];
    let oldResolve: () => void = () => {};
    const lock = vi.fn((v: string) => {
      values.push(v);
      return v === "portrait-primary"
        ? new Promise<void>((resolve) => (oldResolve = resolve))
        : Promise.resolve();
    });
    const controller = new MockOrientation(orientationEnvironment(lock));
    controller.set("portrait");
    controller.set("landscape");
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.status).toContain("横向きに固定");
    oldResolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(values.at(-1)).toBe("landscape-primary");
    expect(controller.preference).toBe("landscape");
  });
  it("failure reports fallback without changing desired orientation", async () => {
    vi.useFakeTimers();
    const controller = new MockOrientation(
      orientationEnvironment(() => Promise.reject(new Error("unsupported"))),
    );
    controller.set("portrait");
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.status).toContain("現在の向きで遊べます");
    expect(controller.preference).toBe("portrait");
  });
});
