import * as T from "three";

export const SOLDIER_ACCENTS = ["#5dbccc", "#ef8b39", "#b278db", "#a5c85a"] as const;

/** Change the uniform's authored cyan paint; preserve fabric and white markings. */
export function soldierAccent(material: T.MeshStandardMaterial) {
  const uniform = { value: new T.Color(SOLDIER_ACCENTS[0]) };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.playerAccent = uniform;
    shader.fragmentShader = "uniform vec3 playerAccent;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      float paint = smoothstep(0.025, 0.085, min(diffuseColor.g, diffuseColor.b) - diffuseColor.r);
      float brightness = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      float targetBrightness = max(dot(playerAccent, vec3(0.2126, 0.7152, 0.0722)), 0.01);
      diffuseColor.rgb = mix(diffuseColor.rgb, playerAccent * brightness / targetBrightness, paint);`,
    );
  };
  material.customProgramCacheKey = () => "swarm-player-accent-v1";
  return (index: number) => uniform.value.set(SOLDIER_ACCENTS[((index % 4) + 4) % 4]);
}
