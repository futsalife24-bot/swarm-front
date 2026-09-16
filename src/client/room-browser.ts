import { parseRoomEntry } from "./room-invite";
import { STAGES } from "../shared/stages";
import { type RoomListing } from "../shared/room-directory";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Catamon's create / public list / eight-character ID flow, using this game's UI. */
export function roomBrowserMarkup(endpoint: string, status: string) {
  return `<section class="panel room-entry room-browser"><header><div><div class="eyebrow">CO-OP / SQUAD</div><h1>協力プレイ</h1></div><button id="home">タイトルへ</button></header>
  <div class="room-browser-columns"><section class="room-create"><h2>部屋を作る</h2><label>部屋名<input id="room-name" maxlength="24" value="協力部隊" autocomplete="off"></label><label>募集方法<select id="room-visibility"><option value="public">公開（部屋一覧に表示）</option><option value="private">ID・招待のみ</option></select></label><div id="turnstile-room-create" aria-label="ルーム作成の人間確認"></div><p id="turnstile-status" class="fine"></p><button class="primary" id="launch">部屋を作る ↗</button></section>
  <section class="room-browse"><header><h2>部屋を探す</h2><button id="room-refresh">更新</button></header><form id="room-join-form"><label class="sr-only" for="room-id">部屋IDまたは招待リンク</label><input id="room-id" maxlength="2048" placeholder="部屋ID / 招待リンク" autocomplete="off" autocapitalize="off"><button id="room-join" type="submit">参加</button></form><p id="room-list-status" role="status">参加できる部屋を表示します。</p><div id="room-list" aria-label="公開部屋一覧"></div></section></div>
  <details class="coop-advanced"><summary>接続先を手動設定（開発用）</summary><div class="join"><input id="endpoint" aria-label="協力サーバー" value="${esc(endpoint)}"><input id="creation-key" type="password" aria-label="ローカル作成キー" placeholder="ローカル作成キー" autocomplete="off" maxlength="256"></div></details><p class="status" role="status">${esc(status)}</p></section>`;
}

export function bindRoomBrowser(
  root: HTMLElement,
  join: (code: string) => Promise<void>,
) {
  const field = root.querySelector<HTMLInputElement>("#endpoint")!;
  const status = root.querySelector<HTMLElement>("#room-list-status")!;
  const list = root.querySelector<HTMLElement>("#room-list")!;
  let joining = false,
    revision = 0;
  const refreshButton = root.querySelector<HTMLButtonElement>("#room-refresh")!;
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
    const response = await fetch(endpoint() + path, {
      signal: AbortSignal.timeout(7000),
      redirect: "error",
      cache: "no-store",
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(value.error || "部屋情報を取得できませんでした");
    return value;
  }
  async function enter(value: string) {
    if (joining) return;
    revision++;
    refreshButton.disabled = false;
    const id = parseRoomEntry(value, location.href);
    if (!id) {
      status.textContent =
        "部屋ID（8文字）またはこのゲームの招待リンクを入力してください。";
      return;
    }
    joining = true;
    try {
      status.textContent = "部屋を確認しています…";
      const code =
        id.length === 32
          ? id.toLowerCase()
          : (await request(`/rooms/${id}`)).code;
      if (typeof code !== "string" || !/^[a-f0-9]{32}$/.test(code))
        throw new Error("部屋情報を確認できませんでした");
      if (root.isConnected) await join(code);
    } catch (e) {
      if (root.isConnected) status.textContent = (e as Error).message;
    } finally {
      joining = false;
    }
  }
  async function refresh() {
    if (joining) return;
    const current = ++revision;
    refreshButton.disabled = true;
    status.textContent = "公開部屋を探しています…";
    try {
      const data = await request("/rooms");
      if (!root.isConnected || current !== revision) return;
      if (!Array.isArray(data.rooms))
        throw new Error("部屋一覧を取得できませんでした");
      list.replaceChildren();
      for (const room of (data.rooms as RoomListing[]).slice(0, 20)) {
        if (!/^[A-F0-9]{8}$/.test(room.roomId)) continue;
        const row = document.createElement("div");
        row.className = "room-list-row";
        const title = document.createElement("strong");
        title.textContent = room.name;
        const detail = document.createElement("small");
        detail.textContent = `${STAGES.find((s) => s.id === room.stage)?.name ?? "作戦準備中"} · ${room.players}/4人 · ${room.roomId}`;
        const button = document.createElement("button");
        button.textContent = "入る";
        button.dataset.roomJoin = room.roomId;
        button.onclick = () => void enter(room.roomId);
        row.append(title, detail, button);
        list.append(row);
      }
      status.textContent = list.children.length
        ? `${list.children.length}件の公開部屋`
        : "現在、参加できる公開部屋はありません。";
    } catch (e) {
      if (root.isConnected && current === revision)
        status.textContent = (e as Error).message;
    } finally {
      if (current === revision) refreshButton.disabled = false;
    }
  }
  root.querySelector<HTMLFormElement>("#room-join-form")!.onsubmit = (e) => {
    e.preventDefault();
    void enter(root.querySelector<HTMLInputElement>("#room-id")!.value);
  };
  root.querySelector<HTMLButtonElement>("#room-refresh")!.onclick = () =>
    void refresh();
  field.addEventListener("change", () => void refresh());
  void refresh();
}
