import * as T from "three";
import { StructureMotion } from "../src/client/structure-motion";
const query = new URLSearchParams(location.search);
const scale = Number(query.get("scale") ?? 3),
  version = query.get("version") ?? "lightweight";
const data = await (
  await fetch(
    `/docs/evidence/pleat-wall-acceptance-20261101/slab-${scale}-${version}.json`,
  )
).json();
const scene = new T.Scene();
scene.background = new T.Color(0x091419);
const renderer = new T.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
document.body.append(renderer.domElement);
const camera = new T.PerspectiveCamera(46, innerWidth / innerHeight, 0.05, 100);
camera.position.set(22, 4, 1);
camera.lookAt(0, 2.4, 0);
scene.add(new T.HemisphereLight(0xdcefff, 0x54705c, 2.6));
const light = new T.DirectionalLight(0xffedc7, 3.2);
light.position.set(8, 12, 5);
scene.add(light);
const floor = new T.Mesh(
  new T.PlaneGeometry(32, 32),
  new T.MeshStandardMaterial({
    color: 0x273936,
    roughness: 0.9,
    transparent: true,
    opacity: 0.45,
    side: T.DoubleSide,
  }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const grid = new T.GridHelper(32, 32, 0x99c9b3, 0x3a5750);
grid.position.y = 0.003;
scene.add(grid);
for (const b of data.blocks) {
  const bottom = b.terrainBase ?? 0,
    geometry = new T.BoxGeometry(b.w, b.h - bottom, b.d),
    mesh = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({
        color: bottom ? 0x41595e : 0x3b4c55,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
  mesh.position.set(b.x, (bottom + b.h) / 2, b.z);
  scene.add(mesh);
  const edge = new T.LineSegments(
    new T.EdgesGeometry(geometry),
    new T.LineBasicMaterial({ color: 0x88aaab }),
  );
  edge.position.copy(mesh.position);
  scene.add(edge);
}
const motion = new StructureMotion(scene, 1, "crawler"),
  source = new T.InstancedMesh(
    new T.SphereGeometry(0.1),
    new T.MeshBasicMaterial(),
    1,
  );
source.count = 1;
source.setColorAt(0, new T.Color(0xffffff));
scene.add(source);
const dots = Array.from({ length: 4 }, () => {
  const m = new T.Mesh(
    new T.SphereGeometry(0.08),
    new T.MeshBasicMaterial({ color: 0xff746b, depthTest: false }),
  );
  m.renderOrder = 99;
  scene.add(m);
  return m;
});
await motion.loading;
if (motion.error) throw new Error(motion.error);
function draw(index: number) {
  const s = data.frames[Math.min(index, data.frames.length - 1)];
  source.setMatrixAt(
    0,
    new T.Matrix4().compose(
      new T.Vector3(s.body.x, s.body.y - 0.8 * scale, s.body.z),
      new T.Quaternion(),
      new T.Vector3(scale, scale, scale),
    ),
  );
  motion.setSurroundings(camera.position, data.blocks);
  motion.sync(
    source,
    [
      {
        id: 1,
        slot: 0,
        moving: s.speed > 0.01,
        wind: 0,
        cool: 0,
        distance: s.speed * 0.05,
        pleat: s,
      },
    ],
    0.05,
  );
  let lowest = Infinity;
  [
    [0, -0.78],
    [0.244, -0.434],
    [0.302, 0.687],
    [0.302, 1.478],
  ].forEach(([y, z], i) => {
    const p = new T.Vector3(
      s.body.x + (s.up.x * y - s.poseForward.x * z) * scale,
      s.body.y + (s.up.y * y - s.poseForward.y * z) * scale,
      s.body.z + (s.up.z * y - s.poseForward.z * z) * scale,
    );
    dots[i].position.copy(p);
    lowest = Math.min(lowest, p.y);
  });
  document.querySelector("#title")!.textContent =
    `${version === "before" ? "旧方式（公開基点）" : "軽量版（未公開）"} ／ 大型 ${scale}`;
  document.querySelector("#stats")!.textContent =
    `${s.time.toFixed(2)}秒　後端を含む4点の最低高さ ${lowest.toFixed(2)}m\n半透明：地形　赤点：計測点　地面の高さ：0m`;
  renderer.render(scene, camera);
  return { time: s.time, lowest };
}
Object.assign(window, { review: { draw, length: data.frames.length } });
draw(0);
