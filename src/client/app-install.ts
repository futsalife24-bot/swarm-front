interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}
let prompt: InstallEvent | undefined;
export const canInstallApp = () => !!prompt;
export async function installApp() {
  const current = prompt;
  if (!current) return;
  prompt = undefined;
  await current.prompt();
  await current.userChoice;
  window.dispatchEvent(new Event("app-install-changed"));
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  prompt = event as InstallEvent;
  window.dispatchEvent(new Event("app-install-changed"));
});
window.addEventListener("appinstalled", () => {
  prompt = undefined;
  window.dispatchEvent(new Event("app-install-changed"));
});
if ("serviceWorker" in navigator)
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {});
