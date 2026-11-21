import {
  defaultStore,
  hasSeen,
  markReturnVisit,
  markSeen,
} from "./tutorial-flags";
import {
  elapsedBucketFromSeconds,
  isSwarmM2Kind,
  type ElapsedBucket,
} from "../shared/analytics-kinds";

const adminKey = "app-analytics-admin";
const searchParams = () =>
  new URLSearchParams(globalThis.location?.search ?? "");
const adminChoice = searchParams().get("analytics_admin");
if (adminChoice === "1" || adminChoice === "0") {
  let message: string;
  try {
    localStorage.setItem(adminKey, adminChoice);
    message =
      adminChoice === "1"
        ? "このブラウザを管理者として登録しました。以後のアクセスを区別します。"
        : "このブラウザの管理者登録を解除しました。";
  } catch {
    message = "ブラウザに保存できないため管理者登録を変更できませんでした。";
  }
  const show = () => {
    const box = document.createElement("aside");
    box.setAttribute("role", "status");
    box.style.cssText =
      "position:fixed;top:12px;left:12px;right:12px;z-index:2147483647;padding:14px;background:#17303a;color:#fff;border:1px solid #81ead6;border-radius:12px;font:14px/1.5 system-ui";
    box.textContent = message;
    const close = document.createElement("button");
    close.textContent = "閉じる";
    close.type = "button";
    close.style.cssText = "margin-left:12px;min-height:44px";
    close.onclick = () => box.remove();
    box.append(close);
    document.body.append(box);
  };
  if (document.body) show();
  else document.addEventListener("DOMContentLoaded", show, { once: true });
  try {
    const url = new URL(globalThis.location!.href);
    url.searchParams.delete("analytics_admin");
    history.replaceState(history.state, "", url.href);
  } catch {}
}
const isAnalyticsAdmin = () => {
  try {
    return localStorage.getItem(adminKey) === "1";
  } catch {
    return false;
  }
};
const key = "swarm-front-analytics-visitor";
const visitor = (() => {
  try {
    const old = localStorage.getItem(key);
    if (old && /^[a-zA-Z0-9_-]{8,64}$/.test(old)) return old;
    const value = crypto.randomUUID().replaceAll("-", "");
    localStorage.setItem(key, value);
    return value;
  } catch {
    return "anonymous";
  }
})();
const collect = (kind: string, elapsedBucket?: ElapsedBucket) =>
  fetch(
    "https://project-hub.melosalife-24.workers.dev/api/analytics/collect/swarm-front",
    {
      method: "POST",
      keepalive: true,
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        visitor,
        admin: isAnalyticsAdmin(),
        ...(elapsedBucket ? { elapsed_bucket: elapsedBucket } : {}),
      }),
    },
  ).catch(() => {});
const isDeveloper = () => searchParams().get("developer") === "1";
let ftueStartAt: number | undefined;
const elapsedBucket = () =>
  ftueStartAt === undefined
    ? "another_launch"
    : elapsedBucketFromSeconds((Date.now() - ftueStartAt) / 1000);
export function track(kind: "view" | "sortie" | "clear") {
  if (isDeveloper()) return;
  void collect(kind);
}

export type OnceKind =
  | "ftue_start"
  | "first_sortie"
  | "first_clear"
  | "first_supply10"
  | "return"
  | "operation_achieved"
  | "training_started"
  | "training_completed"
  | "first_buddy"
  | "first_supply_opened"
  | "second_sortie"
  | "first_box_claim"
  | "first_defeat";

export function trackOnce(
  kind: OnceKind,
  marker: `ftue:${string}`,
  store: Pick<Storage, "getItem" | "setItem"> | undefined = defaultStore(),
) {
  if (isDeveloper()) return false;
  if (hasSeen(marker, store)) return false;
  markSeen(marker, store);
  if (!hasSeen(marker, store)) return false;
  if (kind === "ftue_start") ftueStartAt = Date.now();
  void collect(kind, isSwarmM2Kind(kind) ? elapsedBucket() : undefined);
  return true;
}

export function trackReturn() {
  if (isDeveloper()) return;
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  if (markReturnVisit(today)) void collect("return");
}
