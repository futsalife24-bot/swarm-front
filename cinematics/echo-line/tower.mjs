import * as THREE from 'three';

const TAU = Math.PI * 2;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const Y = v(0, 1, 0);
const Z = v(0, 0, 1);
const bone = 0xc7b99b, pale = 0xe2d5b4, graphite = 0x344744;
const iron = 0x535e54, black = 0x253737, oxide = 0x95523b, red = 0xb46847;
const brass = 0xa99065, concrete = 0x8b8d7d;

function weatheredMetal() {
  const size = 256, pixels = new Uint8Array(size * size * 4);
  let seed = 27073;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  const grit = Array.from({length: 1024}, random);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const w = Math.sin(TAU * y / size);
      const grain = grit[(x * 13 + Math.floor(2 * w) + 1024) % 1024];
      const stain = Math.max(0, grain - 0.72) * (28 + 19 * w);
      const scuff = random() > 0.984 ? 22 : 0;
      const n = 219 + random() * 34 - stain - scuff + 4 * Math.cos(TAU * (3 * x + y) / size);
      const i = (y * size + x) * 4;
      pixels[i] = Math.min(255, n + stain * 0.19);
      pixels[i + 1] = n;
      pixels[i + 2] = n - stain * 0.26;
      pixels[i + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({map, vertexColors: true, roughness: 0.82,
    metalness: 0.18, side: THREE.DoubleSide});
}

// Coalesce the hundreds of individually fabricated parts that share a moving frame.
class Fabrication {
  constructor() {
    this.p = []; this.n = []; this.c = []; this.uv = [];
    this.cache = new Map();
  }
  triangle(a, b, c, tint) {
    if (!this.cache.has(tint)) this.cache.set(tint, new THREE.Color(tint));
    const color = this.cache.get(tint);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const ax = Math.abs(normal.x), ay = Math.abs(normal.y), az = Math.abs(normal.z);
    for (const p of [a, b, c]) {
      this.p.push(p.x, p.y, p.z);
      this.n.push(normal.x, normal.y, normal.z);
      this.c.push(color.r, color.g, color.b);
      this.uv.push((ax > az && ax > ay ? p.z : p.x) * 0.43, (ay > az && ay > ax ? -p.z : p.y) * 0.43);
    }
  }
  quad(a, b, c, d, tint) {
    this.triangle(a, b, d, tint);
    this.triangle(b, c, d, tint);
  }
  rod(a, b, r, color, sides = 7, top = r, phase = 0) {
    const dir = b.clone().sub(a).normalize();
    const u = dir.clone().cross(Math.abs(dir.y) > 0.9 ? Z : Y).normalize();
    const w = dir.clone().cross(u);
    const offset = (i) => u.clone().multiplyScalar(Math.cos(i * TAU / sides + phase))
      .addScaledVector(w, Math.sin(i * TAU / sides + phase));
    let prev = offset(0);
    for (let i = 1; i <= sides; i++) {
      const next = offset(i), p = a.clone().addScaledVector(prev, r), q = a.clone().addScaledVector(next, r);
      const s = b.clone().addScaledVector(prev, top), t = b.clone().addScaledVector(next, top);
      this.quad(p, q, t, s, color);
      this.triangle(a, q, p, color);
      this.triangle(b, s, t, color);
      prev = next;
    }
  }
  block(x, y, z, width, height, depth, color) {
    const a = [], s = [width, height, depth].map(n => n * 0.5);
    for (const dz of [-1, 1]) for (const dy of [-1, 1]) for (const dx of [-1, 1]) {
      a.push(v(x + dx * s[0], y + dy * s[1], z + dz * s[2]));
    }
    for (const [i,j,k,l] of [[0,2,3,1],[4,5,7,6],[0,4,6,2],[1,3,7,5],[2,6,7,3],[0,1,5,4]]) {
      this.quad(a[i], a[j], a[k], a[l], color);
    }
  }
  cable(a, b, sag, r, color, spans = 9) {
    let p = a;
    for (let i = 1; i <= spans; i++) {
      const t = i / spans, q = a.clone().lerp(b, t);
      q.y -= 4 * sag * t * (1 - t);
      this.rod(p, q, r, color, 5);
      p = q;
    }
  }
  mesh(parent, material, name) {
    const geom = new THREE.BufferGeometry();
    for (const [key, arr, len] of [['position',this.p,3],['normal',this.n,3],['color',this.c,3],['uv',this.uv,2]]) {
      geom.setAttribute(key, new THREE.Float32BufferAttribute(arr, len));
    }
    geom.computeBoundingSphere();
    const mesh = new THREE.Mesh(geom, material);
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  }
}

function makePedestal(f, lamps) {
  const disc = (low, high, lower, upper, color, sides = 12) => f.rod(v(0,low,0),v(0,high,0),lower,color,sides,upper,Math.PI / sides);
  disc(-0.32,0.34,4.7,4.55,concrete);
  disc(0.34,0.54,4.25,4.18,black);
  disc(0.54,0.72,4.16,3.94,concrete);
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12, c = Math.cos(a), s = Math.sin(a);
    f.rod(v(c*3.87,0.71,s*3.87),v(c*3.87,0.78,s*3.87),0.085,graphite,6);
  }
  for (const x of [-1,1]) for (const z of [-1,1]) {
    const foot = v(x*2.42,0.68,z*1.85), knee = v(x*1.29,5.6,z*0.91);
    f.block(foot.x,0.89,foot.z,1.24,0.48,1.13,graphite);
    f.block(foot.x,1.14,foot.z,1.09,0.11,1.03,oxide);
    f.rod(foot,knee,0.53,oxide,4,0.30,Math.PI / 4);
    f.rod(v(foot.x+x*0.22,1.24,foot.z+z*0.15),v(knee.x+x*0.15,5.5,knee.z+z*0.1),0.21,bone,4,0.15);
    f.rod(knee,v(x*1.92,10.68,-0.59+z*0.38),0.30,iron,4,0.49,Math.PI/4);
    f.rod(v(x*1.37,6.1,z*0.87),v(x*1.9,10.70,-0.5+z*0.48),0.16,pale,4,0.27);
    f.rod(v(x*2.28,1.45,z*1.68),v(-x*1.42,4.68,z*1.03),0.10,iron,4);
    f.rod(v(x*1.42,4.68,z*1.03),v(x*2.28,1.45,-z*1.68),0.09,iron,4);
  }
  disc(3.50,3.75,1.48,1.56,black);
  disc(3.75,5.50,1.40,1.14,iron);
  disc(5.50,5.74,1.49,1.50,oxide,24);
  disc(5.74,6.05,1.25,1.25,graphite,24);
  for (let i = 0; i < 18; i++) {
    const a = i * TAU / 18;
    f.rod(v(Math.cos(a)*1.35,3.83,Math.sin(a)*1.35),v(Math.cos(a)*1.13,5.46,Math.sin(a)*1.13),0.062,brass,5);
  }
  // Exposed drive, oil seals, crown gear and central elevation bearing.
  const axle = (x1, x2, y, z, radius, color, sides=32) => f.rod(v(x1,y,z),v(x2,y,z),radius,color,sides);
  axle(-2.2,2.2,10.36,-0.53,0.72,graphite);
  for (const side of [-1,1]) {
    axle(side*1.79,side*2.22,10.36,-0.53,0.83,oxide);
    axle(side*2.22,side*2.26,10.36,-0.53,0.61,bone);
    axle(side*2.26,side*2.32,10.36,-0.53,0.37,black);
    for (let i=0;i<10;i++) {
      const a=i*TAU/10;
      axle(side*2.25,side*2.30,10.36+Math.cos(a)*0.52,-0.53+Math.sin(a)*0.52,0.055,brass,6);
    }
  }
  axle(-2.33,-0.95,4.24,1.44,0.61,black);
  for (let i=0;i<8;i++) axle(-2.21+i*0.14,-2.16+i*0.14,4.24,1.44,0.67,iron);
  axle(-2.42,-2.22,4.24,1.44,0.83,oxide);
  axle(-2.49,-2.42,4.24,1.44,0.46,graphite);
  for (let i=0;i<22;i++) {
    const a=i*TAU/22, dy=Math.cos(a), dz=Math.sin(a);
    f.rod(v(-2.32,4.24+dy*0.79,1.44+dz*0.79),v(-2.32,4.24+dy*0.91,1.44+dz*0.91),0.094,brass,4);
  }
  // A service gallery with a ladder opening, and the stepped entry on the front.
  for (let i=0;i<3;i++) f.block(0.72,0.12+0.14*i,4.88-0.43*i,1.73,0.26+0.27*i,0.49,concrete);
  f.block(0,2.13,1.54,3.80,0.20,1.24,graphite);
  for (const x of [-1.76,-0.85,1.78]) {
    f.rod(v(x,2.2,2.10),v(x,3.01,2.10),0.040,oxide);
  }
  for(const y of [2.56,2.99]) f.rod(v(-1.78,y,2.10),v(-0.84,y,2.10),0.036,brass);
  for (const x of [-0.48,0.02]) f.rod(v(x,0.68,2.26),v(x,2.88,2.26),0.046,graphite);
  for (let i=0;i<7;i++) f.rod(v(-0.48,0.78+i*0.29,2.26),v(0.02,0.78+i*0.29,2.26),0.034,brass);
  f.block(1.03,2.92,1.77,1.02,1.37,0.60,graphite);
  f.block(1.03,2.98,2.09,0.91,1.02,0.063,bone);
  for (let i=0;i<5;i++) {
    f.block(0.78+i*.113,3.29,2.14,.087,.068,.025,black);
    lamps.block(0.78+i*.113,3.29,2.16,.059,.033,.022,0xffce88);
  }
  for (let i=0;i<6;i++) f.block(1.02,2.72+i*0.066,2.14,0.66,0.029,0.026,iron);
  for (let i=0;i<3;i++) {
    f.cable(v(-1.96+i*.11,4.40,1.46),v(-1.51+i*.12,9.61,-0.2),0.8,0.036,black);
    f.cable(v(-1.91+i*.13,4.12,1.87),v(0.64+i*.16,2.26,1.77),1.18,0.033,black);
  }
}

const bladeCount = 10;
const hinge = 1.16;
const radii = [8.94,8.59,9.12,8.77,8.94,8.64,8.78,9.12,8.53,8.96];
const plates = [bone,0xc3b599,0xd5c6a7,0xb8a88e,0xdbceb2,0xbfb09a,0xcbbc9e];

function makePetal(f, sector) {
  const tip = radii[sector];
  const surf = (t, s, offset = 0) => {
    const bevel = 0.77*Math.abs(s)**2 + 0.17*s + (sector%3 === 0 ? 0.39*Math.max(0,s) : 0);
    const r = hinge + (tip - bevel - hinge)*t, angle = s * (0.247 + 0.050*Math.sin(t*2.13));
    return v(r*Math.cos(angle)-hinge,r*Math.sin(angle),0.039*r*r + offset);
  };
  // Curved lattice girders remain visible through lost reflector tiles.
  for (const s of [-1,0,1]) {
    for(let i=0; i<8; i++) {
      const t0=i/8, t1=(i+1)/8, mid=(t0+t1)/2;
      const dep=0.20+0.56*Math.sin(Math.PI*mid);
      f.rod(surf(t0,s,-.035),surf(t1,s,-.035),s===0?.065:.084,oxide,5);
      f.rod(surf(t0,s,-dep),surf(t1,s,-dep),.062,graphite,5);
      f.rod(surf(t0,s,-dep),surf(t1,s,-.035),.035,red,4);
      if(i%2===0) f.rod(surf(t0,s,-0.04),surf(t0,s,-dep),.046,iron,4);
    }
  }
  for(let i=1; i<=7; i++) {
    const t=i/7;
    for(const s of [-1,0]) f.rod(surf(t,s,-.10),surf(t,s+1,-.10),.051,iron,5);
  }
  const rows = 5, cols = 4;
  for (let r=0; r<rows; r++) for (let c=0; c<cols; c++) {
    const t0=r/rows+.0024, t1=(r+1)/rows-.0024, s0=-1+c*2/cols+.008, s1=-1+(c+1)*2/cols-.008;
    const stripped = (sector===4 && (r>=3 || c===2 && r>0)) ||
      (sector===8 && (r===4 && c<3 || r===3 && c===0)) || (sector===0 && r===4 && c===3);
    if (stripped) {
      // Paired diagonals in the screening change direction at each bay.
      for(let i=0;i<4;i++) {
        const a=t0+(t1-t0)*i/4, b=t0+(t1-t0)*(i+1)/4;
        f.rod(surf(a,s0,-.06),surf(b,s1,-.06),.018,iron,4);
        f.rod(surf(a,s1,-.065),surf(b,s0,-.065),.013,brass,4);
      }
      continue;
    }
    const tint=plates[(sector*3+r*11+c*5)%plates.length];
    for(let i=0;i<2;i++) for(let j=0;j<2;j++) {
      const a=t0+(t1-t0)*i/2, b=t0+(t1-t0)*(i+1)/2;
      const l=s0+(s1-s0)*j/2, h=s0+(s1-s0)*(j+1)/2;
      f.quad(surf(a,l),surf(b,l),surf(b,h),surf(a,h),tint);
    }
    if (r===rows-1) f.quad(surf(t1,s0),surf(t1,s0,-.13),surf(t1,s1,-.13),surf(t1,s1),brass);
    for(const s of [s0+.025,s1-.025]) {
      const head=surf(t1-.011,s);
      f.rod(head,head.clone().addScaledVector(Z,.022),r<2?.030:.047,iron,6);
    }
    if ((c===0 || c===3) && r===2 && sector%3!==0) {
      f.quad(surf(t0+.018,s0,.009),surf(t0+.040,s0,.009),surf(t0+.040,s1,.009),surf(t0+.018,s1,.009),red);
    }
    const serial=sector*41+r*17+c*7;
    if (r>1 && serial%3!==0) {
      const end=s0+.12+(serial%19)*.009;
      f.triangle(surf(t1-.004,end,.006),surf(t1-.040-(serial%4)*.011,end,.006),
        surf(t1-.009,end+.021,.006),0xa68c71);
    }
    if (sector===6 && r===3 && c===2) {
      f.quad(surf(t0+.06,s0+.07,.022),surf(t0+.14,s0+.06,.022),
        surf(t0+.13,s1-.03,.022),surf(t0+.05,s1-.02,.022),0x869088);
    }
  }
  // Survey registration paint. The open corners are the bridges of the original stencil.
  if (sector===0) {
    const stroke=(t0,t1,s0,s1)=>f.quad(surf(t0,s0,.035),surf(t1,s0,.035),
      surf(t1,s1,.035),surf(t0,s1,.035),0x4b544c);
    stroke(.630,.687,.17,.22); stroke(.630,.687,.77,.82);
    stroke(.625,.639,.24,.75); stroke(.678,.692,.24,.75);
    stroke(.711,.778,.77,.82);
    f.quad(surf(.758,.75,.035),surf(.773,.75,.035),surf(.735,.17,.035),surf(.719,.17,.035),0x4b544c);
    for(let i=0;i<5;i++) stroke(.632+i*.030,.636+i*.030,.01,i%2===0?.112:.068);
  }
  if ([1,2,7].includes(sector)) {
    // A worn vermilion datum arc continues across the seams on three surviving sectors.
    for(let i=0;i<8;i++) {
      const s0=-.965+i*.242, s1=s0+.225;
      f.quad(surf(.837,s0,.023),surf(.868,s0,.023),surf(.868,s1,.023),surf(.837,s1,.023),0x986e55);
    }
  }
  f.rod(surf(0,-.98,-.11),surf(0,.98,-.11),.16,graphite,12);
}

function makeReceiver(f, lamps) {
  const shaft = (a,b,r,top,color,sides=24) => f.rod(v(0,0,a),v(0,0,b),r,color,sides,top);
  shaft(-1.4,-.76,.98,1.67,graphite);
  shaft(-.78,-.50,1.67,1.68,oxide);
  shaft(-.50,.11,1.54,1.25,graphite);
  shaft(.10,.25,1.25,.99,bone);
  shaft(.25,.58,.92,.68,iron);
  shaft(.57,.66,.65,.64,brass);
  shaft(.66,.69,.54,.51,graphite);
  shaft(.69,.73,.40,.36,black);
  shaft(.73,.78,.24,.21,oxide);
  for(let i=0;i<16;i++) {
    const a=i*TAU/16, c=Math.cos(a), s=Math.sin(a);
    f.rod(v(c*.572,s*.572,.66),v(c*.572,s*.572,.697),.037,graphite,6);
    f.rod(v(c*.86,s*.86,.45),v(c*.989,s*.989,.28),.041,bone,5);
  }
  for(let j=0;j<3;j++) {
    const a=TAU*(j/3+0.08), vx=Math.cos(a), vy=Math.sin(a);
    for(const side of [-1,1]) {
      const angle=a+side*.047;
      const pin=v(3.54*Math.cos(angle),3.54*Math.sin(angle),.43);
      f.rod(pin,v(.41*vx,.41*vy,4.23),.071,graphite,6,.042);
    }
    f.rod(v(vx*.79,vy*.79,.54),v(3.56*vx,3.56*vy,.43),.087,iron,7);
    f.rod(v(3.56*vx,3.56*vy,.43),v(3.56*vx,3.56*vy,.59),.15,oxide,9);
  }
  // Flared waveguide and stacked cooling fins surround the inset amber lens.
  shaft(3.85,4.15,.22,.48,black);
  shaft(4.15,4.48,.43,.45,oxide);
  for(let j=0;j<5;j++) shaft(4.17+j*.069,4.20+j*.069,.50,.50,brass);
  shaft(4.48,4.78,.33,.58,graphite);
  shaft(4.77,4.86,.59,.59,bone);
  shaft(4.855,4.89,.48,.42,black);
  lamps.rod(v(0,0,4.884),v(0,0,4.933),.385,0xffb354,32,.34);
  lamps.rod(v(0,0,4.931),v(0,0,4.952),.18,0xffedb8,24,.14);
  for(let i=0;i<8;i++) {
    const a=i*TAU/8, c=Math.cos(a), s=Math.sin(a);
    f.rod(v(c*.45,s*.45,4.902),v(c*.52,s*.52,4.902),.023,brass,5);
  }
}

export function buildTower() {
  const root=new THREE.Group(), bowl=new THREE.Group();
  root.name='聴測塔';
  const metal=weatheredMetal();
  const signal=new THREE.MeshBasicMaterial({vertexColors:true, color:0xffffff, toneMapped:false});
  const fixed=new Fabrication(), lights=new Fabrication();
  makePedestal(fixed,lights);
  fixed.mesh(root,metal,'基台と架台');
  lights.mesh(root,signal,'巻揚機の表示灯');
  root.add(bowl);
  bowl.position.y=11.6;
  bowl.rotation.x=-Math.asin(.44);
  const head=new Fabrication(), beacon=new Fabrication();
  makeReceiver(head,beacon);
  head.mesh(bowl,metal,'方位架と帰還器');
  beacon.mesh(bowl,signal,'受音器のレンズ');
  const petals=[];
  for(let i=0;i<bladeCount;i++) {
    const angle=TAU*i/bladeCount + .08;
    const hingeFrame=new THREE.Group(), moving=new THREE.Group(), fabrication=new Fabrication();
    hingeFrame.rotation.z=angle;
    hingeFrame.position.set(hinge*Math.cos(angle),hinge*Math.sin(angle),0);
    bowl.add(hingeFrame); hingeFrame.add(moving);
    makePetal(fabrication,i);
    fabrication.mesh(moving,metal,'分割反射板 '+(i+1));
    petals.push(moving);
  }
  const update=(time,opening,pulse)=>{
    const t=THREE.MathUtils.clamp(opening,0,1);
    petals.forEach((petal,i)=>{
      const stagger=Math.sin(i*2.38)*.034;
      petal.rotation.y=-(1-t)*(.53+stagger) + (1-t)*t*Math.sin(time*.41+i*.32)*.005;
    });
    const power=.60+THREE.MathUtils.clamp(pulse,0,1)*.92;
    signal.color.setRGB(power,power*.94,power*.86);
  };
  update(0,0,0);
  return {root,update};
}
