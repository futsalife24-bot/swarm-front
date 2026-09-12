import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { enemyGeometry } from "./enemy-model";
import type { Enemy } from "../shared/game";
import {loadEnemyMotion,HoundMotionBatch} from './hound-motion';
import {STRUCTURE_ASSETS} from './structure-motion';
import type {StructureVisualKind} from './structure-motion';

export function createEnemyViewer(host: HTMLElement) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.setAttribute(
    "aria-label",
    "敵の3Dモデル。ドラッグで回転、ピンチで拡大縮小",
  );
  host.append(renderer.domElement);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xdcefff, 0x566577, 2.6));
  const light = new T.DirectionalLight(0xffffff, 3);
  light.position.set(4, 8, 6);
  scene.add(light);
  const camera = new T.PerspectiveCamera(38, 1, 0.01, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.55,
    roughness: 0.5,
  });
  const model = new T.Group();
  scene.add(model);
  const render = () => renderer.render(scene, camera);
  controls.addEventListener("change", render);
  let radius = 1;
  let generation=0,disposed=false,motion:HoundMotionBatch|undefined;
  function reset() {
    const distance =
      (radius /
        Math.sin(T.MathUtils.degToRad(19)) /
        Math.min(1, camera.aspect)) *
      1.12;
    camera.position.set(distance * 0.65, distance * 0.4, distance * 0.65);
    controls.target.set(0, 0, 0);
    controls.minDistance = radius * 1.2;
    controls.maxDistance = distance * 3;
    camera.far = Math.max(500, distance * 5);
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    reset();
  });
  resize.observe(host);
  function clear() {
    motion?.dispose();motion=undefined;
    for (const child of [...model.children]) {
      (child as T.Mesh).geometry.dispose();
      model.remove(child);
    }
  }
  return {
    show(kind: Enemy["kind"], worm = false) {
      const ticket=++generation;
      clear();
      model.position.set(0, 0, 0);
      model.add(new T.Mesh(enemyGeometry(kind), material));
      if (worm)
        for (let i = 0; i < 7; i++) {
          const segment = new T.Mesh(enemyGeometry("boss", true), material);
          segment.position.z = (i + 1) * 3.4;
          segment.scale.set(0.92, 0.95, 0.92);
          model.add(segment);
        }
      const bounds = new T.Box3().setFromObject(model);
      model.position.copy(bounds.getCenter(new T.Vector3()).negate());
      radius = bounds.getBoundingSphere(new T.Sphere()).radius;
      reset();
      if(!worm&&kind in STRUCTURE_ASSETS)void loadEnemyMotion(STRUCTURE_ASSETS[kind as StructureVisualKind]).then(asset=>{
        if(disposed||ticket!==generation)return;
        clear();model.position.set(0,0,0);motion=new HoundMotionBatch(asset,1);motion.setPose(0,'Idle',0);motion.setTransform(0,new T.Matrix4());motion.finish(1);model.add(motion.group);
        const bounds=new T.Box3().setFromObject(asset.model);model.position.copy(bounds.getCenter(new T.Vector3()).negate());radius=bounds.getBoundingSphere(new T.Sphere()).radius;reset();
      }).catch(()=>{/* Keep the already-visible fallback. */});
    },
    reset,
    rotate(direction: number) {
      camera.position.applyAxisAngle(
        new T.Vector3(0, 1, 0),
        (direction * Math.PI) / 8,
      );
      controls.update();
    },
    dispose() {
      disposed=true;++generation;
      resize.disconnect();
      controls.dispose();
      clear();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
