import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Enemy } from "../shared/game";

// Each species owns its anatomy. Body segments deliberately have no head or limbs.
export function enemyGeometry(kind: Enemy["kind"], segment = false) {
  const pieces: T.BufferGeometry[] = [];
  const shell = {
    ant: 0x9e6550,
    spider: 0x696e91,
    crawler: 0x557984,
    spitter: 0x70866a,
    hornet: 0xc39b48,
    boss: 0x707e89,
  }[kind];
  const dark = 0x182630,
    ivory = 0xb9ccd5,
    energy = 0x65edff;
  function add(
    geo: T.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rx = 0,
    ry = 0,
    rz = 0,
    gait = 0,
    wing = 0,
  ) {
    const matrix = new T.Matrix4().compose(
      new T.Vector3(x, y, z),
      new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)),
      new T.Vector3(sx, sy, sz),
    );
    geo.applyMatrix4(matrix);
    const flat = geo.index ? geo.toNonIndexed() : geo;
    if (flat !== geo) geo.dispose();
    const count = flat.attributes.position.count,
      c = new T.Color(color);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
    flat.setAttribute("color", new T.BufferAttribute(colors, 3));
    flat.setAttribute(
      "reactor",
      new T.BufferAttribute(
        new Float32Array(count).fill(color === energy ? 1 : 0),
        1,
      ),
    );
    flat.setAttribute(
      "legPhase",
      new T.BufferAttribute(new Float32Array(count).fill(gait), 1),
    );
    flat.setAttribute(
      "wingSide",
      new T.BufferAttribute(new Float32Array(count).fill(wing), 1),
    );
    pieces.push(flat);
  }
  function oval(
    c: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    add(new T.IcosahedronGeometry(1, 0), c, x, y, z, sx, sy, sz);
  }
  function plate(
    c: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    gait = 0,
  ) {
    add(new T.BoxGeometry(1, 1, 1), c, x, y, z, sx, sy, sz, 0, 0, 0, gait);
  }
  function ring(
    x: number,
    y: number,
    z: number,
    radius: number,
    horizontal = false,
  ) {
    add(
      new T.TorusGeometry(radius, 0.09, 5, 16),
      energy,
      x,
      y,
      z,
      1,
      1,
      1,
      horizontal ? Math.PI / 2 : 0,
    );
  }
  function strut(a: number[], b: number[], width: number, gait = 0) {
    const delta = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const rotation = new T.Euler().setFromQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.clone().normalize(),
      ),
    );
    add(
      new T.BoxGeometry(1, 1, 1),
      shell,
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
      width,
      delta.length(),
      width,
      rotation.x,
      rotation.y,
      rotation.z,
      gait,
    );
  }
  if (kind === "crawler" || kind === "ant" || kind === "spider") {
    // HOUND: mammalian crouch + wader-like long forelimbs, five legs,
    // no skull, a vertical shoulder ring and disconnected spine plates.
    for (const side of [-1, 1]) {
      plate(shell, side * 0.5, 0.85, 0.1, 0.25, 0.4, 1.5);
      strut([side * 0.5, 1, -0.5], [side * 1.0, 0.75, -1.4], 0.18, side);
      strut([side * 1.0, 0.75, -1.4], [side * 1.1, 0.08, -1.9], 0.14, side);
    }
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.65;
      strut([x, 0.85, 0.65], [x * 1.4, 0.08, 1.3], 0.16, i % 2 ? -1 : 1);
    }
    ring(0, 1.25, -0.6, 0.5);
    for (let i = 0; i < 4; i++)
      plate(ivory, 0, 1.5 + i * 0.06, -0.05 + i * 0.4, 0.65, 0.13, 0.22);
    if (kind === "ant") ring(0, 1.4, 0.9, 0.35);
    if (kind === "spider") plate(energy, 0, 1.9, 0.5, 0.3, 0.1, 0.7);
  } else if (kind === "hornet") {
    // RAY: ray-like plane + three eel-like propulsion tails; central vertical
    // void is built from four rails, not a filled torso. No wings or legs.
    for (const side of [-1, 1]) {
      add(
        new T.OctahedronGeometry(1, 0),
        shell,
        side * 1.05,
        1,
        0,
        0.95,
        0.14,
        1.35,
        0,
        side * 0.2,
        0,
        0,
        side,
      );
      plate(ivory, side * 0.35, 1, 0, 0.12, 0.22, 1.2);
    }
    for (const z of [-0.6, 0.6]) plate(energy, 0, 1, z, 0.65, 0.14, 0.12);
    for (let i = 0; i < 3; i++) {
      strut(
        [(i - 1) * 0.35, 1, 0.8],
        [(i - 1) * 0.7, 0.9, 2.3 + i * 0.16],
        0.065,
      );
      ring((i - 1) * 0.7, 0.9, 2.3 + i * 0.16, 0.13);
    }
  } else if (kind === "spitter") {
    // PRISM: asymmetrical, suspended functional planes, never animal anatomy.
    add(
      new T.OctahedronGeometry(1, 0),
      shell,
      0,
      1.4,
      0,
      0.8,
      1.1,
      0.6,
      0,
      0.4,
      0.3,
    );
    add(
      new T.TetrahedronGeometry(0.7),
      ivory,
      0.8,
      1.7,
      0.2,
      0.8,
      0.7,
      1.1,
      0,
      0.7,
      0,
    );
    plate(dark, -0.65, 1.4, 0, 0.16, 1.8, 0.75);
    ring(0, 1.4, -0.6, 0.35);
  } else {
    // FOUNDRY ZERO: open furnace, rails, offset chimneys and fabrication ring.
    // Legacy articulated sections use the same industrial module, without a mouth.
    for (const side of [-1, 1]) {
      plate(shell, side * 2, 2, 0, 0.7, 2.5, 3.7);
      plate(dark, side * 2, 0.4, 0, 0.9, 0.65, 4.5);
      plate(ivory, side * 2, 3.6, side * 0.7, 0.45, 1.0, 1.2);
      for (const z of [-1.4, 1.4])
        strut([side * 1.8, 2, z], [side * 2.5, 0.1, z], 0.3, side);
    }
    plate(shell, 0, 0.7, 0, 3.4, 0.3, 3.5);
    ring(0, 2.4, 0, 1.5);
    ring(0, 3.7, 0, 1.6, true);
    plate(energy, 0, 2.5, 1.4, 0.5, 0.5, 0.25);
    if (!segment) {
      plate(ivory, -1.2, 3.9, 1.3, 0.5, 1.8, 0.6);
      plate(dark, 1, 3.2, 1.5, 0.6, 1.1, 0.6);
    }
  }
  const result = mergeGeometries(pieces)!;
  pieces.forEach((g) => g.dispose());
  return result;
}

// Preserve the species animation hook while adding emissive reactor surfaces.
export function mechanizeMaterial(material: T.MeshStandardMaterial) {
  material.metalness = 0.65;
  material.roughness = 0.36;
  const animate = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    animate.call(material, shader, renderer);
    shader.vertexShader =
      "attribute float reactor; varying float vReactor;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvReactor = reactor;",
    );
    shader.fragmentShader = "varying float vReactor;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.10, 0.75, 1.0) * vReactor * 1.5;",
    );
  };
  material.customProgramCacheKey = () => `mechanical-${animate.toString()}`;
  return material;
}
