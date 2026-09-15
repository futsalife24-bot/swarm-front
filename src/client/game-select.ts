import { menuDialog } from "./menu-ui";
import "./game-select.css";

type Picker = { button: HTMLButtonElement; dialog?: HTMLDialogElement };
const pickers = new WeakMap<HTMLSelectElement, Picker>();
let nextId = 0;

function label(select: HTMLSelectElement) {
  const associated = select.labels?.[0]?.cloneNode(true) as
    HTMLElement | undefined;
  associated
    ?.querySelectorAll("select, button")
    .forEach((node) => node.remove());
  return (
    select.getAttribute("aria-label") ||
    associated?.textContent?.trim() ||
    "選択"
  );
}

function sync(select: HTMLSelectElement, picker: Picker) {
  const selected = select.selectedOptions[0];
  picker.button.textContent = `${selected?.textContent || "選択してください"} ▾`;
  picker.button.setAttribute(
    "aria-label",
    `${label(select)}: ${selected?.textContent || "未選択"}`,
  );
  picker.button.disabled = select.matches(":disabled");
  if (picker.button.disabled) picker.dialog?.close();
  picker.dialog
    ?.querySelectorAll<HTMLButtonElement>("[data-option-index]")
    .forEach((button) => {
      const option = select.options[Number(button.dataset.optionIndex)];
      button.setAttribute("aria-pressed", String(option?.selected || false));
      button.disabled =
        !option ||
        option.disabled ||
        (option.parentElement instanceof HTMLOptGroupElement &&
          option.parentElement.disabled);
    });
}

function open(select: HTMLSelectElement, picker: Picker) {
  sync(select, picker);
  if (picker.button.disabled || picker.dialog?.isConnected) return;
  // Use textContent for all option text; saved/user-provided names stay plain text.
  const dialog = menuDialog("選択", "", "SWARM FRONT");
  picker.dialog = dialog;
  dialog.classList.add("game-select-dialog");
  const title = dialog.querySelector("h2")!;
  title.id = `game-select-title-${++nextId}`;
  title.textContent = label(select);
  dialog.id = `game-select-dialog-${nextId}`;
  dialog.setAttribute("aria-labelledby", title.id);
  picker.button.setAttribute("aria-controls", dialog.id);
  picker.button.setAttribute("aria-expanded", "true");
  const body = dialog.querySelector<HTMLElement>(".menu-dialog-body")!;
  const list = document.createElement("div");
  list.className = "game-select-options";
  body.append(list);
  for (const [index, option] of [...select.options].entries()) {
    if (option.hidden) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.textContent;
    button.dataset.optionIndex = String(index);
    button.disabled =
      option.disabled ||
      (option.parentElement instanceof HTMLOptGroupElement &&
        option.parentElement.disabled);
    button.setAttribute("aria-pressed", String(option.selected));
    button.onclick = () => {
      if (
        select.matches(":disabled") ||
        button.disabled ||
        !select.isConnected
      ) {
        dialog.close();
        return;
      }
      const changed = select.selectedIndex !== index;
      select.selectedIndex = index;
      sync(select, picker);
      dialog.close();
      if (changed) select.dispatchEvent(new Event("change", { bubbles: true }));
    };
    list.append(button);
  }
  list.addEventListener("keydown", (event) => {
    const buttons = [
      ...list.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    ];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let target: number;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        target = (index + 1) % buttons.length;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        target = (index - 1 + buttons.length) % buttons.length;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[target]?.focus();
  });
  const focusSelected = () => {
    if (!dialog.open) return;
    const selected =
      list.querySelector<HTMLButtonElement>(
        'button[aria-pressed="true"]:not(:disabled)',
      ) || list.querySelector<HTMLButtonElement>("button:not(:disabled)");
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: "nearest" });
  };
  // menuDialog may wait for a pending fullscreen transition before opening.
  const observer = new MutationObserver(focusSelected);
  observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
  focusSelected();
  dialog.addEventListener("close", () => {
    observer.disconnect();
    picker.dialog = undefined;
    picker.button.setAttribute("aria-expanded", "false");
    picker.button.removeAttribute("aria-controls");
    // A change handler can replace the whole menu and enhance its new select in
    // a microtask. Resolve the live trigger after that render, not the old node.
    requestAnimationFrame(() => {
      if (document.querySelector("dialog[open]")) return;
      const currentSelect = select.isConnected
        ? select
        : select.id
          ? document.getElementById(select.id)
          : null;
      const button =
        currentSelect instanceof HTMLSelectElement
          ? pickers.get(currentSelect)?.button
          : undefined;
      if (button?.isConnected && !button.disabled)
        button.focus({ preventScroll: true });
    });
  });
}

/** Keep the existing select/change handlers as the source of truth. Call after render. */
export function enhanceGameSelects(
  root: ParentNode,
  selectors: string | readonly string[],
) {
  const query = typeof selectors === "string" ? selectors : selectors.join(",");
  if (!query) return;
  root.querySelectorAll<HTMLSelectElement>(query).forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    let picker = pickers.get(select);
    if (!picker) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `${select.className} game-select-trigger`.trim();
      button.dataset.gameSelectFor = select.id;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      select.hidden = true;
      select.dataset.gameSelect = "true";
      select.after(button);
      picker = { button };
      pickers.set(select, picker);
      const current = picker;
      button.onclick = () => open(select, current);
      select.addEventListener("change", () => sync(select, current));
    }
    sync(select, picker);
  });
}

/** Call after external value/disabled changes that do not dispatch change. */
export function syncGameSelects(root: ParentNode) {
  root
    .querySelectorAll<HTMLSelectElement>('select[data-game-select="true"]')
    .forEach((select) => {
      const picker = pickers.get(select);
      if (picker) sync(select, picker);
    });
}
