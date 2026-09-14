import * as T from "three";

// Authored surface relief in world metres. No displacement, added geometry,
// additional render pass, or photographic assets. See docs/MAP-REALISM.md.
let noiseTexture: T.DataTexture | undefined;
function texture() {
  if (noiseTexture) return noiseTexture;
  const data = new Uint8Array(128 * 128 * 4);
  let seed = 8713;
  for (let i = 0; i < data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = data[i + 1] = data[i + 2] = seed >>> 24;
    data[i + 3] = 255;
  }
  noiseTexture = new T.DataTexture(data, 128, 128);
  noiseTexture.wrapS = noiseTexture.wrapT = T.RepeatWrapping;
  noiseTexture.magFilter = T.LinearFilter;
  noiseTexture.minFilter = T.LinearMipmapLinearFilter;
  noiseTexture.generateMipmaps = true;
  noiseTexture.needsUpdate = true;
  return noiseTexture;
}

function surface(name: string, index: number) {
  if (/snow/.test(name))
    return `
float wind = p.x * 1.3 + p.z * 0.53 + 2.8 * broad + 0.5 * medium;
float ripple = sin(wind * 5.0 + sin(wind * 1.4)) * smoothstep(0.35,0.9,weights.y);
float crust = smoothstep(0.42, 0.72, medium);
relief = ripple * 0.016 * detailFade + grain * 0.003;
surfaceTint = mix(vec3(0.89,0.95,1.0),vec3(1.045,1.025,0.99),broad);
surfaceTint *= 0.97 + 0.045 * ripple * detailFade;
surfaceRough = mix(0.92,0.58,crust);
`;
  if (/meadow|foliage/.test(name))
    return `
float dry = smoothstep(0.42,0.69,broad * 0.65 + medium * 0.35);
float clump = smoothstep(0.34,0.65,medium);
float blades = noiseAt(p.xz * vec2(20.0,3.2) + medium);
surfaceTint = mix(vec3(0.72,0.90,0.68),vec3(1.39,1.16,0.76),dry);
surfaceTint *= 0.86 + 0.26 * clump + (blades-0.5)*0.22*detailFade;
relief = (medium*0.035 + blades*0.012) * detailFade;
surfaceRough = 0.94;
`;
  if (/limestone|granite/.test(name))
    return `
float bedding = p.y * ${/limestone/.test(name) ? "7.0" : "3.1"} + p.x * 0.16 + p.z * 0.12 + medium * 2.8 + broad * 3.0;
float layer = sin(bedding);
float seam = 1.0 - smoothstep(0.035,0.16,abs(sin(bedding*0.5)));
float mineral = smoothstep(0.57,0.78,noiseAt(plane*0.65 + vec2(0.0,p.y*0.07)));
surfaceTint = mix(vec3(0.77,0.81,0.83),vec3(1.22,1.15,1.02),broad);
surfaceTint *= 0.96 + 0.105*layer - 0.22*seam*detailFade;
surfaceTint = mix(surfaceTint,vec3(1.3,1.22,1.05),mineral*0.28);
relief = (layer * 0.019 - seam * 0.018 + grain * 0.008) * detailFade;
surfaceRough = ${index === 5 ? "mix(0.9,0.48,mineral)" : "0.91"};
`;
  if (/concrete|facade/.test(name))
    return `
vec2 panel = vec2(plane.x / 3.0, p.y / 1.5);
vec2 edge = abs(fract(panel+0.5)-0.5);
vec2 aa = max(fwidth(panel),vec2(0.0001));
vec2 joint = 1.0-smoothstep(vec2(0.004),vec2(0.004)+aa*1.5,edge);
float seam = max(joint.x,joint.y)*wall;
float streak = smoothstep(0.43,0.74,noiseAt(vec2(plane.x*3.7,p.y*0.055)));
float damp = (1.0-smoothstep(0.0,2.3,p.y))*wall;
surfaceTint = mix(vec3(0.90,0.91,0.89),vec3(1.12,1.09,1.02),broad);
surfaceTint *= 1.0 - streak*wall*${index === 2 ? "0.27" : "0.20"} - damp*0.17 - seam*0.18;
relief = (grain*0.006-seam*0.008)*detailFade;
surfaceRough = mix(0.88,0.74,damp);
`;
  if (/steel|metal/.test(name))
    return `
float streak = noiseAt(vec2(plane.x*2.3,p.y*0.12));
float oxide = smoothstep(${/oxidized/.test(name) ? "0.25,0.58" : "0.57,0.77"},medium*0.45+streak*0.55);
float seam = 1.0-smoothstep(0.005,0.025+fwidth(plane.x)*0.8,abs(fract(plane.x/1.2+0.5)-0.5));
surfaceTint = mix(vec3(0.88,0.98,1.03),vec3(1.10,0.53,0.23),oxide);
surfaceTint *= 0.9+0.16*broad-seam*0.13*wall;
relief = (grain*0.003 + oxide*0.005-seam*wall*0.006)*detailFade;
surfaceRough = mix(0.44,0.94,oxide);
surfaceMetal = 1.0-oxide*0.92;
`;
  if (/asphalt|paint/.test(name))
    return `
float aggregate = smoothstep(0.48,0.7,grain);
float fracture = abs(sin(p.x*0.37+p.z*0.19+medium*4.0+broad*7.0));
float crack = (1.0-smoothstep(0.006,0.026+fwidth(fracture),fracture))*smoothstep(0.48,0.66,broad);
surfaceTint = mix(vec3(0.83,0.86,0.88),vec3(1.16,1.12,1.02),broad);
surfaceTint *= 1.0 + (aggregate-0.4)*0.16*detailFade-crack*0.28;
relief = (aggregate*0.004-crack*0.009)*detailFade;
surfaceRough = mix(0.79,0.96,medium);
`;
  if (/bark/.test(name))
    return `
float furrow = sin(plane.x*32.0+medium*5.0);
surfaceTint=vec3(0.93,0.89,0.82)*(0.92+medium*0.2+furrow*0.1*detailFade);
relief=(furrow*0.009+grain*0.004)*detailFade;
surfaceRough=0.96;
`;
  return `
surfaceTint=mix(vec3(0.80,0.83,0.84),vec3(1.13,1.07,0.93),medium);
relief=(grain*0.009+medium*0.012)*detailFade;
surfaceRough=${index === 5 ? "mix(0.9,0.57,smoothstep(0.52,0.75,broad))" : "0.94"};
`;
}

export function weatherMapMaterials(
  scene: T.Object3D,
  index = 0,
  detailed = true,
) {
  const seen = new Set<T.Material>();
  scene.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!(mat instanceof T.MeshStandardMaterial) || seen.has(mat)) continue;
      seen.add(mat);
      if (/glass|lamps|mineral/.test(mat.name)) continue;
      const design = surface(mat.name, index);
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.mapNoise = { value: texture() };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vMapWorld;",
          )
          .replace(
            "#include <project_vertex>",
            `#include <project_vertex>
vec4 surfacePosition = vec4(transformed,1.0);
#ifdef USE_BATCHING
surfacePosition = batchingMatrix * surfacePosition;
#endif
#ifdef USE_INSTANCING
surfacePosition = instanceMatrix * surfacePosition;
#endif
vMapWorld = (modelMatrix * surfacePosition).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
varying vec3 vMapWorld;
uniform sampler2D mapNoise;
float noiseAt(vec2 p) {
  vec2 f=fract(p);
  return texture2D(mapNoise,(floor(p)+f*f*(3.0-2.0*f)+0.5)/128.0).r;
}

`,
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
vec3 p = vMapWorld;
vec3 face = normalize(cross(dFdx(p),dFdy(p)));
vec3 weights = abs(face);
float wall = 1.0-smoothstep(0.45,0.85,weights.y);
vec2 plane = weights.x > weights.z ? p.zy : p.xy;
vec2 surfaceUv = mix(p.xz,plane,wall);
float broad = noiseAt(surfaceUv*0.13);
float medium = noiseAt(surfaceUv*1.8);
float grain = noiseAt(surfaceUv*38.0);
float detailFade = ${detailed ? "1.0-smoothstep(0.03,0.23,length(fwidth(p)))" : "0.0"};
vec3 surfaceTint=vec3(1.0);
float relief=0.0, surfaceRough=0.85, surfaceMetal=1.0;
${design}
diffuseColor.rgb *= surfaceTint;
`,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>
roughnessFactor = clamp(mix(roughnessFactor,surfaceRough,0.8),0.28,1.0);`,
          )
          .replace(
            "#include <metalnessmap_fragment>",
            `#include <metalnessmap_fragment>
metalnessFactor *= surfaceMetal;`,
          )
          .replace(
            "#include <normal_fragment_maps>",
            `#include <normal_fragment_maps>
${
  detailed
    ? `// Screen-space surface gradient adds relief without changing silhouette or collision.
vec3 dpdx=dFdx(-vViewPosition), dpdy=dFdy(-vViewPosition);
vec3 r1=cross(dpdy,normal), r2=cross(normal,dpdx);
float det=dot(dpdx,r1);
vec3 grad=sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2);
normal=normalize(abs(det)*normal-grad);`
    : ""
}
`,
          );
      };
      mat.customProgramCacheKey = () =>
        `map-surfaces-v1-${mat.name}-${index}-${detailed}`;
      mat.needsUpdate = true;
    }
  });
}

/** Smooth shallow snow/grass facets using only existing normals. Sharp rock
 * edges, positions, UVs and the authoritative walkable surface remain intact. */
export function softenNaturalNormals(scene: T.Object3D) {
  scene.traverse((o) => {
    if (
      !(o instanceof T.Mesh) ||
      !/^(granular_snow|meadow_ground)$/.test(o.name)
    )
      return;
    const p = o.geometry.getAttribute("position"),
      n = o.geometry.getAttribute("normal");
    const old = Float32Array.from(n.array);
    const groups = new Map<string, number[]>();
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < 0.5) continue;
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      const group = groups.get(key);
      if (group) group.push(i);
      else groups.set(key, [i]);
    }
    for (const group of groups.values())
      for (const i of group) {
        const a = new T.Vector3(old[i * 3], old[i * 3 + 1], old[i * 3 + 2]),
          sum = new T.Vector3();
        for (const j of group) {
          const b = new T.Vector3(old[j * 3], old[j * 3 + 1], old[j * 3 + 2]);
          if (a.dot(b) > 0.55) sum.add(b);
        }
        if (sum.lengthSq() > 0) {
          sum.normalize();
          n.setXYZ(i, sum.x, sum.y, sum.z);
        }
      }
    n.needsUpdate = true;
  });
}
