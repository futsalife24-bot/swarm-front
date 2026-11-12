export function applyWear(root, kind) {
  if (kind !== 'heavy') return 0;
  const seen = new Set();
  root.traverse(o => {
    if (!o.isMesh || /WeaponNeon/.test(o.name)) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      if (!m.isMeshStandardMaterial || m.name === 'Rarity identification' || m.name === 'Glow heat' || (m.emissive && m.emissive.getHex() !== 0)) continue;
      if (!['Metal steel', 'Metal gunmetal', 'Paint rust orange'].includes(m.name) || m.userData.wearLab) continue;
      m.userData.wearLab = true;
      m.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 vWearLabPos;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWearLabPos = position;');
        shader.fragmentShader = 'varying vec3 vWearLabPos;\nfloat wlHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\nfloat wlNoise(vec3 p){vec3 a=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(wlHash(a),wlHash(a+vec3(1.,0.,0.)),f.x),mix(wlHash(a+vec3(0.,1.,0.)),wlHash(a+vec3(1.,1.,0.)),f.x),f.y),mix(mix(wlHash(a+vec3(0.,0.,1.)),wlHash(a+vec3(1.,0.,1.)),f.x),mix(wlHash(a+vec3(0.,1.,1.)),wlHash(a+vec3(1.,1.,1.)),f.x),f.y),f.z);}\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat wlCoarse=wlNoise(vWearLabPos*65.0);\nfloat wlFine=wlNoise(vWearLabPos*220.0);\nfloat wlMark=smoothstep(0.70,0.82,wlFine)*smoothstep(0.42,0.68,wlCoarse);\ndiffuseColor.rgb *= clamp(0.92+0.11*wlCoarse-0.09*wlMark,0.82,1.03);');
        shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.93 + 0.14*wlCoarse), 0.0, 1.0);');
        window.__wearCompiled = (window.__wearCompiled || 0) + 1;
      };
      m.customProgramCacheKey = () => 'weapon-wear-lab-v1';
      m.needsUpdate = true;
    }
  });
  return [...seen].filter(m => m.userData.wearLab).length;
}
window.__wearApply = applyWear;
