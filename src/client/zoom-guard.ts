export function installZoomGuard() {
  const cancel = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  // Safari may ignore viewport scale limits. Cancel its native gesture events
  // as well as multi-touch defaults, without stopping game pointer handlers.
  for (const type of ["gesturestart", "gesturechange", "gestureend"])
    document.addEventListener(type, cancel, { passive: false, capture: true });
  for (const type of ["touchstart", "touchmove"] as const)
    document.addEventListener(
      type,
      (event) => {
        if (event.touches.length > 1) cancel(event);
      },
      { passive: false, capture: true },
    );
  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) cancel(event);
    },
    { passive: false, capture: true },
  );
}
