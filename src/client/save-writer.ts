/** One normal/co-op app owns persistence for its whole document lifetime. */
const LOCK_NAME = "swarm-front-shared-save-writer-v3";
let ownsWriter = false;

export function assertSaveWriter(storage: unknown) {
  if (typeof window === "undefined" || storage !== window.localStorage) return;
  if (!ownsWriter)
    throw new Error(
      "この画面には保存権限がありません。ゲームを開き直してください。",
    );
}

export function startWithSaveWriter(start: () => Promise<void>) {
  const root = document.getElementById("ui") ?? document.body;
  let attempting = false;
  let started = false;
  const showBlocked = (unsupported = false) => {
    root.hidden = false;
    root.innerHTML = `<div style="position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:16px;box-sizing:border-box;overflow:auto;background:#08151b;color:#eef7f8;font-family:sans-serif"><section id="save-writer-blocked" role="status" style="max-width:640px;padding:20px;background:#12252d;border:1px solid #52717b"><h1 style="font-size:22px;margin:0 0 12px">${unsupported ? "このブラウザでは保存を保護できません" : "別のタブでゲームを開いています"}</h1><p style="line-height:1.6">${unsupported ? "対応するブラウザの最新版で、ゲームの正式なURLを開いてください。" : "保存データを守るため、同時に遊べる画面は1つです。もう一方のゲームタブを閉じてから、この画面で再開してください。"}</p>${unsupported ? "" : '<button id="save-writer-retry" type="button" style="padding:12px 20px">このタブで再開</button>'}</section></div>`;
    root
      .querySelector<HTMLButtonElement>("#save-writer-retry")
      ?.addEventListener("click", () => void acquire());
  };
  const acquire = async () => {
    if (attempting || started) return;
    if (!navigator.locks) {
      showBlocked(true);
      return;
    }
    attempting = true;
    try {
      await navigator.locks.request(
        LOCK_NAME,
        { ifAvailable: true },
        async (lock) => {
          attempting = false;
          if (!lock) {
            showBlocked();
            return;
          }
          ownsWriter = true;
          started = true;
          let release!: () => void;
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          const onHide = () => {
            ownsWriter = false;
            release();
          };
          window.addEventListener("pagehide", onHide, { once: true });
          window.addEventListener("pageshow", (event) => {
            if (event.persisted) location.reload();
          });
          root.innerHTML = "";
          try {
            await start();
            await held;
          } finally {
            ownsWriter = false;
            window.removeEventListener("pagehide", onHide);
          }
        },
      );
    } catch (error) {
      attempting = false;
      if (started) throw error;
      showBlocked(true);
    }
  };
  void acquire();
}
