import { stageFor } from "../shared/stages";

export const MAP_MUSIC = [
  "map-0",
  "map-1",
  "map-2",
  "map-3",
  "map-4",
  "map-5",
] as const;
export type MusicTrack =
  | "title"
  | "base"
  | "prepare"
  | "lobby"
  | "report"
  | "clear"
  | "victory"
  | (typeof MAP_MUSIC)[number];

type MusicWorld = Parameters<typeof stageFor>[0] & { training?: boolean };

/** Use the active plan, including resumed campaigns, rather than a menu selection. */
export function musicForBattle(world?: MusicWorld | null): MusicTrack | null {
  if (!world || world.training) return null;
  return MAP_MUSIC[stageFor(world).map] ?? null;
}

export function musicForScreen(
  screen: string,
  victory = false,
  world?: MusicWorld | null,
): MusicTrack | null | undefined {
  if (screen === "battle") return musicForBattle(world);
  if (["loading", "layout"].includes(screen)) return undefined;
  if (["title", "home", "intro"].includes(screen)) return "title";
  if (["base", "armory", "growth", "accessories"].includes(screen))
    return "base";
  if (screen === "gear") return "prepare";
  if (screen === "lobby") return "lobby";
  if (["collection", "stage-clear"].includes(screen)) return "clear";
  if (screen === "choice" || (screen === "result" && victory)) return "victory";
  return null;
}

/** One streaming player: no multi-megabyte decoded buffers or overlapping tracks. */
export class BackgroundMusic {
  private player: HTMLAudioElement;
  private scene: MusicTrack | null = null;
  private report = false;
  private current: MusicTrack | null = null;
  private unlocked = false;
  private level = 0.35;
  private pending = false;
  constructor() {
    this.player = new Audio();
    this.player.preload = "none";
    this.player.volume = this.level * 0.55;
    this.player.dataset.bgm = "true";
    this.player.hidden = true;
    document.body.append(this.player);
    this.player.addEventListener("ended", () => {
      if (this.current === "clear") {
        this.current = null;
        if (this.scene === "clear") this.scene = "victory";
        this.sync();
      }
    });
    this.player.addEventListener("error", () => {
      // A missing cue must never prevent results or trap playback before victory.
      if (this.current === "clear") {
        this.current = null;
        if (this.scene === "clear") this.scene = "victory";
        this.sync();
      }
    });
    document.addEventListener("visibilitychange", () => this.sync());
    window.addEventListener("pagehide", () => this.player.pause());
    window.addEventListener("pageshow", () => this.sync());
    document.addEventListener("pointerdown", () => this.unlock(), true);
    document.addEventListener("keydown", () => this.unlock(), true);
  }
  set volume(value: number) {
    this.level = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    this.player.volume = this.level * 0.55;
    this.player.muted = this.level === 0;
    this.sync();
  }
  unlock() {
    this.unlocked = true;
    this.sync();
  }
  setScreen(screen: string, victory = false, world?: MusicWorld | null) {
    const next = musicForScreen(screen, victory, world);
    if (next === undefined || next === this.scene) return;
    // Collection may be redrawn after its one-shot has already finished.
    if (next === "clear" && this.scene === "victory") return;
    this.scene = next;
    this.sync();
  }
  setReport(open: boolean) {
    this.report = open;
    this.sync();
  }
  private sync() {
    const wanted = this.report ? "report" : this.scene;
    // Let the supplied clear cue finish even if the result screen opens first.
    const finishCue =
      this.current === "clear" && wanted === "victory" && !this.player.ended;
    if (wanted !== this.current && !finishCue) {
      this.player.pause();
      this.current = wanted;
      if (wanted) {
        this.player.src = `${import.meta.env.BASE_URL}assets/audio/bgm-v1/${wanted}.mp3`;
        this.player.loop = wanted !== "clear";
        this.player.dataset.track = wanted;
      } else {
        this.player.removeAttribute("src");
        this.player.load();
        delete this.player.dataset.track;
      }
    }
    if (
      !this.current ||
      !this.unlocked ||
      this.level === 0 ||
      document.hidden
    ) {
      this.player.pause();
      return;
    }
    if (this.player.paused && !this.pending) {
      this.pending = true;
      const requested = this.current;
      void this.player
        .play()
        .catch(() => {
          // Browser autoplay policies/network failures: retry on the next gesture.
        })
        .finally(() => {
          this.pending = false;
          if (requested !== this.current) this.sync();
        });
    }
  }
}

let instance: BackgroundMusic | undefined;
export const backgroundMusic = () => (instance ??= new BackgroundMusic());
