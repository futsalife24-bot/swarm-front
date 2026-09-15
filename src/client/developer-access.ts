import { menuDialog } from "./menu-ui";

export const developerRequested =
  new URLSearchParams(location.search).get("developer") === "1";
export let developerAuthorized = false;
const endpoint = "/api/developer/";
const RETURN_KEY = "swarm-front-developer-return";

export async function checkDeveloperSession() {
  try {
    const response = await fetch(endpoint + "session", {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    developerAuthorized =
      response.ok && (await response.json()).authenticated === true;
  } catch {
    developerAuthorized = false;
  }
  return developerAuthorized;
}

export function openDeveloperLogin(
  returnTo: "main" | "playtest",
  onClose?: () => void,
) {
  const existing =
    document.querySelector<HTMLDialogElement>("#developer-login");
  if (existing) return existing;
  const d = menuDialog(
    "管理者モード",
    '<p>固定パスワードを入力してください。通常の進行はそのまま残ります。</p><form id="developer-login-form"><label>パスワード<input id="developer-password" type="password" autocomplete="current-password" required maxlength="256"></label><p id="developer-login-note" role="status"></p><button id="developer-login-submit" type="submit">管理者モードへ</button></form>',
    "DEVELOPER ACCESS",
  );
  d.id = "developer-login";
  const input = d.querySelector<HTMLInputElement>("#developer-password")!;
  const button = d.querySelector<HTMLButtonElement>("#developer-login-submit")!;
  const note = d.querySelector<HTMLElement>("#developer-login-note")!;
  let busy = false;
  d.addEventListener("close", () => {
    input.value = "";
    onClose?.();
  });
  d.querySelector<HTMLFormElement>("form")!.onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    button.disabled = true;
    note.textContent = "確認中…";
    try {
      const response = await fetch(endpoint + "login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: input.value }),
      });
      input.value = "";
      const data = await response.json();
      if (!response.ok || data.authenticated !== true)
        throw Error(data.error || "認証できませんでした");
      if (!d.isConnected) {
        await fetch(endpoint + "logout", {
          method: "POST",
          credentials: "same-origin",
        });
        return;
      }
      sessionStorage.setItem(RETURN_KEY, returnTo);
      location.assign(import.meta.env.BASE_URL + "?developer=1");
    } catch (error) {
      note.textContent =
        error instanceof Error &&
        !["TypeError", "TimeoutError"].includes(error.name)
          ? error.message
          : "接続できませんでした。通信を確認して再試行してください。";
    } finally {
      busy = false;
      button.disabled = false;
    }
  };
  return d;
}

export function returnToNormal() {
  sessionStorage.removeItem(RETURN_KEY);
  sessionStorage.removeItem("swarm-front-developer-retry");
  sessionStorage.setItem("swarm-front-playtest-mode", "normal");
  location.replace(import.meta.env.BASE_URL);
}

export async function exitDeveloperMode() {
  // Server revocation prevents an old developer URL or another tab reusing the session.
  try {
    const response = await fetch(endpoint + "logout", {
      method: "POST",
      credentials: "same-origin",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw Error();
    developerAuthorized = false;
    returnToNormal();
  } catch {
    menuDialog(
      "通常モードへ戻る",
      "<p>通信できず、管理者モードの認証を終了できませんでした。通信を確認して、もう一度「通常モードへ戻る」を押してください。</p>",
    );
  }
}
