import * as T from "three";
import { ARENA_X, ARENA_Z } from "../shared/arena";
import type { Block } from "../shared/defs";
import { groundHeight } from "../shared/terrain";

/** One height texture per active map, using the collision grid's triangle split. */
export class TerrainWarnings {
  private blocks?: Block[];
  private texture = new T.DataTexture(
    new Float32Array((ARENA_X * 2 + 1) * (ARENA_Z * 2 + 1)),
    ARENA_X * 2 + 1,
    ARENA_Z * 2 + 1,
    T.RedFormat,
    T.FloatType,
  );
  constructor() {
    this.texture.minFilter = this.texture.magFilter = T.NearestFilter;
    this.texture.generateMipmaps = false;
  }
  select(blocks: Block[]) {
    if (blocks === this.blocks) return;
    this.blocks = blocks;
    const data = this.texture.image.data as Float32Array;
    let i = 0;
    for (let z = -ARENA_Z; z <= ARENA_Z; z++)
      for (let x = -ARENA_X; x <= ARENA_X; x++)
        data[i++] = groundHeight(x, z, blocks);
    this.texture.needsUpdate = true;
  }
  attach(mesh: T.InstancedMesh) {
    // CPU bounds don't include vertex shader displacement.
    mesh.frustumCulled = false;
    const material = mesh.material as T.MeshBasicMaterial;
    material.depthWrite = false;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.warningTerrain = { value: this.texture };
      shader.vertexShader =
        `uniform sampler2D warningTerrain;
float warningHeight(vec2 p) {
  if (abs(p.x) >= ${ARENA_X}.0 || abs(p.y) >= ${ARENA_Z}.0) return 0.0;
  vec2 grid = p + vec2(${ARENA_X}.0, ${ARENA_Z}.0);
  vec2 cell = floor(grid), f = fract(grid);
  vec2 size = vec2(${ARENA_X * 2 + 1}.0, ${ARENA_Z * 2 + 1}.0);
  float a = texture2D(warningTerrain, (cell + vec2(0.5,0.5))/size).r;
  float b = texture2D(warningTerrain, (cell + vec2(1.5,0.5))/size).r;
  float c = texture2D(warningTerrain, (cell + vec2(0.5,1.5))/size).r;
  float d = texture2D(warningTerrain, (cell + vec2(1.5,1.5))/size).r;
  return f.x + f.y <= 1.0 ? a+(b-a)*f.x+(c-a)*f.y : d+(c-d)*(1.0-f.x)+(b-d)*(1.0-f.y);
}
` +
        shader.vertexShader.replace(
          "#include <project_vertex>",
          `
vec4 warningWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
warningWorld.y += warningHeight(warningWorld.xz);
vec4 mvPosition = viewMatrix * warningWorld;
gl_Position = projectionMatrix * mvPosition;
`,
        );
    };
    material.customProgramCacheKey = () => "terrain-warning-v1";
  }
}
