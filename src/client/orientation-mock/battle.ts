import { Controls } from "../input";
import { Renderer } from "../render";
import { Minimap } from "../minimap";
import type { Sound } from "../audio";
import { updateScopeButtons } from "../layout";
import { createTrainingWorld, stepTraining } from "../../shared/training";
import {
  createWorld,
  addPlayer,
  spawn,
  step,
  retireEvents,
} from "../../shared/game";
import { WEAPONS, stats, type Weapon } from "../../shared/defs";
import { shortEdgeFov } from "./geometry";
import type { MockViewport } from "./viewport";
import type { MockLayouts } from "./layouts";
import type { MockSettings } from "./settings";
import {
  FRONT_UPGRADE_CATALOG,
  FRONT_UPGRADE_IDS,
} from "../../shared/front-upgrades";

export type BattleScene = "training" | "skirmish" | "boss" | "dense";
const $ = (id: string) => document.getElementById(id)!;
export class MockBattle {
  readonly controls = new Controls({ releaseOnReset: true });
  private view?: Renderer;
  private map = new Minimap();
  private world = createTrainingWorld();
  scene: BattleScene = "training";
  visible = false;
  paused = false;
  private started = false;
  private draft = false;
  private savedBattle?: {
    world: ReturnType<typeof createWorld>;
    scene: BattleScene;
    started: boolean;
    yaw: number;
    pitch: number;
  };
  private runs = 0;
  private accumulator = 0;
  private previous = performance.now();
  private frames: number[] = [];
  private lastHud = 0;
  private placement?: ReturnType<MockLayouts["place"]>;
  constructor(
    private viewport: MockViewport,
    private layouts: MockLayouts,
    private settings: MockSettings,
    private sound: Sound,
    private actions: {
      pause: () => void;
      result: () => void;
      exitTraining: () => void;
    },
  ) {
    viewport.subscribe((v, old) => {
      if (
        v.width !== old.width ||
        v.height !== old.height ||
        v.screenAngle !== old.screenAngle ||
        JSON.stringify(v.insets) !== JSON.stringify(old.insets)
      ) {
        this.controls.reset();
        this.accumulator = 0;
        this.place();
        this.view?.resize();
      }
    });
    const loseFocus = () => {
      if (this.visible && !this.paused) {
        this.paused = true;
        this.controls.reset();
        actions.pause();
      }
    };
    window.addEventListener("blur", loseFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) loseFocus();
    });
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && this.visible) {
        this.paused = true;
        this.controls.reset();
        actions.pause();
      }
    });
    $("pause").onclick = () => {
      this.paused = true;
      this.controls.reset();
      actions.pause();
    };
    $("mock-training-exit").onclick = actions.exitTraining;
    requestAnimationFrame(this.frame);
  }
  start(scene: BattleScene, draft = false, weapons?: Weapon[]) {
    if (draft && !this.draft)
      this.savedBattle = {
        world: this.world,
        scene: this.scene,
        started: this.started,
        yaw: this.controls.input.yaw,
        pitch: this.controls.input.pitch,
      };
    if (!draft) this.savedBattle = undefined;
    this.scene = scene;
    this.draft = draft;
    this.frames = [];
    this.world =
      scene === "training"
        ? createTrainingWorld(weapons)
        : createWorld("", 731);
    // Renderer and audio track delivered events per run. Every training world
    // is created as "training", so a trial or restart reused the old cursor
    // and silently dropped its first shots and hits.
    this.world.run = `mock-${scene}-${++this.runs}`;
    if (scene !== "training") {
      const p = addPlayer(this.world, "training", weapons);
      p.x = 0;
      p.z = 16;
      this.world.phase = "battle";
      this.world.wave = 1;
      const count = scene === "dense" ? 40 : scene === "boss" ? 1 : 8;
      for (let i = 0; i < count; i++)
        spawn(
          this.world,
          scene === "boss" ? "harrow" : i % 4 === 3 ? "spitter" : "crawler",
          scene === "boss" ? 0 : ((i % 8) - 3.5) * 4,
          scene === "boss" ? -24 : 4 - Math.floor(i / 8) * 7,
          "crown",
          scene === "boss" ? 2 : 0,
        );
      if (scene === "dense")
        for (let i = 0; i < 3; i++) {
          const mate = addPlayer(this.world, `demo-${i}`);
          mate.x = (i - 1) * 3;
          mate.z = 17;
        }
    }
    this.controls.reset();
    this.controls.input.yaw = 0;
    // Frame the airborne boss on entry so both orientations start with a
    // useful aiming target. Subsequent look input remains entirely player-led.
    this.controls.input.pitch = scene === "boss" ? 0.65 : 0;
    this.started = true;
    this.paused = false;
    this.accumulator = 0;
    if (!this.view)
      this.view = new Renderer($("world") as HTMLCanvasElement, 120, {
        measure: () => this.viewport.snapshot,
        fov: shortEdgeFov,
      });
    this.applySettings();
    this.show();
    void this.sound.unlock();
  }
  show() {
    if (!this.started) {
      this.start("training");
      return;
    }
    this.visible = true;
    this.paused = false;
    this.controls.reset();
    this.accumulator = 0;
    document.body.dataset.screen = "battle";
    document.body.classList.toggle("mock-max-hud", this.scene === "dense");
    $("mock-upgrade-strip").innerHTML =
      this.scene === "dense"
        ? FRONT_UPGRADE_IDS.map(
            (id) => `<span>${FRONT_UPGRADE_CATALOG[id].name} Lv.5</span>`,
          ).join("")
        : "";
    $("mock-mission").hidden = this.scene !== "dense";
    $("mock-upgrade-strip").hidden = this.scene !== "dense";
    for (const id of ["controls", "hud", "minimap", "pause"])
      $(id).hidden = false;
    $("mock-training-exit").hidden = !this.draft;
    this.place();
  }
  hide() {
    this.visible = false;
    this.controls.enabled = false;
    this.controls.reset();
    this.accumulator = 0;
    // The frame loop stops updating audio while hidden; end combat voices now.
    this.sound.update(this.world, "training", this.controls.input.yaw, false);
    for (const id of [
      "controls",
      "hud",
      "minimap",
      "pause",
      "scope-overlay",
      "mock-training-exit",
    ])
      $(id).hidden = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  endTrial() {
    this.hide();
    const saved = this.savedBattle;
    if (saved) {
      this.world = saved.world;
      this.scene = saved.scene;
      this.started = saved.started;
      this.controls.input.yaw = saved.yaw;
      this.controls.input.pitch = saved.pitch;
    }
    this.savedBattle = undefined;
    this.draft = false;
    this.paused = true;
  }
  applySettings() {
    const s = this.settings,
      c = this.controls,
      v = this.view;
    c.sensitivity = s.sensitivity;
    c.fireSensitivity = s.fireSensitivity;
    c.gyroEnabled = s.gyroEnabled;
    c.gyroSensitivity = s.gyroSensitivity;
    this.sound.setVolumes(s.volume, s.bgmVolume, s.seVolume);
    this.map.rotates = s.mapRotates;
    if (v) {
      v.quality = s.quality;
      v.frameRate = s.frameRate;
      v.damageNumbers = s.damageNumbers;
      v.mapAssets.setQuality(s.quality);
      v.resize();
    }
  }
  private place() {
    this.placement = this.layouts.place(this.viewport.snapshot, this.draft);
  }
  snapshot() {
    const w = this.world,
      p = w.players[0],
      f = this.frames;
    return {
      scene: this.scene,
      active: this.visible && !this.paused,
      paused: this.paused,
      time: w.time,
      run: w.run,
      phase: w.phase,
      player: {
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        pitch: p.pitch,
        hp: p.hp,
        ammo: [...p.ammo],
        kills: p.kills,
      },
      events: {
        serial: w.eventSerial,
        rendered: this.view?.lastEvent ?? 0,
      },
      enemyCount: w.enemies.length,
      enemyHp: w.enemies.reduce((n, e) => n + e.hp, 0),
      input: { ...this.controls.input },
      touches: this.controls.touches.size,
      queued: this.controls.queued.size,
      scoped: this.controls.scoped,
      viewport: { ...this.viewport.snapshot },
      fov: this.view?.camera.fov,
      aspect: this.view?.camera.aspect,
      fallback: this.placement?.fallback,
      fps: f.length
        ? Math.round(1000 / (f.reduce((a, b) => a + b, 0) / f.length))
        : null,
      frameSamples: f.length,
      loaded: !!this.view?.players.get("training")?.userData.trooper,
      enemyModels: this.view
        ? [...this.view.structures]
            .filter(([, model]) => !!model.batch)
            .map(([kind]) => kind)
        : [],
    };
  }
  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const elapsed = now - this.previous,
      dt = Math.min(0.1, elapsed / 1000);
    this.previous = now;
    const active = this.visible && !this.paused && !document.hidden;
    this.controls.enabled = active;
    this.controls.setScopeAvailable(active);
    if (!this.visible || !this.view) {
      this.accumulator = 0;
      return;
    }
    const w = this.world,
      p = w.players[0],
      layout = this.placement?.layout;
    if (layout)
      updateScopeButtons(layout, {
        visible: true,
        available: active,
        scoped: this.controls.scoped,
      });
    $("scope-overlay").hidden = !this.controls.scoped;
    if (active) {
      this.frames.push(elapsed);
      if (this.frames.length > 120) this.frames.shift();
      this.accumulator += dt;
      while (this.accumulator >= 0.05) {
        const input = this.controls.read();
        if (this.scene === "training") stepTraining(w, input);
        else step(w, { training: input });
        this.accumulator -= 0.05;
      }
    } else this.accumulator = 0;
    if (now - this.lastHud > 100) {
      this.lastHud = now;
      $("mock-hp").textContent =
        `HP ${Math.ceil(p.hp)} · ${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, "0")}`;
      $("mock-ammo").textContent =
        `${WEAPONS[p.weapons[p.slot].kind].name} ${p.ammo[p.slot]}/${stats(p.weapons[p.slot]).mag}${p.reload > 0 ? " · 装填中" : ""}`;
      $("mock-battle-info").textContent =
        `${this.scene === "training" ? "射撃場" : this.scene === "boss" ? "大型戦" : this.scene === "dense" ? "密集戦" : "小規模戦"} · 敵${w.enemies.length} · 撃破${p.kills}${this.placement?.fallback ? " · 標準配置" : ""}`;
      $("mock-party").innerHTML =
        w.players.length > 1
          ? w.players
              .map(
                (mate, i) =>
                  `<span>隊員${i + 1} <b>HP ${Math.ceil(mate.hp)}</b></span>`,
              )
              .join("")
          : "";
    }
    this.map.draw(w, "training", this.controls.input.yaw, now);
    this.sound.update(w, "training", this.controls.input.yaw, active);
    this.view.render(
      w,
      "training",
      dt,
      this.controls.input.yaw,
      this.controls.input.pitch,
      undefined,
      active,
      this.controls.scoped,
      this.controls.aiming,
    );
    retireEvents(
      w,
      Math.min(this.view.consumed(w.run), this.sound.consumed(w.run)),
    );
    if (active && w.phase !== "battle") {
      this.paused = true;
      this.actions.result();
    }
  };
}
