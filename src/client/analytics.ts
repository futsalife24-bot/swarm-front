const key = "swarm-front-analytics-visitor";
const visitor = (() => {
  try {
    const old = localStorage.getItem(key);
    if (old && /^[a-zA-Z0-9_-]{8,64}$/.test(old)) return old;
    const value = crypto.randomUUID().replaceAll("-", "");
    localStorage.setItem(key, value);
    return value;
  } catch { return "anonymous"; }
})();
export function track(kind: "view" | "sortie" | "clear") {
  if (new URLSearchParams(location.search).get("developer") === "1") return;
  void fetch("/api/analytics/event", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, visitor }) }).catch(() => {});
}
