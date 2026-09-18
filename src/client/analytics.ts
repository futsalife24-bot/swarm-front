const adminKey = "app-analytics-admin";
const adminChoice = new URLSearchParams(location.search).get("analytics_admin");
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
    const url = new URL(location.href);
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
export function track(kind: "view" | "sortie" | "clear") {
  if (new URLSearchParams(location.search).get("developer") === "1") return;
  void fetch("/api/analytics/event", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, visitor, admin: isAnalyticsAdmin() }),
  }).catch(() => {});
}
