/** URL-only presentation settings. Never persisted or passed to simulation. */
export function captureFromLocation(search: string) {
  const query = new URLSearchParams(search);
  const enabled = query.get("clean") === "1";
  return {
    enabled,
    tracerOpacity: enabled ? (query.get("tracers") === "off" ? 0 : 0.25) : 1,
  };
}
export const cleanCapture = captureFromLocation(
  typeof location === "undefined" ? "" : location.search,
);
export function installCleanCapture() {
  if (cleanCapture.enabled)
    document.documentElement.dataset.cleanCapture = "true";
}
