// Compare complete generated GLBs across rarity, allowing only inlay RGB to differ.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const kinds=['smg','slug','heavy','sniper','laser','grenade','sticky','kick','medic'];
const root='design/weapon-models-20261111/out';
const available=process.argv.includes('--available');
const rows=[],missing=[],errors=[];

function parse(data) {
  assert.equal(data.toString('ascii',0,4),'glTF');
  assert.equal(data.readUInt32LE(4),2);
  assert.equal(data.readUInt32LE(8),data.length);
  const length=data.readUInt32LE(12);
  assert.equal(data.toString('ascii',16,20),'JSON');
  const gltf=JSON.parse(data.toString('utf8',20,20+length));
  const inlays=gltf.materials.filter(m=>m.name==='Rarity identification');
  assert.equal(inlays.length,1,'識別材質は1つ');
  const factor=inlays[0].pbrMetallicRoughness.baseColorFactor;
  assert.equal(factor.length,4);
  const color=factor.slice(0,3);
  factor.splice(0,3,0,0,0); // Keep alpha and all other material properties.
  return {gltf,color,binary:data.subarray(20+length)};
}

function equivalent(base,candidate) {
  return JSON.stringify(base.gltf)===JSON.stringify(candidate.gltf) && base.binary.equals(candidate.binary);
}

for (const kind of kinds) {
  try {
    const files=[];
    for (let grade=0;grade<5;grade++) files.push(await fs.readFile(path.join(root,kind,`${kind}_${grade}.glb`)));
    const grades=files.map(parse);
    const same=grades.every(g=>equivalent(grades[0],g));
    const colors=grades.map(g=>g.color);
    const distinct=new Set(colors.map(c=>JSON.stringify(c))).size===5;
    rows.push({kind,sameExceptInlayRGB:same,distinctInlayColors:distinct,colors});
    if(!same||!distinct) errors.push(`${kind}: レア度差が識別色だけではないか識別色が重複`);
  } catch(e) {
    if(e.code==='ENOENT') missing.push(kind);
    else errors.push(`${kind}: ${String(e)}`);
  }
}
// Negative controls: these must be detected even though the inlay color is untouched.
if(rows.length) {
  const first=rows[0].kind;
  const data=await fs.readFile(path.join(root,first,`${first}_0.glb`));
  const base=parse(data), changedMaterial=parse(data), changedBinary=parse(Buffer.from(data));
  const other=changedMaterial.gltf.materials.find(m=>m.name!=='Rarity identification');
  assert.ok(other);
  other.doubleSided=!other.doubleSided;
  changedBinary.binary[changedBinary.binary.length-1]^=1;
  assert.equal(equivalent(base,changedMaterial),false,'材質の変更を検出');
  assert.equal(equivalent(base,changedBinary),false,'頂点などのバイナリ変更を検出');
}
const report={scope:'Generated GLB JSON and binary across five rarities; only the RGB of the single Rarity identification material may differ. Neon is generated separately in product code.',rows,missing,errors,negativeControls:rows.length?['other material','binary byte']:[]};
await fs.mkdir('dist-validation/weapon-rarity-invariants',{recursive:true});
await fs.writeFile('dist-validation/weapon-rarity-invariants/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({kinds:rows.length,missing,errors,negativeControls:report.negativeControls}));
if(errors.length || !rows.length || (missing.length&&!available)) process.exitCode=1;
