// What happens after "3… BOOM!" — one behaviour per kind of pataka.
// All positions are relative to where the cracker stands, so they work in the aangan and on the chhat.
import * as THREE from 'three';
import { F } from './particles.js';
import { R, pick } from './utils.js';

const PAL = {
  gold: [[3, 2.1, 0.9], [1.3, 0.32, 0.04]],
  red: [[3.4, 0.55, 0.4], [1.1, 0.05, 0.04]],
  green: [[0.7, 3.2, 0.9], [0.05, 0.9, 0.12]],
  blue: [[0.7, 1.1, 3.6], [0.1, 0.12, 1.2]],
  purple: [[2.5, 0.7, 3.2], [0.7, 0.05, 1]],
  silver: [[3.2, 3.2, 3.4], [0.9, 0.85, 1.1]],
  orange: [[3.4, 1.5, 0.35], [1.2, 0.22, 0.02]],
  pink: [[3.4, 1, 2], [1.1, 0.1, 0.45]],
  cyan: [[0.7, 2.8, 3.2], [0.02, 0.7, 1]],
};
const AERIAL = ['red', 'green', 'blue', 'purple', 'gold', 'silver', 'pink', 'cyan', 'orange'];
const HOT = [[3.2, 2.7, 1.8], [1.4, 0.32, 0.04]];

const D = new THREE.Vector3();
function randDir(out, upBias = 0) {
  const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  out.set(s * Math.cos(th), u, s * Math.sin(th));
  if (upBias > 0 && out.y < 0) out.y = -out.y * (1 - upBias);
  return out;
}
function spark(ctx, p, vx, vy, vz, life, size, pal, drag, grav, flags = 0, alpha = 1) {
  const [c0, c1] = pal;
  ctx.sparks.spawn(p.x, p.y, p.z, vx, vy, vz, life, size, c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], drag, grav, flags, 0, alpha);
}
function puff(ctx, p, vx, vy, vz, life, size, grow, gray, alpha, warm = 0) {
  ctx.smoke.spawn(p.x, p.y, p.z, vx, vy, vz, life, size, gray + warm, gray + warm * 0.55, gray, gray, gray, gray * 1.06, 1.8, 0.32, F.SMOKE, grow, alpha);
}

/* ------------------------------------------------------------------- bang */

async function bang(ctx, item, model) {
  const p = item.power;
  const pos = model.group.position.clone();
  const fy = pos.y;
  pos.y += 0.06 + 0.05 * p;
  model.group.visible = false;
  ctx.audio.boom(item.id);
  ctx.flash(pos, 0xffd7a0, 40 + 360 * p, 0.1 + 0.2 * p);
  ctx.shake(0.012 + 0.11 * p);
  spark(ctx, pos, 0, 0, 0, 0.06, 0.2 + 0.4 * p, [[5, 4.2, 3.2], [3, 1, 0.3]], 0, 0);
  spark(ctx, pos, 0, 0, 0, 0.12, 0.12 + 0.25 * p, [[3.5, 2.6, 1.5], [2, 0.6, 0.1]], 0, 0);
  const n = Math.floor(140 + 560 * p);
  for (let i = 0; i < n; i++) {
    randDir(D, 0.8);
    const s = R(2, 9) * (0.45 + p);
    spark(ctx, pos, D.x * s, D.y * s, D.z * s, R(0.12, 0.45), R(0.012, 0.03), HOT, 3, -9.8, F.BOUNCE | (Math.random() < 0.2 ? F.TWINKLE : 0));
  }
  for (let i = 0; i < 30 + 70 * p; i++) {
    randDir(D, 0.6);
    const s = R(0.8, 3.5) * (0.6 + p);
    spark(ctx, pos, D.x * s, D.y * s + 1, D.z * s, R(0.7, 1.8), R(0.014, 0.024), PAL.orange, 1.4, -5, F.BOUNCE | F.TWINKLE);
  }
  for (let i = 0; i < 14 + 46 * p; i++) {
    randDir(D, 0.9);
    const s = R(0.3, 1.6) * (0.4 + p);
    puff(ctx, pos.clone().addScaledVector(D, 0.03), D.x * s, D.y * s * 0.7 + 0.25, D.z * s, R(3, 7.5), R(0.14, 0.3) * (0.6 + p), R(2.5, 5), R(0.17, 0.27), R(0.35, 0.6), 0.1);
  }
  ctx.debris.burst(pos, Math.floor(30 + 170 * p), model.debris, 1.4 + 4 * p);
  if (p >= 0.75) {
    ctx.shockwave(new THREE.Vector3(pos.x, fy + 0.012, pos.z), 0.9 + 2 * p);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = R(2, 4.5);
      puff(ctx, new THREE.Vector3(pos.x, fy + 0.05, pos.z), Math.cos(a) * s, R(0.05, 0.3), Math.sin(a) * s, R(2, 4), 0.12, 4, 0.2, 0.35, 0.05);
    }
  }
  ctx.scorch(pos, 0.1 + 0.28 * p);
  await ctx.tl.wait(2.4);
}

/* --------------------------------------------------------------- fountain */

async function fountain(ctx, item, model) {
  const dur = 8;
  const nozzle = model.group.localToWorld(model.nozzle.clone());
  ctx.audio.fountain(dur);
  const light = ctx.effectLight;
  light.position.copy(nozzle).add(new THREE.Vector3(0, 0.35, 0));
  light.color.set(0xffb35c);
  let carry = 0, smokeCarry = 0;
  ctx.tl.add((dt, e) => {
    if (e > dur) { light.intensity = 0; return false; }
    const ramp = Math.min(1, e / 0.6) * (e > dur - 1.3 ? Math.max(0, (dur - e) / 1.3) : 1);
    const phase = e / dur;
    const pulse = 0.85 + 0.25 * Math.sin(e * 7) * Math.sin(e * 2.3);
    carry += 1100 * ramp * dt;
    while (carry >= 1) {
      carry--;
      const th = R(0, 0.3) * (0.8 + 0.4 * Math.random()), ph = Math.random() * Math.PI * 2;
      const s = R(3.4, 6.6) * pulse;
      const pal = phase < 0.5 ? PAL.gold : Math.random() < 0.6 ? PAL.silver : PAL.gold;
      const fl = F.BOUNCE | (Math.random() < 0.1 ? F.CRACKLE : 0) | (Math.random() < 0.3 ? F.TWINKLE : 0);
      spark(ctx, nozzle, Math.sin(th) * Math.cos(ph) * s, Math.cos(th) * s, Math.sin(th) * Math.sin(ph) * s,
        R(0.7, 1.4), R(0.011, 0.024), pal, 0.7, -9.8, fl);
    }
    spark(ctx, nozzle, 0, 0.3, 0, 0.06, 0.06 * ramp, [[3.5, 2.8, 1.6], [2, 1, 0.3]], 0, 0);
    smokeCarry += 9 * ramp * dt;
    while (smokeCarry >= 1) {
      smokeCarry--;
      puff(ctx, nozzle, R(-0.2, 0.2), R(0.6, 1.2), R(-0.2, 0.2), R(4, 7), R(0.08, 0.16), R(4, 7), R(0.2, 0.28), R(0.25, 0.4), 0.12);
    }
    light.intensity = (3.5 + 2 * Math.random()) * ramp;
    return true;
  });
  await ctx.tl.wait(dur + 1.2);
  ctx.char(model);
}

/* --------------------------------------------------------------- sparkler */

async function sparkler(ctx, item, model) {
  const dur = 18;
  const stick = model.stick;
  ctx.scene.attach(stick);
  ctx.beginSparkler(stick);
  const stop = ctx.audio.sparkler(dur);
  const light = ctx.effectLight;
  light.color.set(0xfff0d0);
  const tip = new THREE.Vector3(), local = new THREE.Vector3();
  let carry = 0;
  await new Promise((res) => {
    ctx.tl.add((dt, e) => {
      const remain = 1 - Math.min(1, e / dur);
      model.coat.scale.y = Math.max(0.001, remain);
      local.set(0, model.coatBase + model.coatLen * remain, 0);
      stick.localToWorld(tip.copy(local));
      if (e >= dur) { light.intensity = 0; res(); return false; }
      const ramp = Math.min(1, e / 0.4);
      carry += 420 * ramp * dt;
      while (carry >= 1) {
        carry--;
        randDir(D);
        const s = R(1.0, 3.4);
        spark(ctx, tip, D.x * s, D.y * s, D.z * s, R(0.12, 0.42), R(0.012, 0.026), [[3.6, 3.3, 2.6], [2.2, 0.9, 0.3]], 4, -2,
          Math.random() < 0.28 ? F.CRACKLE : 0);
      }
      spark(ctx, tip, 0, 0, 0, 0.1, 0.07, [[3.6, 3.2, 2.4], [3, 2, 1]], 0, 0);
      spark(ctx, tip, 0, 0, 0, 0.6, 0.04, [[2.6, 1.6, 0.6], [0.6, 0.1, 0]], 0, 0);
      if (Math.random() < 6 * dt) puff(ctx, tip, R(-0.1, 0.1), R(0.2, 0.5), R(-0.1, 0.1), R(2, 4), 0.04, 5, 0.25, 0.25);
      light.position.copy(tip);
      light.intensity = (1.6 + Math.random()) * ramp;
      return true;
    });
  });
  stop.stop();
  const wire = stick.children[0];
  wire.material = wire.material.clone();
  wire.material.emissive = new THREE.Color(0xff5a10);
  await ctx.tl.tween(1.4, (k) => { wire.material.emissiveIntensity = 2 * (1 - k); });
  ctx.endSparkler();
  stick.removeFromParent();
}

/* ---------------------------------------------------------------- chakri */
// A real chakri spins ~15-20 rev/s: your eye sees a solid ring of fire, a spiral spray of sparks
// shooting off tangentially, and the whole thing skids, hops and wobbles across the floor.

async function spinner(ctx, item, model) {
  const dur = 8.5;
  ctx.audio.chakri(dur);
  const light = ctx.effectLight;
  const g = model.group;
  const base = g.position.clone();
  const fy = base.y;
  const rimR = model.rimRadius * g.scale.x;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(rimR * 0.8, rimR * 1.25, 48).rotateX(-Math.PI / 2), ringMat);
  ctx.scene.add(ring);
  const phases = [PAL.gold, PAL.green, PAL.red, PAL.silver];
  const off = new THREE.Vector3(), vel = new THREE.Vector3(R(-0.3, 0.3), 0, R(-0.3, 0.3));
  const rim = new THREE.Vector3(), ctr = new THREE.Vector3();
  let ang = 0, prev = 0, carry = 0, hopY = 0, hopV = 0, smokeT = 0;
  await new Promise((res) => {
    ctx.tl.add((dt, e) => {
      if (e >= dur) { light.intensity = 0; res(); return false; }
      const ramp = Math.min(1, e / 0.7) * (e > dur - 1.4 ? Math.max(0, (dur - e) / 1.4) : 1);
      const omega = (100 + 25 * Math.sin(e * 3.1)) * ramp;
      prev = ang; ang += omega * dt;
      vel.x += (Math.cos(e * 1.7) * 1.1 + R(-1.4, 1.4)) * dt;
      vel.z += (Math.sin(e * 1.3) * 1.1 + R(-1.4, 1.4)) * dt;
      vel.multiplyScalar(Math.exp(-0.9 * dt));
      off.addScaledVector(vel, dt * ramp);
      if (off.length() > 0.85) { off.setLength(0.85); vel.multiplyScalar(-0.4); }
      if (hopY === 0 && hopV === 0 && Math.random() < 0.45 * dt * ramp) hopV = R(0.5, 1.0);
      if (hopV !== 0 || hopY > 0) {
        hopV -= 9.8 * dt; hopY += hopV * dt;
        if (hopY <= 0) { hopY = 0; hopV = hopV < -0.8 ? -hopV * 0.3 : 0; }
      }
      g.position.set(base.x + off.x, fy + hopY, base.z + off.z);
      g.rotation.set(Math.sin(e * 6.3) * 0.12 * ramp, ang, Math.cos(e * 5.1) * 0.12 * ramp);
      const pi = Math.min(phases.length - 1, Math.floor((e / dur) * phases.length));
      const pal = phases[pi];
      ctr.set(g.position.x, fy + hopY + 0.014, g.position.z);
      // nozzle sparks spread across the arc swept this frame, so the spray never strobes
      carry += 1500 * ramp * dt;
      const n = Math.floor(carry); carry -= n;
      for (let i = 0; i < n; i++) {
        const a = prev + (ang - prev) * Math.random();
        const ca = Math.cos(a), sa = Math.sin(a);
        rim.set(ctr.x + ca * rimR, ctr.y + 0.006, ctr.z - sa * rimR);
        const s = R(2.4, 4.6), out = R(0.3, 1.4);
        spark(ctx, rim, sa * s + ca * out, R(0.05, 0.9), ca * s - sa * out, R(0.18, 0.5), R(0.011, 0.024), pal, 2.6, -9.8,
          F.BOUNCE | (pi === 3 && Math.random() < 0.25 ? F.CRACKLE : 0));
      }
      // the solid wheel of fire (persistence of vision)
      const m = Math.min(40, Math.ceil((ang - prev) / 0.22));
      for (let i = 0; i < m; i++) {
        const a = prev + (ang - prev) * (i / m);
        rim.set(ctr.x + Math.cos(a) * rimR, ctr.y + 0.006, ctr.z - Math.sin(a) * rimR);
        spark(ctx, rim, 0, 0, 0, 0.07, 0.03, [[pal[0][0] * 0.9, pal[0][1] * 0.9, pal[0][2] * 0.9], pal[1]], 0, 0, 0, 0.8);
      }
      ring.position.copy(ctr);
      ring.rotation.set(g.rotation.x, 0, g.rotation.z);
      ringMat.color.setRGB(pal[0][0] / 3.6, pal[0][1] / 3.6, pal[0][2] / 3.6);
      ringMat.opacity = 0.32 * ramp;
      smokeT += dt * ramp;
      if (smokeT > 0.08) { smokeT = 0; puff(ctx, ctr, R(-0.3, 0.3), R(0.3, 0.6), R(-0.3, 0.3), R(3, 5), 0.07, 5, 0.22, 0.28, 0.1); }
      light.position.set(ctr.x, ctr.y + 0.3, ctr.z);
      light.color.setRGB(pal[0][0] / 3.4, pal[0][1] / 3.4, pal[0][2] / 3.4);
      light.intensity = (1.6 + Math.random() * 0.8) * ramp;
      return true;
    });
  });
  ring.removeFromParent(); ring.geometry.dispose(); ringMat.dispose();
  g.rotation.set(0, ang, 0); g.position.y = fy;
  ctx.scorch(g.position, 0.12);
  ctx.char(model);
  await ctx.tl.wait(1);
}

/* ------------------------------------------------------------ aerial shells */

function aerialBurst(ctx, pos, pattern, scale = 1, withSound = true, trails = true) {
  const a = pick(AERIAL);
  let b = pick(AERIAL);
  if (b === a) b = 'gold';
  const palA = PAL[a], palB = PAL[b];
  const TR = trails ? F.TRAIL : 0;
  spark(ctx, pos, 0, 0, 0, 0.12, 3 * scale, [[6, 5.5, 5], [3, 2, 1]], 0, 0);
  if (withSound) {
    ctx.flash(pos, new THREE.Color(palA[0][0], palA[0][1], palA[0][2]).multiplyScalar(0.3), 20000 * scale, 0.5);
    const dist = ctx.camera.position.distanceTo(pos);
    ctx.audio.airBurst(0.6 + 0.2 * scale, Math.min(0.8, dist / 343));
  }
  const sz = 0.4 * scale;
  if (pattern === 'peony') {
    const n = 220;
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      const s = R(8.5, 10) * scale;
      spark(ctx, pos, Math.cos(th) * r * s, y * s, Math.sin(th) * r * s, R(1.5, 2.1), sz, palA, 1.5, -2.6,
        TR | F.TWINKLE | (Math.random() < 0.15 ? F.CRACKLE : 0));
      if (i % 2 === 0) {
        const s2 = s * 0.55;
        spark(ctx, pos, Math.cos(th) * r * s2, y * s2, Math.sin(th) * r * s2, R(1.2, 1.6), sz * 0.8, palB, 1.5, -2.6, F.TWINKLE);
      }
    }
  } else if (pattern === 'ring') {
    const nrm = new THREE.Vector3(R(-0.6, 0.6), R(0.2, 0.8), 1).normalize();
    const u = new THREE.Vector3().crossVectors(nrm, new THREE.Vector3(0, 1, 0)).normalize();
    const v = new THREE.Vector3().crossVectors(nrm, u).normalize();
    for (let i = 0; i < 110; i++) {
      const t = (i / 110) * Math.PI * 2, s = 10 * scale;
      D.copy(u).multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
      spark(ctx, pos, D.x * s, D.y * s, D.z * s, R(1.4, 1.8), sz, palA, 1.4, -2.2, TR);
    }
    for (let i = 0; i < 60; i++) {
      randDir(D); const s = R(2, 4) * scale;
      spark(ctx, pos, D.x * s, D.y * s, D.z * s, R(1, 1.4), sz * 0.8, palB, 1.4, -2.2, F.TWINKLE);
    }
  } else if (pattern === 'willow') {
    for (let i = 0; i < 170; i++) {
      randDir(D); const s = R(6, 8.5) * scale;
      spark(ctx, pos, D.x * s, D.y * s, D.z * s, R(2.8, 3.6), sz * 0.85, [[2.8, 1.8, 0.7], [0.9, 0.28, 0.02]], 2.3, -3.2, TR | F.TWINKLE);
    }
  } else if (pattern === 'crackle') {
    for (let i = 0; i < 160; i++) {
      randDir(D); const s = R(6, 9) * scale;
      spark(ctx, pos, D.x * s, D.y * s, D.z * s, R(0.7, 1.15), sz * 0.8, PAL.gold, 1.8, -3, TR | F.CRACKLE);
    }
  } else if (pattern === 'heart') {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(ctx.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ctx.camera.quaternion);
    for (let i = 0; i < 130; i++) {
      const t = (i / 130) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      D.copy(right).multiplyScalar(hx / 16).addScaledVector(up, hy / 16);
      const s = 9 * scale;
      spark(ctx, pos, D.x * s, D.y * s, D.z * s, R(1.5, 1.8), sz, PAL.pink, 1.6, -1.2, TR);
    }
  }
}

/* ----------------------------------------------------------------- rocket */
// Fuse → motor catches and sputters in the bottle → whoosh: white-hot flame, golden spark tail,
// stick-stabilised fishtail flight with wind drift → burnout, coast on dull embers → pop at the top.

async function rocket(ctx, item, model) {
  const flyer = model.flyer;
  ctx.scene.attach(flyer);
  ctx.audio.rocketLaunch();
  const tailLocal = model.tail.clone();
  const tail = new THREE.Vector3();
  const start = flyer.position.clone();
  const pos = start.clone();
  const vel = new THREE.Vector3();
  const tilt = new THREE.Vector3(R(-0.12, 0.12), 1, R(-0.22, -0.06)).normalize();
  const wind = new THREE.Vector3(R(-0.8, 0.8), 0, R(-0.5, 0.3));
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), dirv = new THREE.Vector3();
  const wob = R(0, 6.28);
  const IGN = 0.45, BURN = 1.15;
  ctx.skyView(true);
  let carry = 0, smokeCarry = 0;
  const burstPos = await new Promise((res) => {
    ctx.tl.add((dt, e) => {
      flyer.updateMatrixWorld(true);
      tail.copy(tailLocal); flyer.localToWorld(tail);
      if (e < IGN) {
        flyer.position.set(start.x + R(-1, 1) * 0.002, start.y + R(-1, 1) * 0.002, start.z);
        for (let i = 0; i < 9; i++) {
          randDir(D); const s = R(0.3, 1.5);
          spark(ctx, tail, D.x * s, -Math.abs(D.y) * s * 0.6, D.z * s, R(0.1, 0.3), 0.011, PAL.gold, 3, -6, F.BOUNCE);
        }
        spark(ctx, tail, 0, 0, 0, 0.05, 0.05 * (e / IGN), [[3.5, 2.8, 1.5], [2, 0.8, 0.2]], 0, 0);
        if (Math.random() < 25 * dt) puff(ctx, tail, R(-0.1, 0.1), R(0.1, 0.3), R(-0.1, 0.1), R(2, 4), 0.05, 5, 0.24, 0.35);
        return true;
      }
      const t = e - IGN;
      const thrusting = t < BURN;
      if (vel.lengthSq() > 1) dirv.copy(vel).normalize(); else dirv.copy(tilt);
      dirv.x += Math.sin(t * 14 + wob) * 0.025; dirv.z += Math.cos(t * 11 + wob) * 0.02; dirv.normalize();
      if (thrusting) vel.addScaledVector(t < 0.1 ? tilt : dirv, (t < 0.15 ? 46 : 33) * dt);
      vel.y -= 9.8 * dt;
      vel.addScaledVector(wind, dt * 0.35);
      vel.multiplyScalar(Math.exp(-0.16 * dt));
      pos.addScaledVector(vel, dt);
      flyer.position.copy(pos);
      flyer.quaternion.slerp(q.setFromUnitVectors(up, dirv), 0.5);
      ctx.follow(pos);
      if (thrusting) {
        spark(ctx, tail, 0, 0, 0, 0.04, 0.07, [[4, 3.4, 2.2], [3, 1.2, 0.3]], 0, 0);
        carry += 1100 * dt;
        while (carry >= 1) {
          carry--;
          randDir(D); const s = R(0.6, 2.2), back = R(0.2, 0.55);
          spark(ctx, tail, -vel.x * back + D.x * s, -vel.y * back + D.y * s, -vel.z * back + D.z * s,
            R(0.25, 0.75), R(0.012, 0.03), PAL.gold, 2.2, -5, Math.random() < 0.25 ? F.TWINKLE : 0);
        }
        smokeCarry += 50 * dt;
        while (smokeCarry >= 1) { smokeCarry--; puff(ctx, tail, R(-0.08, 0.08), R(-0.05, 0.1), R(-0.08, 0.08), R(3.5, 6), 0.05, 6, 0.24, 0.32); }
      } else {
        carry += 70 * dt;
        while (carry >= 1) { carry--; spark(ctx, tail, R(-0.3, 0.3), R(-0.5, 0), R(-0.3, 0.3), R(0.2, 0.45), 0.012, PAL.orange, 2, -4); }
      }
      if ((t > BURN + 0.3 && vel.y < 2.5) || t > 3.8) { res(pos.clone()); return false; }
      return true;
    });
  });
  flyer.visible = false;
  aerialBurst(ctx, burstPos, pick(['peony', 'crackle', 'ring', 'willow']), 0.72);
  for (let i = 0; i < 10; i++) {
    randDir(D); const s = R(0.5, 2);
    puff(ctx, burstPos, D.x * s, D.y * s, D.z * s, R(4, 8), 0.8, 3, 0.2, 0.22);
  }
  await ctx.tl.wait(2.8);
  flyer.removeFromParent();
  ctx.skyView(false);
}

/* ---------------------------------------------------------------- sky shot */

async function skyshot(ctx, item, model) {
  const muzzle = model.group.localToWorld(model.muzzle.clone());
  ctx.skyView(true);
  ctx.follow(muzzle.clone().add(new THREE.Vector3(0, 16, -4)));
  const patterns = ['peony', 'ring', 'willow', 'heart', 'crackle'];
  for (let k = 0; k < 5; k++) {
    ctx.audio.mortar();
    ctx.flash(muzzle, 0xffc070, 60, 0.1);
    ctx.shake(0.02);
    for (let i = 0; i < 40; i++) {
      randDir(D, 0.95); const s = R(0.5, 2.5);
      spark(ctx, muzzle, D.x * s, Math.abs(D.y) * s + 1, D.z * s, R(0.15, 0.4), 0.015, PAL.gold, 3, -6, F.BOUNCE);
    }
    for (let i = 0; i < 6; i++) puff(ctx, muzzle, R(-0.3, 0.3), R(0.5, 1.5), R(-0.3, 0.3), R(3, 6), 0.12, 4, 0.24, 0.4, 0.1);
    const shell = muzzle.clone();
    const v = new THREE.Vector3(R(-1.6, 1.6), R(21, 24), R(-3.5, -1.5));
    const pattern = patterns[k];
    await new Promise((res) => {
      ctx.tl.add((dt, e) => {
        v.y -= 9.8 * dt;
        shell.addScaledVector(v, dt);
        spark(ctx, shell, 0, 0, 0, 0.1, 0.1, [[3.5, 2.6, 1.4], [2, 1, 0.2]], 0, 0);
        if (Math.random() < 0.8) spark(ctx, shell, R(-0.4, 0.4), R(-1, 0), R(-0.4, 0.4), R(0.3, 0.6), 0.03, PAL.gold, 2, -3, F.TWINKLE);
        if (e > 1.65) {
          aerialBurst(ctx, shell.clone(), pattern, 1.05);
          ctx.follow(shell.clone().setY(shell.y - 2));
          res(); return false;
        }
        return true;
      });
    });
    await ctx.tl.wait(k === 4 ? 2.8 : 0.9);
  }
  ctx.char(model);
  ctx.skyView(false);
  await ctx.tl.wait(1);
}

/* ------------------------------------------------------------------ ladi */

async function ladi(ctx, item, model) {
  const dur = 4.2;
  const { chain, pops } = model;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const world = new THREE.Vector3(), burn = new THREE.Vector3();
  await new Promise((res) => {
    ctx.tl.add((dt, e) => {
      const f = Math.min(1, e / dur);
      chain.setBurn(f);
      chain.worldPoint(f, burn);
      for (let i = 0; i < 3; i++) {
        randDir(D, 0.7); const s = R(0.4, 1.5);
        spark(ctx, burn, D.x * s, D.y * s, D.z * s, R(0.1, 0.3), 0.012, HOT, 3, -6, F.BOUNCE);
      }
      for (const p of pops) {
        if (p.done || f < 1 - p.u) continue;
        p.done = true;
        model.inst.setMatrixAt(p.idx, zero);
        model.inst.instanceMatrix.needsUpdate = true;
        world.copy(p.pos); model.group.localToWorld(world);
        world.y += 0.02;
        const pan = Math.max(-1, Math.min(1, (world.x - ctx.camera.position.x) * 0.8));
        ctx.audio.pop(R(0.7, 1), pan);
        if (Math.random() < 0.7) ctx.audio.pop(R(0.5, 0.9), pan, R(0.03, 0.08));
        if (Math.random() < 0.4) ctx.audio.pop(R(0.4, 0.8), pan, R(0.08, 0.14));
        ctx.flash(world, 0xffd090, 60, 0.05);
        ctx.shake(0.008);
        spark(ctx, world, 0, 0, 0, 0.05, 0.18, [[5, 4.2, 3], [3, 1, 0.2]], 0, 0);
        for (let i = 0; i < 40; i++) {
          randDir(D, 0.7); const s = R(1.5, 5);
          spark(ctx, world, D.x * s, D.y * s, D.z * s, R(0.08, 0.3), R(0.01, 0.022), HOT, 3, -9.8, F.BOUNCE);
        }
        for (let i = 0; i < 3; i++) puff(ctx, world, R(-0.4, 0.4), R(0.2, 0.7), R(-0.4, 0.4), R(3, 6), R(0.08, 0.14), R(3, 5), R(0.18, 0.26), R(0.3, 0.5), 0.1);
        ctx.debris.burst(world, 6, model.debris, 2.2, [0.008, 0.02]);
        ctx.scorch(world, 0.07);
      }
      if (f >= 1) { res(); return false; }
      return true;
    });
  });
  model.group.visible = false;
  await ctx.tl.wait(2);
}

export async function runEffect(ctx, item, model) {
  switch (item.kind) {
    case 'bang': return bang(ctx, item, model);
    case 'fountain': return fountain(ctx, item, model);
    case 'sparkler': return sparkler(ctx, item, model);
    case 'spinner': return spinner(ctx, item, model);
    case 'rocket': return rocket(ctx, item, model);
    case 'skyshot': return skyshot(ctx, item, model);
    case 'ladi': return ladi(ctx, item, model);
    default: return bang(ctx, { ...item, power: 0.6 }, model);
  }
}

/** The whole town celebrating: shells all around the horizon + crackers you can hear down the gali. */
export function startAmbient(ctx) {
  let nextShow = 2.5, nextBang = 1.5, t = 0;
  ctx.tl.add((dt) => {
    if (!ctx.ambientOn) return true;
    t += dt;
    if (t > nextShow) {
      nextShow = t + R(1.8, 5.5);
      const a = Math.random() * Math.PI * 2, rad = R(80, 230);
      const pos = new THREE.Vector3(Math.sin(a) * rad, R(30, 70), Math.cos(a) * rad);
      const dist = ctx.camera.position.distanceTo(pos);
      aerialBurst(ctx, pos, pick(['peony', 'peony', 'ring', 'willow', 'crackle']), R(1.4, 2.1), false, false);
      ctx.audio.distant(Math.min(1.4, dist / 343), 0.7);
    }
    if (t > nextBang) {
      nextBang = t + R(1.2, 4.5);
      if (Math.random() < 0.18) ctx.audio.distantLadi();
      else ctx.audio.distant(R(0, 0.2));
    }
    return true;
  });
}
