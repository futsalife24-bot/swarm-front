import {
  arena,
  CONTROL_IDS,
  LABELS,
  defaultLayout,
  resolveLayout,
  overlaps,
  readInsets,
  type Layout,
  type ControlId,
} from "./layout";
export function openLayoutEditor(
  root: HTMLElement,
  current: Layout,
  onSave: (value: Layout) => void,
  onExit: () => void,
  training?: { config: () => unknown; enabled?: boolean },
) {
  let draft = structuredClone(current),
    selected: ControlId = "fire";
  root.innerHTML =
    '<section class="layout-editor"><header class="layout-toolbar"><div><b>操作ボタンの配置</b><small>ボタンをドラッグ · 上部は情報表示用</small></div><label>ボタン <select id="layout-selected">' +
    CONTROL_IDS.map(
      (id) => '<option value="' + id + '">' + LABELS[id] + "</option>",
    ).join("") +
    '</select></label><label>大きさ <input id="layout-size" type="range" min="0.7" max="1.4" step="0.05"></label><label>濃さ <input id="layout-opacity" type="range" min="0.4" max="1" step="0.05"></label><button id="layout-training">試し撃ち</button><button id="layout-reset">初期配置</button><button id="layout-cancel">キャンセル</button><button id="layout-save" class="primary">保存</button><p id="layout-message" role="status">配置はこの端末だけに保存されます</p></header><div class="layout-preview">' +
    CONTROL_IDS.map(
      (id) =>
        '<button data-layout-button="' +
        id +
        '" aria-label="' +
        LABELS[id] +
        'の配置">' +
        (id === "move"
          ? "<span></span>"
          : document.getElementById(id)!.innerHTML) +
        "</button>",
    ).join("") +
    "</div></section>";
  const el = (id: string) => root.querySelector<HTMLElement>("#" + id)!;
  const choose = el("layout-selected") as HTMLSelectElement,
    size = el("layout-size") as HTMLInputElement,
    opacity = el("layout-opacity") as HTMLInputElement;
  const draw = () => {
    for (const r of resolveLayout(
      draft,
      innerWidth,
      innerHeight,
      readInsets(),
    )) {
      const b = root.querySelector<HTMLElement>(
        '[data-layout-button="' + r.id + '"]',
      )!;
      const actual = getComputedStyle(document.getElementById(r.id)!);
      for (const key of [
        "border-radius",
        "border",
        "background",
        "color",
        "font-size",
        "font-family",
        "font-weight",
        "line-height",
        "padding",
        "box-shadow",
        "clip-path",
        "flex-direction",
        "align-items",
        "justify-content",
      ])
        b.style.setProperty(key, actual.getPropertyValue(key));
      Object.assign(b.style, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "0",
        minHeight: "0",
        margin: "0",
        transform: "none",
        left: r.left + "px",
        top: r.top + "px",
        width: r.size + "px",
        height: r.size + "px",
        opacity: String(draft.buttons[r.id].opacity ?? draft.opacity),
      });
      b.classList.toggle("selected", r.id === selected);
    }
    (el("layout-training") as HTMLButtonElement).disabled =
      training?.enabled === false ||
      overlaps(resolveLayout(draft, innerWidth, innerHeight, readInsets()));
    choose.value = selected;
    size.value = String(draft.buttons[selected].size);
    opacity.value = String(draft.buttons[selected].opacity ?? draft.opacity);
    const bad = overlaps(
      resolveLayout(draft, innerWidth, innerHeight, readInsets()),
    );
    (el("layout-save") as HTMLButtonElement).disabled = bad;
    el("layout-message").textContent = bad
      ? "ボタンが重なっています。間隔を空けてください"
      : training?.enabled === false
        ? "協力プレイは進行中です。試し撃ちはホームから利用できます。"
        : "ボタンを選び、位置・大きさ・濃さを調整できます";
  };
  let drag:
    | {
        id: ControlId;
        pointer: number;
        x: number;
        y: number;
        bx: number;
        by: number;
      }
    | undefined;
  root.querySelectorAll<HTMLElement>("[data-layout-button]").forEach((b) => {
    b.onpointerdown = (e) => {
      e.preventDefault();
      selected = b.dataset.layoutButton as ControlId;
      const p = draft.buttons[selected];
      drag = {
        id: selected,
        pointer: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        bx: p.x,
        by: p.y,
      };
      b.setPointerCapture(e.pointerId);
      draw();
    };
    b.onpointermove = (e) => {
      if (!drag || drag.pointer !== e.pointerId) return;
      const a = arena(innerWidth, innerHeight, readInsets());
      draft.buttons[drag.id].x = Math.max(
        0,
        Math.min(1, drag.bx + (e.clientX - drag.x) / a.width),
      );
      draft.buttons[drag.id].y = Math.max(
        0,
        Math.min(1, drag.by + (e.clientY - drag.y) / a.height),
      );
      draw();
    };
    b.onpointerup =
      b.onpointercancel =
      b.onlostpointercapture =
        () => {
          drag = undefined;
        };
    b.onkeydown = (e) => {
      const offsets: Record<string, [number, number]> = {
        ArrowLeft: [-0.01, 0],
        ArrowRight: [0.01, 0],
        ArrowUp: [0, -0.01],
        ArrowDown: [0, 0.01],
      };
      if (!offsets[e.key]) return;
      e.preventDefault();
      selected = b.dataset.layoutButton as ControlId;
      const [dx, dy] = offsets[e.key],
        p = draft.buttons[selected];
      p.x = Math.max(0, Math.min(1, p.x + dx));
      p.y = Math.max(0, Math.min(1, p.y + dy));
      draw();
    };
  });
  choose.onchange = () => {
    selected = choose.value as ControlId;
    draw();
  };
  size.oninput = () => {
    draft.buttons[selected].size = Number(size.value);
    draw();
  };
  opacity.oninput = () => {
    draft.buttons[selected].opacity = Number(opacity.value);
    draw();
  };
  el("layout-reset").onclick = () => {
    draft = defaultLayout();
    draw();
  };
  const close = () => {
    window.removeEventListener("resize", draw);
    onExit();
  };
  el("layout-cancel").onclick = close;
  el("layout-save").onclick = () => {
    try {
      if (overlaps(resolveLayout(draft, innerWidth, innerHeight, readInsets())))
        return;
      onSave(draft);
      close();
    } catch {
      el("layout-message").textContent =
        "配置の保存に失敗しました。容量やブラウザ設定を確認してください。";
    }
  };
  el("layout-training").onclick = () => {
    if (training?.enabled === false) return;
    const frame = document.createElement("iframe");
    frame.className = "training-frame";
    frame.title = "試し撃ち用トレーニングマップ";
    frame.allow = "autoplay; gyroscope; accelerometer";
    frame.src = import.meta.env.BASE_URL + "?training=1";
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.contentWindow
      )
        return;
      if (event.data?.type === "training-ready")
        frame.contentWindow!.postMessage(
          { type: "training-start", layout: draft, config: training?.config() },
          location.origin,
        );
      if (event.data?.type === "training-exit") {
        window.removeEventListener("message", receive);
        frame.remove();
        draw();
        el("layout-training").focus();
      }
    };
    window.addEventListener("message", receive);
    root.append(frame);
  };
  window.addEventListener("resize", draw);
  draw();
}
