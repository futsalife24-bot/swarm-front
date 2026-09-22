import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { enemyGeometry } from "./enemy-model";
import type { Enemy } from "../shared/game";
import { HARROW, harrowMissilePosition } from "../shared/harrow";
import { loadEnemyMotion, HoundMotionBatch } from "./hound-motion";
import { STRUCTURE_ASSETS } from "./structure-motion";
import type { StructureVisualKind } from "./structure-motion";
import { FoundryWormView, FOUNDRY_WORM_ASSET } from "./foundry-worm";
import {
  ReportEffects,
  reportPose,
  reportWorm,
  reportHarrowMissiles,
  type ReportMotion,
} from "./enemy-report-motion";

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
  let generation = 0,
    disposed = false,
    motion: HoundMotionBatch | undefined;
  let foundry: FoundryWormView | undefined;
  let foundryIdle: ReturnType<FoundryWormView["inspectionIdle"]> | undefined;
  let wormForm = false;
  let kind: Enemy["kind"] = "crawler";
  let mode: ReportMotion = "idle",
    time = 0,
    last = 0;
  const effects = new ReportEffects();
  scene.add(effects.root);
  const transform = new T.Matrix4();
  const restBounds = new T.Box3();
  function fitSpecimen() {
    const bounds = restBounds.clone();
    if (kind === "harrow" && mode === "attack") {
      bounds.union(
        restBounds
          .clone()
          .translate(new T.Vector3(0, HARROW.flightHeight / HARROW.scale, 0)),
      );
      for (const missile of reportHarrowMissiles()) {
        for (let step = 0; step <= 20; step++) {
          const p = harrowMissilePosition(
            missile,
            missile.launch + ((missile.impact - missile.launch) * step) / 20,
          );
          bounds.expandByPoint(
            new T.Vector3(p.x, p.y, p.z).multiplyScalar(1 / HARROW.scale),
          );
        }
      }
    }
    model.position.copy(bounds.getCenter(new T.Vector3()).negate());
    radius =
      bounds.getBoundingSphere(new T.Sphere()).radius *
      (kind === "harrow" ? 1.25 : 1);
  }
  function animatePose() {
    if (motion) {
      const pose = reportPose(kind, mode, time);
      motion.setPose(0, pose.clip, pose.sample);
      motion.setTransform(0, transform.makeTranslation(0, pose.height, 0));
      motion.finish(1);
    }
    if (foundry) {
      if (mode === "idle") {
        if (!foundryIdle) {
          foundry.update(reportWorm("idle", 0), 0);
          foundryIdle = foundry.inspectionIdle();
        }
        foundryIdle.update(time);
      } else {
        foundryIdle?.restore();
        foundryIdle = undefined;
        const snapshot = reportWorm(mode, time);
        foundry.update(snapshot, time);
      }
      foundry.root.position.z = mode === "move" ? time * 4.2 : 0;
    }
    effects.root.position.copy(model.position);
    effects.update(kind, wormForm, mode, time);
  }
  renderer.setAnimationLoop((now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (disposed || document.hidden) return;
    time += dt;
    animatePose();
    render();
  });
  const halfSize = new T.Vector3();
  function reset() {
    let distance =
      (radius /
        Math.sin(T.MathUtils.degToRad(19)) /
        Math.min(1, camera.aspect)) *
      1.12;
    if (wormForm) {
      // Fit the long body's projected corners from the head side.
      const direction = new T.Vector3(1, 0.58, -0.9).normalize();
      const right = new T.Vector3(direction.z, 0, -direction.x).normalize();
      const up = direction.clone().cross(right);
      const vertical = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      distance = 0;
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          for (const z of [-1, 1]) {
            const corner = new T.Vector3(
              x * halfSize.x,
              y * halfSize.y,
              z * halfSize.z,
            );
            const fit = Math.max(
              Math.abs(corner.dot(right)) / (vertical * camera.aspect),
              Math.abs(corner.dot(up)) / vertical,
            );
            distance = Math.max(distance, corner.dot(direction) + fit * 1.12);
          }
      camera.position.copy(direction).multiplyScalar(distance);
    } else
      camera.position.set(distance * 0.65, distance * 0.4, -distance * 0.65);
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
    foundryIdle = undefined;
    foundry?.dispose();
    foundry = undefined;
    motion?.dispose();
    motion = undefined;
    for (const child of [...model.children]) {
      if (child instanceof T.Mesh) child.geometry.dispose();
      model.remove(child);
    }
  }
  return {
    show(selectedKind: Enemy["kind"], worm = false) {
      kind = selectedKind;
      mode = "idle";
      time = 0;
      host.dataset.motion = mode;
      host.dataset.asset = "loading";
      effects.root.children.forEach((o) => (o.visible = false));
      const ticket = ++generation;
      wormForm = worm;
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
      bounds.getSize(halfSize).multiplyScalar(0.5);
      reset();
      if (worm)
        void FoundryWormView.load(FOUNDRY_WORM_ASSET)
          .then((view) => {
            if (disposed || ticket !== generation) {
              view.dispose();
              return;
            }
            clear();
            model.position.set(0, 0, 0);
            foundry = view;
            model.add(view.root);
            // BatchedMesh also retains packed geometry in unposed coordinates.
            // Fit only the visible source primitives in their actual rest pose.
            const bounds = new T.Box3();
            const primitiveBounds = new T.Box3();
            view.root.updateWorldMatrix(true, true);
            view.root.traverseVisible((object) => {
              if (
                !(object instanceof T.Mesh) ||
                object instanceof T.BatchedMesh
              )
                return;
              if (!object.geometry.boundingBox)
                object.geometry.computeBoundingBox();
              primitiveBounds
                .copy(object.geometry.boundingBox!)
                .applyMatrix4(object.matrixWorld);
              bounds.union(primitiveBounds);
            });
            model.position.copy(bounds.getCenter(new T.Vector3()).negate());
            radius = bounds.getBoundingSphere(new T.Sphere()).radius;
            bounds.getSize(halfSize).multiplyScalar(0.5);
            host.dataset.asset = "ready";
            animatePose();
            reset();
          })
          .catch(() => {
            if (ticket === generation) host.dataset.asset = "error";
          });
      if (!worm && kind in STRUCTURE_ASSETS)
        void loadEnemyMotion(
          STRUCTURE_ASSETS[kind as StructureVisualKind],
          kind === "spider",
        )
          .then((asset) => {
            if (disposed || ticket !== generation) return;
            clear();
            model.position.set(0, 0, 0);
            motion = new HoundMotionBatch(asset, 1);
            motion.setPose(0, "Idle", 0);
            motion.setTransform(0, new T.Matrix4());
            motion.finish(1);
            model.add(motion.group);
            const bounds = new T.Box3().setFromObject(asset.model);
            restBounds.copy(bounds);
            fitSpecimen();
            host.dataset.asset = "ready";
            animatePose();
            reset();
          })
          .catch(() => {
            if (ticket === generation) host.dataset.asset = "error";
          });
    },
    play(next: ReportMotion) {
      mode = next;
      time = 0;
      last = 0;
      host.dataset.motion = mode;
      if (foundry) foundry.root.position.z = 0;
      if (kind === "harrow" && motion) {
        fitSpecimen();
        reset();
      }
      animatePose();
      render();
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
      disposed = true;
      ++generation;
      renderer.setAnimationLoop(null);
      resize.disconnect();
      controls.dispose();
      clear();
      effects.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
