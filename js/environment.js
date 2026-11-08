// Our home on Diwali night: courtyard + rooftop terrace, diyas, jhalar lights, kandils, toran, rangoli, sky.
import * as THREE from 'three';
import * as TX from './textures.js';

export const sharedTime = { value: 0 };

/* ---------------------------------------------------------------- flames */

const FLAME_VS = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
void main(){
  vUv = uv; vSeed = aSeed;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sx = length(instanceMatrix[0].xyz);
  float sy = length(instanceMatrix[1].xyz);
  float fl = 1.0 + 0.12*sin(uTime*11.0 + aSeed*6.3) + 0.07*sin(uTime*23.0 + aSeed*2.1);
  vec2 p = position.xy;
  p.x += sin(uTime*5.0 + aSeed*4.0) * 0.16 * p.y;
  p.y *= fl;
  c.xy += p * vec2(sx, sy);
  gl_Position = projectionMatrix * c;
}`;

const FLAME_FS = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
void main(){
  float y = vUv.y;
  float x = abs(vUv.x - 0.5) * 2.0;
  float hw = y < 0.32 ? sqrt(max(0.0, 1.0 - pow((0.32 - y) / 0.32, 2.0)))
                      : pow(max(0.0, 1.0 - (y - 0.32) / 0.68), 1.4);
  hw *= 0.92;
  float d = x / max(hw, 0.001);
  float a = (1.0 - smoothstep(0.5, 1.0, d)) * smoothstep(0.0, 0.05, y);
  vec3 core = vec3(1.0, 0.97, 0.86);
  vec3 mid  = vec3(1.0, 0.62, 0.18);
  vec3 edge = vec3(0.95, 0.25, 0.04);
  vec3 col = mix(core, mid, smoothstep(0.1, 0.65, d + y * 0.35));
  col = mix(col, edge, smoothstep(0.6, 1.0, d));
  col = mix(col, vec3(0.25, 0.35, 1.0), (1.0 - smoothstep(0.0, 0.2, y)) * 0.55);
  float flick = 0.9 + 0.1 * sin(uTime * 31.0 + vSeed * 9.0);
  gl_FragColor = vec4(col * 1.9 * flick, a);
}`;

let flameMaterial = null;
export function createFlames(list) {
  if (!flameMaterial) {
    flameMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: sharedTime },
      vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, flameMaterial, list.length);
  const seeds = new Float32Array(list.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  list.forEach((f, i) => {
    s.set(f.w, f.h, 1);
    M.compose(f.pos, q, s);
    mesh.setMatrixAt(i, M);
    seeds[i] = Math.random() * 100;
  });
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return mesh;
}

/* ------------------------------------------------------------------- sky */

const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FS = /* glsl */ `
uniform float uTime;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  float h = vDir.y;
  vec3 top = vec3(0.004, 0.004, 0.018);
  vec3 mid = vec3(0.016, 0.010, 0.045);
  vec3 hor = vec3(0.13, 0.055, 0.075);
  vec3 col = mix(hor, mid, smoothstep(-0.02, 0.22, h));
  col = mix(col, top, smoothstep(0.22, 0.75, h));
  vec3 d = vDir * 380.0;
  vec3 cell = floor(d);
  float s = hash(cell);
  if (s > 0.9975 && h > 0.08) {
    vec3 f = fract(d) - 0.5;
    float st = 1.0 - smoothstep(0.0, 0.3, length(f));
    float tw = 0.55 + 0.45 * sin(uTime * (2.0 + 3.0 * fract(s * 91.0)) + s * 100.0);
    col += vec3(0.9, 0.92, 1.0) * st * tw * (0.3 + 0.9 * fract(s * 37.0)) * smoothstep(0.08, 0.35, h);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/* --------------------------------------------------------------- helpers */

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function sag(a, b, amount, n) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const p = new THREE.Vector3().lerpVectors(a, b, u);
    p.y -= amount * 4 * u * (1 - u);
    pts.push(p);
  }
  return pts;
}

const BULB_COLS = [
  [1, 0.1, 0.08], [0.12, 1, 0.2], [0.15, 0.35, 1], [1, 0.78, 0.08],
  [1, 0.12, 0.8], [0.08, 0.9, 1], [1, 0.42, 0.04],
];

class Jhalar {
  constructor() { this.items = []; this.wires = []; }
  add(pos, strand, idx, color, kind) { this.items.push({ pos, strand, idx, color, kind, seed: Math.random() }); }
  wire(points) { for (let i = 0; i < points.length - 1; i++) this.wires.push(points[i], points[i + 1]); }
  build(scene) {
    const n = this.items.length;
    const geo = new THREE.SphereGeometry(0.022, 6, 4);
    geo.scale(1, 1.3, 1);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    const M = new THREE.Matrix4();
    this.items.forEach((b, i) => { M.makeTranslation(b.pos.x, b.pos.y, b.pos.z); mesh.setMatrixAt(i, M); });
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.mesh = mesh;
    scene.add(mesh);
    const wg = new THREE.BufferGeometry().setFromPoints(this.wires);
    scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1c2a18 })));
  }
  update(t) {
    const arr = this.mesh.instanceColor.array;
    const mode = Math.floor(t / 8) % 4;
    const blend = Math.min(1, (t % 8) / 0.6);
    const prevMode = (mode + 3) % 4;
    for (let i = 0; i < this.items.length; i++) {
      const b = this.items[i];
      const bm = this._b(mode, b, t), bp = blend < 1 ? this._b(prevMode, b, t) : bm;
      const k = 2.4 * (bp + (bm - bp) * blend);
      const c = b.color;
      arr[i * 3] = c[0] * k; arr[i * 3 + 1] = c[1] * k; arr[i * 3 + 2] = c[2] * k;
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
  _b(mode, b, t) {
    switch (mode) {
      case 0: {
        const f = (b.idx * 0.11 - t * 1.3 + b.strand * 0.05) % 1;
        return 0.18 + 0.82 * ((f + 1) % 1 < 0.38 ? 1 : 0);
      }
      case 1: return 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(t * 5 + b.seed * 40), 3);
      case 2: {
        if (b.kind === 'v') {
          const f = (((t * 0.9 - b.idx * 0.075 + b.strand * 0.13) % 1) + 1) % 1;
          return 0.15 + 0.85 * Math.pow(f, 6);
        }
        return 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(b.idx * 0.6 - t * 4));
      }
      default: return 0.75 + 0.25 * Math.sin(t * 1.4 + b.strand);
    }
  }
}

function diyaGeometry() {
  const pts = [[0, 0], [0.026, 0], [0.04, 0.01], [0.046, 0.021], [0.044, 0.025], [0.036, 0.016], [0.02, 0.012], [0, 0.012]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const w = Math.pow(Math.max(0, Math.cos(Math.atan2(x, z))), 12) * Math.min(1, y / 0.022);
    p.setX(i, x * (1 + 0.38 * w)); p.setZ(i, z * (1 + 0.38 * w));
  }
  g.computeVertexNormals();
  return g;
}

function kandilOct(base, accent) {
  const g = new THREE.Group();
  const tex = TX.kandilTexture(base, accent);
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.4, side: THREE.DoubleSide, roughness: 0.9 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8, 1, true), mat));
  const capMat = new THREE.MeshStandardMaterial({ color: base, emissive: base, emissiveIntensity: 0.8, side: THREE.DoubleSide });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 0.16, 8, 1, true), capMat); top.position.y = 0.23; g.add(top);
  const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.06, 0.16, 8, 1, true), capMat); bot.position.y = -0.23; g.add(bot);
  const tasselMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.38), tasselMat);
    t.position.set(Math.cos(a) * 0.2, -0.33, Math.sin(a) * 0.2); t.rotation.y = -a + Math.PI / 2;
    g.add(t);
  }
  return g;
}

function kandilStar(c1, c2) {
  const g = new THREE.Group();
  const shape = (outer, inner) => {
    const s = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5 + Math.PI / 2, r = k % 2 ? inner : outer;
      k ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return s;
  };
  const geo = new THREE.ExtrudeGeometry(shape(0.3, 0.14), { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.03, bevelSegments: 2 });
  geo.center();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c1, emissive: c1, emissiveIntensity: 1.3, roughness: 0.8 })));
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(shape(0.17, 0.08)),
    new THREE.MeshStandardMaterial({ color: c2, emissive: c2, emissiveIntensity: 1.9, side: THREE.DoubleSide }));
  inner.position.z = 0.085; g.add(inner);
  const inner2 = inner.clone(); inner2.position.z = -0.085; g.add(inner2);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: c2, emissive: c2, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.55), ribbonMat);
    r.position.set(sx * 0.11, -0.5, 0); r.rotation.z = sx * 0.06; g.add(r);
  }
  return g;
}

/* --------------------------------------------------------- environment */

export const ROOF_Y = 4.8;

export function createEnvironment(scene, { lowPower = false } = {}) {
  const updaters = [];
  scene.background = new THREE.Color(0x030209);
  scene.fog = new THREE.FogExp2(0x120c1c, 0.0062);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uTime: sharedTime }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0x5c5ab0, 0x2a1810, 0.5));
  const moon = new THREE.DirectionalLight(0x8a96ff, 0.18);
  moon.position.set(-10, 20, 10);
  scene.add(moon);

  // courtyard floor (the town provides everything outside our walls)
  const tiles = TX.groundTexture();
  tiles.repeat.set(11.1 / 4, 9.5 / 4);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(11.1, 9.5), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.92, color: 0xbcb0a4 }));
  court.rotation.x = -Math.PI / 2; court.position.set(0, 0.006, -0.25);
  court.receiveShadow = true;
  scene.add(court);

  /* ---------------- the house */
  const house = new THREE.Group(); scene.add(house);
  const wallTex = TX.plasterTexture('#e7b78c', 9); wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(4, 2);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x7a1f2b, roughness: 0.8 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xc9962e, roughness: 0.5, metalness: 0.4 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.75 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8c8074, roughness: 0.9 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f3b2a, roughness: 0.6, metalness: 0.5 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.55 });

  box(10.4, ROOF_Y, 6, wallMat, 0, ROOF_Y / 2, -8, house);       // body: front face z=-5, back z=-11
  box(10.6, 0.14, 0.42, trimMat, 0, 2.8, -4.85, house);          // first-floor ledge
  box(10.6, 0.05, 0.43, goldTrim, 0, 2.885, -4.85, house);
  // terrace parapets all round
  const PH = 0.95, PT = ROOF_Y + PH;
  box(10.6, PH, 0.26, trimMat, 0, ROOF_Y + PH / 2, -5.0, house);
  box(10.6, PH, 0.22, wallMat, 0, ROOF_Y + PH / 2, -10.9, house);
  box(0.22, PH, 5.9, wallMat, -5.1, ROOF_Y + PH / 2, -7.95, house);
  box(0.22, PH, 5.9, wallMat, 5.1, ROOF_Y + PH / 2, -7.95, house);
  for (const [w, d, x, z] of [[10.7, 0.32, 0, -5.0], [10.7, 0.28, 0, -10.9], [0.28, 5.9, -5.1, -7.95], [0.28, 5.9, 5.1, -7.95]]) {
    box(w, 0.06, d, goldTrim, x, PT + 0.03, z, house);
  }
  box(10.4, 0.3, 0.7, stoneMat, 0, 0.15, -4.7, house);           // plinth
  box(2.0, 0.15, 0.42, stoneMat, 0, 0.075, -4.15, house);        // step
  // door
  box(0.18, 2.55, 0.16, woodMat, -0.86, 1.57, -4.96, house);
  box(0.18, 2.55, 0.16, woodMat, 0.86, 1.57, -4.96, house);
  box(1.9, 0.24, 0.2, woodMat, 0, 2.95, -4.95, house);
  box(1.9, 0.05, 0.21, goldTrim, 0, 2.83, -4.94, house);
  const doorTex = TX.doorTexture();
  const doorInside = new THREE.Mesh(new THREE.PlaneGeometry(1.54, 2.5), new THREE.MeshBasicMaterial({ map: doorTex, color: new THREE.Color(1.15, 1.02, 0.92) }));
  doorInside.position.set(0, 1.55, -4.985); house.add(doorInside);
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(sx * 0.77, 1.55, -4.95);
    box(0.76, 2.48, 0.06, woodMat, -sx * 0.38, 0, 0, leaf);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), goldTrim);
      stud.position.set(-sx * (0.2 + c * 0.36), -0.9 + r * 0.6, 0.035);
      leaf.add(stud);
    }
    leaf.rotation.y = sx * -1.25;
    house.add(leaf);
  }
  // windows on every side
  const winMat = (seed) => new THREE.MeshBasicMaterial({ map: TX.windowTexture(seed), color: new THREE.Color(0.95, 0.9, 0.85) });
  const addWindow = (x, y, z, w, h, seed, ry = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; house.add(g);
    box(w + 0.2, h + 0.2, 0.12, woodMat, 0, 0, 0.03, g);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), winMat(seed)); pane.position.z = 0.095; g.add(pane);
    box(w + 0.3, 0.08, 0.24, trimMat, 0, -h / 2 - 0.12, 0.12, g);
    box(w + 0.5, 0.07, 0.4, stoneMat, 0, h / 2 + 0.2, 0.2, g); // chajja
    return y - h / 2 - 0.08;
  };
  const sillY = addWindow(-2.7, 1.62, -5.0, 1.1, 1.2, 3);
  addWindow(2.7, 1.62, -5.0, 1.1, 1.2, 4);
  addWindow(-3.2, 3.75, -5.0, 1.0, 1.1, 5);
  addWindow(0, 3.75, -5.0, 1.0, 1.1, 6);
  addWindow(3.2, 3.75, -5.0, 1.0, 1.1, 7);
  for (const sx of [-1, 1]) for (const [y, z, s] of [[1.62, -7, 8], [3.75, -7, 9], [3.75, -9.4, 10]]) addWindow(sx * 5.2, y, z, 1.0, 1.1, s + (sx > 0 ? 5 : 0), sx * Math.PI / 2);
  for (const x of [-2.6, 2.6]) for (const y of [1.62, 3.75]) addWindow(x, y, -11, 1.0, 1.1, 20 + x + y, Math.PI);
  for (const [x, txt] of [[-1.28, 'शुभ'], [1.28, 'लाभ']]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34), new THREE.MeshStandardMaterial({ map: TX.textPlateTexture(txt), transparent: true, roughness: 0.9 }));
    p.position.set(x, 2.25, -4.985); house.add(p);
  }
  const fpTex = TX.footprintsTexture();
  for (const [y, z, len] of [[0.302, -4.6, 0.6], [0.152, -4.15, 0.38]]) {
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.34, len), new THREE.MeshStandardMaterial({ map: fpTex, transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    fp.rotation.x = -Math.PI / 2; fp.position.set(0, y, z); house.add(fp);
  }
  const doorLight = new THREE.PointLight(0xffa04a, 2.2, 7, 2);
  doorLight.position.set(0, 1.6, -4.4);
  scene.add(doorLight);

  /* ---------------- rooftop terrace (chhat) */
  const roofTex = TX.groundTexture(); roofTex.repeat.set(10 / 3, 5.7 / 3);
  const roofFloor = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.7), new THREE.MeshStandardMaterial({ map: roofTex, color: 0x9d968e, roughness: 0.95 }));
  roofFloor.rotation.x = -Math.PI / 2; roofFloor.position.set(0, ROOF_Y + 0.004, -7.95); roofFloor.receiveShadow = true;
  house.add(roofFloor);
  // stair room (mumty) with a lit door, tubelight and black water tank on top
  const mumty = box(3, 2.6, 3.2, wallMat, -3.45, ROOF_Y + 1.3, -9.25, house);
  mumty.receiveShadow = true;
  box(3.2, 0.12, 3.4, stoneMat, -3.45, ROOF_Y + 2.66, -9.25, house);
  const mDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.05), new THREE.MeshBasicMaterial({ map: doorTex, color: new THREE.Color(1.0, 0.9, 0.8) }));
  mDoor.position.set(-3.45, ROOF_Y + 1.03, -7.645); house.add(mDoor);
  box(1.15, 0.12, 0.08, woodMat, -3.45, ROOF_Y + 2.1, -7.62, house);
  const tube = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 2.8) }));
  tube.position.set(-3.45, ROOF_Y + 2.32, -7.6); house.add(tube);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.64, 1.2, 20), tankMat);
  tank.position.set(-3.6, ROOF_Y + 2.72 + 0.6, -9.4); house.add(tank);
  const tankLid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12), tankMat);
  tankLid.position.set(-3.6, ROOF_Y + 2.72 + 1.24, -9.4); house.add(tankLid);
  for (let k = 0; k < 7; k++) box(0.5, 0.025, 0.025, ironMat, -1.98, ROOF_Y + 0.3 + k * 0.33, -9.9, house); // ladder rungs
  for (const dz of [-0.25, 0.25]) box(0.025, 2.4, 0.025, ironMat, -1.98, ROOF_Y + 1.2, -9.9 + dz, house);
  // dish antenna on the side parapet
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 8, 0, Math.PI * 2, 0, 0.7), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, side: THREE.DoubleSide, roughness: 0.5 }));
  dish.position.set(4.85, PT + 0.45, -10.3); dish.rotation.set(-1.2, 0.6, 0); house.add(dish);
  box(0.04, 0.5, 0.04, ironMat, 4.85, PT + 0.2, -10.3, house);
  // tulsi & plant pots along the back parapet
  const potMat = new THREE.MeshStandardMaterial({ color: 0x9c4a24, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 0.8, flatShading: true });
  for (const x of [-0.9, 0.4, 1.7, 3.0]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.3, 12), potMat); pot.position.set(x, ROOF_Y + 0.15, -10.55); house.add(pot);
    for (let k = 0; k < 3; k++) {
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + Math.random() * 0.06, 0), leafMat);
      l.position.set(x + (Math.random() - 0.5) * 0.15, ROOF_Y + 0.38 + Math.random() * 0.15, -10.55 + (Math.random() - 0.5) * 0.15); house.add(l);
    }
  }
  // clothesline with a saree and kurta drying
  for (const x of [1.8, 4.6]) box(0.035, 1.7, 0.035, ironMat, x, ROOF_Y + 0.85, -9.9, house);
  const lineGeo = new THREE.BufferGeometry().setFromPoints(sag(new THREE.Vector3(1.8, ROOF_Y + 1.65, -9.9), new THREE.Vector3(4.6, ROOF_Y + 1.65, -9.9), 0.08, 10));
  house.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x222222 })));
  for (const [x, w, h, c] of [[2.35, 0.9, 0.95, 0xb0173a], [3.3, 0.55, 0.7, 0xf2c14e], [4.05, 0.5, 0.6, 0x2e7d9a]]) {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.9 }));
    cloth.position.set(x, ROOF_Y + 1.62 - h / 2, -9.9); house.add(cloth);
  }

  /* ---------------- courtyard walls and front gate */
  const wallTex2 = TX.plasterTexture('#d9cfc0', 12); wallTex2.wrapS = wallTex2.wrapT = THREE.RepeatWrapping; wallTex2.repeat.set(4, 1);
  const bwMat = new THREE.MeshStandardMaterial({ map: wallTex2, roughness: 0.95 });
  for (const sx of [-1, 1]) {
    box(0.3, 1.0, 9.6, bwMat, sx * 5.7, 0.5, -0.3, scene);
    box(0.42, 0.08, 9.7, trimMat, sx * 5.7, 1.04, -0.3, scene);
    box(4.2, 1.0, 0.3, bwMat, sx * 3.5, 0.5, 4.5, scene);
    box(4.25, 0.08, 0.42, trimMat, sx * 3.5, 1.04, 4.5, scene);
    box(0.5, 1.75, 0.5, bwMat, sx * 1.15, 0.875, 4.5, scene);       // gate pillars
    box(0.62, 0.1, 0.62, trimMat, sx * 1.15, 1.8, 4.5, scene);
    const gate = new THREE.Group(); gate.position.set(sx * 0.9, 0, 4.5); gate.rotation.y = sx * 1.2; scene.add(gate);
    box(0.04, 1.3, 0.04, ironMat, -sx * 0.02, 0.75, 0, gate);
    box(0.04, 1.3, 0.04, ironMat, -sx * 0.86, 0.75, 0, gate);
    for (const y of [0.15, 0.75, 1.38]) box(0.86, 0.04, 0.04, ironMat, -sx * 0.44, y, 0, gate);
    for (let k = 1; k < 9; k++) box(0.018, 1.25, 0.018, ironMat, -sx * (0.02 + k * 0.094), 0.75, 0, gate);
  }

  /* ---------------- rangoli */
  const rangolis = [
    { x: 0, z: -2.85, r: 0.95, seed: 1, pal: ['#e6194b', '#ffb300', '#1565c0', '#2e7d32', '#ff6f00', '#7b1fa2', '#ec407a'] },
    { x: -2.7, z: -1.6, r: 0.72, seed: 7, pal: ['#d81b60', '#fdd835', '#00897b', '#5e35b1', '#ef6c00', '#43a047', '#29b6f6'] },
    { x: 2.7, z: -1.6, r: 0.72, seed: 13, pal: ['#8e24aa', '#ffca28', '#e53935', '#00acc1', '#7cb342', '#f4511e', '#3949ab'] },
    { x: -1.9, z: 1.35, r: 0.45, seed: 19, pal: ['#ff7043', '#ffee58', '#26a69a', '#ab47bc', '#ef5350', '#66bb6a', '#42a5f5'] },
    { x: 1.9, z: 1.35, r: 0.45, seed: 23, pal: ['#26c6da', '#ffa726', '#ec407a', '#9ccc65', '#7e57c2', '#ffca28', '#ef5350'] },
    { x: 1.6, z: -9.6 + 1.4, r: 0.55, seed: 29, y: ROOF_Y + 0.01, pal: ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#ec407a'] },
  ];
  for (const rg of rangolis) {
    const tex = TX.rangoliTexture(rg.seed, rg.pal);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rg.r * 2.1, rg.r * 2.1), new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 1, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1,
      polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2; m.position.set(rg.x, rg.y ?? 0.014, rg.z);
    m.receiveShadow = true;
    scene.add(m);
  }

  /* ---------------- diyas */
  const DS = 1.5;
  const diyas = [];
  const addDiya = (x, y, z, theta = Math.random() * Math.PI * 2) => diyas.push({ x, y, z, theta });
  const ringDiyas = (cx, cz, rad, n, y = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      addDiya(cx + Math.cos(a) * rad, y, cz + Math.sin(a) * rad, Math.PI / 2 - a);
    }
  };
  ringDiyas(0, -2.85, 1.12, 14);
  ringDiyas(-2.7, -1.6, 0.86, 9);
  ringDiyas(2.7, -1.6, 0.86, 9);
  ringDiyas(-1.9, 1.35, 0.58, 6);
  ringDiyas(1.9, 1.35, 0.58, 6);
  ringDiyas(1.6, -8.2, 0.68, 7, ROOF_Y);
  for (let x = 1.25; x <= 5.0; x += 0.42) { addDiya(x, 0.3, -4.47, 0); addDiya(-x, 0.3, -4.47, 0); }
  for (const sx of [-0.85, 0.85]) addDiya(sx, 0.15, -4.03, 0);
  for (const sx of [-1, 1]) for (let z = -4.3; z <= 3.9; z += 0.75) addDiya(sx * 5.7, 1.08, z, -sx * Math.PI / 2);
  for (const sx of [-1, 1]) { for (let x = 1.6; x <= 5.4; x += 0.6) addDiya(sx * x, 1.08, 4.5, 0); addDiya(sx * 1.15, 1.85, 4.5, 0); }
  for (const wx of [-2.7, 2.7]) for (const dx of [-0.38, 0, 0.38]) addDiya(wx + dx, sillY, -4.86, 0);
  for (let x = -5.0; x <= 5.01; x += 0.55) addDiya(x, PT + 0.06, -5.0, 0);                         // roof parapet front
  for (let x = -4.6; x <= 4.0; x += 0.8) addDiya(x, PT + 0.06, -10.9, Math.PI);
  for (const sx of [-1, 1]) for (let z = -10.4; z <= -5.4; z += 0.7) addDiya(sx * 5.1, PT + 0.06, z, sx * Math.PI / 2);

  const diyaGeo = diyaGeometry();
  const diyaMesh = new THREE.InstancedMesh(diyaGeo, new THREE.MeshStandardMaterial({ color: 0xb4532a, roughness: 0.85 }), diyas.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), SV = new THREE.Vector3(DS, DS, DS), up = new THREE.Vector3(0, 1, 0);
  const flameList = [];
  diyas.forEach((d, i) => {
    Q.setFromAxisAngle(up, d.theta);
    M.compose(new THREE.Vector3(d.x, d.y, d.z), Q, SV);
    diyaMesh.setMatrixAt(i, M);
    const off = new THREE.Vector3(0, 0.024, 0.06).multiplyScalar(DS).applyQuaternion(Q);
    flameList.push({ pos: new THREE.Vector3(d.x, d.y, d.z).add(off), w: 0.03, h: 0.078 });
  });
  diyaMesh.receiveShadow = true;
  scene.add(diyaMesh);
  scene.add(createFlames(flameList));

  const diyaLightSpots = lowPower ? [[0, 0.3, -2.85], [0, PT + 0.3, -5.6]] : [[0, 0.3, -2.85], [-3, 0.6, -4.3], [3, 0.6, -4.3], [0, PT + 0.3, -5.6]];
  const diyaLights = diyaLightSpots.map(([x, y, z], i) => {
    const l = new THREE.PointLight(0xff9a3c, 1.4, 6, 2);
    l.position.set(x, y, z); l.userData.seed = i * 7.3;
    scene.add(l);
    return l;
  });
  updaters.push((t) => {
    for (const l of diyaLights) {
      const s = l.userData.seed;
      l.intensity = 1.4 * (0.85 + 0.1 * Math.sin(t * 9 + s) + 0.05 * Math.sin(t * 23 + s * 3));
    }
  });

  /* ---------------- jhalar (string lights) */
  const J = new Jhalar();
  let strand = 0;
  for (let x = -5.05; x <= 5.06; x += 0.34, strand++) {
    const len = 1.15 + 0.6 * Math.abs(Math.sin(strand * 0.7));
    const top = new THREE.Vector3(x, PT - 0.05, -4.84);
    const col = BULB_COLS[strand % BULB_COLS.length];
    J.wire([top, new THREE.Vector3(x, top.y - len, -4.84)]);
    let idx = 0;
    for (let y = top.y - 0.07; y > top.y - len; y -= 0.11, idx++) J.add(new THREE.Vector3(x, y, -4.84), strand, idx, col, 'v');
  }
  const swagRow = (a, b, n, sagAmt, str) => {
    let idx = 0;
    for (let k = 0; k < n; k++) {
      const p0 = new THREE.Vector3().lerpVectors(a, b, k / n), p1 = new THREE.Vector3().lerpVectors(a, b, (k + 1) / n);
      const pts = sag(p0, p1, sagAmt, 12);
      J.wire(pts);
      for (const p of pts.slice(0, -1)) { J.add(p, str, idx, BULB_COLS[idx % BULB_COLS.length], 'h'); idx++; }
    }
  };
  swagRow(new THREE.Vector3(-5.2, 2.76, -4.62), new THREE.Vector3(5.2, 2.76, -4.62), 8, 0.2, 100);
  swagRow(new THREE.Vector3(-5.2, PT + 0.02, -4.84), new THREE.Vector3(5.2, PT + 0.02, -4.84), 10, 0.16, 101);
  for (const sx of [-1, 1]) swagRow(new THREE.Vector3(sx * 5.24, PT + 0.02, -10.8), new THREE.Vector3(sx * 5.24, PT + 0.02, -5.1), 5, 0.14, 102 + sx);
  swagRow(new THREE.Vector3(-4.8, PT + 0.02, -11.03), new THREE.Vector3(4.8, PT + 0.02, -11.03), 8, 0.16, 104);
  const bamboo = new THREE.MeshStandardMaterial({ color: 0x8a7340, roughness: 0.8 });
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 3.8, 8), bamboo);
    pole.position.set(sx * 4.6, 1.9, 3.8); scene.add(pole);
  }
  const overhead = [
    [new THREE.Vector3(-5.2, PT, -4.9), new THREE.Vector3(-4.6, 3.75, 3.8)],
    [new THREE.Vector3(5.2, PT, -4.9), new THREE.Vector3(4.6, 3.75, 3.8)],
    [new THREE.Vector3(-2.6, PT, -4.9), new THREE.Vector3(4.6, 3.75, 3.8)],
    [new THREE.Vector3(2.6, PT, -4.9), new THREE.Vector3(-4.6, 3.75, 3.8)],
    [new THREE.Vector3(0, PT, -4.9), new THREE.Vector3(-4.6, 3.75, 3.8)],
    [new THREE.Vector3(0, PT, -4.9), new THREE.Vector3(4.6, 3.75, 3.8)],
    [new THREE.Vector3(-4.6, 3.75, 3.8), new THREE.Vector3(4.6, 3.75, 3.8)],
  ];
  overhead.forEach(([a, b], si) => {
    const pts = sag(a, b, 0.75, Math.round(a.distanceTo(b) / 0.2));
    J.wire(pts);
    pts.forEach((p, idx) => J.add(p, 200 + si, idx, BULB_COLS[(idx + si) % BULB_COLS.length], 'h'));
  });
  J.build(scene);
  updaters.push((t) => J.update(t));

  /* ---------------- toran: marigold + mango leaves */
  const marigolds = [];
  const doorTop = 2.78;
  for (let k = 0; k < 3; k++) {
    const x0 = -0.82 + k * 0.547;
    sag(new THREE.Vector3(x0, doorTop, -4.83), new THREE.Vector3(x0 + 0.547, doorTop, -4.83), 0.16, 14).forEach((p) => marigolds.push(p));
  }
  for (const sx of [-0.84, 0.84]) for (let y = doorTop; y > 0.95; y -= 0.045) marigolds.push(new THREE.Vector3(sx, y, -4.84));
  for (const wx of [-3.2, 0, 3.2]) sag(new THREE.Vector3(wx - 0.6, 4.42, -4.86), new THREE.Vector3(wx + 0.6, 4.42, -4.86), 0.22, 26).forEach((p) => marigolds.push(p));
  sag(new THREE.Vector3(-4.0, ROOF_Y + 2.15, -7.6), new THREE.Vector3(-2.9, ROOF_Y + 2.15, -7.6), 0.18, 20).forEach((p) => marigolds.push(p));
  for (const sx of [-1, 1]) sag(new THREE.Vector3(sx * 0.95, 1.75, 4.6), new THREE.Vector3(sx * 0.2, 1.6, 4.6), 0.1, 14).forEach((p) => marigolds.push(p));
  const mgMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.026, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true, emissive: 0x401800 }), marigolds.length);
  const mc = new THREE.Color();
  marigolds.forEach((p, i) => {
    Q.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, 0));
    M.compose(p, Q, new THREE.Vector3(1, 1, 1));
    mgMesh.setMatrixAt(i, M);
    mgMesh.setColorAt(i, mc.set(i % 3 === 0 ? 0xffc107 : 0xff7f00));
  });
  scene.add(mgMesh);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.035, -0.07, 0, -0.16); leafShape.quadraticCurveTo(-0.035, -0.07, 0, 0);
  const leaves = [];
  for (let x = -0.78; x <= 0.79; x += 0.1) leaves.push(x);
  const leafMesh = new THREE.InstancedMesh(new THREE.ShapeGeometry(leafShape), new THREE.MeshStandardMaterial({ color: 0x2f7d32, side: THREE.DoubleSide, roughness: 0.6 }), leaves.length);
  leaves.forEach((x, i) => {
    Q.setFromEuler(new THREE.Euler(0.15, 0, (Math.random() - 0.5) * 0.3));
    M.compose(new THREE.Vector3(x, doorTop + 0.04, -4.82), Q, new THREE.Vector3(1, 1, 1));
    leafMesh.setMatrixAt(i, M);
  });
  scene.add(leafMesh);

  /* ---------------- kandils */
  const kandils = [];
  const hang = (obj, x, y, z, len) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    obj.position.y = -len;
    pivot.add(obj);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len - 0.2, 4), new THREE.MeshBasicMaterial({ color: 0x221111 }));
    cord.position.y = -(len - 0.2) / 2;
    pivot.add(cord);
    scene.add(pivot);
    kandils.push({ pivot, seed: Math.random() * 10 });
  };
  hang(kandilOct('#ff6d00', '#ffd600'), -4.3, 2.73, -4.66, 0.55);
  hang(kandilOct('#d50000', '#ffab00'), 4.3, 2.73, -4.66, 0.55);
  hang(kandilStar('#ff1744', '#ffea00'), -1.55, 2.73, -4.66, 0.6);
  hang(kandilStar('#ff9100', '#e040fb'), 1.55, 2.73, -4.66, 0.6);
  hang(kandilOct('#c51162', '#ffd600'), -2.6, PT - 0.1, -4.62, 0.8);
  hang(kandilOct('#6200ea', '#ff9100'), 2.6, PT - 0.1, -4.62, 0.8);
  updaters.push((t) => {
    for (const k of kandils) {
      k.pivot.rotation.z = Math.sin(t * 0.9 + k.seed) * 0.045;
      k.pivot.rotation.x = Math.sin(t * 0.7 + k.seed * 2) * 0.03;
      k.pivot.children[0].rotation.y = Math.sin(t * 0.3 + k.seed) * 0.4;
    }
  });

  /* ---------------- courtyard lamp, work light, water buckets */
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1d1d22, roughness: 0.6, metalness: 0.5 });
  const lamp = new THREE.Group(); lamp.position.set(-2.5, 0, 1.7); scene.add(lamp);
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 3.3, 8), poleMat); lp.position.y = 1.65; lamp.add(lp);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), poleMat); arm.position.set(0.32, 3.25, 0); lamp.add(arm);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 16, 1, true), poleMat); shade.position.set(0.64, 3.18, 0); lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 1.2) }));
  bulb.position.set(0.64, 3.12, 0); lamp.add(bulb);
  const spot = new THREE.SpotLight(0xffd2a0, 9, 0, 0.5, 0.7, 2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(lowPower ? 512 : 1024, lowPower ? 512 : 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 9;
  scene.add(spot, spot.target);
  const SPOT = {
    ground: { pos: [-1.86, 3.1, 1.7], target: [0.1, 0, -0.2], color: 0xffd2a0, intensity: 10, angle: 0.5 },
    roof: { pos: [-3.2, ROOF_Y + 2.3, -7.35], target: [0.4, ROOF_Y, -7.5], color: 0xeaf2ff, intensity: 22, angle: 0.8 },
  };
  const bucket = (x, y, z) => {
    const pts = [[0, 0.005], [0.15, 0.005], [0.155, 0.01], [0.18, 0.3], [0.19, 0.305], [0.182, 0.31], [0.172, 0.3], [0.148, 0.02]].map(([a, b]) => new THREE.Vector2(a, b));
    const b = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), new THREE.MeshStandardMaterial({ color: 0xaeb3b8, metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide }));
    b.position.set(x, y, z); b.castShadow = true; scene.add(b);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.172, 24), new THREE.MeshStandardMaterial({ color: 0x0b2836, roughness: 0.05, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.set(x, y + 0.26, z); scene.add(water);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.006, 6, 20, Math.PI), poleMat);
    handle.position.set(x, y + 0.3, z); handle.rotation.y = 0.5; scene.add(handle);
  };
  bucket(1.15, 0, 0.55);
  bucket(1.3, ROOF_Y, -6.4);

  return {
    update(t, dt) { sharedTime.value = t; for (const u of updaters) u(t, dt); },
    setSpot(key) {
      const s = SPOT[key];
      spot.position.set(...s.pos); spot.target.position.set(...s.target);
      spot.color.set(s.color); spot.intensity = s.intensity; spot.angle = s.angle;
      spot.target.updateMatrixWorld();
    },
  };
}
