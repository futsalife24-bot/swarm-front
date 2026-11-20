import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createExitConfirmation,
  isGameMenuDestination,
} from "../src/client/exit-confirmation";

describe("終了確認", () => {
  afterEach(() => vi.useRealTimers());
  function fixture() {
    vi.useFakeTimers();
    const target = new EventTarget();
    const guard = createExitConfirmation(target as Window);
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    return { target, guard, leave };
  }
  it("Back・更新・閉じるの再試行でも毎回確認し、履歴や状態を操作しない", () => {
    const { guard, leave } = fixture();
    for (let i = 0; i < 10; i++) expect(leave()).toBe(true);
    guard.dispose();
    expect(leave()).toBe(false);
  });
  it("明示的なゲーム内文書移動だけ一度許可する", () => {
    const { guard, leave } = fixture();
    guard.proceed(() => expect(leave()).toBe(false));
    expect(leave()).toBe(true);
    guard.dispose();
  });
  it("遷移しなかった場合の次タスクと例外後は保護を戻す", () => {
    const { guard, leave } = fixture();
    guard.proceed(() => {});
    vi.runAllTimers();
    expect(leave()).toBe(true);
    expect(() =>
      guard.proceed(() => {
        throw new Error("blocked");
      }),
    ).toThrow("blocked");
    expect(leave()).toBe(true);
    guard.dispose();
  });
  it("BFCache復帰で許可状態を保持しない", () => {
    const { target, guard, leave } = fixture();
    guard.proceed(() => {});
    target.dispatchEvent(new Event("pageshow"));
    expect(leave()).toBe(true);
    guard.dispose();
  });
  it.each([
    "/",
    "/?coop=1",
    "/?base=1",
    "/front?solo=1",
    "/front.html?cards=1",
    "/index.html",
  ])("ゲーム内入口 %s", (url) => {
    expect(
      isGameMenuDestination(url, "https://game.example/front?solo=1", "/"),
    ).toBe(true);
  });
  it.each([
    "https://other.example/",
    "//other.example/front",
    "/admin",
    "/front-evil",
    "javascript:alert(1)",
    "/briefing/",
  ])("任意の外部・別ページは許可しない %s", (url) => {
    expect(isGameMenuDestination(url, "https://game.example/", "/")).toBe(
      false,
    );
  });
  it("サブパス配信を尊重する", () => {
    expect(
      isGameMenuDestination(
        "/swarm-front/front?coop=1",
        "https://game.example/swarm-front/",
        "/swarm-front/",
      ),
    ).toBe(true);
    expect(
      isGameMenuDestination(
        "/front",
        "https://game.example/swarm-front/",
        "/swarm-front/",
      ),
    ).toBe(false);
  });
});
