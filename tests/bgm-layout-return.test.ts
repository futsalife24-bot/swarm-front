import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Execute the actual pause/layout-return callback, so a transient battleUI()
// call cannot be hidden by restoring only the final screen afterwards.
const source = readFileSync(
  process.env.BGM_LAYOUT_SOURCE ?? "src/client/playtest-app.ts",
  "utf8",
);
const start = source.indexOf("function battleUI(");
const end = source.indexOf("function defeatChoice(", start);
if (start < 0 || end < 0) throw new Error("Solo screen functions not found");
const actualFunctions = stripTypeScriptTypes(source.slice(start, end));

describe("solo layout return screen routing", () => {
  it.each(["battle", "collection"])(
    "restores %s without briefly routing through a different music screen",
    (original) => {
      const routed: string[] = [];
      const nodes = [{ id: "collection-result-button" }];
      const fade = { id: "collection-fade" };
      const buttons = new Map<string, { onclick?: () => void }>();
      const element = { hidden: true };
      const ui = {
        hidden: false,
        childNodes: nodes,
        classList: { add() {} },
        replaceChildren(...next: unknown[]) {
          this.childNodes = next as typeof nodes;
        },
      };
      let returnFromLayout: () => void;
      let cueCancels = 0;
      const context = createContext({
        screen: original,
        paused: false,
        // pause() は作戦表示を止め、進撃ソロ以外では共通の一時停止ボタンを出す。
        world: undefined,
        cancelOperationCue() {
          cueCancels++;
        },
        ui,
        hud: element,
        controls: { enabled: false, reset() {} },
        view: {},
        checkpointNow() {},
        preferences: {
          mount(_dialog: unknown, editLayout: () => void) {
            buttons.set("#pt-layout", { onclick: editLayout });
          },
        },
        $: () => element,
        document: {
          querySelector: () => fade,
          body: { dataset: {}, append() {} },
        },
        dialog: () => ({
          querySelector(selector: string) {
            const button = {};
            buttons.set(selector, button);
            return button;
          },
          close() {},
          addEventListener() {},
        }),
        editControlLayout(callback: () => void) {
          context.screen = "layout";
          returnFromLayout = callback;
        },
        setScreen(next: string) {
          routed.push(next);
          context.screen = next;
        },
      });
      runInContext(actualFunctions + "\npause();", context);
      buttons.get("#pt-pause-layout")!.onclick!();
      buttons.get("#pt-layout")!.onclick!();
      expect(context.screen).toBe("layout");
      returnFromLayout!();
      expect(routed).toEqual([original]);
      expect(context.screen).toBe(original);
      expect(context.paused).toBe(true);
      // 最初の停止と、配置画面から戻った後の再停止の2回。
      expect(cueCancels).toBe(2);
      if (original === "collection") {
        expect(ui.childNodes).toEqual(nodes);
        expect(ui.hidden).toBe(false);
      }
    },
  );
});
