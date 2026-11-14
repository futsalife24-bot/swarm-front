/**
 * 補給演出（public/supply-reveal）の進行見出しに管制AIの声を当てる。
 * 演出側のコードは変えず、見出し `.gx-status` とカットインの表示名 `.gx-ghost` の変化だけを見る。
 * 採用外の行（解析中・開封など）は再生キューが "unadopted" で捨てる。
 */
const STATUS_LINES: Readonly<Record<string, string>> = {
  投下要請: "supply-request",
  降下中: "supply-descend",
  反応を検知: "supply-detect",
  解析中: "supply-analyze",
  開封: "supply-open",
  確定: "supply-confirmed",
  受領完了: "supply-complete",
};
const CUT_LINES: Readonly<Record<string, string>> = {
  SSR: "supply-ssr",
  BUDDY: "supply-buddy",
};

export const supplyStatusLine = (status: string) => STATUS_LINES[status.trim()];
export const supplyCutLine = (ghost: string) => CUT_LINES[ghost.trim()];

export function watchSupplyVoice(
  say: (id: string) => void,
  root: HTMLElement = document.body,
) {
  let status = "",
    cut = "";
  const check = () => {
    const nextStatus = root.querySelector(".gx-status")?.textContent ?? "",
      nextCut = root.querySelector(".gx-cut .gx-ghost")?.textContent ?? "";
    if (nextStatus !== status) {
      status = nextStatus;
      const id = supplyStatusLine(status);
      if (id) say(id);
    }
    if (nextCut !== cut) {
      cut = nextCut;
      const id = supplyCutLine(cut);
      if (id) say(id);
    }
  };
  const observer = new MutationObserver(check);
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return () => observer.disconnect();
}
