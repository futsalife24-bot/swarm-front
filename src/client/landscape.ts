let fullscreenRequest: Promise<void> | undefined;

/** Keep native dialogs above an in-flight fullscreen transition from the same tap. */
export function showModalAfterFullscreen(dialog: HTMLDialogElement) {
  const show = () => { if (dialog.isConnected && !dialog.open) dialog.showModal(); };
  if (fullscreenRequest) void fullscreenRequest.then(show, show);
  else show();
}

// CSS blocks portrait before JavaScript loads; inert also blocks keyboard focus.
export function installLandscapeGuard(onPortrait: () => void) {
  const portrait = matchMedia("(orientation: portrait)");
  // Only actual fullscreen display replaces DOM fullscreen. Installed apps
  // may still use standalone (e.g. before their manifest update is applied).
  const appFullscreen = matchMedia("(display-mode: fullscreen)");
  const gate = document.getElementById("portrait")!;
  const sync = () => {
    for (const child of document.body.children) {
      if (child instanceof HTMLElement && child !== gate)
        child.inert = portrait.matches;
    }
    if (portrait.matches) onPortrait();
  };
  let locking: Promise<boolean> | undefined;
  const lock = (): Promise<boolean> => {
    if (locking) return locking;
    const orientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: "landscape") => Promise<void>;
    };
    locking = (async () => {
      try {
        if (!orientation?.lock) return false;
        await orientation.lock("landscape");
        return true;
      } catch {
        return false;
      }
    })();
    void locking.finally(() => {
      locking = undefined;
    });
    return locking;
  };
  let starting = false;
  let lastFullscreenAttempt = -Infinity;
  const start = async () => {
    if (starting) return;
    starting = true;
    try {
      // Request synchronously within the user's normal start gesture. Awaiting
      // a failed lock first can consume the activation needed for fullscreen.
      if (
        !appFullscreen.matches &&
        !document.fullscreenElement &&
        navigator.maxTouchPoints > 0
      ) {
        try {
          lastFullscreenAttempt = performance.now();
          fullscreenRequest = document.documentElement.requestFullscreen?.({
            navigationUI: "hide",
          });
          await fullscreenRequest;
        } catch {
          // Installed apps can allow locking without browser fullscreen.
        } finally {
          fullscreenRequest = undefined;
        }
      }
      const locked = await lock();
      document.getElementById("landscape-status")!.textContent = locked
        ? ""
        : "このブラウザでは画面を自動で切り替えられません。";
      sync();
    } finally {
      starting = false;
    }
  };
  // Fullscreen needs a real user gesture. Touch pointerup also covers combat
  // controls that cancel pointerdown and therefore never produce a click.
  // Do not cancel/consume the gameplay event or retry in an unbounded timer.
  const keepFullscreen = (event: Event) => {
    if (!event.isTrusted || document.hidden || navigator.maxTouchPoints === 0)
      return;
    if (appFullscreen.matches || document.fullscreenElement) return;
    // Coalesce pointerup + compatibility click, including rejected requests.
    if (performance.now() - lastFullscreenAttempt < 500) return;
    void start();
  };
  document.addEventListener("pointerup", keepFullscreen, { capture: true });
  document.addEventListener("click", keepFullscreen, { capture: true });
  portrait.addEventListener("change", sync);
  document.addEventListener("fullscreenchange", () => void lock());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      sync();
      void lock();
    }
  });
  window.addEventListener("pageshow", () => {
    sync();
    void lock();
  });
  sync();
  void lock();
}
