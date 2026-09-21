import { menuDialog } from "./menu-ui";
import "./encounter-film.css";

export const encounterFilms = {
  calyx: "CALYX",
  crawler: "PLEAT",
  ant: "HOUND / VOLLEY",
  spider: "HOUND / LEAPER",
  spitter: "PRISM",
  hornet: "RAY",
  boss: "FOUNDRY ZERO",
  worm: "FOUNDRY ZERO 連結炉",
} as const;
export type EncounterFilm = keyof typeof encounterFilms;

/** Movies are fetched only when requested, not when the report or game opens. */
export function showEncounterFilm(
  key: EncounterFilm,
  owner: HTMLDialogElement,
) {
  const d = menuDialog(
    `${encounterFilms[key]} — 会敵ムービー`,
    '<video controls playsinline muted preload="metadata" aria-label="会敵ムービー"></video><p class="film-status" role="status">映像を読み込み中…</p><button class="film-retry" hidden>再読み込み</button>',
    "ENEMY REPORT",
  );
  d.classList.add("report-film-dialog");
  const video = d.querySelector("video")!;
  const status = d.querySelector<HTMLElement>(".film-status")!;
  const retry = d.querySelector<HTMLButtonElement>(".film-retry")!;
  d.querySelector("h2")!.id = "report-film-title";
  d.setAttribute("aria-labelledby", "report-film-title");
  const source = `${import.meta.env.BASE_URL}assets/encounters/report-v2/${key === "calyx" ? "calyx-v5" : key}.mp4`;
  video.dataset.source = source;
  let request: AbortController | undefined;
  let objectUrl: string | undefined;
  const play = () => {
    retry.hidden = true;
    void video.play().catch(() => {
      if (d.open && !video.error)
        status.textContent = "再生ボタンで映像を開始できます。";
    });
  };
  video.addEventListener("playing", () => {
    status.textContent = "";
  });
  const failed = () => {
    if (!d.open) return;
    status.textContent =
      "映像を読み込めませんでした。再読み込みをお試しください。";
    retry.hidden = false;
  };
  video.addEventListener("error", failed);
  const load = async () => {
    request?.abort();
    const pending = new AbortController();
    request = pending;
    retry.hidden = true;
    status.textContent = "映像を読み込み中…";
    video.pause();
    video.removeAttribute("src");
    video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
    try {
      const response = await fetch(source, { signal: pending.signal });
      if (!response.ok) throw new Error("Movie unavailable");
      const blob = await response.blob();
      if (!d.open || pending.signal.aborted) return;
      // Static hosting does not serve byte ranges. A small, complete Blob gives
      // native controls reliable seeking without changing the Worker/API.
      objectUrl = URL.createObjectURL(blob);
      video.src = objectUrl;
      play();
    } catch {
      if (!pending.signal.aborted) failed();
    }
  };
  retry.onclick = () => {
    void load();
  };
  const closeWithReport = () => d.close();
  owner.addEventListener("close", closeWithReport, { once: true });
  d.addEventListener(
    "close",
    () => {
      owner.removeEventListener("close", closeWithReport);
      request?.abort();
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    { once: true },
  );
  void load();
}
