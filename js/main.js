import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Timeline, R } from './utils.js';
import * as TX from './textures.js';
import { ParticleSystem, Debris, F, floorAt } from './particles.js';
import { createEnvironment, ROOF_Y } from './environment.js';
import { createTown } from './town.js';
import { CATALOG, buildCracker, ignitionPoint, disposeModel, charModel } from './crackers.js';
import { Lighter } from './lighter.js';
import { AudioEngine } from './audio.js';
import { runEffect, startAmbient } from './effects.js';
import { UI } from './ui.js';

const V3 = THREE.Vector3;
const mqMobile = matchMedia('(max-width: 820px)');
const lowPower = mqMobile.matches || (navigator.hardwareConcurrency || 8) <= 4;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------- renderer */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const QUALITY = [1.75, 1.5, 1.25, 1.0, 0.85, 0.7];
let qIdx = QUALITY.findIndex((q) => q <= Math.min(window.devicePixelRatio, lowPower ? 1.25 : 1.5));
if (qIdx < 0) qIdx = QUALITY.length - 1;
renderer.setPixelRatio(QUALITY[qIdx]);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 1500);
camera.position.set(0, 2.6, 7.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.2, -2);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 0.35;
controls.maxDistance = 14;
controls.maxPolarAngle = 1.48;
controls.rotateSpeed = 0.6;
controls.autoRotateSpeed = 0.7;

// MSAA render target (antialias on the canvas is useless once we post-process)
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: new URLSearchParams(location.search).has('nomsaa') ? 0 : (lowPower ? 0 : 4) });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.5, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.setPixelRatio(QUALITY[qIdx]);

/* -------------------------------------------------------------- systems */
const tl = new Timeline();
const audio = new AudioEngine();
let env, town, sparks, smoke, debris, lighter;

const ui = new UI(CATALOG, {
  onSelect: (item) => { if (started) { endTour(); placeCracker(item); } },
  onSound: (on) => { audio.init(); audio.setMuted(!on); },
  onAmbient: (on) => { ctx.ambientOn = on; },
  onResetView: () => { endTour(); if (current) focusOn(current.model); else goTo(spot.home.pos, spot.home.target, 1.6); },
  onEnter: () => enter(),
  onSpot: (key) => setSpot(key),
  onTour: () => startTour(),
});

/* ------------------------------------------------------------- places */
const SPOTS = {
  ground: {
    key: 'ground', pos: new V3(0, 0, 0), rect: null, maxDist: 14,
    home: { pos: new V3(0, 1.25, 3.1), target: new V3(0, 0.75, -1.6) },
    sky: new V3(0.5, 0.85, 3.6),
  },
  roof: {
    key: 'roof', pos: new V3(0, ROOF_Y + 0.004, -7.4), maxDist: 12,
    rect: { x0: -4.99, x1: 4.99, z0: -10.79, z1: -5.13, y: ROOF_Y + 0.004 },
    home: { pos: new V3(1.5, ROOF_Y + 1.45, -5.5), target: new V3(0, ROOF_Y + 0.9, -9.6) },
    sky: new V3(0.6, ROOF_Y + 0.95, -5.5),
  },
};
let spot = SPOTS.ground;

/* ----------------------------------------------------------- stats */
const STORE = 'pataka-mela-v1';
const blankStats = () => ({ saved: 0, count: 0, smoke: 0, by: {} });
const stats = (() => {
  try {
    const s = { ...blankStats(), ...JSON.parse(localStorage.getItem(STORE) || '{}') };
    if (!s.by || typeof s.by !== 'object') s.by = {};
    return s;
  } catch (e) { return blankStats(); }
})();
const session = blankStats();
const saveStats = () => { try { localStorage.setItem(STORE, JSON.stringify(stats)); } catch (e) { /* private mode */ } };

function credit(item, model) {
  for (const s of [stats, session]) {
    s.saved += item.price; s.count += 1; s.smoke += item.smoke;
    s.by[item.id] = (s.by[item.id] || 0) + 1;
  }
  saveStats();
  ui.updateStats(stats, session);
  const p = model.group.getWorldPosition(new V3());
  p.y += 0.35;
  p.project(camera);
  if (p.z < 1) {
    ui.popAt((p.x + 1) / 2 * window.innerWidth, (1 - p.y) / 2 * window.innerHeight,
      `+₹${item.price} saved<br><small>+${item.smoke} g smoke avoided</small>`);
  }
}

/* ----------------------------------------------------- camera director */
const director = { active: true, pos: new V3(0, 1.25, 3.1), target: new V3(0, 0.75, -1.6), speed: 0.9, sky: false };
let tour = false;
function goTo(pos, target, speed = 2.2) {
  director.active = true; director.pos.copy(pos); director.target.copy(target); director.speed = speed;
}
function focusOn(model) {
  const box = new THREE.Box3().setFromObject(model.group);
  const c = box.getCenter(new V3()), s = box.getSize(new V3());
  const size = Math.max(s.x, s.y, s.z);
  const dist = THREE.MathUtils.clamp(size * 2.4 + 0.55, 0.95, 2.6);
  if (spot === SPOTS.roof) {
    // on the chhat, frame low so the lit town skyline sits behind the pataka
    const d = dist * 1.35;
    goTo(c.clone().add(new V3(d * 0.45, d * 0.32, d * 0.9)), new V3(c.x, c.y + 0.45, c.z - 1.2), 2.4);
  } else {
    goTo(c.clone().add(new V3(dist * 0.05, dist * 0.42, dist)), new V3(c.x, c.y + 0.1, c.z - 0.35), 2.4);
  }
}
function startTour() {
  if (!started || ui.busy) return;
  tour = true;
  lighter.stopFollow();
  goTo(new V3(13, 10.5, 15), new V3(0, 3, -6), 1.1);
  ui.toast('Ghar ki sair — drag to look around, tap anywhere to stop 🏠', 3500);
}
function endTour() {
  if (!tour) return;
  tour = false;
  controls.autoRotate = false;
}

/* ------------------------------------------------------- shared FX bits */
const flashes = [];
const shocks = [];
const scorches = [];
let shakeAmp = 0;

function initFX() {
  for (let i = 0; i < 2; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 0, 2);
    scene.add(l);
    flashes.push({ l, i0: 0, t: 0, dur: 1 });
  }
  const ringGeo = new THREE.RingGeometry(0.8, 1, 64);
  ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.8, 1.3, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.visible = false; scene.add(m);
    shocks.push({ m, t: 1, r: 1 });
  }
  const scTex = TX.scorchTexture();
  const scGeo = new THREE.PlaneGeometry(1, 1);
  scGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(scGeo, new THREE.MeshBasicMaterial({
      map: scTex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
    }));
    m.visible = false; m.renderOrder = 1; scene.add(m);
    scorches.push({ m, t: 999 });
  }
}

const ctx = {
  scene, camera, tl, audio, ambientOn: true,
  get sparks() { return sparks; }, get smoke() { return smoke; }, get debris() { return debris; },
  effectLight: null,
  floorAt: (x, z) => floorAt(spot.rect, x, z),
  flash(pos, color, intensity, dur) {
    const f = flashes.reduce((a, b) => (a.l.intensity <= b.l.intensity ? a : b));
    f.l.position.copy(pos);
    if (color instanceof THREE.Color) f.l.color.copy(color); else f.l.color.set(color);
    f.i0 = intensity; f.t = 0; f.dur = dur; f.l.intensity = intensity;
  },
  shake(a) { if (!reducedMotion) shakeAmp = Math.min(0.2, shakeAmp + a); },
  shockwave(pos, r) {
    const s = shocks.find((x) => x.t >= 1) || shocks[0];
    s.m.position.copy(pos); s.t = 0; s.r = r; s.m.visible = true;
  },
  scorch(pos, r) {
    const s = scorches.reduce((a, b) => (a.t >= b.t ? a : b));
    s.m.position.set(pos.x, ctx.floorAt(pos.x, pos.z) + 0.016 + Math.random() * 0.002, pos.z);
    s.m.rotation.y = Math.random() * 6;
    s.m.scale.setScalar(r * 2);
    s.t = 0; s.m.visible = true;
  },
  char(model) { charModel(model); },
  follow(p) {
    if (!director.sky) return;
    director.target.set(p.x * 0.7 + spot.pos.x * 0.3, Math.max(spot.pos.y + 1.5, p.y * 0.92), p.z * 0.85 + spot.pos.z * 0.15 - 0.5);
  },
  skyView(on) {
    director.sky = on;
    if (on) {
      director.active = true; director.speed = 1.7;
      director.pos.copy(spot.sky);
      director.target.copy(spot.pos).add(new V3(0, 3, -1.5));
    } else if (current) focusOn(current.model);
    else goTo(spot.home.pos, spot.home.target);
  },
  beginSparkler(stick) {
    sparklerState = { stick, target: stick.position.clone().add(new V3(0.05, 0.35, 0.15)), prev: stick.position.clone() };
    ui.toast('Move your mouse / finger to wave the <b>phuljhari</b> ✨', 3500);
  },
  endSparkler() { sparklerState = null; },
};

/* -------------------------------------------------------- thumbnails */
function makeThumbs() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(220, 190);
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.2;
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xfff0e0, 0x402030, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(1.5, 2.5, 2.5); s.add(key);
  const rim = new THREE.DirectionalLight(0xffa040, 2.0); rim.position.set(-2, 1, -1.5); s.add(rim);
  const cam = new THREE.PerspectiveCamera(30, 220 / 190, 0.01, 20);
  for (const item of CATALOG) {
    const m = buildCracker(item.id);
    m.group.rotation.y = item.kind === 'ladi' ? 0.25 : -0.5;
    s.add(m.group);
    const box = new THREE.Box3().setFromObject(m.group);
    const c = box.getCenter(new V3()), sz = box.getSize(new V3());
    const dist = (sz.length() * 0.5) / Math.sin(THREE.MathUtils.degToRad(15)) * 0.82;
    cam.position.copy(c).add(new V3(0.15, 0.55, 1).normalize().multiplyScalar(dist));
    cam.lookAt(c);
    r.render(s, cam);
    ui.setThumb(item.id, r.domElement.toDataURL('image/png'));
    s.remove(m.group);
    disposeModel(m);
  }
  r.dispose();
  r.forceContextLoss?.();
}

/* ------------------------------------------------------------ game flow */
let started = false;
let state = 'idle';
let current = null;
let sparklerState = null;

function clearCurrent() {
  if (!current) return;
  const { model } = current;
  model.group.removeFromParent();
  if (model.flyer) model.flyer.removeFromParent();
  if (model.stick) model.stick.removeFromParent();
  disposeModel(model);
  current = null;
}

function placeCracker(item) {
  if (ui.busy) return;
  clearCurrent();
  const model = buildCracker(item.id);
  const g = model.group;
  g.rotation.y = item.kind === 'ladi' ? 0.25 : -0.5;
  g.position.copy(spot.pos);
  scene.add(g);
  current = { item, model };
  focusOn(model);
  g.position.y = spot.pos.y + 0.45;
  tl.tween(0.45, (k) => { g.position.y = spot.pos.y + 0.45 * (1 - k); }, (k) => k * k).then(() => audio.place());
  ui.select(item);
  state = 'ready';
}

function setSpot(key) {
  if (!started || ui.busy || spot.key === key) return;
  endTour();
  spot = SPOTS[key];
  env.setSpot(key);
  sparks.rect = smoke.rect = debris.rect = spot.rect;
  ui.setSpot(key);
  if (current) placeCracker(current.item);
  else goTo(spot.home.pos, spot.home.target, 1.4);
  ui.toast(key === 'roof' ? 'Chhat pe! Look around — the whole town is celebrating 🏙️' : 'Back in the aangan 🪔', 2600);
}

function burnFuse(item, model) {
  const D = item.fuseTime;
  const fuse = model.fuse;
  const hiss = audio.fuse(D);
  const p = new V3();
  const fl = ctx.effectLight;
  fl.color.set(0xff9a40);
  let shown = 0;
  ui.countdown('1');
  return new Promise((res) => {
    tl.add((dt, e) => {
      const f = Math.min(1, e / D);
      fuse.setBurn(f);
      fuse.worldPoint(f, p);
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2, u = Math.random(), s = R(0.3, 1.8);
        sparks.spawn(p.x, p.y, p.z, Math.cos(a) * s * (1 - u * 0.5), u * s + 0.3, Math.sin(a) * s * (1 - u * 0.5),
          R(0.08, 0.32), R(0.006, 0.012), 3.2, 2.5, 1.5, 1.6, 0.4, 0.05, 3, -5, F.BOUNCE);
      }
      sparks.spawn(p.x, p.y, p.z, 0, 0, 0, 0.05, 0.025, 3.4, 2.6, 1.6, 2, 1, 0.2, 0, 0, 0);
      if (Math.random() < 10 * dt) {
        smoke.spawn(p.x, p.y, p.z, R(-0.05, 0.05), R(0.15, 0.3), R(-0.05, 0.05), R(1.5, 3), 0.025, 0.3, 0.27, 0.25, 0.25, 0.25, 0.26, 1.5, 0.3, F.SMOKE, 5, 0.4);
      }
      fl.position.copy(p).y += 0.22;
      fl.intensity = 0.12 + Math.random() * 0.12;
      const step = Math.floor(e / (D / 3));
      if (step > shown && step < 3) { shown = step; ui.countdown(String(step + 1)); }
      if (e >= D) {
        fuse.mesh.visible = false;
        fl.intensity = 0;
        hiss.stop();
        ui.countdown(item.boom, true);
        res();
        return false;
      }
      return true;
    });
  });
}

async function light(byHand = false) {
  if (state !== 'ready' || !current || ui.busy) return;
  audio.init(); audio.resume();
  endTour();
  const { item, model } = current;
  state = 'lighting';
  ui.setBusy(true);
  try {
    if (!byHand) await lighter.lightAt(ignitionPoint(model), spot.pos.y);
    if (item.kind !== 'sparkler') {
      state = 'burning';
      await burnFuse(item, model);
    } else {
      ui.countdown(item.boom, true);
    }
    state = 'bursting';
    credit(item, model);
    await runEffect(ctx, item, model);
    await tl.wait(0.4);
  } catch (err) {
    console.error(err);
  }
  state = 'idle';
  ui.setBusy(false);
  placeCracker(item);
}

function enter() {
  if (started) return;
  started = true;
  audio.init(); audio.resume();
  ui.hideIntro();
  goTo(spot.home.pos, spot.home.target, 1.1);
  setTimeout(() => {
    if (!current) placeCracker(CATALOG.find((c) => c.id === 'chocolate'));
    const fine = matchMedia('(pointer: fine)').matches;
    ui.toast(fine
      ? 'Your cursor is a lighter 🔥 — hold the flame on the <b>bati</b> to light it'
      : 'Pick a pataka, then <b>tap it</b> to light it', 5000);
  }, 1400);
}

/* ------------------------------------------------------------- input */
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane();
const hand = { over: false, mouse: false, touchT: 0 };
const tipV = new V3(), planePt = new V3(), hitV = new V3(), nrm = new V3(), cp = new V3();
let downAt = null;

canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; endTour(); });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || sparklerState) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  if (moved < 6 && performance.now() - downAt.t < 500 && state === 'ready' && current) {
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(current.model.group, true).length) light(lighter.following);
  }
  downAt = null;
});
canvas.addEventListener('pointermove', (e) => {
  hand.mouse = e.pointerType === 'mouse';
  hand.over = true;
  setPointer(e);
  if (!sparklerState) return;
  raycaster.setFromCamera(pointer, camera);
  camera.getWorldDirection(nrm); nrm.y = 0; nrm.normalize().negate();
  plane.setFromNormalAndCoplanarPoint(nrm, spot.pos.clone().add(new V3(0, 0.4, 0)));
  if (raycaster.ray.intersectPlane(plane, hitV)) {
    const fy = spot.pos.y;
    hitV.y = THREE.MathUtils.clamp(hitV.y - 0.25, fy + 0.1, fy + 1.6);
    hitV.x = THREE.MathUtils.clamp(hitV.x, spot.pos.x - 1.6, spot.pos.x + 1.6);
    sparklerState.target.copy(hitV);
  }
});
canvas.addEventListener('pointerleave', () => { hand.over = false; });
function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && started && !(document.activeElement instanceof HTMLButtonElement)) {
    e.preventDefault();
    light(false);
  }
});

/** The cursor is a burning lighter: hold the flame on the bati to light it. */
function updateHand(dt) {
  const can = started && hand.mouse && hand.over && !sparklerState && !director.sky && !tour && current && !lighter.busy && state !== 'idle';
  canvas.classList.toggle('hand', !!can);
  if (!can) { lighter.stopFollow(); hand.touchT = 0; return; }
  if (state === 'ready') { ignitionPoint(current.model, tipV); planePt.copy(tipV); }
  camera.getWorldDirection(nrm);
  plane.setFromNormalAndCoplanarPoint(nrm, planePt);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(plane, hitV)) { lighter.stopFollow(); return; }
  const fy = ctx.floorAt(hitV.x, hitV.z);
  if (hitV.y < fy + 0.03) hitV.y = fy + 0.03;
  lighter.follow(hitV);
  if (state !== 'ready') return;
  lighter.contactPoint(cp);
  if (cp.distanceTo(tipV) < 0.045) {
    hand.touchT += dt;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * 6.28, s = R(0.2, 0.8);
      sparks.spawn(tipV.x, tipV.y, tipV.z, Math.cos(a) * s, R(0.2, 0.9), Math.sin(a) * s, R(0.05, 0.18), 0.008, 3.2, 2.4, 1.4, 1.6, 0.4, 0.05, 3, -5, 0);
    }
    if (hand.touchT > 0.22) { hand.touchT = 0; light(true); }
  } else hand.touchT = Math.max(0, hand.touchT - dt * 2);
}

/* ------------------------------------------------------------ resize */
function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H);
  composer.setSize(W, H);
  const mobile = mqMobile.matches;
  const shopW = mobile ? 0 : 340;
  const bottom = mobile ? 230 : 0;
  const fullW = W + shopW, fullH = H + bottom;
  camera.fov = fullW / fullH < 0.8 ? 62 : 50;
  camera.aspect = fullW / fullH;
  camera.setViewOffset(fullW, fullH, shopW, bottom, W, H);
  camera.updateProjectionMatrix();
  const px = (fullH * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  sparks?.setScale(px);
  smoke?.setScale(px);
  town?.setScale(px);
}
window.addEventListener('resize', resize);

/* --------------------------------------------- adaptive quality (fps) */
const perf = { acc: 0, frames: 0, calm: 0 };
function setQuality(i) {
  qIdx = i;
  if (qIdx >= 3 && composer.renderTarget1.samples > 0) { // weak GPU: drop MSAA before resolution
    for (const t of [composer.renderTarget1, composer.renderTarget2]) { t.samples = 0; t.dispose(); }
  }
  renderer.setPixelRatio(QUALITY[qIdx]);
  composer.setPixelRatio(QUALITY[qIdx]);
  resize();
}
function adaptQuality(rawDt) {
  if (document.hidden || rawDt > 0.5) return;
  perf.acc += rawDt; perf.frames++;
  if (perf.acc < 2) return;
  const fps = perf.frames / perf.acc;
  perf.acc = 0; perf.frames = 0;
  if (fps < 40 && qIdx < QUALITY.length - 1) {
    setQuality(qIdx + 1);
    if (qIdx >= 4 && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
    perf.calm = 0;
  } else if (fps > 58 && qIdx > 0 && ++perf.calm >= 4) {
    setQuality(qIdx - 1);
    perf.calm = 0;
  }
}

/* -------------------------------------------------------------- loop */
const clock = new THREE.Clock();
let time = 0;
const shakeOff = new V3();
const flashCol = new THREE.Color();

function processCrackles() {
  const arr = sparks.crackles;
  if (!arr.length) return;
  const n = arr.length / 3;
  for (let i = 0; i < arr.length; i += 3) {
    const high = arr[i + 1] - spot.pos.y > 3;
    const sz = high ? 0.13 : 0.009, sp = high ? 2.5 : 0.9;
    const k = high ? 4 : 3;
    for (let j = 0; j < k; j++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u) * R(0.4, 1) * sp;
      sparks.spawn(arr[i], arr[i + 1], arr[i + 2], Math.cos(a) * s, u * sp, Math.sin(a) * s, R(0.06, 0.16), sz, 4, 4, 3.6, 2, 1.6, 1, 2, -2, 0);
    }
  }
  audio.crackle(n);
  arr.length = 0;
}

function loop() {
  requestAnimationFrame(loop);
  const raw = clock.getDelta();
  adaptQuality(raw);
  const dt = Math.min(raw, 1 / 20);
  time += dt;
  tl.tick(dt);
  env.update(time, dt);
  town.update(time);
  sparks.update(dt);
  processCrackles();
  smoke.update(dt);
  debris.update(dt);
  updateHand(dt);

  flashCol.setRGB(0, 0, 0);
  for (const f of flashes) {
    if (f.l.intensity <= 0) continue;
    f.t += dt;
    f.l.intensity = f.i0 * Math.exp((-f.t / f.dur) * 3);
    if (f.l.intensity < 0.05) f.l.intensity = 0;
    flashCol.r += f.l.color.r * f.l.intensity; flashCol.g += f.l.color.g * f.l.intensity; flashCol.b += f.l.color.b * f.l.intensity;
  }
  flashCol.multiplyScalar(1.4e-5);
  flashCol.setRGB(Math.min(0.6, flashCol.r), Math.min(0.6, flashCol.g), Math.min(0.6, flashCol.b));
  town.setFlash(flashCol);

  for (const s of shocks) {
    if (s.t >= 1) continue;
    s.t = Math.min(1, s.t + dt / 0.38);
    s.m.scale.setScalar(0.05 + s.r * Math.pow(s.t, 0.55));
    s.m.material.opacity = 0.7 * (1 - s.t);
    if (s.t >= 1) s.m.visible = false;
  }
  for (const s of scorches) {
    if (!s.m.visible) continue;
    s.t += dt;
    s.m.material.opacity = s.t < 0.3 ? (s.t / 0.3) * 0.9 : s.t > 60 ? Math.max(0, 0.9 - (s.t - 60) / 4) : 0.9;
    if (s.t > 64) s.m.visible = false;
  }

  if (sparklerState) {
    const st = sparklerState.stick;
    const k = 1 - Math.exp(-10 * dt);
    sparklerState.prev.copy(st.position);
    st.position.lerp(sparklerState.target, k);
    const vx = (st.position.x - sparklerState.prev.x) / Math.max(dt, 1e-3);
    st.rotation.z = THREE.MathUtils.lerp(st.rotation.z, THREE.MathUtils.clamp(-vx * 0.12, -0.7, 0.7) + 0.15, 0.2);
    st.rotation.x = THREE.MathUtils.lerp(st.rotation.x, -0.25, 0.1);
  }

  if (director.active) {
    const k = 1 - Math.exp(-director.speed * dt);
    camera.position.lerp(director.pos, k);
    controls.target.lerp(director.target, k);
    if (!director.sky && camera.position.distanceTo(director.pos) < 0.01 && controls.target.distanceTo(director.target) < 0.01) {
      director.active = false;
      if (tour) controls.autoRotate = true;
    }
  }
  controls.enabled = !director.active && !sparklerState;
  controls.maxDistance = director.active || director.sky ? 400 : tour ? 45 : spot.maxDist;
  controls.maxPolarAngle = director.sky ? Math.PI : 1.48;
  controls.update();

  if (shakeAmp > 0.0005) {
    shakeOff.set(R(-1, 1), R(-1, 1), R(-1, 1)).multiplyScalar(shakeAmp);
    camera.position.add(shakeOff);
    shakeAmp *= Math.exp(-7 * dt);
  } else shakeOff.set(0, 0, 0);

  composer.render();
  camera.position.sub(shakeOff);
}

/* -------------------------------------------------------------- boot */
async function boot() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`800 64px Poppins`),
        document.fonts.load(`48px "Tiro Devanagari Hindi"`, 'शुभ'),
        document.fonts.load(`40px "Yatra One"`),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* fonts optional */ }

  env = createEnvironment(scene, { lowPower });
  env.setSpot('ground');
  town = createTown(scene, { lowPower });
  sparks = new ParticleSystem({ max: lowPower ? 14000 : 26000, texture: TX.sparkTexture(), renderOrder: 3 });
  smoke = new ParticleSystem({ max: 2600, texture: TX.smokeTexture(), blending: THREE.NormalBlending, renderOrder: 2 });
  scene.add(smoke.points, sparks.points);
  debris = new Debris(900);
  scene.add(debris.mesh);
  lighter = new Lighter(scene, tl, audio);
  ctx.effectLight = new THREE.PointLight(0xffb35c, 0, 0, 2);
  scene.add(ctx.effectLight);
  initFX();
  resize();
  ui.updateStats(stats, session, true);
  startAmbient(ctx);
  renderer.compile(scene, camera);
  loop();
  ui.setLoading('Chalo, pataka jalayein! 🪔', true);
  setTimeout(makeThumbs, 60); // after the first frames, so the page appears sooner
}

boot().catch((err) => {
  console.error(err);
  ui.setLoading('Oops — WebGL failed to start. Try another browser.', false);
});

window.__mela = { scene, camera, ctx, state: () => state, CATALOG, placeCracker, light, setSpot, startTour, renderer, goTo, controls };
