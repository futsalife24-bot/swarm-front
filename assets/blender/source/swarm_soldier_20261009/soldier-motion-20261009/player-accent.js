import * as T from 'three';
export const PLAYER_ACCENTS = [
 {label:'1P · シアン', color:'#5dbccc'},
 {label:'2P · オレンジ', color:'#ef8b39'},
 {label:'3P · パープル', color:'#b278db'},
 {label:'4P · ライム', color:'#a5c85a'},
];
// Recolor only the existing cyan paint, preserving fabric and white markings.
export function installPlayerAccent(root, player=0) {
 const uniform={value:new T.Color(PLAYER_ACCENTS[player].color)};
 root.traverse(o=>{
  if(!o.isMesh||o.name!=='Body')return;
  o.material=o.material.clone();
  o.material.onBeforeCompile=shader=>{
   shader.uniforms.playerAccent=uniform;
   shader.fragmentShader='uniform vec3 playerAccent;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float paint = smoothstep(0.025, 0.085, min(diffuseColor.g, diffuseColor.b) - diffuseColor.r);
    float brightness = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float targetBrightness = max(dot(playerAccent, vec3(0.2126, 0.7152, 0.0722)), 0.01);
    diffuseColor.rgb = mix(diffuseColor.rgb, playerAccent * brightness / targetBrightness, paint);
   `);
  };
  o.material.customProgramCacheKey=()=> 'swarm-player-accent-v1';
 });
 return player=>uniform.value.set(PLAYER_ACCENTS[player].color);
}
