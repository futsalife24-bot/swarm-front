import { parseRoomEntry } from "./room-invite";

// Supported browsers deliver app links without discarding an ongoing game.
// OS link capture preferences still decide whether an external link opens the app.
export function installInviteLaunch() {
  const queue = (
    window as Window & {
      launchQueue?: {
        setConsumer(fn: (params: { targetURL?: string }) => void): void;
      };
    }
  ).launchQueue;
  queue?.setConsumer(({ targetURL }) => {
    if (!targetURL || targetURL === location.href) return;
    const code = parseRoomEntry(targetURL, location.href);
    if (code.length !== 32) return;
    if (
      !window.confirm(
        "招待された部屋の参加画面へ移動しますか？ プレイ中の場合は現在のゲームを退出します。",
      )
    )
      return;
    const url = new URL(location.href);
    url.search = "?coop=1";
    url.hash = code.toLowerCase();
    // replaceState + reload also handles a hash-only launch into an existing app.
    history.replaceState(null, "", url);
    location.reload();
  });
}
