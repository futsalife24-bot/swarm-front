import { menuDialog } from "./menu-ui";
import { normalizePlayerName } from "../shared/social";

export const PLAYER_NAME_KEY = "swarm-front-player-name-v1";
let sessionName = "";
export function playerName() {
  try {
    return (
      normalizePlayerName(localStorage.getItem(PLAYER_NAME_KEY)) || sessionName
    );
  } catch {
    return sessionName;
  }
}
let pending: Promise<boolean> | undefined;
export function editPlayerName(): Promise<boolean> {
  if (pending) return pending;
  pending = new Promise<boolean>((resolve) => {
    const d = menuDialog(
      "プレイヤー名",
      '<form id="player-name-form"><label for="player-name">部隊で表示する名前</label><input id="player-name" autocomplete="nickname" maxlength="40" required><p>20文字まで。設定からいつでも変更できます。</p><p id="player-name-status" role="status"></p><button class="primary" type="submit">この名前で登録</button></form>',
      "PLAYER PROFILE",
    );
    const input = d.querySelector<HTMLInputElement>("#player-name")!;
    input.value = playerName();
    let saved = false;
    d.querySelector<HTMLFormElement>("form")!.onsubmit = (event) => {
      event.preventDefault();
      const name = normalizePlayerName(input.value);
      const status = d.querySelector<HTMLElement>("#player-name-status")!;
      if (!name) {
        status.textContent = "名前を入力してください。";
        return;
      }
      if (Array.from(input.value.trim()).length > 20) {
        status.textContent = "20文字以内で入力してください。";
        return;
      }
      try {
        localStorage.setItem(PLAYER_NAME_KEY, name);
      } catch {
        status.textContent =
          "名前を保存できません。ブラウザの保存設定・空き容量を確認してください。";
        return;
      }
      sessionName = name;
      saved = true;
      window.dispatchEvent(
        new CustomEvent("player-name-changed", { detail: name }),
      );
      d.close();
    };
    d.addEventListener(
      "close",
      () => {
        pending = undefined;
        resolve(saved);
      },
      { once: true },
    );
    requestAnimationFrame(() => input.focus());
  });
  return pending;
}
export function installPlayerProfile() {
  document.addEventListener(
    "click",
    (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>(
              "#solo, #coop, #launch, #pt-start",
            )
          : null;
      if (!button || button.disabled || playerName()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void editPlayerName().then((saved) => {
        if (saved && button.isConnected) button.click();
      });
    },
    true,
  );
}
export function addPlayerNameSetting(root: HTMLElement) {
  const button = document.createElement("button");
  button.type = "button";
  button.id = "edit-player-name";
  const refresh = () => {
    button.textContent = `プレイヤー名：${playerName() || "未登録"} · 変更`;
  };
  refresh();
  button.onclick = () => {
    void editPlayerName().then(refresh);
  };
  root.prepend(button);
}
