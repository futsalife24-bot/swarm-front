/**
 * Protect document departures, without manufacturing browser history entries.
 * The browser owns confirmation/cancellation: do not save, disconnect, pause or
 * navigate from beforeunload. Native dialogs require user activation and are
 * not guaranteed for mobile app termination.
 */
export function createExitConfirmation(target: Window) {
  let internalDeparture = false;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  const reset = () => {
    internalDeparture = false;
    clearTimeout(resetTimer);
  };
  const beforeUnload = (event: BeforeUnloadEvent) => {
    const allowed = internalDeparture;
    // Consume even when another listener/browser cancels this navigation.
    reset();
    if (allowed) return;
    event.preventDefault();
    event.returnValue = true;
  };
  const proceed = (action: () => void) => {
    reset();
    internalDeparture = true;
    // Failed, hash-only or cancelled navigation must not disable protection.
    resetTimer = setTimeout(reset, 0);
    try {
      action();
    } catch (error) {
      reset();
      throw error;
    }
  };
  target.addEventListener("beforeunload", beforeUnload);
  target.addEventListener("pageshow", reset);
  return {
    proceed,
    dispose() {
      reset();
      target.removeEventListener("beforeunload", beforeUnload);
      target.removeEventListener("pageshow", reset);
    },
  };
}

let confirmation: ReturnType<typeof createExitConfirmation> | undefined;

export function installExitConfirmation() {
  if (typeof window !== "undefined" && !confirmation)
    confirmation = createExitConfirmation(window);
}

/** Only explicit app menu commands may bypass the document-exit prompt. */
export function isGameMenuDestination(
  url: string,
  current: string,
  base: string,
) {
  try {
    const destination = new URL(url, current);
    const root = new URL(base, current);
    return (
      destination.origin === new URL(current).origin &&
      [
        root.pathname,
        `${root.pathname}index.html`,
        `${root.pathname}front`,
        `${root.pathname}front.html`,
      ].includes(destination.pathname)
    );
  } catch {
    return false;
  }
}

export function navigateGameMenu(url: string) {
  const go = () => {
    location.href = url;
  };
  if (
    confirmation &&
    isGameMenuDestination(url, location.href, import.meta.env.BASE_URL)
  )
    confirmation.proceed(go);
  else go();
}

/** Only restoration or an already confirmed invitation may use this reload. */
export function reloadAuthorizedGameDocument() {
  const reload = () => location.reload();
  if (confirmation) confirmation.proceed(reload);
  else reload();
}
