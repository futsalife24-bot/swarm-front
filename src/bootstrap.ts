import { checkDeveloperSession, developerRequested } from "./client/developer-access";

async function boot() {
if (new URLSearchParams(location.search).get("training") === "1") { await import("./client/training-app"); return; }
if (developerRequested) {
  const allowed = await checkDeveloperSession();
  if (!allowed) {
    const url = new URL(location.href);
    url.searchParams.delete("developer");
    url.searchParams.set("playtest", "1");
    history.replaceState(null, "", url);
  }
}
if (
  new URLSearchParams(location.search).get("playtest") === "1" ||
  new URLSearchParams(location.search).get("developer") === "1"
) {
  await import("./client/playtest-app");
} else {
  await import("./main");
}
}
void boot();
