import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tau = Math.PI * 2;
export function random(seed) {
  return () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
}
const mat = (color, roughness = .86, metalness = .08) => new T.MeshStandardMaterial({ color, roughness, metalness });
export function mesh(parent, geom, material, xyz) {
  const m = new T.Mesh(geom, material);
  m.position.fromArray(xyz);
  parent.add(m);
  return m;
}
export function rod(parent, a, b, r, material, r2 = r, sides = 8) {
  const A = new T.Vector3(...a), B = new T.Vector3(...b);
  const m = mesh(parent, new T.CylinderGeometry(r2, r, A.distanceTo(B), sides), material, A.clone().lerp(B, .5).toArray());
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.sub(A).normalize());
  return m;
}
function batch(parent) {
  const byMaterial = new Map();
  for (const node of [...parent.children]) {
    node.updateMatrix();
    const g = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    g.applyMatrix4(node.matrix);
    if (!byMaterial.has(node.material)) byMaterial.set(node.material, []);
    byMaterial.get(node.material).push(g);
    parent.remove(node);
    node.geometry.dispose();
  }
  for (const [m, gs] of byMaterial) {
    mesh(parent, mergeGeometries(gs), m, [0, 0, 0]);
    gs.forEach(g => g.dispose());
  }
}

const skyVertex = `
varying vec3 ray;
void main(){
 ray=position;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const skyFragment = `
varying vec3 ray;
uniform float dawn;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
void main(){
 vec3 d=normalize(ray); float y=max(d.y,0.);
 vec3 s=normalize(vec3(-.38,mix(.064,.164,dawn),-1.)); float k=dot(d,s);
 vec3 horizon=mix(vec3(.24,.245,.30),vec3(1.05,.64,.38),dawn);
 vec3 top=mix(vec3(.019,.052,.094),vec3(.075,.235,.30),dawn);
 vec3 c=mix(horizon,top,pow(clamp(y*1.45,0.,1.),.61));
 vec2 uv=d.xz/max(.06,y+.075); float v=n(uv*vec2(1.8,3.8))*.51+n(uv*vec2(4.,9.))*.27+n(uv*vec2(9.,21.))*.15+n(uv*vec2(20.,43.))*.07;
 float wisps=smoothstep(.39,.78,v)*smoothstep(.01,.13,y)*(1.-smoothstep(.46,.98,y));
 c=mix(c, mix(vec3(.31,.29,.34),vec3(.94,.73,.60),dawn),wisps*.64);
 float angle=acos(clamp(k,-1.,1.));
 c+=vec3(1.1,.45,.16)*exp(-angle*8.)*.56;
 c=mix(c,vec3(2.5,1.42,.68),1.-smoothstep(.047,.0485,angle));
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

function ridges(scene) {
  const rnd = random(7123);
  for (let layer = 0; layer < 3; layer++) {
    const verts = [], colors = [], indices = [], steps = 580, rows = 6;
    const radius = 108 + layer * 67;
    for (let j=0;j<=steps;j++) {
      const a=j/steps*tau, wave=(k,p)=>Math.sin(k*a+p);
      const ridge=4+layer*7.9 + (6.4+layer*1.6)*wave(5,layer*.9)+3*wave(13,2+layer)+2.5*wave(24,1)+1.5*wave(38,layer)+.7*wave(78,2);
      for(let r=0;r<rows;r++) {
        const u=r/(rows-1), rr=radius-14+u*22+2*wave(18,1);
        const height=-2+u*(Math.max(3,ridge)+2)+rnd()*.65;
        verts.push(Math.sin(a)*rr,height,Math.cos(a)*rr);
        const col=new T.Color(['#766b69','#a38e8a','#b4a2a1'][layer]);
        col.multiplyScalar(.62+.30*u+.14*wave(13,.4)+.08*wave(37,layer)+rnd()*.055);
        colors.push(col.r,col.g,col.b);
        if(j<steps && r<rows-1) { const i=j*rows+r; indices.push(i,i+rows,i+1,i+1,i+rows,i+rows+1); }
      }
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    scene.add(new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide})));
  }
}

function saltBanks(scene) {
  const rnd=random(7107),verts=[],colors=[];
  const palette=['#45494a','#70615a','#ad9c80','#d7c9a8'].map(x=>new T.Color(x));
  function block(cx,cz,rx,rz,h,twist) {
    const count=11, rings=[[],[],[],[]];
    for(let i=0;i<count;i++){
      const a=i/count*tau, rough=.83+rnd()*.30,dx=Math.cos(a)*rx*rough,dz=Math.sin(a)*rz*rough;
      const x=dx*Math.cos(twist)-dz*Math.sin(twist),z=dx*Math.sin(twist)+dz*Math.cos(twist);
      const y=h*(.62+.4*rnd())+x*.028;
      for(const [j,k] of [1.1,1,.92,.57].entries())rings[j].push([cx+k*x,[-.34,y*.40,y*.77,y][j],cz+k*z]);
    }
    function tri(a,b,c,color,f) {
      verts.push(...a,...b,...c);for(let j=0;j<3;j++)colors.push(color.r*f,color.g*f,color.b*f);
    }
    for(let i=0;i<count;i++){
      const next=(i+1)%count;
      for(let j=0;j<3;j++){
        const k=.68+.28*rnd(),r=rings[j],s=rings[j+1];
        tri(r[i],s[i],r[next],palette[j],k);tri(s[i],s[next],r[next],palette[j],k);
      }
      tri(rings[3][i],[cx,h*.94,cz],rings[3][next],palette[3],.81+.15*rnd());
    }
  }
  for(const [x,z,r] of [[-20,19,1.4],[19,38,1.55],[-16,54,1.35],[33,8,1.25],[-36,-19,2.4],[40,-26,2],[4,-44,1.8],[-55,16,2.8]]) {
    for(let j=0;j<44;j++){
      const s=(1-rnd()**2)*r,offset=(rnd()-.5)*14*r;
      block(x+offset,z+offset*.27+(rnd()-.5)*4*r,.5+s*(.6+rnd()*2.4),.4+s*(.3+rnd()),.12+s*.58,-.24+rnd()*.25);
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const islands=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,flatShading:true,roughness:.97}));scene.add(islands);
}

function water(scene) {
  const shader = {
    uniforms:{...Reflector.ReflectorShader.uniforms, clock:{value:0}},
    vertexShader:`uniform mat4 textureMatrix; varying vec4 projected; varying vec3 pos;
    void main(){pos=(modelMatrix*vec4(position,1.)).xyz;projected=textureMatrix*vec4(position,1.);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse;uniform float clock;varying vec4 projected;varying vec3 pos;
    void main(){vec2 p=pos.xz; float dist=length(cameraPosition-pos);
    float bands=sin(p.y*1.9+p.x*.22+sin(p.x*.59))*.57+sin(p.y*4.1+sin(p.x*.73)*1.4)*.29+sin(p.x*1.4-p.y*5.+clock*.6)*.14;
    float detail=1.-smoothstep(25.,130.,dist);
    vec2 uv=projected.xy/projected.w+vec2(.0018*sin(p.y*2.7+clock*.8),.0032*bands)*(.4+detail);
    vec3 reflection=texture2D(tDiffuse,clamp(uv,.001,.999)).rgb;
    float veins=sin(p.x*.16+p.y*.35+sin(p.y*.22+p.x*.095)*3.3+sin(p.x*.32-p.y*.22)*1.3);
    float salt=smoothstep(.55,.99,veins)*(.25+.3*(.5+.5*bands));
    vec3 color=mix(reflection*.76+vec3(.018,.034,.036),vec3(.28,.25,.197),salt);
    color+=.016*bands*detail+vec3(.072,.068,.053)*smoothstep(.83,1.,bands)*detail;
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
  };
  const lake = new Reflector(new T.PlaneGeometry(850,850),{textureWidth:720,textureHeight:320,clipBias:.002,multisample:0,shader});
  lake.rotation.x=-Math.PI/2;lake.position.y=-.10;scene.add(lake);return lake;
}

export function landscape(scene) {
  const sky=mesh(scene,new T.SphereGeometry(540,52,22),new T.ShaderMaterial({vertexShader:skyVertex,fragmentShader:skyFragment,uniforms:{dawn:{value:0}},side:T.BackSide,depthWrite:false,fog:false}),[0,0,0]);
  sky.renderOrder=-100;
  ridges(scene);saltBanks(scene);const lake=water(scene);
  const props=new T.Group();scene.add(props);
  const concrete=mat('#8b8270'), edge=mat('#435458'),iron=mat('#733f2c'), wire=mat('#353b39'), ivory=mat('#c5b89a');
  const amber=new T.MeshBasicMaterial({color:0xffae51});
  const box=(x,y,z,w,h,d,m)=>mesh(props,new T.BoxGeometry(w,h,d),m,[x,y,z]);
  // The service causeway carries cables and calibration lamps across the flooded basin.
  for(let i=0;i<34;i++) {
    const z=2+i*2.7, x=-4.6-Math.sin(z*.047)*3.3;
    box(x,.32,z,2.55,.41,2.65,concrete);
    if(i%2===0) {
      for(const side of [-1,1]) rod(props,[x+side*1.06,-.65,z],[x+side*1.06,.18,z],.17,edge);
    }
    if(i%4===0) {
      const p=x-1.25; rod(props,[p,.5,z],[p,2.48,z],.07,iron);
      rod(props,[p,2.14,z],[p,2.43,z],.117,amber);
      if(i<32) {
        const nz=z+10.8,np=-5.85-Math.sin(nz*.047)*3.3;
        rod(props,[p,1.48,z],[(p+np)/2,1.12,z+5.4],.035,wire);
        rod(props,[(p+np)/2,1.12,z+5.4],[np,1.48,nz],.035,wire);
      }
    }
  }
  // Two lines of survey pylons mark the edge of the listening field.
  for(const side of [-1,1]) for(let i=0;i<11;i++) {
    const x=side*(23+i*3.3),z=-18-i*4.1+side*3,h=3+(i%3)*.55;
    rod(props,[x,-.3,z],[x,h,z],.16,edge,.07);
    rod(props,[x,h-.65,z],[x,h-.32,z],.13,ivory);
    rod(props,[x-.66,h-.48,z],[x+.66,h-.48,z],.058,iron);
    rod(props,[x,h,z],[x,h+.17,z],.095,amber);
  }
  batch(props);
  const light=new T.DirectionalLight(0xffcc97,3.05);light.position.set(-26,30,13);scene.add(light);
  light.castShadow=true;light.shadow.mapSize.set(2048,2048);
  Object.assign(light.shadow.camera,{left:-27,right:27,top:29,bottom:-24,near:1,far:85});light.shadow.camera.updateProjectionMatrix();
  light.shadow.normalBias=.045;light.shadow.bias=-.00032;
  const rim=new T.DirectionalLight(0xffad82,2.2);rim.position.set(-18,13,-30);scene.add(rim);
  const fill=new T.DirectionalLight(0x93ccd7,1.3);fill.position.set(17,9,21);scene.add(fill);
  const hemi=new T.HemisphereLight(0xd5e4e3,0x89786a,1.20);scene.add(hemi);
  scene.fog=new T.FogExp2(0xc2a991,.0054);
  const cold=new T.Color('#adc7e2'),warm=new T.Color('#ffcf9c'),mist=new T.Color('#8b99a4'),morning=new T.Color('#c8ab92');
  return (t,dawn)=>{
    sky.material.uniforms.dawn.value=dawn;lake.material.uniforms.clock.value=t;
    light.color.copy(cold).lerp(warm,dawn);light.intensity=1.72+1.03*dawn;
    rim.intensity=.95+1.25*dawn;fill.intensity=.75+.27*dawn;scene.fog.color.copy(mist).lerp(morning,dawn);
  };
}
