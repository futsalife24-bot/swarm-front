import { parseRoomEntry } from "./room-invite";
import { STAGES } from "../shared/stages";
import { validRoomId, type RoomListing } from "../shared/room-directory";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function setRoomBrowserBusy(root: HTMLElement, busy: boolean) {
  root.dataset.roomBusy = String(busy);
  for (const button of root.querySelectorAll<HTMLButtonElement>(
    "[data-room-access], #launch, #room-join, #room-refresh",
  ))
    button.disabled = busy;
}
/** 招待で集まる部屋と、一覧から入る部屋を切り替える。 */
export function roomBrowserMarkup(endpoint: string, status: string) {
  return `<section class="panel room-entry room-browser"><header><div><div class="eyebrow">CO-OP / SQUAD</div><h1>協力プレイ</h1></div><button id="home">タイトルへ</button></header>
  <div class="room-access" role="group" aria-label="募集方法"><button type="button" data-room-access="private" aria-pressed="true">IDで招待</button><button type="button" data-room-access="public" aria-pressed="false">フリーマッチング</button></div>
  <p id="room-access-help" class="fine">招待リンクか部屋IDを共有して、仲間と集まります。一覧には表示されません。</p>
  <input id="room-visibility" type="hidden" value="private">
  <div class="room-browser-columns"><section class="room-create"><div class="room-create-fields"><h2>部屋を作る</h2><label>部屋名<input id="room-name" maxlength="24" value="協力部隊" autocomplete="off"></label><div id="turnstile-room-create" aria-label="ルーム作成の人間確認"></div><p id="turnstile-status" class="fine"></p></div><button class="primary" id="launch">部屋を作る ↗</button></section>
  <section class="room-browse"><header><h2 id="room-browse-title">招待で参加する</h2><button id="room-refresh" hidden>更新</button></header><form id="room-join-form"><label class="sr-only" for="room-id">部屋IDまたは招待リンク</label><input id="room-id" maxlength="2048" placeholder="部屋ID / 招待リンク" autocomplete="off" autocapitalize="off" spellcheck="false"><button id="room-join" type="submit">参加</button></form><p id="room-list-status" role="status">部屋主から届いた数字3桁の部屋IDか招待リンクを入力してください。</p><div id="room-list" aria-label="公開部屋一覧" hidden></div></section></div>
  <details class="coop-advanced"><summary>接続先を手動設定（開発用）</summary><div class="join"><input id="endpoint" aria-label="協力サーバー" value="${esc(endpoint)}"><input id="creation-key" type="password" aria-label="ローカル作成キー" placeholder="ローカル作成キー" autocomplete="off" maxlength="256"></div></details><p class="status" role="status">${esc(status)}</p></section>`;
}

export function bindRoomBrowser(
  root: HTMLElement,
  join: (code: string) => Promise<void>,
  ruleset?: "front-v1",
) {
  const field = root.querySelector<HTMLInputElement>("#endpoint")!;
  const status = root.querySelector<HTMLElement>("#room-list-status")!;
  const list = root.querySelector<HTMLElement>("#room-list")!;
  let joining = false,
    revision = 0;
  const refreshButton = root.querySelector<HTMLButtonElement>("#room-refresh")!;
  const visibility = root.querySelector<HTMLInputElement>("#room-visibility")!;
  const joinForm = root.querySelector<HTMLFormElement>("#room-join-form")!;
  const joinButton = root.querySelector<HTMLButtonElement>("#room-join")!;
  const roomInput = root.querySelector<HTMLInputElement>("#room-id")!;
  roomInput.setAttribute("aria-describedby", "room-list-status");
  const message = (text: string, state = "info") => {
    status.dataset.state = state;
    status.setAttribute("role", state === "error" ? "alert" : "status");
    status.textContent = text;
  };
  const accessButtons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-room-access]"),
  ];
  const endpoint = () => {
    const url = new URL(field.value.trim());
    if (
      !/^https?:$/.test(url.protocol) ||
      (url.protocol === "http:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("サーバーURLを確認してください");
    return url.href.replace(/\/$/, "");
  };
  async function request(path: string) {
    const response = await fetch(
      endpoint() + path + (ruleset ? "?ruleset=" + ruleset : ""),
      {
        signal: AbortSignal.timeout(7000),
        redirect: "error",
        cache: "no-store",
      },
    ).catch((error: Error) => {
      throw new Error(
        error.name === "TimeoutError"
          ? "部屋の確認が時間切れになりました。通信を確認して、もう一度お試しください。"
          : "サーバーに接続できません。通信を確認して、もう一度お試しください。",
      );
    });
    const value = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? "部屋が見つかりません。部屋IDが違うか、部屋が終了しています。部屋主にご確認ください。"
          : typeof value?.error === "string"
            ? value.error
            : "部屋情報を取得できませんでした。もう一度お試しください。",
      );
    if (!value) throw new Error("部屋情報を確認できませんでした。");
    return value;
  }
  async function enter(value: string) {
    if (joining || root.dataset.roomBusy === "true") return;
    revision++;
    refreshButton.disabled = false;
    const id = parseRoomEntry(value, location.href, ruleset);
    if (!id) {
      roomInput.setAttribute("aria-invalid", "true");
      message(
        "入力エラー：部屋IDは数字3桁です。部屋主のIDか招待リンクをコピーしてください。以前の8文字IDも利用できます。",
        "error",
      );
      return;
    }
    roomInput.removeAttribute("aria-invalid");
    joining = true;
    root.dataset.roomBusy = "true";
    joinForm.setAttribute("aria-busy", "true");
    roomInput.readOnly = true;
    const launch = root.querySelector<HTMLButtonElement>("#launch")!;
    const launchWasDisabled = launch.disabled;
    launch.disabled = true;
    joinButton.disabled = true;
    joinButton.textContent = "確認中…";
    for (const button of accessButtons) button.disabled = true;
    try {
      message("部屋を確認しています…", "pending");
      const code =
        id.length === 32
          ? id.toLowerCase()
          : (await request(`/rooms/${id}`)).code;
      if (typeof code !== "string" || !/^[a-f0-9]{32}$/.test(code))
        throw new Error("部屋情報を確認できませんでした");
      if (root.isConnected) {
        message("部隊に接続しています…", "pending");
        await join(code);
      }
    } catch (e) {
      if (root.isConnected)
        message(`参加できませんでした。${(e as Error).message}`, "error");
    } finally {
      joining = false;
      root.dataset.roomBusy = "false";
      launch.disabled = launchWasDisabled;
      joinForm.setAttribute("aria-busy", "false");
      roomInput.readOnly = false;
      joinButton.disabled = false;
      joinButton.textContent = "参加";
      for (const button of accessButtons) button.disabled = false;
    }
  }
  async function refresh() {
    if (
      joining ||
      root.dataset.roomBusy === "true" ||
      visibility.value !== "public"
    )
      return;
    const current = ++revision;
    refreshButton.disabled = true;
    message("公開部屋を探しています…", "pending");
    try {
      const data = await request("/rooms");
      if (!root.isConnected || current !== revision) return;
      if (!Array.isArray(data.rooms))
        throw new Error("部屋一覧を取得できませんでした");
      list.replaceChildren();
      for (const room of (data.rooms as RoomListing[]).slice(0, 20)) {
        if (typeof room.roomId !== "string" || !validRoomId(room.roomId))
          continue;
        const row = document.createElement("div");
        row.className = "room-list-row";
        const title = document.createElement("strong");
        title.textContent = room.name;
        const detail = document.createElement("small");
        detail.textContent = `${ruleset === "front-v1" ? "生存" : (STAGES.find((s) => s.id === room.stage)?.name ?? "作戦準備中")} · ${room.players}/4人`;
        const button = document.createElement("button");
        button.textContent = "入る";
        button.dataset.roomJoin = room.roomId;
        button.onclick = () => void enter(room.roomId);
        row.append(title, detail, button);
        list.append(row);
      }
      message(
        list.children.length
          ? `${list.children.length}件の公開部屋`
          : "現在、参加できる公開部屋はありません。",
      );
    } catch (e) {
      if (root.isConnected && current === revision)
        message((e as Error).message, "error");
    } finally {
      if (current === revision)
        refreshButton.disabled = root.dataset.roomBusy === "true";
    }
  }
  function selectAccess(access: string) {
    if (joining || root.dataset.roomBusy === "true") return;
    const isPublic = access === "public";
    visibility.value = isPublic ? "public" : "private";
    revision++;
    for (const button of accessButtons)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.roomAccess === visibility.value),
      );
    joinForm.hidden = isPublic;
    list.hidden = !isPublic;
    refreshButton.hidden = !isPublic;
    refreshButton.disabled = false;
    root.querySelector("#room-browse-title")!.textContent = isPublic
      ? "公開中の部屋"
      : "招待で参加する";
    root.querySelector("#room-access-help")!.textContent = isPublic
      ? "公開中の部屋から選んで参加できます。部屋を作ると、この一覧に公開されます。"
      : "招待リンクか部屋IDを共有して、仲間と集まります。一覧には表示されません。";
    roomInput.removeAttribute("aria-invalid");
    message(
      isPublic
        ? "公開部屋を探しています…"
        : "部屋主から届いた数字3桁の部屋IDか招待リンクを入力してください。",
    );
    if (isPublic) void refresh();
  }
  for (const button of accessButtons)
    button.onclick = () => selectAccess(button.dataset.roomAccess!);
  joinForm.onsubmit = (e) => {
    e.preventDefault();
    void enter(root.querySelector<HTMLInputElement>("#room-id")!.value);
  };
  root.querySelector<HTMLButtonElement>("#room-refresh")!.onclick = () =>
    void refresh();
  field.addEventListener("change", () => void refresh());
  // 招待側を初期表示し、公開一覧は選ばれた時だけ取得する。
}
