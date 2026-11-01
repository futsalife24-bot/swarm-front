import { afterEach, expect, it, vi } from "vitest";
import {
  diagnosticReport,
  networkDiagnosticsEnabled,
  setNetworkDiagnostics,
} from "../src/client/diagnostic-export";
afterEach(() => vi.unstubAllGlobals());
it("診断設定を保存し、URLで有効化した場合もオフにできる", () => {
  const saved = new Map<string, string>();
  const location = {
    href: "https://game.invalid/front?networkDiagnostics=1&other=keep",
    search: "?networkDiagnostics=1&other=keep",
  };
  vi.stubGlobal("location", location);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => saved.set(k, v),
  });
  vi.stubGlobal("history", {
    state: null,
    replaceState: (_s: unknown, _t: string, url: URL) => {
      location.href = url.href;
      location.search = url.search;
    },
  });
  expect(networkDiagnosticsEnabled()).toBe(true);
  setNetworkDiagnostics(false);
  expect(networkDiagnosticsEnabled()).toBe(false);
  expect(location.search).toBe("?other=keep");
  setNetworkDiagnostics(true);
  expect(networkDiagnosticsEnabled()).toBe(true);
});
it("保存する端末条件にURLや保存本文を取得しない", () => {
  vi.stubGlobal("navigator", { userAgent: "test-device" });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("innerWidth", 844);
  vi.stubGlobal("innerHeight", 390);
  vi.stubGlobal("devicePixelRatio", 2);
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("must not read storage");
    },
  });
  const report = diagnosticReport({
    timeline: [{ at: 1, kind: "state", value: 2 }],
  });
  expect(report.environment).toEqual({
    userAgent: "test-device",
    standalone: true,
    viewport: [844, 390, 2],
  });
  expect(Object.keys(report)).toEqual([
    "format",
    "build",
    "capturedAt",
    "environment",
    "observations",
  ]);
});
