import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { WEAPONS, stats } from "../shared/defs";
import {
  GRADES,
  VARIANCE_KEYS,
  varianceMark,
  varianceClass,
  weaponStatVariance,
  type NewWeapon,
  type StoredWeapon,
  weaponGrade,
} from "../shared/progression";
async function sceneFor(w: StoredWeapon, width: number, height: number) {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height);
  renderer.setClearColor(0x11232f);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(35, width / height, 0.001, 100);
  scene.add(new T.HemisphereLight(0xe7f4ff, 0x39494e, 3));
  const light = new T.DirectionalLight(0xffffff, 4);
  light.position.set(2, 4, 3);
  scene.add(light);
  try {
    const gltf = await new GLTFLoader().loadAsync(
      `${import.meta.env.BASE_URL}assets/weapons/realism-v2/${w.kind}_${w.rarity}.glb`,
    );
    const box = new T.Box3().setFromObject(gltf.scene),
      center = box.getCenter(new T.Vector3()),
      size = box.getSize(new T.Vector3());
    gltf.scene.position.sub(center);
    scene.add(gltf.scene);
    const direction = new T.Vector3(1, 0.45, 0.65).normalize();
    camera.position.copy(direction);
    camera.lookAt(0, 0, 0);
    const inverse = camera.quaternion.clone().invert(),
      tanY = Math.tan(T.MathUtils.degToRad(camera.fov / 2)),
      tanX = tanY * camera.aspect;
    let distance = 0;
    for (const x of [-0.5, 0.5])
      for (const y of [-0.5, 0.5])
        for (const z of [-0.5, 0.5]) {
          const corner = new T.Vector3(
            size.x * x,
            size.y * y,
            size.z * z,
          ).applyQuaternion(inverse);
          distance = Math.max(
            distance,
            corner.z + Math.abs(corner.x) / tanX,
            corner.z + Math.abs(corner.y) / tanY,
          );
        }
    camera.position.copy(direction.multiplyScalar(distance * 1.15));
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    return {
      renderer,
      scene,
      camera,
      dispose: () => {
        scene.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.geometry.dispose();
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(
              (m) => m.dispose(),
            );
          }
        });
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  } catch (e) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw e;
  }
}
export async function previewWeapon(host: HTMLElement, w: StoredWeapon) {
  const v = await sceneFor(w, Math.max(300, host.clientWidth), 170);
  if (!host.isConnected) {
    v.dispose();
    return () => {};
  }
  host.append(v.renderer.domElement);
  v.renderer.domElement.style.width = "100%";
  return v.dispose;
}
export async function weaponImage(w: StoredWeapon) {
  const v = await sceneFor(w, 1200, 420),
    canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 720;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#11232f";
  c.fillRect(0, 0, 1200, 720);
  c.drawImage(v.renderer.domElement, 0, 70);
  v.dispose();
  c.fillStyle = "#fff";
  c.font = "bold 34px sans-serif";
  c.fillText(`${WEAPONS[w.kind].name} / ${weaponGrade(w)}`, 40, 52);
  c.font = "20px sans-serif";
  c.fillText("SWARM FRONT", 950, 52);
  if (w.testData) {
    c.fillStyle = "#ffb667";
    c.fillText("TEST DATA", 40, 95);
  }
  const d = stats(w),
    values = {
      power: d.damage.toFixed(0),
      reload: d.reload.toFixed(2) + " 秒",
      range: d.range.toFixed(1) + " m",
      rate: (1 / d.interval).toFixed(2) + " 発/秒",
    },
    labels = { power: "威力", reload: "装填", range: "射程", rate: "連射" };
  VARIANCE_KEYS.forEach((key, i) => {
    const y = 470 + i * 50,
      n = weaponStatVariance(w, key);
    c.fillStyle = "#c5d7e4";
    c.fillText(labels[key], 60, y);
    const markColor = {
      low: "#89d6f2",
      base: "#fff",
      good: "#f5dc66",
      great: "#ffa348",
      max: "#fa6852",
    }[varianceClass(n)];
    const value = `${values[key]}  (${w.format === 2 ? "" : "約"}${n >= 0 ? "+" : ""}${Number(n.toFixed(3))}%)`;
    c.fillStyle = "#fff";
    c.fillText(value, 300, y);
    const x = 307 + c.measureText(value).width;
    c.fillStyle = markColor;
    c.save();
    c.font = n === 20 ? "20px sans-serif" : "12px sans-serif";
    const marks = varianceMark(n).split("\n");
    marks.forEach((mark, index) =>
      c.fillText(mark, x, y - (marks.length === 2 ? 8 : 2) + index * 9),
    );
    c.restore();
  });
  c.fillStyle = "#fff";
  const magazineText = `装弾 ${d.mag} 発${w.format === 2 ? "（固定）" : ""}`;
  c.fillText(magazineText, 720, 470);
  const magazineMarkX = 727 + c.measureText(magazineText).width;
  const magVariance = weaponStatVariance(w, "mag");
  c.fillStyle = {
    low: "#89d6f2",
    base: "#fff",
    good: "#f5dc66",
    great: "#ffa348",
    max: "#fa6852",
  }[varianceClass(magVariance)];
  c.font = magVariance === 20 ? "20px sans-serif" : "12px sans-serif";
  varianceMark(magVariance)
    .split("\n")
    .forEach((mark, i) => c.fillText(mark, magazineMarkX, 468 + i * 9));
  c.fillStyle = "#c5d7e4";
  c.font = "18px sans-serif";
  c.fillText(
    "印：同武器種・同レア標準比（装填は速度換算・特殊効果を除く）／ ★ +20%",
    40,
    700,
  );
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("共有画像を作成できません"))),
      "image/png",
    ),
  );
}
export async function shareImage(w: StoredWeapon) {
  const blob = await weaponImage(w),
    file = new File([blob], `swarm-front-${w.id}.png`, { type: "image/png" }),
    // Canonical deployment recorded in README.md; local preview URLs must not escape into posts.
    url = new URL(
      import.meta.env.VITE_PUBLIC_GAME_URL ||
        "https://swarm-front.melosalife-24.workers.dev/",
    );
  url.search = "?playtest=1";
  const text = `${WEAPONS[w.kind].name} / ${weaponGrade(w)} — SWARM FRONT${w.testData ? " [TEST DATA]" : ""}\n${url}`;
  const dialog = document.createElement("dialog");
  dialog.className = "menu-dialog";
  const objectURL = URL.createObjectURL(blob);
  dialog.innerHTML =
    '<header><h2>共有画像</h2><button id="share-close">閉じる</button></header><div class="menu-dialog-body"><img alt="武器の共有画像" style="width:100%;max-width:650px"><p>投稿先を選んだ後、最後の投稿はご自身で行ってください。</p><button id="share-native">画像を共有</button><a id="share-download">画像を保存</a><button id="share-copy">投稿文をコピー</button><textarea readonly style="width:100%"></textarea></div>';
  dialog.querySelector("img")!.src = objectURL;
  (dialog.querySelector("#share-download") as HTMLAnchorElement).href =
    objectURL;
  (dialog.querySelector("#share-download") as HTMLAnchorElement).download =
    file.name;
  dialog.querySelector("textarea")!.value = text;
  const native = dialog.querySelector<HTMLButtonElement>("#share-native")!;
  native.disabled = !navigator.canShare?.({ files: [file] });
  native.onclick = () =>
    void navigator.share({ files: [file], text }).catch(() => {});
  dialog.querySelector<HTMLButtonElement>("#share-copy")!.onclick = () =>
    void navigator.clipboard
      .writeText(text)
      .catch(() => dialog.querySelector("textarea")!.select());
  dialog.querySelector<HTMLButtonElement>("#share-close")!.onclick = () =>
    dialog.close();
  dialog.addEventListener("close", () => {
    URL.revokeObjectURL(objectURL);
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
}
