import { Renderer } from "../src/client/render";
import {
  addPlayer,
  createWorld,
  hurtEnemy,
  neutral,
  spawn,
  step,
  type Enemy,
  type Input,
  type World,
} from "../src/shared/game";
import {
  BASTION,
  bastionCenter,
  bastionLanes,
  bastionTier,
} from "../src/shared/bastion";
import { mapFor } from "../src/shared/stages";
import { VIEW_MAPS } from "../src/client/map-assets";
import type { Kind } from "../src/shared/defs";

/**
 * BASTION（仮称）検証ページ。実際の Renderer・共有 step()・肩越しカメラを使い、
 * 初期配置とシナリオ操作（被弾・回避・ポーズ）だけを検証用に与える。
 */
const renderer = new Renderer(document.querySelector("canvas")!);
let w: World,
  paused = false,
  recording = false,
  mode = "idle",
  before = performance.now(),
  clock = 0,
  lastFire = -1;
const errors: string[] = [];
window.addEventListener("error", (e) => errors.push(e.message));

const WEAPON: Record<string, Kind> = {
  smg: "smg",
  rifle: "rifle",
  burst: "rifle",
  shotgun: "shotgun",
  sniper: "sniper",
  multi: "smg",
};
const PRESET_COUNTER = new Set(["counter", "dodge", "hit", "pause", "death"]);

function reset(next: string) {
  mode = next;
  clock = 0;
  w = createWorld("bastion-preview-" + next + "-" + performance.now(), 3, 1);
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  const p = addPlayer(w, "viewer");
  const kind = WEAPON[mode] ?? "rifle";
  p.weapons = [0, 1].map((i) => ({
    id: `preview-${i}`,
    kind,
    rarity: 0 as const,
    power: 1,
    effect: "none" as const,
  }));
  Object.assign(p, { x: 0, y: 0, z: 12, hp: 1e6, ammo: [999, 999] });
  const count = mode === "multi" ? 3 : 1;
  for (let i = 0; i < count; i++) {
    const e = spawn(w, "bastion", (i - (count - 1) / 2) * 5, i === 1 ? -3 : 0)!;
    e.active = true;
    if (mode !== "death") e.hp = e.maxHp = 1e6;
    // 照準弾は複数体の検証だけで使い、他は硬化と反撃に絞る。
    if (mode !== "multi") e.bastion!.aimReadyAt = 1e9;
    if (PRESET_COUNTER.has(mode))
      Object.assign(e.bastion!, { armor: 100, hitAt: 0 });
  }
  paused = false;
}

function pose(name: string) {
  reset("idle");
  const e = w.enemies[0];
  Object.assign(e, { x: 0, z: 0, heading: 0 });
  const s = e.bastion!;
  s.aimReadyAt = 1e9;
  w.time = 5;
  if (name === "hardened") Object.assign(s, { armor: 62, hitAt: 5 });
  if (name === "brace")
    Object.assign(s, { armor: 100, phase: "brace", phaseAt: 4.5 });
  if (name === "warn")
    Object.assign(s, {
      armor: 100,
      phase: "warn",
      phaseAt: 4.45,
      volley: { count: 12, turn: 0.18, ...bastionCenter(e) },
    });
  if (name === "open") Object.assign(s, { phase: "open", phaseAt: 4.3 });
  mode = "pose:" + name;
  paused = true;
}

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]"))
  b.onclick = () => reset(b.dataset.mode!);
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-pose]"))
  b.onclick = () => pose(b.dataset.pose!);
document.getElementById("pause")!.onclick = () => (paused = !paused);
document.getElementById("hide")!.onclick = () =>
  document.getElementById("panel")!.classList.toggle("hidden");

function aimAt(e: Enemy | undefined): Pick<Input, "yaw" | "pitch"> {
  const p = w.players[0];
  if (!e) return { yaw: 0, pitch: 0 };
  const c = bastionCenter(e);
  return {
    yaw: Math.atan2(c.x - p.x, -(c.z - p.z)),
    pitch: Math.atan2(c.y - ((p.y ?? 0) + 1.5), Math.hypot(c.x - p.x, c.z - p.z)),
  };
}

function trigger() {
  if (!WEAPON[mode]) return false;
  if (mode === "burst") return clock % 1.8 < 0.36;
  return true;
}

/** 回避シナリオ: 赤予告中だけ、最寄りのレーンの隙間へ横移動する。 */
function dodgeInput(e: Enemy | undefined): Partial<Input> {
  const s = e?.bastion;
  if (!e || !s?.volley || s.phase !== "warn") return {};
  const p = w.players[0];
  const step = (Math.PI * 2) / s.volley.count;
  const here = Math.atan2(p.x - e.x, p.z - e.z);
  const gap =
    s.volley.turn +
    (Math.round((here - s.volley.turn) / step - 0.5) + 0.5) * step;
  const diff = Math.atan2(Math.sin(gap - here), Math.cos(gap - here));
  if (Math.abs(diff) < 0.02) return {};
  // 敵へ向いた状態の横移動。yaw = -角度 なので mx=+1 で角度が増える。
  return { mx: diff > 0 ? 1 : -1 };
}

/** シナリオごとの操作。frame は録画中のフレーム番号（30fps）。 */
function scenario(frame: number): Partial<Input> {
  const e = w.enemies[0];
  if (mode === "dodge") return dodgeInput(e);
  if (mode === "hit" && e?.bastion?.phase === "warn" && e.bastion.volley) {
    // レーン上に立たせる（赤予告の開始時に一度だけ配置）。
    const lane = bastionLanes(e.bastion.volley, mapFor(w).blocks)[0];
    const p = w.players[0];
    if (Math.abs(Math.atan2(p.x - e.x, p.z - e.z) - lane.yaw) > 1e-3) {
      p.x = e.x + Math.sin(lane.yaw) * 9;
      p.z = e.z + Math.cos(lane.yaw) * 9;
    }
  }
  // 予備動作の途中（0.6秒）で撃破し、2.4秒に同じ位置へ再出現させる。
  if (mode === "death" && frame === 18 && e) hurtEnemy(w, e, 1e9, "viewer");
  if (mode === "death" && frame === 72) {
    const again = spawn(w, "bastion", 0, 0)!;
    again.active = true;
    again.bastion!.aimReadyAt = 1e9;
  }
  return {};
}

function input(frame: number): Input {
  const aim = aimAt(w.enemies[0]);
  const fire = trigger();
  if (fire) lastFire = w.time;
  return { ...neutral(), ...aim, fire, ...scenario(frame) };
}

function sample() {
  const p = w.players[0];
  return {
    time: +w.time.toFixed(3),
    playerHp: Math.round(p.hp),
    player: { x: +p.x.toFixed(2), z: +p.z.toFixed(2) },
    rounds: w.projectiles.filter((q) => q.style === "bastion").length,
    lanes: renderer.bastion.lanesDrawn,
    enemies: w.enemies.map((e) => ({
      id: e.id,
      armor: +(e.bastion?.armor ?? 0).toFixed(1),
      tier: bastionTier(e.bastion?.armor ?? 0),
      phase: e.bastion?.phase,
      volley: e.bastion?.volley?.count,
      aim: e.bastion?.aim ? (e.bastion.aim.committed ? "red" : "windup") : undefined,
      damageTaken: Math.round(e.maxHp - e.hp),
      view: renderer.bastion.inspect(e.id),
    })),
  };
}

const PHASE_LABEL: Record<string, string> = {
  guard: "通常",
  brace: "予備動作",
  warn: "赤予告",
  open: "開放",
};
/** 録画の下端に検証用の状態を焼き込む（ゲームUIではない）。 */
function caption(ctx: CanvasRenderingContext2D, label: string) {
  const e = w.enemies[0];
  const s = e?.bastion;
  ctx.fillStyle = "#05090dcc";
  ctx.fillRect(0, 676, 1280, 44);
  ctx.fillStyle = "#e6eef0";
  ctx.font = "18px sans-serif";
  const text = s
    ? `検証表示｜${label}｜時刻 ${w.time.toFixed(2)}s｜硬化 ${Math.round(s.armor)}（段階${bastionTier(s.armor)}）｜${PHASE_LABEL[s.phase]}${s.volley ? `｜${s.volley.count}発確定` : ""}｜軽減 ${Math.round(BASTION.reduction[bastionTier(s.armor)] * (s.phase === "open" ? 0 : 100))}%｜隊員HP ${Math.round(w.players[0].hp)}`
    : `検証表示｜${label}｜時刻 ${w.time.toFixed(2)}s｜BASTIONなし｜隊員HP ${Math.round(w.players[0].hp)}`;
  ctx.fillText(text, 16, 705);
}

const yieldTask = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });

/** 決定的な録画: 1/30秒ずつ step と描画を進め、VP9 を IVF にまとめて返す。 */
async function record(next: string, seconds: number, label: string) {
  recording = true;
  reset(next);
  const fps = 30,
    count = Math.round(seconds * fps);
  const film = document.createElement("canvas");
  film.width = 1280;
  film.height = 720;
  const ctx = film.getContext("2d")!;
  const frames: Uint8Array[] = [];
  let failure: unknown;
  const encoder = new VideoEncoder({
    output(chunk) {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      frames.push(bytes);
    },
    error(e) {
      failure = e;
    },
  });
  const config: VideoEncoderConfig = {
    codec: "vp09.00.10.08",
    width: 1280,
    height: 720,
    framerate: fps,
    bitrate: 6_000_000,
    latencyMode: "quality",
  };
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) throw Error("VP9 encoder unsupported");
  encoder.configure(support.config ?? config);
  const samples: ReturnType<typeof sample>[] = [];
  try {
    // モデルとマップの読込を待ち、最初のフレームから完成した見た目で描く。
    await prepareCapture();
    for (let i = 0; i < count; i++) {
      if (failure) throw failure;
      while (encoder.encodeQueueSize > 4) await yieldTask();
      const dt = 1 / fps;
      const frozen = mode === "pause" && i >= 30 && i < 60;
      if (!frozen) {
        clock += dt;
        w.players[0].ammo = [999, 999];
        step(w, { viewer: input(i) }, dt);
      }
      const aim = aimAt(w.enemies[0]);
      renderer.render(w, "viewer", dt, aim.yaw, aim.pitch - 0.05, undefined, true);
      ctx.drawImage(renderer.renderer.domElement, 0, 0, 1280, 720);
      caption(ctx, frozen ? `${label}（一時停止中）` : label);
      const frame = new VideoFrame(film, {
        timestamp: Math.round((i * 1e6) / fps),
        duration: Math.round(1e6 / fps),
      });
      try {
        encoder.encode(frame, { keyFrame: i % fps === 0 });
      } finally {
        frame.close();
      }
      if (i % 3 === 0) samples.push(sample());
      await yieldTask();
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    encoder.close();
    recording = false;
  }
  const size = 32 + frames.reduce((n, f) => n + 12 + f.length, 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  out.set([68, 75, 73, 70], 0); // DKIF
  view.setUint16(6, 32, true);
  out.set([86, 80, 57, 48], 8); // VP90
  view.setUint16(12, 1280, true);
  view.setUint16(14, 720, true);
  view.setUint32(16, fps, true);
  view.setUint32(20, 1, true);
  view.setUint32(24, frames.length, true);
  let offset = 32;
  frames.forEach((f, index) => {
    view.setUint32(offset, f.length, true);
    view.setBigUint64(offset + 4, BigInt(index), true);
    out.set(f, offset + 12);
    offset += 12 + f.length;
  });
  let binary = "";
  for (let i = 0; i < out.length; i += 0x8000)
    binary += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return { ivf: btoa(binary), frames: frames.length, samples, errors: [...errors] };
}

/**
 * 撮影の前提をそろえる: 固定1/30秒の描画を30fps目標として扱い（解像度の自動低下を防ぐ）、
 * BASTION と現在マップ（遠景を含む）の読込完了を待つ。
 */
async function prepareCapture() {
  renderer.frameRate = 30;
  renderer.adaptiveQuality.scale = 1;
  renderer.resize();
  const map = VIEW_MAPS.indexOf(mapFor(w));
  const start = performance.now();
  while (
    !renderer.bastion.ready ||
    renderer.mapAssets.status[map]?.state !== "ready" ||
    renderer.mapAssets.distantStatus[map]?.state !== "ready"
  ) {
    if (renderer.bastion.error) throw Error(renderer.bastion.error);
    if (performance.now() - start > 120000) throw Error("model/map load timeout");
    renderer.render(w, "viewer", 0, 0, 0, undefined, false);
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** 静止画: 状態を固定し、表示の補間を固定時間（3秒）だけ進めてから canvas を画像化する。 */
async function still(name: string, distance: number) {
  recording = true;
  try {
    pose(name);
    w.players[0].z = distance;
    await prepareCapture();
    const aim = aimAt(w.enemies[0]);
    for (let i = 0; i < 90; i++)
      renderer.render(w, "viewer", 1 / 30, aim.yaw, aim.pitch - 0.05, undefined, true);
    const view = renderer.bastion.inspect(w.enemies[0].id);
    const canvas = renderer.renderer.domElement;
    const film = document.createElement("canvas");
    film.width = canvas.width;
    film.height = canvas.height;
    film.getContext("2d")!.drawImage(canvas, 0, 0);
    return { png: film.toDataURL("image/png"), view, lanes: renderer.bastion.lanesDrawn };
  } finally {
    recording = false;
  }
}

reset("smg");
(window as unknown as Record<string, unknown>).__bastion = {
  reset,
  pose,
  record,
  still,
  get world() {
    return w;
  },
  set paused(v: boolean) {
    paused = v;
  },
  renderer,
};

function frame(now: number) {
  const dt = Math.min(0.05, (now - before) / 1000);
  before = now;
  if (!recording) {
    if (!paused) {
      clock += dt;
      w.players[0].ammo = [999, 999];
      step(w, { viewer: input(Math.round(clock * 30)) }, dt);
    }
    const aim = aimAt(w.enemies[0]);
    renderer.render(w, "viewer", dt, aim.yaw, aim.pitch - 0.05, undefined, true);
    renderer.drawDamage(dt);
    document.getElementById("status")!.textContent = JSON.stringify(
      {
        mode,
        paused,
        model: renderer.bastion.ready ? "GLB loaded" : renderer.bastion.error ?? "loading",
        weapon: w.players[0].weapons[0].kind,
        firing: w.time - lastFire < 0.1,
        ...sample(),
        errors,
      },
      null,
      1,
    );
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
