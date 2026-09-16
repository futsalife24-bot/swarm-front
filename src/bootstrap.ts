import { installPlayerProfile } from "./client/player-profile";
import "./client/app-install";
import { installInviteLaunch } from "./client/invite-launch";
import { startWithSaveWriter } from "./client/save-writer";
import {
  checkDeveloperSession,
  developerRequested,
} from "./client/developer-access";

async function boot() {
  installInviteLaunch();
  installPlayerProfile();
  const url = new URL(location.href);
  // Old shared links retain their progress, but no longer select a separate edition.
  url.searchParams.delete("playtest");
  if (new URLSearchParams(location.search).get("training") === "1") {
    await import("./client/training-app");
    return;
  }
  let allowed = false;
  if (developerRequested) {
    allowed = await checkDeveloperSession();
    if (!allowed) {
      url.searchParams.delete("developer");
    }
  }
  history.replaceState(null, "", url);
  const launch = async () => {
    if (
      !developerRequested &&
      (url.searchParams.get("coop") === "1" ||
        /^[a-f0-9]{32}$/.test(url.hash.slice(1)))
    ) {
      await import("./main");
    } else {
      await import("./client/playtest-app");
    }
  };
  if (allowed) await launch();
  else startWithSaveWriter(launch);
}
void boot();
