import * as T from "three";
import { loadEnemyMotion, type HoundClip } from "../src/client/hound-motion";
import { TRS_PALETTE_GLSL } from "../src/client/motion-trs";
import { StructureMotionController } from "../src/client/structure-motion";

async function check() {
  const asset = await loadEnemyMotion("calyx"),
    data = asset.trsAtlas!.image.data as Float32Array;
  const renderer = new T.WebGLRenderer(),
    scene = new T.Scene(),
    camera = new T.Camera();
  const target = new T.WebGLRenderTarget(asset.bones * 4, 1, {
    type: T.FloatType,
    depthBuffer: false,
  });
  const uniforms = {
    houndParents: { value: asset.trsParents },
    houndInverseBind: { value: asset.trsInverseBind },
    houndSkinPrefix: { value: asset.trsPrefix },
    houndPalette: { value: asset.trsAtlas },
    houndPaletteSize: {
      value: new T.Vector2(asset.bones * 4, asset.atlas.image.height),
    },
    houndPoseA: { value: new T.Vector3() },
    houndPoseB: { value: new T.Vector3() },
    houndBlend: { value: 0.5 },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `precision highp float;
uniform sampler2D houndPalette;uniform vec2 houndPaletteSize;uniform vec3 houndPoseA;uniform vec3 houndPoseB;uniform float houndBlend;
${TRS_PALETTE_GLSL}
void main(){float pixel=floor(gl_FragCoord.x);mat4 m=houndMatrix(floor(pixel/4.0));int col=int(mod(pixel,4.0));gl_FragColor=m[col];}`,
  });
  scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), material));
  const pose = (clip: HoundClip, time: number) => {
    const r = asset.ranges[clip],
      f = Math.min(r.steps, time * 60),
      a = Math.floor(f);
    return new T.Vector3(
      r.start + a,
      r.start + Math.min(r.steps, a + 1),
      f - a,
    );
  };
  const mixer = new T.AnimationMixer(asset.model),
    skeleton = asset.meshes[0].skeleton;
  const offset = new T.Matrix4();
  const pixels = new Float32Array(asset.bones * 16);
  let cases = 0,
    maxError = 0,
    minDet = Infinity,
    maxDet = -Infinity;
  for (const clip of ["Idle", "Slam", "PollenShot"] as HoundClip[])
    for (let phase = 0; phase < 6; phase += 0.1)
      for (const blend of [0.25, 0.5, 0.75]) {
        uniforms.houndPoseA.value.copy(pose("Locomotion", phase));
        uniforms.houndPoseB.value.copy(pose(clip, 0.35 * blend));
        uniforms.houndBlend.value = blend;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(
          target,
          0,
          0,
          asset.bones * 4,
          1,
          pixels,
        );
        mixer.stopAllAction();
        const a = mixer
            .clipAction(asset.clips.find((c) => c.name === "Locomotion")!)
            .reset()
            .play(),
          b = mixer
            .clipAction(asset.clips.find((c) => c.name === clip)!)
            .reset()
            .play();
        a.time = phase;
        a.setEffectiveWeight(1 - blend);
        b.time = 0.35 * blend;
        b.setEffectiveWeight(blend);
        mixer.update(0);
        asset.model.updateMatrixWorld(true);
        skeleton.update();
        for (let bone = 0; bone < asset.bones; bone++) {
          offset.fromArray(skeleton.boneMatrices!, bone * 16);
          const expected = asset.meshes[0].matrixWorld
              .clone()
              .multiply(asset.meshes[0].bindMatrixInverse)
              .multiply(offset)
              .multiply(asset.meshes[0].bindMatrix),
            actual = new T.Matrix4().fromArray(pixels, bone * 16),
            det = actual.determinant();
          minDet = Math.min(minDet, det);
          maxDet = Math.max(maxDet, det);
          expected.elements.forEach(
            (v, j) =>
              (maxError = Math.max(maxError, Math.abs(v - actual.elements[j]))),
          );
        }
        cases++;
      }
  let continuousFrames = 0,
    maxFrameAngle = 0;
  const drawRotations = () => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, asset.bones * 4, 1, pixels);
    return Array.from({ length: asset.bones }, (_, i) =>
      new T.Quaternion()
        .setFromRotationMatrix(new T.Matrix4().fromArray(pixels, i * 16))
        .normalize(),
    );
  };
  for (const clip of ["Idle", "Slam", "PollenShot"] as const) {
    const controller = new StructureMotionController("calyx"),
      input = {
        slot: 0,
        id: 1,
        moving: true,
        distance: 0.65 / 60,
        wind: 0,
        cool: 0,
      };
    for (let frame = 0; frame < 170; frame++)
      controller.update({ setPose() {} }, [input], 1 / 60);
    uniforms.houndPoseB.value.copy(pose("Locomotion", 170 / 60));
    uniforms.houndBlend.value = 1;
    let prior = drawRotations();
    for (let frame = 1; frame <= 21; frame++) {
      controller.update(
        {
          setPose(_slot, to, time, from, fromTime, blend) {
            uniforms.houndPoseA.value.copy(pose(from!, fromTime!));
            uniforms.houndPoseB.value.copy(pose(to, time));
            uniforms.houndBlend.value = Math.min(1, blend!);
          },
        },
        [
          {
            ...input,
            moving: false,
            distance: 0,
            worldTime: frame / 60,
            calyx:
              clip === "Idle"
                ? undefined
                : { kind: clip, started: 0, fired: false, yaw: 0 },
          },
        ],
        1 / 60,
      );
      const current = drawRotations();
      current.forEach(
        (q, i) =>
          (maxFrameAngle = Math.max(maxFrameAngle, prior[i].angleTo(q))),
      );
      prior = current;
      continuousFrames++;
    }
  }
  const pass =
    Number.isFinite(maxError) &&
    maxError < 0.0001 &&
    minDet > 0.999 &&
    maxDet < 1.001 &&
    maxFrameAngle < 0.35;
  document.querySelector("#result")!.textContent = JSON.stringify(
    {
      pass,
      cases,
      bones: asset.bones,
      maxError,
      minDet,
      maxDet,
      continuousFrames,
      maxFrameAngle,
      method:
        "Actual WebGL local-TRS shader vs independent standard Three.js AnimationMixer including bone hierarchy and inverse bind; locomotion phases across full turn to Idle/Slam/PollenShot, 25/50/75% blends",
    },
    null,
    2,
  );
  target.dispose();
  material.dispose();
  renderer.dispose();
}
check().catch(
  (e) => (document.querySelector("#result")!.textContent = String(e)),
);
