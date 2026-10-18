import * as T from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { Renderer } from "../src/client/render";
import {
  encounterCamera,
  harrowEncounterDistance,
} from "../src/client/encounter-camera";
import { VIEW_MAPS } from "../src/client/map-assets";
import { STRUCTURE_ASSETS } from "../src/client/structure-motion";
import {
  ENEMY_MOTION_FILES,
  FOUNDRY_WORM_FILE,
} from "../src/client/enemy-motion-assets";
import {
  createWorld,
  addPlayer,
  spawn,
  type Enemy,
  type World,
} from "../src/shared/game";
import {
  ENEMY_REPORT_NAMES,
  type EnemyReportId,
} from "../src/shared/enemy-identity";
import { ENEMY_REPORT_ORDER } from "../src/shared/enemy-report-order";
import { mapFor, STAGES, TRAINING_MAP } from "../src/shared/stages";
import { BASTION_ASSET } from "../src/client/bastion-view";
import { supportHeight } from "../src/shared/terrain";

type Scene = {
  key: EnemyReportId;
  world: World;
  enemy: Enemy;
  focus: T.Vector3;
  sample: ReturnType<typeof encounterCamera>;
  idle: NonNullable<ReturnType<Renderer["encounterIdle"]>>;
  frozen: string;
  assets: { url: string; sha256: string }[];
  bodyBounds: T.Box3;
};
type CameraChoice = { distance: number; fov: number };

const $ = <TElement extends HTMLElement>(id: string) =>
  document.getElementById(id) as TElement;
const worldCanvas = $<HTMLCanvasElement>("world");
const film = $<HTMLCanvasElement>("film");
const ctx = film.getContext("2d")!;
const kind = $<HTMLSelectElement>("kind");
const distance = $<HTMLInputElement>("distance");
const fov = $<HTMLInputElement>("fov");
const status = $<HTMLElement>("status");
const previewButton = $<HTMLButtonElement>("preview");
const recordButton = $<HTMLButtonElement>("record");
const allButton = $<HTMLButtonElement>("record-all");
const fromButton = $<HTMLButtonElement>("record-from");
const errors: string[] = [];
window.addEventListener("error", (event) => errors.push(event.message));
window.addEventListener("unhandledrejection", (event) =>
  errors.push(String(event.reason)),
);
performance.setResourceTimingBufferSize(500);
const view = new Renderer(worldCanvas);
let scene: Scene | undefined;
let serial = 0;
let busy = false;
let recording = false;
let previewStart = performance.now();
const cameraChoices = new Map<EnemyReportId, CameraChoice>();
const observations: Record<EnemyReportId, string> = {
  crawler:
    "獣の背を思わせる乾いた被覆。その下の支持肢は、外から見える体形と一致しません。",
  ant: "五脚と浮遊する背骨を持つHOUNDの派生個体。地上を回り込みます。",
  spider: "五脚を縮めて跳躍し、壁を足場に再び飛び出します。",
  spitter:
    "浮遊する非対称多面体。離れた間合いを保ち、射線が通る遠い隊員を優先します。",
  boss: "壁・レール・リングからなる移動工場。",
  hornet: "エイのような平面、ウナギを思わせる推進尾と中央の縦穴。",
  worm: "ミミズのようにうねり、多数の脚で地面を這う機械型の巨体。",
  calyx: "灰緑に赤茶の斑が混じる丸い蕾。",
  bastion: "上下の装甲板と回転する帯に覆われた、宙に浮かぶ球体。",
  harrow: "細い後脚で歩き、支柱で組まれた翼を広げて高く飛び上がります。",
};

for (const key of ENEMY_REPORT_ORDER) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = ENEMY_REPORT_NAMES[key];
  kind.append(option);
}

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
const setStatus = (message: string) => {
  status.textContent = message;
};
const selectedKey = () => kind.value as EnemyReportId;
const choiceFor = (key: EnemyReportId, enemy: Enemy): CameraChoice => {
  const defaultDistance =
    key === "harrow"
      ? harrowEncounterDistance(1280 / 720)
      : Math.max(6, (enemy.size ?? 1) * (enemy.kind === "boss" ? 12 : 5)) *
        (enemy.segments ? 1 : 1.35);
  return cameraChoices.get(key) ?? { distance: defaultDistance, fov: 40 };
};
function syncCameraInputs(choice: CameraChoice) {
  distance.value = String(choice.distance);
  fov.value = String(choice.fov);
  $("distance-value").textContent = Number(distance.value).toFixed(1);
  $("fov-value").textContent = `${fov.value}°`;
}
function cameraFor(current: Scene, choice: CameraChoice) {
  const front = view.encounterFront(current.enemy).setY(0).normalize();
  if (front.lengthSq() < 0.5) throw Error("正面方向を取得できません");
  const camera = view.camera.clone();
  camera.position
    .copy(current.focus)
    .addScaledVector(front, choice.distance * 1.45);
  camera.position.y = current.focus.y + choice.distance * 0.08;
  camera.lookAt(current.focus);
  return encounterCamera(
    camera,
    current.focus,
    front,
    choice.distance,
    current.key === "harrow" ? 0 : 0.14,
  );
}
function animatedBodyBounds(enemy: Enemy, idle: Scene["idle"]) {
  const bounds = new T.Box3().makeEmpty();
  if (enemy.kind === "bastion") {
    // 浮遊の上下を含めた外形。待機中はトゲも装甲の開きもない。
    for (const seconds of [0, 1, 2, 3, 4]) {
      idle.update(seconds);
      const box = view.bastion.bounds(enemy.id);
      if (!box) throw Error("BASTIONの現行モデルがありません");
      bounds.union(box);
    }
    idle.update(0);
  } else if (enemy.segments) {
    const worm = view.foundryWorms.get(enemy.id)?.view;
    if (!worm) throw Error("CATENAの現行モデルがありません");
    for (const seconds of [0, 1.5, 3, 4.5, 6]) {
      idle.update(seconds);
      worm.root.updateMatrixWorld(true);
      for (const unit of worm.units)
        bounds.union(new T.Box3().setFromObject(unit, true));
    }
    idle.update(0);
  } else {
    const batch = view.structures.get(enemy.kind)?.batch;
    if (!batch) throw Error(`現行モデルがありません: ${enemy.kind}`);
    const model = cloneSkeleton(batch.asset.model);
    const meshes: T.SkinnedMesh[] = [];
    model.traverse((object) => {
      if (object instanceof T.SkinnedMesh) meshes.push(object);
    });
    const name =
      enemy.kind === "harrow" && enemy.harrowAirborne ? "Flight" : "Idle";
    const clip = batch.asset.clips.find((item) => item.name === name);
    if (!clip || !meshes.length) throw Error(`現行${name}の形状がありません`);
    const instance = new T.Matrix4();
    batch.parts[0].getMatrixAt(0, instance);
    const mixer = new T.AnimationMixer(model);
    mixer.clipAction(clip).play();
    const point = new T.Vector3();
    for (let frame = 0; frame <= 6; frame++) {
      mixer.setTime((clip.duration * frame) / 6);
      model.updateMatrixWorld(true);
      for (const mesh of meshes) {
        const positions = mesh.geometry.getAttribute("position");
        for (let i = 0; i < positions.count; i++) {
          mesh.getVertexPosition(i, point);
          point.applyMatrix4(mesh.matrixWorld).applyMatrix4(instance);
          bounds.expandByPoint(point);
        }
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  }
  if (bounds.isEmpty()) throw Error("会敵形状を測定できません");
  return bounds;
}
function fittedDistance(current: Scene, minimum: number, fov: number) {
  const { min, max } = current.bodyBounds;
  const corners = [min.x, max.x].flatMap((x) =>
    [min.y, max.y].flatMap((y) =>
      [min.z, max.z].map((z) => new T.Vector3(x, y, z)),
    ),
  );
  const fits = (distance: number) => {
    const sample = cameraFor(current, { distance, fov });
    const camera = sample(1);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    return corners.every((corner) => {
      const projected = corner.clone().project(camera);
      const x = (projected.x + 1) * 640;
      const y = (1 - projected.y) * 360;
      return (
        projected.z > 0 &&
        projected.z < 1 &&
        x >= 52 &&
        x <= 1228 &&
        y >= 88 &&
        y <= 608
      );
    });
  };
  let lower = 3;
  let upper = Math.max(minimum, lower);
  for (let attempt = 0; !fits(upper) && attempt < 16; attempt++) {
    lower = upper;
    upper *= 1.25;
  }
  if (!fits(upper) || upper > 300)
    throw Error(`字幕帯を除く画面へ収まりません: ${current.key}`);
  for (let attempt = 0; attempt < 20; attempt++) {
    const middle = (lower + upper) / 2;
    if (fits(middle)) upper = middle;
    else lower = middle;
  }
  return Math.min(300, upper * 1.04);
}
async function loadedAsset(key: EnemyReportId) {
  const file =
    key === "worm"
      ? FOUNDRY_WORM_FILE
      : key === "bastion"
        ? BASTION_ASSET
        : ENEMY_MOTION_FILES[STRUCTURE_ASSETS[key]];
  const expected = new URL(`${import.meta.env.BASE_URL}${file}`, location.href);
  const entry = performance.getEntriesByType("resource").find((item) => {
    const url = new URL(item.name);
    return (
      url.origin === location.origin &&
      url.pathname === expected.pathname &&
      url.search === expected.search
    );
  });
  if (!entry) throw Error(`実ロードGLB URLを確認できません: ${key}`);
  const loaded = new URL(entry.name);
  const url = loaded.pathname + loaded.search;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw Error(`GLB検証 HTTP ${response.status}: ${url}`);
  return {
    url,
    sha256: hex(
      await crypto.subtle.digest("SHA-256", await response.arrayBuffer()),
    ),
  };
}
function firstStage(key: EnemyReportId) {
  const stage = STAGES.find((candidate) =>
    candidate.waves.some((wave) =>
      key === "boss" || key === "worm" || key === "harrow"
        ? wave.bosses.includes(key === "boss" ? "crown" : key)
        : (wave.troops[key] ?? 0) > 0,
    ),
  );
  if (!stage) throw Error(`初登場ステージがありません: ${key}`);
  return stage;
}
async function prepare(key: EnemyReportId) {
  if (recording) throw Error("録画中は対象を切り替えられません");
  recordButton.disabled = allButton.disabled = fromButton.disabled = true;
  kind.disabled = true;
  setStatus(`${ENEMY_REPORT_NAMES[key]} を準備中…`);
  errors.length = 0;
  scene?.idle.restore();
  scene = undefined;
  const stage = firstStage(key);
  const world = createWorld(`current-film-${key}-${++serial}`, 1, stage.id);
  world.phase = "battle";
  world.nextSpawn = 1e9;
  world.spawned = 9999;
  const origin = key === "boss" ? { x: 70, z: -60 } : { x: 0, z: 0 };
  const soldier = addPlayer(world, "film");
  soldier.x = origin.x;
  soldier.z = origin.z + (key === "boss" || key === "worm" ? 58 : 38);
  soldier.y = supportHeight(soldier.x, soldier.z, mapFor(world).blocks);
  const enemy = spawn(
    world,
    key === "worm" ? "boss" : key,
    origin.x,
    origin.z,
    key === "worm" ? "worm" : "crown",
    0,
  );
  if (!enemy) throw Error(`出現に失敗: ${key}`);
  Object.assign(enemy, {
    heading: 0,
    targetId: soldier.id,
    tx: soldier.x,
    tz: soldier.z,
    cool: 999,
    wind: 0,
  });
  const mapIndex = VIEW_MAPS.indexOf(mapFor(world));
  if (mapIndex < 0) throw Error(`描画マップの対応がありません: ${key}`);
  const map = VIEW_MAPS[mapIndex];
  const distantRequired = map !== TRAINING_MAP && map.biome !== "cave";
  const began = performance.now();
  let lastDiagnostic = 0;
  while (true) {
    view.render(
      world,
      soldier.id,
      0,
      0,
      0,
      undefined,
      false,
      false,
      false,
      false,
    );
    const assetReady =
      enemy.kind === "bastion"
        ? view.bastion.placed(enemy.id)
        : enemy.segments
          ? !!view.foundryWorms.get(enemy.id)?.view
          : !!view.structures.get(enemy.kind)?.batch;
    const assetError =
      enemy.kind === "bastion"
        ? view.bastion.error
        : enemy.segments
          ? view.foundryWorms.get(enemy.id)?.error
          : view.structures.get(enemy.kind)?.error;
    const mapState = view.mapAssets.status[mapIndex];
    const distantState = view.mapAssets.distantStatus[mapIndex];
    const diagnostic = () =>
      JSON.stringify({
        kind: key,
        stage: stage.id,
        mapIndex,
        biome: map.biome,
        distantRequired,
        elapsedSeconds: Number(((performance.now() - began) / 1000).toFixed(1)),
        assetReady,
        assetError: assetError || null,
        map: { state: mapState?.state, error: mapState?.error || null },
        distant: {
          state: distantState?.state,
          error: distantState?.error || null,
        },
      });
    if (assetError) throw Error(`現行モデル読込失敗: ${assetError}`);
    if (mapState?.state === "error")
      throw Error(`マップ読込失敗: ${diagnostic()}`);
    if (distantState?.state === "error")
      throw Error(`遠景読込失敗: ${diagnostic()}`);
    if (
      assetReady &&
      mapState?.state === "ready" &&
      (!distantRequired || distantState?.state === "ready")
    )
      break;
    if (performance.now() - began > 90000)
      throw Error(`モデル/マップ読込が90秒で完了しません: ${diagnostic()}`);
    if (performance.now() - lastDiagnostic > 2000) {
      lastDiagnostic = performance.now();
      setStatus(`準備待ち ${diagnostic()}`);
    }
    await nextFrame();
  }
  // The appearance effect finishes before the game state and visual pose freeze.
  for (let i = 0; i < 40; i++)
    view.render(
      world,
      soldier.id,
      0.1,
      0,
      0,
      undefined,
      true,
      false,
      false,
      false,
    );
  for (const actor of view.players.values()) actor.visible = false;
  view.renderer.setPixelRatio(1);
  view.renderer.setSize(1280, 720, false);
  view.camera.aspect = 1280 / 720;
  view.camera.fov = 55;
  view.camera.updateProjectionMatrix();
  const idle = view.encounterIdle(enemy);
  if (!idle) throw Error(`会敵待機モーションがありません: ${key}`);
  const bodyBounds = animatedBodyBounds(enemy, idle);
  const focus = bodyBounds.getCenter(new T.Vector3());
  const current: Scene = {
    key,
    world,
    enemy,
    focus,
    sample: () => view.camera,
    idle,
    frozen: "",
    assets: [],
    bodyBounds,
  };
  const choice = choiceFor(key, enemy);
  if (!cameraChoices.has(key))
    choice.distance = fittedDistance(current, choice.distance, choice.fov);
  cameraChoices.set(key, choice);
  syncCameraInputs(choice);
  current.sample = cameraFor(current, choice);
  const firstPose = current.sample(0);
  view.camera.position.copy(firstPose.position);
  view.camera.quaternion.copy(firstPose.quaternion);
  await view.renderer.compileAsync(view.scene, view.camera);
  current.assets = [await loadedAsset(key)];
  current.frozen = JSON.stringify(world);
  scene = current;
  previewStart = performance.now();
  recordButton.disabled = allButton.disabled = fromButton.disabled = busy;
  kind.disabled = busy;
  setStatus(
    `${ENEMY_REPORT_NAMES[key]} 準備完了｜作戦${stage.id}｜中心${focus
      .toArray()
      .map((value) => value.toFixed(2))
      .join(",")}｜形状${bodyBounds
      .getSize(new T.Vector3())
      .toArray()
      .map((value) => value.toFixed(2))
      .join(
        "×",
      )}｜距離${choice.distance.toFixed(1)}｜${current.assets[0].url}｜収録${key === "harrow" ? 20 : 11}秒`,
  );
}
function renderAt(current: Scene, time: number) {
  const zoom = T.MathUtils.clamp((time - 0.5) / 1.2, 0, 1);
  const smooth = zoom * zoom * (3 - 2 * zoom);
  const pose = current.sample(smooth);
  view.camera.position.copy(pose.position);
  view.camera.quaternion.copy(pose.quaternion);
  const endFov = choiceFor(current.key, current.enemy).fov;
  view.camera.fov = T.MathUtils.lerp(55, endFov, smooth);
  view.camera.updateProjectionMatrix();
  current.idle.update(Math.max(0, time - 1.7));
  view.renderer.render(view.scene, view.camera);
  ctx.drawImage(view.renderer.domElement, 0, 0, 1280, 720);
  const bars = T.MathUtils.clamp((time - 0.18) / 0.32, 0, 1);
  ctx.fillStyle = "#05090d";
  ctx.fillRect(0, 0, 1280, 72 * bars);
  ctx.fillRect(0, 720 - 96 * bars, 1280, 96 * bars);
  if (time >= 1.7) {
    ctx.fillStyle = "#d6eee7";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(ENEMY_REPORT_NAMES[current.key], 52, 53);
    ctx.font = "18px sans-serif";
    ctx.fillText("ANOMALY // FIRST CONTACT", 890, 47);
    ctx.font = "22px sans-serif";
    let line = "";
    let row = 0;
    for (const character of observations[current.key]) {
      if (ctx.measureText(line + character).width > 1170) {
        ctx.fillText(line, 52, 666 + 30 * row++);
        line = "";
      }
      line += character;
    }
    ctx.fillText(line, 52, 666 + 30 * row);
  }
}
function draw(now: number) {
  requestAnimationFrame(draw);
  if (scene && !recording) renderAt(scene, 1.7 + (now - previewStart) / 1000);
}
requestAnimationFrame(draw);

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
type EncodedFrame = { index: number; bytes: Uint8Array };
function ivfVideo(frames: EncodedFrame[], count: number) {
  if (frames.length !== count)
    throw Error(`VP9フレーム数が不正です: ${frames.length}/${count}`);
  const bytes = new ArrayBuffer(
    32 + frames.reduce((size, frame) => size + 12 + frame.bytes.length, 0),
  );
  const view = new DataView(bytes);
  const output = new Uint8Array(bytes);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      output[offset + i] = value.charCodeAt(i);
  };
  ascii(0, "DKIF");
  view.setUint16(4, 0, true);
  view.setUint16(6, 32, true);
  ascii(8, "VP90");
  view.setUint16(12, 1280, true);
  view.setUint16(14, 720, true);
  view.setUint32(16, 30, true);
  view.setUint32(20, 1, true);
  view.setUint32(24, count, true);
  view.setUint32(28, 0, true);
  let offset = 32;
  frames.forEach((frame, index) => {
    if (frame.index !== index)
      throw Error(`VP9フレーム順序が不正です: ${frame.index}/${index}`);
    view.setUint32(offset, frame.bytes.length, true);
    view.setBigUint64(offset + 4, BigInt(index), true);
    offset += 12;
    output.set(frame.bytes, offset);
    offset += frame.bytes.length;
  });
  return bytes;
}

async function record(key: EnemyReportId) {
  if (!scene || scene.key !== key) await prepare(key);
  const current = scene!;
  if (JSON.stringify(current.world) !== current.frozen)
    throw Error(`収録前にWorldが変化しました: ${key}`);
  if (typeof VideoEncoder === "undefined")
    throw Error("WebCodecs VideoEncoderに対応していません");
  const duration = key === "harrow" ? 20 : 11;
  const frameCount = duration * 30;
  const config: VideoEncoderConfig = {
    codec: "vp09.00.10.08",
    width: 1280,
    height: 720,
    framerate: 30,
    bitrate: 8_000_000,
    latencyMode: "quality",
  };
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) throw Error("WebCodecs VP9に対応していません");
  const frames: EncodedFrame[] = [];
  let encodingError: Error | undefined;
  const encoder = new VideoEncoder({
    output(chunk) {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      frames.push({
        index: Math.round((chunk.timestamp * 30) / 1_000_000),
        bytes,
      });
    },
    error(error) {
      encodingError = error;
    },
  });
  recording = true;
  try {
    encoder.configure(support.config ?? config);
    current.idle.update(0);
    for (let i = 0; i < frameCount; i++) {
      if (encodingError) throw encodingError;
      while (encoder.encodeQueueSize > 4) {
        await yieldTask();
        if (encodingError) throw encodingError;
      }
      renderAt(current, i / 30);
      const timestamp = Math.round((i * 1_000_000) / 30);
      const nextTimestamp = Math.round(((i + 1) * 1_000_000) / 30);
      const frame = new VideoFrame(film, {
        timestamp,
        duration: nextTimestamp - timestamp,
      });
      try {
        encoder.encode(frame, { keyFrame: i % 30 === 0 });
      } finally {
        frame.close();
      }
      if (i % 15 === 0 || i === frameCount - 1)
        setStatus(
          `${ENEMY_REPORT_NAMES[key]} 収録中｜${i + 1}/${frameCount}フレーム｜${((i + 1) / 30).toFixed(1)}/${duration}秒`,
        );
      await yieldTask();
    }
    await encoder.flush();
    if (encodingError) throw encodingError;
    const body = new Blob([ivfVideo(frames, frameCount)], {
      type: "video/x-ivf",
    });
    const metadata = {
      kind: key,
      name: ENEMY_REPORT_NAMES[key],
      assets: current.assets,
      worldFrozen: JSON.stringify(current.world) === current.frozen,
      errors: [...errors],
      duration,
      capture: "webcodecs-vp9-frames",
      frameCount,
      stage: current.world.stage,
      camera: choiceFor(key, current.enemy),
    };
    if (!metadata.worldFrozen || metadata.errors.length)
      throw Error(`収録検証失敗: ${key}`);
    const response = await fetch("/__current-film", {
      method: "POST",
      headers: {
        "X-Encounter-Key": key,
        "X-Encounter-Metadata": encodeURIComponent(JSON.stringify(metadata)),
      },
      body,
    });
    if (!response.ok)
      throw Error(
        `受信側 HTTP ${response.status}: ${key}: ${await response.text()}`,
      );
    setStatus(`${ENEMY_REPORT_NAMES[key]} 保存完了｜${body.size} bytes`);
  } finally {
    encoder.close();
    recording = false;
  }
}
function updatePreview() {
  if (!scene || recording) return;
  cameraChoices.set(scene.key, {
    distance: Number(distance.value),
    fov: Number(fov.value),
  });
  syncCameraInputs(cameraChoices.get(scene.key)!);
  scene.sample = cameraFor(scene, cameraChoices.get(scene.key)!);
  previewStart = performance.now();
}
distance.oninput = updatePreview;
fov.oninput = updatePreview;
previewButton.onclick = updatePreview;
kind.onchange = () => {
  if (busy) return;
  void prepare(selectedKey()).catch((error) => {
    kind.disabled = false;
    setStatus(String(error));
  });
};
recordButton.onclick = () => {
  if (busy) return;
  busy = true;
  recordButton.disabled = allButton.disabled = fromButton.disabled = true;
  kind.disabled =
    distance.disabled =
    fov.disabled =
    previewButton.disabled =
      true;
  void record(selectedKey())
    .catch((error) => setStatus(String(error)))
    .finally(() => {
      busy = false;
      recordButton.disabled = allButton.disabled = fromButton.disabled = !scene;
      kind.disabled =
        distance.disabled =
        fov.disabled =
        previewButton.disabled =
          false;
    });
};
function recordSequence(startIndex: number) {
  if (busy) return;
  if (startIndex < 0 || startIndex >= ENEMY_REPORT_ORDER.length)
    throw Error("収録開始位置が不正です");
  busy = true;
  recordButton.disabled = allButton.disabled = fromButton.disabled = true;
  kind.disabled =
    distance.disabled =
    fov.disabled =
    previewButton.disabled =
      true;
  void (async () => {
    for (const key of ENEMY_REPORT_ORDER.slice(startIndex)) {
      kind.value = key;
      await prepare(key);
      setStatus(`${ENEMY_REPORT_NAMES[key]} を収録中…`);
      await record(key);
    }
    setStatus(
      `${ENEMY_REPORT_ORDER.length - startIndex}種の収録と保存が完了しました`,
    );
  })()
    .catch((error) => setStatus(String(error)))
    .finally(() => {
      busy = false;
      recordButton.disabled = allButton.disabled = fromButton.disabled = !scene;
      kind.disabled =
        distance.disabled =
        fov.disabled =
        previewButton.disabled =
          false;
    });
}
allButton.onclick = () => recordSequence(0);
fromButton.onclick = () =>
  recordSequence(ENEMY_REPORT_ORDER.indexOf(selectedKey()));
void prepare(ENEMY_REPORT_ORDER[0]).catch((error) => {
  kind.disabled = false;
  setStatus(String(error));
});
