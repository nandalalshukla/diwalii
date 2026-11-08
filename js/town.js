// A procedural Indian mohalla around the house: flat-roofed concrete homes, shops, water tanks,
// rebar, dish antennas, light strands, poles & wires, sodium lamps, neem trees, a temple, a mobile tower.
// Everything is merged into a handful of meshes with a cheap "night" shader so it stays fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, plasterTexture, sparkTexture, skylineTexture, dotStripTexture } from './textures.js';
import * as TT from './towntex.js';

const FLOOR = 3.1, BAY = 3.0;

/* ----------------------------------------------------------------- shaders */
const shared = {
  uAmb: { value: new THREE.Color(0.2, 0.18, 0.27) },
  uFlash: { value: new THREE.Color(0, 0, 0) },
  uTime: { value: 0 },
  uScale: { value: 800 },
};

const TOWN_VS = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec3 color;
varying vec3 vCol;
varying vec2 vUv;
varying float vUp;
void main(){
  vUv = uv; vCol = color;
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
  #endif
  vUp = normalize(n).y;
  vec4 mvPosition = modelViewMatrix * p;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const TOWN_FS = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D map;
uniform sampler2D emap;
uniform float uHasMap;
uniform float uHasE;
uniform vec3 uAmb;
uniform vec3 uFlash;
uniform vec3 uColor;
varying vec3 vCol;
varying vec2 vUv;
varying float vUp;
void main(){
  vec3 base = uColor * vCol;
  if (uHasMap > 0.5) base *= texture2D(map, vUv).rgb;
  vec3 col = base * (uAmb * (0.72 + 0.28 * vUp) + uFlash);
  if (uHasE > 0.5) col += texture2D(emap, vUv).rgb * 1.45;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

function townMat({ map = null, emap = null, color = 0xffffff, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      map: { value: map }, emap: { value: emap },
      uHasMap: { value: map ? 1 : 0 }, uHasE: { value: emap ? 1 : 0 },
      uColor: { value: new THREE.Color(color) },
      uAmb: shared.uAmb, uFlash: shared.uFlash,
    },
    vertexShader: TOWN_VS, fragmentShader: TOWN_FS, fog: true, side,
  });
}

const STRIP_VS = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aSeed;
varying vec2 vUv;
varying float vSeed;
void main(){
  vUv = uv; vSeed = aSeed;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const STRIP_FS = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D map;
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
void main(){
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.05) discard;
  float row = floor(vUv.y * 46.0);
  float mode = mod(floor(uTime / 7.0 + vSeed * 3.0), 3.0);
  float tw = mode < 1.0 ? 0.55 + 0.45 * sin(uTime * 3.0 + vSeed * 20.0 + row * 0.8)
           : mode < 2.0 ? step(0.5, fract(uTime * 0.9 - row * 0.06 + vSeed)) * 0.85 + 0.15
           : 0.8 + 0.2 * sin(uTime * 1.5 + vSeed * 9.0);
  gl_FragColor = vec4(t.rgb * 2.3 * tw, t.a);
  #include <fog_fragment>
}`;

const PT_VS = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uScale;
varying vec3 vC;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float f = aSeed < 0.0 ? step(0.0, sin(uTime * 2.2 + aSeed)) * 0.95 + 0.05
                        : 0.82 + 0.12 * sin(uTime * (7.0 + aSeed) + aSeed * 9.0) + 0.06 * sin(uTime * 19.0 + aSeed);
  vC = aColor * f;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PT_FS = /* glsl */ `
uniform sampler2D map;
varying vec3 vC;
void main(){
  vec4 t = texture2D(map, gl_PointCoord);
  if (t.a < 0.01) discard;
  gl_FragColor = vec4(vC * t.rgb * t.a, t.a);
}`;

/* ----------------------------------------------------------------- helpers */
const tmpC = new THREE.Color();
function colorize(geo, color) {
  tmpC.set(color);
  const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = tmpC.r; arr[i * 3 + 1] = tmpC.g; arr[i * 3 + 2] = tmpC.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function plane(w, h, uS, vS, uO = 0, vO = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uS + uO, uv.getY(i) * vS + vO);
  return g;
}
function boxUV(w, h, d, s = 0.5) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) * s, uv.getY(i) * h * s);
  return g;
}
const PAINTS = ['#f4a9b8', '#f6d671', '#93cbe9', '#a5e2bb', '#f7bb8c', '#c7abe2', '#efe3c5', '#bcd98c', '#f2f0e8',
  '#f39c4a', '#69cbc1', '#e8c8a0', '#d9d4cc', '#ffcf9e', '#9fd3d8'];

/* ------------------------------------------------------------------- town */
export function createTown(scene, { lowPower = false } = {}) {
  const rand = mulberry32(2024);
  const R = (a, b) => a + rand() * (b - a);
  const chance = (p) => rand() < p;
  const LIMIT = lowPower ? 95 : 135;

  const S = lowPower ? 512 : 1024;
  const facades = [
    TT.facadeTextures('home', 11, S), TT.facadeTextures('shop', 12, S),
    ...(lowPower ? [] : [TT.facadeTextures('home', 13, S), TT.facadeTextures('shop', 14, S)]),
  ];
  const homeIdx = lowPower ? [0] : [0, 2], shopIdx = lowPower ? [1] : [1, 3];
  const wallBuckets = facades.map(() => []);
  const plasterGeos = [], roofGeos = [], roadGeos = [], curbGeos = [], stripGeos = [], concreteGeos = [];
  const tanks = [], dishes = [], rebars = [], kandils = [], trunks = [], crowns = [], poles = [];
  const ptPos = [], ptCol = [], ptSize = [], ptSeed = [];
  const wires = [];
  const addPt = (x, y, z, c, size, seed) => { ptPos.push(x, y, z); ptCol.push(c[0], c[1], c[2]); ptSize.push(size); ptSeed.push(seed); };

  // zones nothing may be built on
  const reserved = [
    { x0: -6.6, x1: 6.6, z0: -12.6, z1: 4.8 },   // our plot
    { x0: -300, x1: 300, z0: 4.8, z1: 11.4 },    // main road
    { x0: 21, x1: 39, z0: -57, z1: -39 },        // temple
    { x0: -53, x1: -45, z0: -63, z1: -55 },      // mobile tower
    { x0: -47, x1: -41, z0: -300, z1: 4.8 },     // cross street west
    { x0: 41, x1: 47, z0: -300, z1: 4.8 },       // cross street east
    { x0: -47, x1: -41, z0: 11.4, z1: 300 },
    { x0: 41, x1: 47, z0: 11.4, z1: 300 },
  ];
  const blocked = (x0, x1, z0, z1) => reserved.some((r) => x0 < r.x1 && x1 > r.x0 && z0 < r.z1 && z1 > r.z0);

  /* ------------ one building */
  const building = (x0, x1, zFront, facing, depth, roadSide) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const z0 = facing > 0 ? zFront - depth : zFront, z1 = facing > 0 ? zFront : zFront + depth;
    const cz = (z0 + z1) / 2;
    if (Math.hypot(cx, cz) > LIMIT || blocked(x0, x1, z0, z1)) return;
    const roll = rand();
    if (roll < 0.06) { // empty plot: a neem tree maybe
      if (chance(0.7)) tree(cx + R(-1, 1), cz + R(-1, 1));
      return;
    }
    const floors = roll < 0.13 ? 1 : roll < 0.45 ? 2 : roll < 0.8 ? 3 : 4;
    const H = floors * FLOOR;
    if (roll > 0.94) return underConstruction(x0, x1, z0, z1, floors);
    const paint = PAINTS[(rand() * PAINTS.length) | 0];
    const tint = new THREE.Color(paint).multiplyScalar(R(0.88, 1.05));
    const shop = roadSide ? chance(0.6) : chance(0.2);
    const fIdx = shop ? shopIdx[(rand() * shopIdx.length) | 0] : homeIdx[(rand() * homeIdx.length) | 0];
    const sideIdx = homeIdx[(rand() * homeIdx.length) | 0];
    const vS = H / (4 * FLOOR);
    const uO = ((rand() * 4) | 0) / 4;
    const add = (bucket, geo) => wallBuckets[bucket].push(colorize(geo, tint));
    // front
    const fg = plane(w, H, w / BAY / 4, vS, uO);
    fg.rotateY(facing > 0 ? 0 : Math.PI); fg.translate(cx, H / 2, facing > 0 ? z1 : z0);
    add(fIdx, fg);
    // back
    const bg = plane(w, H, w / BAY / 4, vS, uO + 0.5);
    bg.rotateY(facing > 0 ? Math.PI : 0); bg.translate(cx, H / 2, facing > 0 ? z0 : z1);
    add(sideIdx, bg);
    // sides
    for (const sx of [-1, 1]) {
      const sg = plane(depth, H, depth / BAY / 4, vS, R(0, 1));
      sg.rotateY(sx * Math.PI / 2); sg.translate(sx > 0 ? x1 : x0, H / 2, cz);
      add(sideIdx, sg);
    }
    // roof slab + parapet
    const rg = plane(w, depth, w / 4, depth / 4);
    rg.rotateX(-Math.PI / 2); rg.translate(cx, H, cz);
    roofGeos.push(colorize(rg, new THREE.Color(0.75, 0.73, 0.7).multiplyScalar(R(0.8, 1.1))));
    const ph = R(0.8, 1.05);
    const par = [[w, ph, 0.2, cx, z0 + 0.1], [w, ph, 0.2, cx, z1 - 0.1], [0.2, ph, depth, x0 + 0.1, cz], [0.2, ph, depth, x1 - 0.1, cz]];
    for (const [bw, bh, bd, bx, bz] of par) {
      const g = boxUV(bw, bh, bd); g.translate(bx, H + bh / 2, bz); plasterGeos.push(colorize(g, tint));
    }
    // stair room (mumty) + water tank
    let tankY = H, tx = cx + R(-w / 4, w / 4), tz = cz + R(-depth / 4, depth / 4);
    if (chance(0.5) && w > 5) {
      const mx = facing > 0 ? x0 + 1.6 : x1 - 1.6, mz = facing > 0 ? z0 + 1.7 : z1 - 1.7;
      const g = boxUV(2.8, 2.6, 3.0); g.translate(mx, H + 1.3, mz); plasterGeos.push(colorize(g, tint));
      tankY = H + 2.6; tx = mx; tz = mz;
      if (chance(0.5)) addPt(mx + (facing > 0 ? 0 : 0), H + 2.3, mz + facing * 1.55, [2.4, 2.6, 2.8], 0.35, 3 + rand());
    }
    if (chance(0.75)) tanks.push([tx, tankY, tz, R(0.85, 1.15)]);
    if (chance(0.35)) dishes.push([x0 + R(0.6, w - 0.6), H + ph, facing > 0 ? z1 - 0.3 : z0 + 0.3, R(0, Math.PI * 2)]);
    if (chance(0.18)) for (const [rx, rz] of [[x0 + 0.25, z0 + 0.25], [x1 - 0.25, z0 + 0.25], [x0 + 0.25, z1 - 0.25], [x1 - 0.25, z1 - 0.25]]) {
      for (let k = 0; k < 4; k++) rebars.push([rx + R(-0.08, 0.08), H, rz + R(-0.08, 0.08), R(-0.15, 0.15), R(-0.15, 0.15), R(0.7, 1.2)]);
    }
    // festive: light strands down the front, diyas on the parapet, a kandil
    const fz = (facing > 0 ? z1 : z0) + facing * 0.06;
    if (chance(roadSide ? 0.7 : 0.45)) {
      const sh = R(2.2, Math.max(2.4, H * 0.75));
      const sg = plane(w * 0.96, sh, w / 8, 1, R(0, 1));
      sg.rotateY(facing > 0 ? 0 : Math.PI); sg.translate(cx, H - sh / 2 + 0.25, fz);
      const seeds = new Float32Array(sg.attributes.position.count).fill(rand());
      sg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
      stripGeos.push(sg);
    }
    if (chance(0.45)) {
      const n = Math.floor(w / 0.75);
      for (let i = 0; i < n; i++) addPt(x0 + 0.4 + i * ((w - 0.8) / Math.max(1, n - 1)), H + ph + 0.06, facing > 0 ? z1 - 0.1 : z0 + 0.1, [2.6, 1.5, 0.45], 0.16, rand() * 6);
    }
    if (floors >= 2 && chance(0.3)) kandils.push([x0 + R(1, w - 1), FLOOR * ((1 + rand() * (floors - 1)) | 0) + 2.1, fz + facing * 0.45, (rand() * 5) | 0]);
  };

  const underConstruction = (x0, x1, z0, z1, floors) => {
    const cols = [];
    for (let x = x0 + 0.2; x <= x1 - 0.2 + 1e-3; x += (x1 - x0 - 0.4) / 2) for (let z = z0 + 0.2; z <= z1 - 0.2 + 1e-3; z += (z1 - z0 - 0.4) / 2) cols.push([x, z]);
    for (let f = 0; f < floors; f++) {
      for (const [x, z] of cols) { const g = new THREE.BoxGeometry(0.3, FLOOR, 0.3); g.translate(x, f * FLOOR + FLOOR / 2, z); concreteGeos.push(colorize(g, '#9a958d')); }
      const s = new THREE.BoxGeometry(x1 - x0, 0.15, z1 - z0); s.translate((x0 + x1) / 2, (f + 1) * FLOOR, (z0 + z1) / 2);
      concreteGeos.push(colorize(s, '#8c877f'));
    }
    for (const [x, z] of cols) for (let k = 0; k < 4; k++) rebars.push([x + R(-0.1, 0.1), floors * FLOOR, z + R(-0.1, 0.1), R(-0.2, 0.2), R(-0.2, 0.2), R(0.8, 1.4)]);
  };

  const tree = (x, z) => {
    if (blocked(x - 1.5, x + 1.5, z - 1.5, z + 1.5)) return;
    const h = R(3, 5.5);
    trunks.push([x, z, h]);
    for (let k = 0; k < 3; k++) crowns.push([x + R(-1, 1), h + R(-0.3, 1.2), z + R(-1, 1), R(1.4, 2.3)]);
  };

  /* ------------ rows of buildings, with lanes between */
  const row = (zFront, facing, roadSide) => {
    let x = -LIMIT;
    while (x < LIMIT) {
      const w = R(6, 11), depth = R(8, 11);
      building(x, x + w, zFront, facing, depth, roadSide);
      x += w + (chance(0.25) ? R(0.3, 1.2) : 0.05);
    }
  };
  // our side of the road: houses set back like ours, facing the road
  let x = -LIMIT;
  while (x < LIMIT) {
    const w = R(6.5, 11);
    if (!(x < 6.8 && x + w > -6.8)) building(x, x + w, R(1, 4), 1, R(10, 14), true);
    x += w + 0.05;
  }
  // back-to-back rows of houses, each pair separated by a 4.5 m gali
  const lanes = [[-16.5, -12.6]];
  for (let z = 11.6; z < LIMIT; z += 26.5) { row(z, -1, z < 12); row(z + 22, 1, false); lanes.push([z + 22, z + 26.5]); }
  for (let z = -16.5; z > -LIMIT; z -= 26.5) { row(z, 1, false); row(z - 22, -1, false); lanes.push([z - 26.5, z - 22]); }
  for (let i = 0; i < 26; i++) tree(R(-LIMIT, LIMIT), R(-LIMIT, LIMIT));
  for (const [a, b] of lanes.slice(0, 5)) for (let k = 0; k < 5; k++) tree(R(-90, 90), (a + b) / 2 + R(-0.6, 0.6));

  /* ------------ roads, lanes, curbs */
  const road = (x0, x1, z0, z1) => {
    const g = plane(x1 - x0, z1 - z0, (x1 - x0) / 6, (z1 - z0) / 6);
    g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
    roadGeos.push(colorize(g, '#ffffff'));
  };
  road(-260, 260, 5, 11);
  road(-47, -41, -260, 5); road(41, 47, -260, 5); road(-47, -41, 11, 260); road(41, 47, 11, 260);
  for (const [a, b] of lanes) road(-260, 260, a, b);
  for (const zc of [5.1, 10.9]) {
    for (let x0 = -200; x0 < 200; x0 += 20) {
      if (zc < 6 && x0 < 6 && x0 + 20 > -6) continue;
      const g = boxUV(20, 0.16, 0.2, 1); const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 20 / 1.3, uv.getY(i));
      g.translate(x0 + 10, 0.08, zc); curbGeos.push(colorize(g, '#ffffff'));
    }
  }

  /* ------------ poles, wires, sodium lamps */
  const glowTex = TT.glowTexture();
  const lampGlows = [];
  const poleTops = [];
  for (let px = -130; px <= 130; px += 23) {
    const pz = 10.6;
    poles.push([px, pz, 8]);
    poleTops.push(new THREE.Vector3(px, 7.8, pz));
    // lamp arm reaching over the road
    const arm = new THREE.BoxGeometry(0.06, 0.06, 1.6); arm.translate(px, 6.6, pz - 0.8); concreteGeos.push(colorize(arm, '#55585c'));
    addPt(px, 6.5, pz - 1.55, [3.2, 1.6, 0.45], 0.9, 2 + rand());
    lampGlows.push([px, pz - 2.2]);
    // service drops to houses across the road
    for (let k = 0; k < 2; k++) {
      const hz = 11.6 + 0.05, hx = px + R(-8, 8);
      wires.push(...sagLine(new THREE.Vector3(px, 7.4, pz), new THREE.Vector3(hx, R(4.5, 6.5), hz), 0.25, 8));
    }
  }
  for (let i = 0; i < poleTops.length - 1; i++) {
    for (const [dy, s] of [[0, 0.5], [-0.3, 0.6], [-0.6, 0.7], [-0.15, 0.9]]) {
      const a = poleTops[i].clone().add(new THREE.Vector3(0, dy, 0)), b = poleTops[i + 1].clone().add(new THREE.Vector3(0, dy, 0));
      wires.push(...sagLine(a, b, s, 14));
    }
  }
  // a wire to our own parapet, and lane poles
  wires.push(...sagLine(new THREE.Vector3(0, 7.4, 10.6), new THREE.Vector3(4.9, 5.6, -5), 0.6, 12));
  for (const lz of lanes.slice(0, 4).map(([a, b]) => (a + b) / 2)) {
    let prev = null;
    for (let px = -110; px <= 110; px += 30) {
      poles.push([px, lz, 6.5]);
      const top = new THREE.Vector3(px, 6.3, lz);
      if (prev) wires.push(...sagLine(prev, top, 0.6, 12));
      prev = top;
      addPt(px, 5.4, lz, [3.0, 1.5, 0.4], 0.7, 2 + rand());
    }
  }

  /* ------------ temple with a lit shikhara */
  const temple = new THREE.Group();
  temple.position.set(30, 0, -48);
  const templeMat = townMat({ map: plasterTexture('#f0dcb0', 5), color: 0xffffff });
  const tb = colorize(boxUV(16, 1.4, 16, 0.3), '#e9d3a6'); tb.translate(0, 0.7, 0);
  const tm = colorize(boxUV(8, 5, 8, 0.3), '#efd9a8'); tm.translate(0, 1.4 + 2.5, 3);
  const ts = colorize(boxUV(6.5, 4, 6.5, 0.3), '#efd9a8'); ts.translate(0, 1.4 + 2, -2.5);
  const prof = [[4.1, 0], [4, 2], [3.7, 5], [3.2, 8], [2.5, 11], [1.7, 13.4], [0.9, 15.2], [0.35, 16], [0, 16.4]].map(([a, b]) => new THREE.Vector2(a, b));
  const sk = new THREE.LatheGeometry(prof, 8); sk.translate(0, 5.4, -2.5); colorize(sk, '#f3dca8');
  temple.add(new THREE.Mesh(mergeGeometries([tb, tm, ts, sk]), templeMat));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.55, 0.05), side: THREE.DoubleSide }));
  flag.position.set(0.7, 5.4 + 17.6, -2.5);
  temple.add(flag);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2), new THREE.MeshBasicMaterial({ color: 0x332211 }));
  pole.position.set(0, 5.4 + 17.3, -2.5); temple.add(pole);
  scene.add(temple);
  for (let rIdx = 0; rIdx < 8; rIdx++) {
    const a = (rIdx / 8) * Math.PI * 2 + Math.PI / 8;
    for (let k = 0; k < prof.length - 1; k++) for (let s = 0; s < 4; s++) {
      const t = s / 4, p0 = prof[k], p1 = prof[k + 1];
      const rr = (p0.x + (p1.x - p0.x) * t) * Math.cos(Math.PI / 8), yy = p0.y + (p1.y - p0.y) * t;
      addPt(30 + Math.cos(a) * rr, 5.4 + yy, -48 - 2.5 + Math.sin(a) * rr, [2.8, 1.9, 0.6], 0.28, rand() * 6);
    }
  }
  for (let k = 0; k < 64; k++) {
    const t = k / 64, side = Math.floor(t * 4), u = (t * 4) % 1;
    const pts = [[-8, -8], [8, -8], [8, 8], [-8, 8], [-8, -8]];
    const [ax, az] = pts[side], [bx, bz] = pts[side + 1];
    addPt(30 + ax + (bx - ax) * u, 1.45, -48 + az + (bz - az) * u, [2.6, 1.6, 0.5], 0.25, rand() * 6);
  }

  /* ------------ mobile tower with aviation lights */
  const tw = [];
  const TH = 36, B = 1.8, T = 0.5;
  const leg = (sx, sz, h) => new THREE.Vector3(-49 + sx * (B + (T - B) * (h / TH)), h, -59 + sz * (B + (T - B) * (h / TH)));
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let h = 0; h < TH; h += 3) {
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
      tw.push(leg(ax, az, h), leg(ax, az, h + 3));
      tw.push(leg(ax, az, h), leg(bx, bz, h + 3));
      tw.push(leg(ax, az, h + 3), leg(bx, bz, h + 3));
    }
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tw), new THREE.LineBasicMaterial({ color: 0x3a3d44, fog: true })));
  addPt(-49, TH + 0.3, -59, [4, 0.2, 0.15], 1.2, -1);
  addPt(-49, TH * 0.55, -59, [4, 0.2, 0.15], 0.9, -2.5);

  /* ------------ horizon: far city ring */
  const skyTex = [skylineTexture(3, true), skylineTexture(8), skylineTexture(13), skylineTexture(21)];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, rr = LIMIT + 50;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * rr * Math.tan(Math.PI / 10) * 1.02, 40),
      new THREE.MeshBasicMaterial({ map: skyTex[i % skyTex.length], transparent: true, depthWrite: false, fog: false, color: new THREE.Color(0.9, 0.9, 0.95) }));
    m.position.set(Math.sin(a) * rr, 18, Math.cos(a) * rr);
    m.lookAt(0, 18, 0);
    m.renderOrder = -5;
    scene.add(m);
  }

  /* ------------ build meshes */
  const addMerged = (geos, mat) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.matrixAutoUpdate = false;
    scene.add(m);
    geos.forEach((g) => g.dispose());
    return m;
  };
  wallBuckets.forEach((geos, i) => addMerged(geos, townMat({ map: facades[i].map, emap: facades[i].emissive, side: THREE.DoubleSide })));
  const plasterTex = plasterTexture('#ebe6dc', 31); plasterTex.wrapS = plasterTex.wrapT = THREE.RepeatWrapping;
  addMerged(plasterGeos, townMat({ map: plasterTex }));
  addMerged(concreteGeos, townMat({ map: TT.concreteTexture(4, '#a29d95') }));
  addMerged(roofGeos, townMat({ map: TT.concreteTexture(2) }));
  addMerged(roadGeos, townMat({ map: TT.asphaltTexture(), color: 0xcfcfcf }));
  addMerged(curbGeos, townMat({ map: TT.curbTexture() }));
  if (stripGeos.length) {
    const tex = dotStripTexture(6); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(mergeGeometries(stripGeos), new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), map: { value: tex }, uTime: shared.uTime },
      vertexShader: STRIP_VS, fragmentShader: STRIP_FS, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    }));
    m.matrixAutoUpdate = false;
    scene.add(m);
  }
  // ground beyond our courtyard
  const dirt = TT.dirtTexture();
  const gg = plane(600, 600, 120, 120); gg.rotateX(-Math.PI / 2); colorize(gg, '#ffffff');
  const ground = new THREE.Mesh(gg, townMat({ map: dirt, color: 0xb0a594 }));
  ground.matrixAutoUpdate = false;
  scene.add(ground);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SV = new THREE.Vector3();
  const inst = (geo, mat, list, fill) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { fill(it); m.setMatrixAt(i, M); });
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const tankGeo = colorize(new THREE.CylinderGeometry(0.58, 0.6, 1.15, 14).translate(0, 0.575, 0), '#141414');
  inst(tankGeo, townMat({ color: 0xffffff }), tanks, ([x, y, z, s]) => M.compose(V.set(x, y, z), Q.identity(), SV.set(s, s, s)));
  const dishGeo = colorize(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, 0.75).rotateX(-1.1).translate(0, 0.45, 0), '#d6d6d6');
  inst(dishGeo, townMat({ side: THREE.DoubleSide }), dishes, ([x, y, z, ry]) => M.compose(V.set(x, y, z), Q.setFromEuler(new THREE.Euler(0, ry, 0)), SV.set(1, 1, 1)));
  const rebarGeo = colorize(new THREE.CylinderGeometry(0.014, 0.014, 1, 4).translate(0, 0.5, 0), '#6b3b22');
  inst(rebarGeo, townMat(), rebars, ([x, y, z, rx, rz, h]) => M.compose(V.set(x, y, z), Q.setFromEuler(new THREE.Euler(rx, 0, rz)), SV.set(1, h, 1)));
  const poleGeo = colorize(new THREE.CylinderGeometry(0.09, 0.14, 1, 8).translate(0, 0.5, 0), '#8d8a84');
  inst(poleGeo, townMat(), poles, ([x, z, h]) => M.compose(V.set(x, 0, z), Q.identity(), SV.set(1, h, 1)));
  const trunkGeo = colorize(new THREE.CylinderGeometry(0.12, 0.22, 1, 6).translate(0, 0.5, 0), '#3b2a1e');
  inst(trunkGeo, townMat(), trunks, ([x, z, h]) => M.compose(V.set(x, 0, z), Q.identity(), SV.set(1, h, 1)));
  const crownGeo = colorize(new THREE.IcosahedronGeometry(1, 1), '#24391f');
  inst(crownGeo, townMat(), crowns, ([x, y, z, s]) => M.compose(V.set(x, y, z), Q.setFromEuler(new THREE.Euler(rand(), rand(), rand())), SV.set(s, s * 0.8, s)));
  const KCOL = [[2.6, 0.5, 0.1], [2.6, 1.4, 0.1], [2.4, 0.2, 0.5], [0.9, 0.3, 2.4], [2.6, 0.2, 0.15]];
  const km = inst(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 8), new THREE.MeshBasicMaterial(), kandils,
    ([x, y, z]) => M.compose(V.set(x, y, z), Q.identity(), SV.set(1, 1, 1)));
  if (km) kandils.forEach((k, i) => km.setColorAt(i, new THREE.Color(...KCOL[k[3]])));
  // sodium pools on the road
  if (lampGlows.length) {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({
      map: glowTex, color: new THREE.Color(0.55, 0.28, 0.06), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }), lampGlows.length);
    lampGlows.forEach(([x, z], i) => { M.compose(V.set(x, 0.03, z), Q.identity(), SV.set(9, 1, 9)); m.setMatrixAt(i, M); });
    m.frustumCulled = false;
    scene.add(m);
  }
  // wires
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wires), new THREE.LineBasicMaterial({ color: 0x0c0c0e, fog: true })));

  // light points (diyas on parapets, tubelights, lamps, temple, tower)
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(ptPos, 3));
  pg.setAttribute('aColor', new THREE.Float32BufferAttribute(ptCol, 3));
  pg.setAttribute('aSize', new THREE.Float32BufferAttribute(ptSize, 1));
  pg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ptSeed, 1));
  const points = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: { map: { value: sparkTexture() }, uTime: shared.uTime, uScale: shared.uScale },
    vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  scene.add(points);

  return {
    update(t) { shared.uTime.value = t; flag.rotation.y = Math.sin(t * 2) * 0.25; },
    setScale(px) { shared.uScale.value = px; },
    setFlash(c) { shared.uFlash.value.copy(c); },
  };
}

function sagLine(a, b, sag, n) {
  const out = [];
  let prev = a.clone();
  for (let k = 1; k <= n; k++) {
    const u = k / n;
    const p = new THREE.Vector3().lerpVectors(a, b, u);
    p.y -= sag * 4 * u * (1 - u);
    out.push(prev, p);
    prev = p;
  }
  return out;
}
