import { afterEach, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ clear: vi.fn(), reload: vi.fn() }));
vi.mock("../src/client/network", () => ({ clearNetworkSession: calls.clear }));
vi.mock("../src/client/exit-confirmation", () => ({
  reloadAuthorizedGameDocument: calls.reload,
}));
import { installInviteLaunch } from "../src/client/invite-launch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([false, true])(
  "招待確認=%s: 取消は接続・履歴を保持、承認は二重確認なし",
  (accepted) => {
    let consumer!: (params: { targetURL?: string }) => void;
    const dispatchEvent = vi.fn();
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      launchQueue: {
        setConsumer: (fn: typeof consumer) => {
          consumer = fn;
        },
      },
      confirm: vi.fn(() => accepted),
      dispatchEvent,
    });
    vi.stubGlobal("location", { href: "https://game.example/" });
    vi.stubGlobal("history", { replaceState });
    installInviteLaunch();
    consumer({ targetURL: `https://game.example/?coop=1#${"a".repeat(32)}` });
    expect(window.confirm).toHaveBeenCalledOnce();
    for (const effect of [
      dispatchEvent,
      calls.clear,
      replaceState,
      calls.reload,
    ]) {
      expect(effect).toHaveBeenCalledTimes(accepted ? 1 : 0);
    }
    if (accepted) {
      expect(calls.clear.mock.invocationCallOrder[0]).toBeLessThan(
        calls.reload.mock.invocationCallOrder[0],
      );
    }
  },
);
