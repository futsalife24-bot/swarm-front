import * as T from "three";
import { weaponTier } from "../shared/progression";
import type { Weapon } from "../shared/defs";

const COLORS = [0x92aaa6, 0x83d8b0, 0x7cbdf4, 0xd5a4f4, 0xffd472];

/** Weld extrusion directions across hard-normal/UV seams, only on the owned shell. */
export function outlineGeometry(source: T.BufferGeometry) {
  const geometry = source.clone();
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const groups = new Map<string, { indices: number[]; normal: T.Vector3 }>();
  for (let i = 0; i < positions.count; i++) {
    const key = `${positions.getX(i)},${positions.getY(i)},${positions.getZ(i)}`;
    let group = groups.get(key);
    if (!group) {
      group = { indices: [], normal: new T.Vector3() };
      groups.set(key, group);
    }
    group.indices.push(i);
    group.normal.add(new T.Vector3().fromBufferAttribute(normals, i));
  }
  for (const { indices, normal } of groups.values()) {
    if (normal.lengthSq() < 1e-12)
      normal.fromBufferAttribute(normals, indices[0]);
    normal.normalize();
    for (const i of indices) normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return geometry;
}

/** Per-equipped-weapon outline; authored geometry/materials remain shared and untouched. */
export class WeaponRarityGlow {
  private material: T.ShaderMaterial;
  private shells: T.Mesh[] = [];

  constructor(root: T.Object3D, weapon: Weapon) {
    this.material = new T.ShaderMaterial({
      uniforms: {
        glowColor: { value: new T.Color(COLORS[weaponTier(weapon)]) },
        strength: { value: 0.65 },
      },
      vertexShader: `
        void main() {
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          // World-sized shell keeps distant weapons from becoming bright blobs.
          p.xyz += n * 0.018;
          gl_Position = projectionMatrix * p;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float strength;
        void main() {
          gl_FragColor = vec4(glowColor, strength);
          #include <colorspace_fragment>
        }
      `,
      side: T.BackSide,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    const meshes: T.Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof T.Mesh) meshes.push(o);
    });
    for (const mesh of meshes) {
      const shell = new T.Mesh(outlineGeometry(mesh.geometry), this.material);
      shell.name = "WeaponRarityGlow";
      shell.raycast = () => {};
      mesh.add(shell);
      this.shells.push(shell);
    }
  }

  update(seconds: number) {
    // Four-second breathing cycle, always visible even at its dimmest.
    this.material.uniforms.strength.value =
      0.65 + 0.3 * Math.sin((seconds * Math.PI) / 2);
  }

  dispose() {
    for (const shell of this.shells) {
      shell.removeFromParent();
      shell.geometry.dispose();
    }
    this.shells.length = 0;
    this.material.dispose();
  }
}
