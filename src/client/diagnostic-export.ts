declare const __SWARM_BUILD__: string;
export const diagnosticBuild =
  typeof __SWARM_BUILD__ === "string" ? __SWARM_BUILD__ : "development";

/** No URL, room identity, storage, cookies, input contents or automatic upload. */
export function diagnosticReport(details: unknown) {
  return {
    format: 1,
    build: diagnosticBuild,
    capturedAt: new Date().toISOString(),
    environment: {
      userAgent: navigator.userAgent,
      standalone: matchMedia("(display-mode: standalone)").matches,
      viewport: [innerWidth, innerHeight, devicePixelRatio],
    },
    observations: details,
  };
}

export function downloadNetworkDiagnostics(details: unknown) {
  const blob = new Blob([JSON.stringify(diagnosticReport(details))], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `swarm-diagnostics-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const DIAGNOSTIC_KEY = "swarm-network-diagnostics-v1";
export function networkDiagnosticsEnabled() {
  try {
    return (
      new URLSearchParams(location.search).get("networkDiagnostics") === "1" ||
      localStorage.getItem(DIAGNOSTIC_KEY) === "1"
    );
  } catch {
    return false;
  }
}
export function setNetworkDiagnostics(enabled: boolean) {
  localStorage.setItem(DIAGNOSTIC_KEY, enabled ? "1" : "0");
  if (!enabled) {
    const url = new URL(location.href);
    url.searchParams.delete("networkDiagnostics");
    history.replaceState(history.state, "", url);
  }
}
