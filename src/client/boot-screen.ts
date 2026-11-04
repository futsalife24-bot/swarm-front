// 起動時だけの表示。戦闘中に #ui が空になっても再表示しない。
const bootScreen = document.getElementById("boot-screen");
const ui = document.getElementById("ui");
if (bootScreen && ui) {
  const dismiss = () => {
    if (!ui.childElementCount) return;
    bootScreen.remove();
    observer.disconnect();
  };
  const observer = new MutationObserver(dismiss);
  observer.observe(ui, { childList: true });
  dismiss();
}
