import { parseLayout, LABELS, type Layout, type ControlId } from "../layout";
import {
  controlArea,
  defaultMockLayout,
  resolveMockLayout,
  layoutProblem,
  type LayoutMode,
  type ViewportSnapshot,
} from "./geometry";
import type { MockStore } from "./storage";
import type { MockViewport } from "./viewport";

export class MockLayouts {
  drafts = new Map<LayoutMode, Layout>();
  constructor(private store: MockStore) {}
  saved(v: ViewportSnapshot): Layout {
    try {
      return parseLayout(
        JSON.stringify(
          this.store.read(`layout-${v.mode}`, defaultMockLayout(v)),
        ),
      );
    } catch {
      return defaultMockLayout(v);
    }
  }
  draft(v: ViewportSnapshot) {
    if (!this.drafts.has(v.mode)) this.drafts.set(v.mode, this.saved(v));
    return this.drafts.get(v.mode)!;
  }
  effective(v: ViewportSnapshot, draft = false) {
    let layout = draft ? this.draft(v) : this.saved(v);
    const problem = layoutProblem(resolveMockLayout(layout, v), v);
    if (problem) layout = defaultMockLayout(v);
    return { layout, fallback: !!problem };
  }
  save(v: ViewportSnapshot) {
    const layout = this.draft(v),
      problem = layoutProblem(resolveMockLayout(layout, v), v);
    if (problem) return problem;
    return this.store.write(`layout-${v.mode}`, layout)
      ? ""
      : "保存できませんでした。編集内容はこの画面に保持しています。";
  }
  place(v: ViewportSnapshot, draft = false) {
    const result = this.effective(v, draft);
    for (const r of resolveMockLayout(result.layout, v)) {
      const el = document.getElementById(r.id)!;
      Object.assign(el.style, {
        left: `${r.left}px`,
        top: `${r.top}px`,
        right: "auto",
        bottom: "auto",
        width: `${r.size}px`,
        height: `${r.size}px`,
        opacity: String(
          result.layout.buttons[r.id].opacity ?? result.layout.opacity,
        ),
      });
    }
    document.getElementById("scope2")!.hidden = !result.layout.secondScope;
    return result;
  }
}

export function mountLayoutEditor(
  root: HTMLElement,
  viewport: MockViewport,
  layouts: MockLayouts,
  actions: { back: () => void; test: () => void },
) {
  root.innerHTML = `<section class="mock-layout-editor"><header class="mock-editor-panel"><b id="layout-mode"></b><p>ボタンをドラッグ。回転すると、もう片方の編集中の配置へ切り替わります。</p><div class="mock-toolbar"><button id="layout-back">戻る</button><button id="layout-save">この向きを保存</button><button id="layout-test">試し撃ち</button><button id="layout-default">この向きを標準に</button></div><div class="mock-toolbar"><label>選択ボタン <select id="layout-select"></select></label><label>大きさ <input id="layout-size" type="range" min="0.7" max="1.4" step="0.05"></label><label>濃さ <input id="layout-opacity" type="range" min="0.4" max="1" step="0.05"></label><label><input id="layout-scope2" type="checkbox">スコープ2</label></div><p id="layout-status" role="status"></p></header><div id="layout-ghosts"></div><span class="mock-reticle">＋</span></section>`;
  const get = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const ghosts = get("layout-ghosts"),
    status = get("layout-status"),
    select = get("layout-select") as HTMLSelectElement;
  select.innerHTML = Object.entries(LABELS)
    .map(([id, label]) => `<option value="${id}">${label}</option>`)
    .join("");
  let selected: ControlId = "move",
    drag:
      { id: ControlId; pointer: number; dx: number; dy: number } | undefined;
  const updateInputs = () => {
    const l = layouts.draft(viewport.snapshot);
    select.value = selected;
    (get("layout-size") as HTMLInputElement).value = String(
      l.buttons[selected].size,
    );
    (get("layout-opacity") as HTMLInputElement).value = String(
      l.buttons[selected].opacity ?? l.opacity,
    );
    (get("layout-scope2") as HTMLInputElement).checked = l.secondScope;
  };
  const draw = () => {
    const v = viewport.snapshot,
      l = layouts.draft(v);
    get("layout-mode").textContent =
      `ボタン配置 · ${v.mode === "portrait" ? "縦" : "横"}画面`;
    const rects = resolveMockLayout(l, v);
    status.textContent =
      layoutProblem(rects, v) || "この向きの配置を保存できます。";
    (get("layout-save") as HTMLButtonElement).disabled = !!layoutProblem(
      rects,
      v,
    );
    (get("layout-test") as HTMLButtonElement).disabled = !!layoutProblem(
      rects,
      v,
    );
    ghosts.innerHTML = rects
      .map(
        (r) =>
          `<button data-control="${r.id}" aria-label="${LABELS[r.id]}の配置" class="mock-ghost ${r.id === selected ? "selected" : ""}" style="left:${r.left}px;top:${r.top}px;width:${r.size}px;height:${r.size}px;opacity:${l.buttons[r.id].opacity ?? l.opacity}">${LABELS[r.id]}</button>`,
      )
      .join("");
  };
  ghosts.onpointerdown = (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-control]",
    );
    if (!button) return;
    e.preventDefault();
    selected = button.dataset.control as ControlId;
    const r = button.getBoundingClientRect();
    drag = {
      id: selected,
      pointer: e.pointerId,
      dx: e.clientX - r.left - r.width / 2,
      dy: e.clientY - r.top - r.height / 2,
    };
    ghosts.setPointerCapture(e.pointerId);
    updateInputs();
  };
  ghosts.onpointermove = (e) => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const v = viewport.snapshot,
      a = controlArea(drag.id, v),
      p = layouts.draft(v).buttons[drag.id];
    p.x = Math.max(0, Math.min(1, (e.clientX - drag.dx - a.left) / a.width));
    p.y = Math.max(0, Math.min(1, (e.clientY - drag.dy - a.top) / a.height));
    draw();
  };
  const cancelDrag = () => {
    if (drag && ghosts.hasPointerCapture(drag.pointer))
      ghosts.releasePointerCapture(drag.pointer);
    drag = undefined;
  };
  ghosts.onpointerup = ghosts.onpointercancel = cancelDrag;
  select.onchange = () => {
    selected = select.value as ControlId;
    updateInputs();
    draw();
  };
  get("layout-size").oninput = (e) => {
    layouts.draft(viewport.snapshot).buttons[selected].size = Number(
      (e.target as HTMLInputElement).value,
    );
    draw();
  };
  get("layout-opacity").oninput = (e) => {
    layouts.draft(viewport.snapshot).buttons[selected].opacity = Number(
      (e.target as HTMLInputElement).value,
    );
    draw();
  };
  get("layout-scope2").onchange = (e) => {
    layouts.draft(viewport.snapshot).secondScope = (
      e.target as HTMLInputElement
    ).checked;
    draw();
  };
  get("layout-default").onclick = () => {
    layouts.drafts.set(
      viewport.snapshot.mode,
      defaultMockLayout(viewport.snapshot),
    );
    updateInputs();
    draw();
  };
  get("layout-save").onclick = () => {
    status.textContent =
      layouts.save(viewport.snapshot) ||
      "この向きの配置を保存しました。もう片方の保存内容はそのままです。";
  };
  get("layout-test").onclick = actions.test;
  get("layout-back").onclick = () => {
    const dirty = [...layouts.drafts].some(
      ([mode, l]) =>
        JSON.stringify(l) !==
        JSON.stringify(layouts.saved({ ...viewport.snapshot, mode })),
    );
    if (!dirty) {
      actions.back();
      return;
    }
    const dialog = document.createElement("dialog");
    dialog.className = "mock-dialog";
    dialog.innerHTML =
      "<h2>保存せず戻りますか？</h2><p>縦・横の編集途中の配置を破棄します。</p><button data-keep>編集を続ける</button><button data-discard>破棄して戻る</button>";
    root.append(dialog);
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-keep]")!.onclick = () =>
      dialog.remove();
    dialog.querySelector<HTMLElement>("[data-discard]")!.onclick = () => {
      layouts.drafts.clear();
      dialog.remove();
      actions.back();
    };
    dialog.addEventListener("cancel", () => dialog.remove());
  };
  const unsubscribe = viewport.subscribe(() => {
    cancelDrag();
    updateInputs();
    draw();
  });
  updateInputs();
  draw();
  return () => {
    cancelDrag();
    unsubscribe();
  };
}
