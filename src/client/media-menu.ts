import { backgroundMusic, type MusicTrack } from "./bgm";
import { closeMenuDialog, menuDialog } from "./menu-ui";
import { MediaPlayback } from "./media-playback";
import "./media-menu.css";

export const SOUND_TEST_TRACKS: readonly { id: MusicTrack; label: string }[] = [
  { id: "title", label: "タイトル / 戦線の灯" },
  { id: "base", label: "基地 / 帰還した場所" },
  { id: "prepare", label: "出撃準備 / 出撃待機" },
  { id: "lobby", label: "協力ロビー / 集結、次の戦場へ" },
  { id: "report", label: "エネミーレポート / 不完全な模倣" },
  { id: "clear", label: "作戦完了 / 作戦完了" },
  { id: "victory", label: "戦果 / 次の戦場へ" },
  { id: "map-0", label: "灰明の街区 / 灰色の前線" },
  { id: "map-1", label: "薄暮の倉庫地区 / 交差する射線" },
  { id: "map-2", label: "蒼鉄の工業区 / 蒼鉄圧力" },
  { id: "map-3", label: "風渡る草原 / 風を裂く進軍" },
  { id: "map-4", label: "白嶺の雪峡 / 凍てつく戦線" },
  { id: "map-5", label: "晶脈の地底巣 / 晶脈の鼓動" },
];
export const PV_SOURCE = "assets/video/swarm-front-pv-v10.mp4";

/** Both clients share the same settings entries and media lifetime. */
export function mountMediaMenu(
  owner: HTMLDialogElement,
  volume: () => number,
  musicVolume: () => number = volume,
) {
  const entries = document.createElement("nav");
  entries.className = "settings-media";
  entries.setAttribute("aria-label", "音楽・映像");
  entries.innerHTML =
    '<button type="button" data-sound-test>サウンドテスト</button><button type="button" data-pv>PVを見る</button>';
  const panel = owner.querySelector("#settings-save");
  const name = panel?.querySelector(".player-name-setting");
  if (name) name.after(entries);
  else (panel ?? owner.querySelector(".menu-dialog-body"))!.append(entries);
  let active: HTMLDialogElement | undefined;
  const open = (video: boolean) => {
    if (active) return;
    const d = menuDialog(
      video ? "SWARM FRONT PV" : "サウンドテスト",
      `${video ? '<video controls playsinline preload="none" aria-label="SWARM FRONT PV"></video>' : `<label class="sound-test-select">BGM / 全${SOUND_TEST_TRACKS.length}曲<select aria-label="試聴するBGM">${SOUND_TEST_TRACKS.map((track) => `<option value="${track.id}">${track.label}</option>`).join("")}</select></label><audio controls preload="none" aria-label="BGM試聴"></audio>`}<div class="media-actions"><button type="button" data-play>再生</button><button type="button" data-pause>一時停止</button><button type="button" data-reload>再読み込み</button><label>試聴音量<input type="range" min="0" max="1" step="any" aria-label="試聴音量"></label></div><p class="media-status" role="status"></p><p class="media-note">音量はこの画面だけに適用されます。閉じるとゲームのBGMに戻ります。</p>`,
      video ? "PROMOTION VIDEO / 30 SEC" : "MUSIC PLAYER",
    );
    active = d;
    d.classList.add("media-dialog");
    if (video) d.classList.add("pv-dialog");
    d.querySelector("h2")!.id = "media-dialog-title";
    d.setAttribute("aria-labelledby", "media-dialog-title");
    const release = backgroundMusic().suspend();
    const media = d.querySelector<HTMLMediaElement>("audio,video")!;
    const level = d.querySelector<HTMLInputElement>('input[type="range"]')!;
    level.value = String(video ? volume() : musicVolume());
    const applyVolume = () => {
      media.volume = Number(level.value) * (video ? 1 : 0.55);
      media.muted = Number(level.value) === 0;
    };
    level.oninput = applyVolume;
    applyVolume();
    const status = d.querySelector<HTMLElement>(".media-status")!;
    const playback = new MediaPlayback(media, (message) => {
      status.textContent = message;
    });
    const selection = d.querySelector<HTMLSelectElement>("select");
    const source = () =>
      `${import.meta.env.BASE_URL}${video ? PV_SOURCE : `assets/audio/bgm-v1/${selection!.value}.mp3`}`;
    const load = (autoplay = false) => {
      media.dataset.track = video ? "pv-v10" : selection!.value;
      void playback.load(source(), autoplay);
    };
    if (selection) selection.onchange = () => load(true);
    d.querySelector<HTMLButtonElement>("[data-play]")!.onclick = () =>
      playback.play();
    d.querySelector<HTMLButtonElement>("[data-pause]")!.onclick = () =>
      playback.pause();
    d.querySelector<HTMLButtonElement>("[data-reload]")!.onclick = () => load();
    const ownerClosed = () => closeMenuDialog(d);
    owner.addEventListener("close", ownerClosed, { once: true });
    d.addEventListener(
      "close",
      () => {
        owner.removeEventListener("close", ownerClosed);
        playback.dispose();
        release();
        active = undefined;
      },
      { once: true },
    );
    load();
  };
  entries.querySelector<HTMLButtonElement>("[data-sound-test]")!.onclick = () =>
    open(false);
  entries.querySelector<HTMLButtonElement>("[data-pv]")!.onclick = () =>
    open(true);
}
