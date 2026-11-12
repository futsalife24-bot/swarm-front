export function applyWear(root, kind) {
  if (kind !== 'heavy') return 0;
  if (!window.__envProbe) throw Error('existing trooper environment missing');
  const seen = new Set();
  root.traverse(o => {
    if (!o.isMesh || /WeaponNeon/.test(o.name)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m?.isMeshStandardMaterial || !/Metal|Ceramic/.test(m.name) || seen.has(m)) continue;
      seen.add(m);
      m.envMap = window.__envProbe;
      m.envMapIntensity = 0.35;
      m.userData.wearLab = true;
      m.needsUpdate = true;
    }
  });
  return seen.size;
}
window.__wearApply = applyWear;
