// Cracker catalogue + procedural 3D models that look like the real Indian patakas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TX from './textures.js';

export const CATALOG = [
  { id: 'bullet', name: 'Bullet Bomb', hindi: 'बुलेट बम', price: 40, unit: 'box of 10', kind: 'bang', power: 0.42, smoke: 6, fuseTime: 3, boom: 'PATAK!', desc: 'Chhota packet, bada dhamaka. Sharp and snappy.' },
  { id: 'chocolate', name: 'Chocolate Bomb', hindi: 'चॉकलेट बम', price: 20, unit: 'per piece', kind: 'bang', power: 0.62, smoke: 9, fuseTime: 3, boom: 'DHAMAAKA!', desc: 'Brown-paper classic tied with sutli.' },
  { id: 'alu', name: 'Alu Bomb', hindi: 'आलू बम', price: 50, unit: 'per piece', kind: 'bang', power: 0.82, smoke: 16, fuseTime: 3, boom: 'DHADAAM!', desc: 'Lumpy like a potato, loud like thunder.' },
  { id: 'sutli', name: 'Sutli Bomb', hindi: 'सुतली बम', price: 60, unit: 'per piece', kind: 'bang', power: 1.0, smoke: 25, fuseTime: 3, boom: 'BHADAAAM!!', desc: 'Jute-wrapped king of noise. Ears ready?' },
  { id: 'ladi', name: 'Ladi · 100 Wala', hindi: 'लड़ी', price: 120, unit: 'per string', kind: 'ladi', smoke: 45, fuseTime: 3, boom: 'TADA-TADA-TAD!', desc: 'A string that goes off like a machine gun.' },
  { id: 'anar', name: 'Anar', hindi: 'अनार', price: 80, unit: 'per piece', kind: 'fountain', smoke: 22, fuseTime: 3, boom: 'WOW!', desc: 'Flower-pot fountain of golden sparks.' },
  { id: 'phuljhari', name: 'Phuljhari', hindi: 'फुलझड़ी', price: 30, unit: 'box of 10', kind: 'sparkler', smoke: 5, fuseTime: 0, boom: 'CHAMAK!', desc: 'Light it and wave it — draw with sparks.' },
  { id: 'chakri', name: 'Chakri', hindi: 'चकरी', price: 40, unit: 'per piece', kind: 'spinner', smoke: 12, fuseTime: 3, boom: 'GHOOM!', desc: 'Ground spinner that whirls in colours.' },
  { id: 'rocket', name: 'Rocket', hindi: 'रॉकेट', price: 30, unit: 'per piece', kind: 'rocket', smoke: 8, fuseTime: 3, boom: 'WHOOOSH!', desc: 'Bottle rocket — shoots up, bursts in the sky.' },
  { id: 'balloon', name: 'Balloon Sky Shot', hindi: 'गुब्बारा शॉट', price: 150, unit: '5 shots', kind: 'skyshot', smoke: 40, fuseTime: 3, boom: 'DHOOM!', desc: 'Five shells bloom into balloons of colour.' },
];

const S = 1.8; // models are a touch larger than life so they read on screen
const cache = new Map();
const C = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
const paper = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.72, ...o });
const solid = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** A burnable fuse (bati). Burns from its free tip back to the body. */
export function makeFuse(points, { radius = 0.0026, color = 0x6f7f45, segs = 28 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  const radial = 6;
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  m.castShadow = true;
  return {
    mesh: m, curve,
    setBurn(f) { geo.setDrawRange(0, Math.max(0, Math.round((1 - f) * segs)) * radial * 6); },
    worldPoint(f, out = new THREE.Vector3()) {
      curve.getPoint(Math.max(0, Math.min(1, 1 - f)), out);
      return m.localToWorld(out);
    },
  };
}

/* ----------------------------------------------------------------- models */

function bullet() {
  const g = new THREE.Group();
  const t = C('bullet', () => TX.paperTexture({
    bg: '#c8102e', bands: [{ y: 0.06, h: 0.09, color: '#ffd23f' }, { y: 0.85, h: 0.09, color: '#ffd23f' }],
    text: 'BULLET', sub: 'बुलेट बम', repeatText: 2, font: `800 66px ${TX.FONT_EN}`, subFont: `46px ${TX.FONT_HI}`, seed: 2,
  }));
  g.add(mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.09, 28), paper(t), 0, 0.051, 0));
  const nose = mesh(new THREE.SphereGeometry(0.019, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    paper(C('gold', () => TX.foilTexture('#d4a017')), { metalness: 0.7, roughness: 0.3 }), 0, 0.096, 0);
  nose.scale.y = 1.9; g.add(nose);
  g.add(mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.006, 28), solid(0x5b3a21), 0, 0.003, 0));
  const fuse = makeFuse([[0, 0.128, 0], [0.002, 0.142, 0.001], [0.01, 0.154, 0.004], [0.022, 0.16, 0.008]]);
  g.add(fuse.mesh);
  return { group: g, fuse, debris: ['#c8102e', '#ffd23f', '#7a0a14', '#e8d9b5'] };
}

function chocolate() {
  const g = new THREE.Group();
  const t = C('choco', () => TX.paperTexture({
    bg: '#5d3a1a', bands: [{ y: 0.28, h: 0.44, color: '#8b1a1a' }],
    text: 'CHOCOLATE', sub: 'चॉकलेट बम', textColor: '#ffe8b0', font: `800 54px ${TX.FONT_EN}`, subFont: `40px ${TX.FONT_HI}`,
    seed: 3, textY: 0.4, subY: 0.62,
  }));
  g.add(mesh(new RoundedBoxGeometry(0.07, 0.048, 0.052, 3, 0.008), paper(t), 0, 0.024, 0));
  const twine = solid(0xc8a165, { roughness: 1 });
  g.add(mesh(new THREE.BoxGeometry(0.0726, 0.0506, 0.004), twine, 0, 0.024, 0));
  g.add(mesh(new THREE.BoxGeometry(0.004, 0.0506, 0.0546), twine, 0, 0.024, 0));
  const fuse = makeFuse([[0, 0.047, 0], [0.001, 0.062, 0.002], [0.008, 0.076, 0.006], [0.02, 0.084, 0.01]]);
  g.add(fuse.mesh);
  return { group: g, fuse, debris: ['#5d3a1a', '#8b1a1a', '#c8a165', '#3b2410'] };
}

function sutli() {
  const g = new THREE.Group();
  const t = C('twine', () => TX.twineTexture());
  const ball = mesh(new THREE.SphereGeometry(0.05, 48, 32), paper(t, { roughness: 1 }), 0, 0.046, 0);
  ball.scale.y = 0.92; g.add(ball);
  const ringMat = solid(0xb08850, { roughness: 1 });
  for (const [rx, ry, rz] of [[Math.PI / 2, 0, 0.3], [Math.PI / 2, 0, -0.9], [0.4, 0, Math.PI / 2], [1.1, 0.6, 0.2]]) {
    const ring = mesh(new THREE.TorusGeometry(0.0503, 0.0024, 6, 56), ringMat, 0, 0.046, 0);
    ring.rotation.set(rx, ry, rz); ring.scale.y = 0.92; g.add(ring);
  }
  const fuse = makeFuse([[0, 0.09, 0], [0.002, 0.106, 0.002], [0.01, 0.12, 0.006], [0.024, 0.128, 0.01]]);
  g.add(fuse.mesh);
  return { group: g, fuse, debris: ['#b08850', '#8a6634', '#d9b77a', '#6e4f28'] };
}

function alu() {
  const g = new THREE.Group();
  const geo = C('aluGeo', () => {
    const gg = new THREE.IcosahedronGeometry(0.047, 5);
    const p = gg.attributes.position, v = new THREE.Vector3();
    const waves = Array.from({ length: 6 }, (_, i) => ({
      k: new THREE.Vector3(Math.sin(i * 2.1), Math.cos(i * 1.7), Math.sin(i * 0.9 + 1)).normalize().multiplyScalar(30 + i * 9),
      ph: i * 1.37, a: 0.07 / (1 + i * 0.4),
    }));
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let d = 1;
      for (const w of waves) d += Math.sin(v.dot(w.k) + w.ph) * w.a;
      v.multiplyScalar(d);
      p.setXYZ(i, v.x * 1.15, v.y * 0.82, v.z);
    }
    gg.computeVertexNormals();
    gg.userData.keep = true;
    return gg;
  });
  g.add(mesh(geo, paper(C('alu', () => TX.aluTexture()), { roughness: 0.9 }), 0, 0.042, 0));
  const ringMat = solid(0xc8a165, { roughness: 1 });
  for (const rz of [0.2, -1.2]) {
    const ring = mesh(new THREE.TorusGeometry(0.05, 0.0022, 6, 48), ringMat, 0, 0.042, 0);
    ring.rotation.set(Math.PI / 2, 0, rz); ring.scale.set(1.12, 1, 0.8); g.add(ring);
  }
  const fuse = makeFuse([[0, 0.076, 0], [0.002, 0.092, 0.002], [0.01, 0.106, 0.006], [0.024, 0.114, 0.01]]);
  g.add(fuse.mesh);
  return { group: g, fuse, debris: ['#8c5a33', '#b3121f', '#e1d7c3', '#5a3a20'] };
}

function anar() {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.046, 0], [0.047, 0.006], [0.044, 0.025], [0.04, 0.045], [0.035, 0.065], [0.03, 0.085],
    [0.025, 0.1], [0.02, 0.115], [0.015, 0.13], [0.012, 0.14], [0, 0.141]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = mesh(new THREE.LatheGeometry(pts, 40), paper(C('anar', () => TX.anarTexture())));
  g.add(body);
  g.add(mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.014, 16), solid(0x8b5a3c), 0, 0.146, 0));
  const fuse = makeFuse([[0, 0.152, 0], [0.002, 0.168, 0.002], [0.01, 0.182, 0.006], [0.022, 0.19, 0.01]]);
  g.add(fuse.mesh);
  return { group: g, fuse, nozzle: new THREE.Vector3(0, 0.153, 0), leavesShell: true, debris: ['#c62828', '#ffd23f', '#1b7a3a'] };
}

function phuljhari() {
  const g = new THREE.Group();
  const potPts = [[0, 0], [0.03, 0], [0.038, 0.02], [0.036, 0.045], [0.041, 0.05], [0.035, 0.053], [0.032, 0.046], [0, 0.046]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(potPts, 28), solid(0x9c4a24)));
  const sand = mesh(new THREE.CircleGeometry(0.033, 24), solid(0xc2a878, { roughness: 1 }), 0, 0.047, 0);
  sand.rotation.x = -Math.PI / 2; g.add(sand);
  const stick = new THREE.Group();
  stick.position.set(0, 0.035, 0);
  stick.rotation.z = 0.12;
  stick.add(mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.3, 6), solid(0x9aa0a6, { metalness: 0.8, roughness: 0.4 }), 0, 0.15, 0));
  const coatGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.19, 10);
  coatGeo.translate(0, 0.095, 0);
  const coat = mesh(coatGeo, solid(0x4d4b48, { roughness: 1 }), 0, 0.105, 0);
  stick.add(coat);
  g.add(stick);
  return { group: g, fuse: null, stick, coat, coatBase: 0.105, coatLen: 0.19, tipLocal: new THREE.Vector3(0, 0.295, 0), debris: [] };
}

function chakri() {
  const g = new THREE.Group();
  const spinner = new THREE.Group();
  g.add(spinner);
  const N = 160, turns = 3.2, pts = [];
  for (let k = 0; k <= N; k++) {
    const th = (k / N) * turns * Math.PI * 2, r = 0.012 + (0.038 * k) / N;
    pts.push(new THREE.Vector3(Math.cos(th) * r, 0.0068, Math.sin(th) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tex = C('chakri', () => {
    const t = TX.stripeTexture(['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa']);
    t.repeat.set(30, 1);
    return t;
  });
  spinner.add(mesh(new THREE.TubeGeometry(curve, 300, 0.0064, 8, false), paper(tex)));
  spinner.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.015, 20), solid(0xc62828), 0, 0.0075, 0));
  const end = pts[pts.length - 1];
  const tan = curve.getTangent(1).setY(0).normalize();
  const fuse = makeFuse([
    end.clone(),
    end.clone().addScaledVector(tan, 0.01).setY(0.012),
    end.clone().addScaledVector(tan, 0.016).setY(0.03),
    end.clone().addScaledVector(tan, 0.018).setY(0.05),
  ]);
  spinner.add(fuse.mesh);
  return { group: g, fuse, spinner, rimRadius: 0.05, leavesShell: true, debris: ['#e53935', '#fdd835', '#43a047'] };
}

function rocket() {
  const g = new THREE.Group();
  const bottlePts = [[0, 0], [0.038, 0], [0.041, 0.006], [0.041, 0.15], [0.036, 0.18], [0.02, 0.215], [0.014, 0.235],
    [0.014, 0.262], [0.0168, 0.266], [0.0168, 0.273], [0.0125, 0.273], [0.0115, 0.24]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x2f8a55, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.45, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false,
  });
  const bottle = mesh(new THREE.LatheGeometry(bottlePts, 36), glass);
  bottle.renderOrder = 1; bottle.castShadow = false;
  g.add(bottle);
  const flyer = new THREE.Group();
  g.add(flyer);
  flyer.add(mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.44, 6), solid(0xc9a26b), 0, 0.3, 0));
  const t = C('rocket', () => TX.paperTexture({
    w: 256, h: 256, bg: '#d32f2f', bands: [{ y: 0.12, h: 0.08, color: '#ffd23f' }, { y: 0.8, h: 0.08, color: '#ffd23f' }],
    text: 'ROCKET', sub: 'रॉकेट', font: `800 46px ${TX.FONT_EN}`, subFont: `40px ${TX.FONT_HI}`, motif: 'dots', seed: 9,
    textY: 0.42, subY: 0.64,
  }));
  flyer.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.085, 20), paper(t), 0.0135, 0.475, 0));
  flyer.add(mesh(new THREE.ConeGeometry(0.0118, 0.036, 20), paper(C('silver', () => TX.foilTexture('#b0bec5', 8)), { metalness: 0.8, roughness: 0.3 }), 0.0135, 0.536, 0));
  flyer.add(mesh(new THREE.CylinderGeometry(0.0105, 0.008, 0.006, 16), solid(0x6b4a2b), 0.0135, 0.43, 0));
  const fuse = makeFuse([[0.0135, 0.43, 0], [0.016, 0.412, 0.002], [0.021, 0.398, 0.006], [0.028, 0.39, 0.012]]);
  flyer.add(fuse.mesh);
  return { group: g, fuse, flyer, tail: new THREE.Vector3(0.0135, 0.426, 0), debris: [] };
}

function balloon() {
  const g = new THREE.Group();
  const t = C('skyshot', () => TX.paperTexture({
    w: 512, h: 256, bg: '#1a237e', bands: [{ y: 0.04, h: 0.1, color: '#ffc107', zig: '#ff5722' }, { y: 0.86, h: 0.1, color: '#ffc107', zig: '#ff5722' }],
    text: 'BALLOON SHOT', sub: 'गुब्बारा शॉट', motif: 'stars', font: `800 50px ${TX.FONT_EN}`, subFont: `44px ${TX.FONT_HI}`, seed: 17,
    textColor: '#ffeb3b', subColor: '#ffffff', textY: 0.4, subY: 0.64,
  }));
  g.add(mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.13, 36), paper(t), 0, 0.065, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.0425, 0.0425, 0.004, 36), solid(0xb71c1c), 0, 0.132, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.0428, 0.0428, 0.006, 36), solid(0x1b5e20), 0, 0.003, 0));
  const holeMat = solid(0x150a05, { roughness: 1 });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.002, 12), holeMat, Math.cos(a) * 0.022, 0.1345, Math.sin(a) * 0.022));
  }
  const fuse = makeFuse([[0.042, 0.02, 0], [0.052, 0.024, 0.002], [0.062, 0.036, 0.006], [0.07, 0.055, 0.01]]);
  g.add(fuse.mesh);
  return { group: g, fuse, muzzle: new THREE.Vector3(0, 0.135, 0), leavesShell: true, debris: ['#1a237e', '#ffc107', '#b71c1c'] };
}

function ladi() {
  const g = new THREE.Group();
  const cpts = [];
  for (let k = 0; k <= 12; k++) cpts.push(new THREE.Vector3(-0.34 + (0.68 * k) / 12, 0.0058, 0.035 * Math.sin(k * 1.1)));
  const curve = new THREE.CatmullRomCurve3(cpts);
  const chain = makeFuse(cpts, { radius: 0.0018, color: 0x8b1a1a, segs: 140 });
  g.add(chain.mesh);
  const N = 36;
  const t = C('ladi', () => TX.paperTexture({ w: 128, h: 64, bg: '#d50000', bands: [{ y: 0.45, h: 0.1, color: '#ffd600' }], seed: 5 }));
  const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.034, 10), paper(t), N);
  inst.castShadow = true;
  const pops = [];
  const Y = new THREE.Vector3(0, 1, 0), M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const side = i % 2 ? 1 : -1;
    const base = Math.atan2(tan.z, tan.x) + side * 1.0;
    const d = new THREE.Vector3(Math.cos(base), 0, Math.sin(base));
    const pos = p.clone().addScaledVector(d, 0.019);
    pos.y = 0.0055;
    Q.setFromUnitVectors(Y, d);
    M.compose(pos, Q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, M);
    pops.push({ u, pos, idx: i, done: false });
  }
  g.add(inst);
  const end = cpts[cpts.length - 1];
  const fuse = makeFuse([end.clone(), end.clone().add(new THREE.Vector3(0.012, 0.004, 0)), end.clone().add(new THREE.Vector3(0.022, 0.018, 0.004)), end.clone().add(new THREE.Vector3(0.026, 0.05, 0.008))]);
  g.add(fuse.mesh);
  return { group: g, fuse, chain, inst, pops, debris: ['#d50000', '#ffd600', '#8b1a1a', '#e8d9b5'] };
}

const BUILDERS = { bullet, chocolate, sutli, alu, anar, phuljhari, chakri, rocket, balloon, ladi };

export function buildCracker(id) {
  const model = BUILDERS[id]();
  model.id = id;
  model.group.scale.setScalar(S);
  model.group.traverse((o) => { if (o.isMesh && o.castShadow !== false) { o.castShadow = true; o.receiveShadow = true; } });
  return model;
}

/** Where the lighter's flame should touch. */
export function ignitionPoint(model, out = new THREE.Vector3()) {
  model.group.updateMatrixWorld(true);
  if (model.fuse) return model.fuse.worldPoint(0, out);
  return model.stick.localToWorld(out.copy(model.tipLocal));
}

export function disposeModel(model) {
  model.group.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); });
}

/** Make a spent shell look burnt (anar / chakri / sky shot). */
export function charModel(model) {
  model.group.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    if (o.material.color) o.material.color.multiplyScalar(0.28);
    if (o.material.emissive) o.material.emissive.setRGB(0, 0, 0);
  });
}
