import { Renderer } from "../src/client/render";
import { CALYX, calyxPredictedImpact } from "../src/shared/calyx";
import { createWorld, addPlayer, spawn, type Enemy } from "../src/shared/game";
import {
  HARROW,
  queueHarrowBombs,
  queueHarrowMissiles,
  queueHarrowSnipes,
} from "../src/shared/harrow";
import { FOUNDRY_LASER_WARNING } from "../src/shared/foundry-defs";
import { mapFor } from "../src/shared/stages";
import { STRUCTURE_TIMING } from "../src/shared/structure-timing";
import { groundHeight } from "../src/shared/terrain";

type Case = {
  id: string;
  species: string;
  name: string;
  kind: Enemy["kind"];
  wind: number;
  duration: number;
  form?: "worm";
  warningAt?: number;
};
const cases: Case[] = [
  {
    id: "ant",
    species: "ANT",
    name: "近接",
    kind: "ant",
    wind: 0.8,
    duration: 1.5,
  },
  {
    id: "ant-ranged",
    species: "ANT",
    name: "射撃",
    kind: "ant",
    wind: 0.8,
    duration: 1.5,
  },
  {
    id: "spider",
    species: "LEAPER",
    name: "近接",
    kind: "spider",
    wind: 0.8,
    duration: 1.5,
  },
  {
    id: "crawler",
    species: "PLEAT",
    name: "近接",
    kind: "crawler",
    wind: STRUCTURE_TIMING.crawler.wind,
    duration: 1.5,
  },
  {
    id: "spitter",
    species: "PRISM",
    name: "射撃",
    kind: "spitter",
    wind: STRUCTURE_TIMING.spitter.wind,
    duration: 1.6,
  },
  {
    id: "hornet",
    species: "RAY",
    name: "光線",
    kind: "hornet",
    wind: STRUCTURE_TIMING.hornet.wind,
    duration: 3.1,
  },
  {
    id: "boss",
    species: "FOUNDRY",
    name: "近接",
    kind: "boss",
    wind: STRUCTURE_TIMING.boss.wind,
    duration: 4,
  },
  {
    id: "worm",
    species: "FOUNDRY",
    name: "連結炉レーザー",
    kind: "boss",
    form: "worm",
    wind: FOUNDRY_LASER_WARNING,
    duration: 1.4,
  },
  {
    id: "calyx-slam",
    species: "CALYX",
    name: "Slam",
    kind: "calyx",
    wind: CALYX.slamWind,
    duration: CALYX.slamDuration,
  },
  {
    id: "calyx-shot",
    species: "CALYX",
    name: "PollenShot",
    kind: "calyx",
    wind: CALYX.shotWind,
    duration: CALYX.shotDuration,
  },
  {
    id: "harrow-dash",
    species: "HARROW",
    name: "Dash",
    kind: "harrow",
    wind: HARROW.dashWind,
    duration: HARROW.dashDuration,
  },
  {
    id: "harrow-threat",
    species: "HARROW",
    name: "Threat",
    kind: "harrow",
    wind: HARROW.threatWind,
    duration: HARROW.threatDuration,
  },
  {
    id: "harrow-snipe",
    species: "HARROW",
    name: "Snipe",
    kind: "harrow",
    wind: HARROW.snipeWind,
    duration: HARROW.snipeDuration,
  },
  {
    id: "harrow-spin",
    species: "HARROW",
    name: "Spin",
    kind: "harrow",
    wind: HARROW.spinWind,
    duration: HARROW.spinDuration,
  },
  {
    id: "harrow-air-threat",
    species: "HARROW",
    name: "AirThreat",
    kind: "harrow",
    wind: HARROW.threatWind,
    duration: HARROW.threatDuration,
  },
  {
    id: "harrow-bomb",
    species: "HARROW",
    name: "BombPass",
    kind: "harrow",
    wind: HARROW.bombWind,
    duration: HARROW.bombDuration,
  },
  {
    id: "harrow-dive",
    species: "HARROW",
    name: "Dive",
    kind: "harrow",
    wind: HARROW.glideDuration,
    duration: HARROW.glideDuration + HARROW.diveDuration + 0.5,
    warningAt: 0.4,
  },
];
const renderer = new Renderer(document.querySelector("canvas")!);
const speciesBox = document.getElementById("species")!;
const attacksBox = document.getElementById("attacks")!;
const slider = document.getElementById("time") as HTMLInputElement;
const status = document.getElementById("status")!;
const stateUrl = document.getElementById("state-url") as HTMLAnchorElement;
const pngLink = document.getElementById("png-link") as HTMLAnchorElement;
const playButton = document.getElementById("play")!;
const initialUrl = new URL(location.href);
let selected =
  cases.find((c) => c.id === initialUrl.searchParams.get("case")) ?? cases[0];
let world = createWorld("anticipation", 1, 20);
let enemy: Enemy;
let time = 0;
let playing = false;
let front = initialUrl.searchParams.get("front") === "1";
let areaView = initialUrl.searchParams.get("view") === "area";
let captureTimer: number | undefined;
let last = performance.now();

function buildWorld() {
  renderer.structures.get(selected.kind)?.controller.states.clear();
  world = createWorld(
    `anticipation-${selected.id}-${performance.now()}`,
    1,
    20,
  );
  world.phase = "battle";
  world.wave = 2;
  world.nextSpawn = 1e9;
  world.spawned = 9999;
  const player = addPlayer(world, "viewer");
  player.x = 0;
  player.z = ["ant", "spider", "crawler"].includes(selected.id) ? 2 : 20;
  player.y = groundHeight(player.x, player.z, mapFor(world).blocks);
  player.hp = 10000;
  enemy = spawn(world, selected.kind, 0, 0, selected.form ?? "crown")!;
  enemy.active = true;
  enemy.tx = player.x;
  enemy.tz = player.z;
  enemy.heading = 0;
  enemy.cool = 10;
  if (selected.kind === "calyx") {
    enemy.calyx = {
      kind: selected.id === "calyx-shot" ? "PollenShot" : "Slam",
      started: 0,
      fired: false,
      yaw: 0,
    };
  }
  if (selected.kind === "harrow") {
    const air = ["harrow-air-threat", "harrow-bomb", "harrow-dive"].includes(
      selected.id,
    );
    enemy.harrowAirborne = air;
    if (!air) enemy.y = groundHeight(enemy.x, enemy.z, mapFor(world).blocks);
    enemy.harrowSwitchAt = 1e9;
    const attackKind = selected.id.replace("harrow-", "");
    enemy.harrow = {
      kind:
        attackKind === "bomb"
          ? "BombPass"
          : attackKind === "dive"
            ? "Glide"
            : attackKind === "dash"
              ? "Dash"
              : attackKind === "snipe"
                ? "Snipe"
                : attackKind === "spin"
                  ? "Spin"
                  : "Threat",
      started: 0,
      fired: false,
      yaw: 0,
      from: { x: enemy.x, y: enemy.y, z: enemy.z },
      to: {
        x: 0,
        y: air ? enemy.y : groundHeight(0, 12, mapFor(world).blocks),
        z: selected.id === "harrow-bomb" ? 80 : 12,
      },
    };
    if (selected.id === "harrow-threat" || selected.id === "harrow-air-threat")
      queueHarrowMissiles(world, enemy, [player]);
    if (selected.id === "harrow-snipe") queueHarrowSnipes(world, enemy, player);
    if (selected.id === "harrow-bomb") queueHarrowBombs(world, enemy, player);
  }
  time = 0;
  playing = false;
  playButton.textContent = "再生";
  slider.max = String(selected.duration);
  slider.value = "0";
  renderAt(0);
  scheduleCapture();
  const selectedId = selected.id;
  void renderer.structures.get(selected.kind)?.loading.then(() => {
    if (selected.id === selectedId) scheduleCapture();
  });
}

function scheduleCapture() {
  if (captureTimer !== undefined) window.clearTimeout(captureTimer);
  captureTimer = window.setTimeout(() => {
    captureTimer = undefined;
    renderAt(time);
    try {
      pngLink.href = renderer.renderer.domElement.toDataURL("image/png");
      pngLink.download = `anomaly-${selected.id}-${time.toFixed(2).replace(".", "-")}.png`;
    } catch (error) {
      pngLink.textContent = `PNG生成失敗: ${String(error)}`;
    }
  }, 180);
}

function renderAt(age: number) {
  time = Math.max(0, Math.min(selected.duration, age));
  world.time = time;
  const warning = selected.warningAt ?? selected.wind / 2;
  const phase =
    time < warning ? "構え" : time < selected.wind ? "赤予告" : "攻撃";
  status.textContent = `${selected.species} ${selected.name}　${phase}\n${time.toFixed(2)} / ${selected.duration.toFixed(2)} 秒（赤 ${warning.toFixed(2)} 秒・攻撃 ${selected.wind.toFixed(2)} 秒）`;
  slider.value = String(time);
  const url = new URL(location.href);
  url.searchParams.set("case", selected.id);
  url.searchParams.set("t", time.toFixed(2));
  url.searchParams.set("front", front ? "1" : "0");
  url.searchParams.set("view", areaView ? "area" : "pose");
  stateUrl.href = url.toString();
  if (selected.kind === "boss" && selected.form === "worm") {
    enemy.wind = 0;
    enemy.pulseAim =
      time < selected.wind
        ? { x: enemy.tx, y: playerY(), z: enemy.tz }
        : undefined;
    enemy.acidAt = selected.wind;
  } else if (selected.kind === "calyx") {
    enemy.calyx!.fired = time >= selected.wind;
    enemy.wind = 0;
  } else if (selected.kind === "harrow") {
    enemy.wind = 0;
    if (selected.id === "harrow-dive") {
      enemy.harrow!.kind = time < HARROW.glideDuration ? "Glide" : "Dive";
      enemy.harrow!.started =
        time < HARROW.glideDuration ? 0 : HARROW.glideDuration;
    } else enemy.harrow!.fired = time >= selected.wind;
  } else {
    enemy.wind = time < selected.wind ? selected.wind - time : 0;
    const cooldown =
      selected.kind === "ant" || selected.kind === "spider"
        ? 1.2
        : STRUCTURE_TIMING[selected.kind].cooldown;
    enemy.cool =
      time < selected.wind
        ? cooldown
        : Math.max(0, cooldown - (time - selected.wind));
  }
  // The fixture controls time itself; bypass the production frame pacer for exact seeks.
  renderer.render(
    world,
    "viewer",
    0,
    0,
    -0.2,
    undefined,
    true,
    false,
    false,
    false,
  );
  const poseDistance =
    selected.form === "worm"
      ? 45
      : selected.kind === "harrow"
        ? 32
        : selected.kind === "calyx"
          ? 7
          : selected.kind === "boss"
            ? 27
            : selected.kind === "hornet"
              ? 14
              : selected.kind === "crawler"
                ? 12
                : selected.kind === "spider"
                  ? 10
                  : 8;
  const distance = areaView ? Math.max(32, poseDistance * 2.5) : poseDistance;
  renderer.camera.position.set(
    enemy.x + (front ? 0 : distance * 0.7),
    enemy.y + distance * 0.53,
    enemy.z + distance,
  );
  renderer.camera.lookAt(
    enemy.x,
    enemy.y + (selected.kind === "harrow" ? 7 : 2),
    enemy.z,
  );
  renderer.renderer.render(renderer.scene, renderer.camera);
}

function seek(age: number) {
  // Rebuild the clip transition before a discontinuous jump, including impact.
  if (age < time || Math.abs(age - time) > 0.1) {
    renderer.structures.get(selected.kind)?.controller.states.clear();
    renderAt(0);
    if (age > selected.wind) renderAt(selected.wind - 0.01);
  }
  renderAt(age);
  scheduleCapture();
}

function playerY() {
  return world.players[0].y ?? 0;
}

function selectCase(c: Case) {
  selected = c;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-case]",
  ))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.case === selected.id),
    );
  buildWorld();
}

for (const species of [...new Set(cases.map((c) => c.species))]) {
  const button = document.createElement("button");
  button.textContent = species;
  button.onclick = () => {
    selectCase(cases.find((c) => c.species === species)!);
    drawAttacks();
  };
  speciesBox.append(button);
}
function drawAttacks() {
  attacksBox.replaceChildren();
  for (const c of cases.filter((c) => c.species === selected.species)) {
    const button = document.createElement("button");
    button.textContent = c.name;
    button.dataset.case = c.id;
    button.setAttribute("aria-pressed", String(c.id === selected.id));
    button.onclick = () => {
      selectCase(c);
      drawAttacks();
    };
    attacksBox.append(button);
  }
}
document.getElementById("prepare")!.onclick = () => {
  playing = false;
  seek(selected.wind * 0.25);
};
document.getElementById("warning")!.onclick = () => {
  playing = false;
  seek((selected.warningAt ?? selected.wind / 2) + 0.05);
};
document.getElementById("impact")!.onclick = () => {
  playing = false;
  seek(selected.wind + 0.05);
};
playButton.onclick = () => {
  playing = !playing;
  playButton.textContent = playing ? "停止" : "再生";
};
document.getElementById("front")!.onclick = () => {
  front = !front;
  renderAt(time);
  scheduleCapture();
};
document.getElementById("view")!.onclick = () => {
  areaView = !areaView;
  renderAt(time);
  scheduleCapture();
};
document.getElementById("save")!.onclick = () => {
  renderAt(time);
  const name = `anomaly-${selected.id}-${time.toFixed(2).replace(".", "-")}.png`;
  renderer.renderer.domElement.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, "image/png");
};
slider.oninput = () => {
  playing = false;
  playButton.textContent = "再生";
  seek(Number(slider.value));
};
drawAttacks();
selectCase(selected);
seek(Number(initialUrl.searchParams.get("t")) || 0);
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    if (time + dt >= selected.duration) {
      playing = false;
      playButton.textContent = "再生";
    }
    renderAt(time + dt);
  } else renderAt(time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
