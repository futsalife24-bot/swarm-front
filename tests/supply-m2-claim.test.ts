import { describe, expect, it, vi } from "vitest";
import {
  HIYORI_RELEASE,
  emptySupplyBox,
  grantOnce,
  saveSupplyBox,
} from "../src/client/supply-box";
import { openSupplyBox } from "../src/client/supply-box-ui";

vi.mock("../src/client/menu-effects", () => ({ menuReward: () => {} }));

const NOON = Date.UTC(2026, 10, 14, 3);
const store = (initial: Record<string, string> = {}) => {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => m.get(key) ?? null,
    setItem: (key: string, value: string) => void m.set(key, value),
  };
};

const element = (): any => ({
  className: "",
  type: "",
  textContent: "",
  innerHTML: "",
  hidden: false,
  disabled: false,
  dataset: {} as Record<string, string>,
  onclick: undefined as (() => void) | undefined,
  classList: { add: () => {} },
  before: () => {},
  append: () => {},
  remove: () => {},
});

describe("C-6 M2: supply box first claim", () => {
  it("reports received items through the shortcut callback", () => {
    const s = store();
    saveSupplyBox(grantOnce(emptySupplyBox(), HIYORI_RELEASE, NOON), s);
    vi.stubGlobal("localStorage", s);
    vi.stubGlobal("document", { createElement: element });
    try {
      const list = element();
      const status = element();
      const voice = element();
      const close = element();
      const claim = element();
      claim.dataset.sbId = HIYORI_RELEASE.id;
      list.querySelectorAll = () => [claim];
      const dialog = element();
      dialog.querySelector = (selector: string) =>
        ({
          ".sb-list": list,
          ".sb-status": status,
          ".sb-voice-shortcut": voice,
          ".dialog-close": close,
        })[selector] ?? null;
      const onClaimed = vi.fn();
      const openControlVoice = vi.fn();
      let changed = 0;
      openSupplyBox(
        () => dialog as unknown as HTMLDialogElement,
        { store: s },
        () => void changed++,
        { onClaimed, openControlVoice },
      );
      claim.onclick?.();
      expect(onClaimed).toHaveBeenCalledTimes(1);
      expect(onClaimed.mock.calls[0][0]).toEqual([
        expect.objectContaining({ id: HIYORI_RELEASE.id }),
      ]);
      expect(changed).toBe(1);
      expect(voice.hidden).toBe(false);
      voice.onclick?.();
      expect(openControlVoice).toHaveBeenCalledWith(dialog);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
