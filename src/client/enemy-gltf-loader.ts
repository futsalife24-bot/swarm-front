import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/**
 * Enemy GLBs store geometry and animation with lossless EXT_meshopt_compression
 * (scripts/optimize-enemy-glb.mjs). Every loader of those files must decode it.
 */
export function enemyGltfLoader(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
