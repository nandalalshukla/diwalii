// CPU-simulated, GPU-drawn particle pools (sparks, smoke) + instanced paper debris.
import * as THREE from 'three';

export const F = { BOUNCE: 1, TRAIL: 2, TWINKLE: 4, CRACKLE: 8, SMOKE: 16, STROBE: 32 };

/** Floor height at (x,z): the roof terrace if inside its rectangle, otherwise the ground. */
export function floorAt(rect, x, z) {
  return rect && x > rect.x0 && x < rect.x1 && z > rect.z0 && z < rect.z1 ? rect.y : 0;
}

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main(){
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aAlpha <= 0.0 ? 0.0 : aSize * uScale / max(0.05, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uTex;
varying float vAlpha;
varying vec3 vColor;
void main(){
  vec4 t = texture2D(uTex, gl_PointCoord);
  float a = t.a * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * t.rgb, a);
}`;

export class ParticleSystem {
  constructor({ max = 20000, texture, blending = THREE.AdditiveBlending, renderOrder = 2 }) {
    this.max = max;
    const A = (n) => new Float32Array(max * n);
    this.p = A(3); this.v = A(3); this.c0 = A(3); this.c1 = A(3); this.c = A(3);
    this.s = A(1); this.s0 = A(1); this.a = A(1); this.a0 = A(1);
    this.life = A(1); this.ml = A(1); this.drag = A(1); this.g = A(1); this.grow = A(1);
    this.fl = new Uint8Array(max); this.alive = new Uint8Array(max);
    this.cursor = 0; this.high = 0; this.wind = [0.25, 0, -0.1];
    this.crackles = [];
    this.rect = null;

    const geo = new THREE.BufferGeometry();
    this.attrs = {
      position: new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage),
      aColor: new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage),
      aSize: new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage),
      aAlpha: new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage),
    };
    for (const k in this.attrs) geo.setAttribute(k, this.attrs[k]);
    geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: texture }, uScale: { value: 800 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
  }

  setScale(s) { this.mat.uniforms.uScale.value = s; }

  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, r2, g2, b2, drag = 1, grav = -9.8, flags = 0, grow = 0, alpha = 1) {
    let i = this.cursor, tries = 0;
    while (this.alive[i] && tries < 96) { i = (i + 1) % this.max; tries++; }
    this.cursor = (i + 1) % this.max;
    const i3 = i * 3;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z;
    this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.c0[i3] = r; this.c0[i3 + 1] = g; this.c0[i3 + 2] = b;
    this.c1[i3] = r2; this.c1[i3 + 1] = g2; this.c1[i3 + 2] = b2;
    this.c[i3] = r; this.c[i3 + 1] = g; this.c[i3 + 2] = b;
    this.s0[i] = size; this.s[i] = size; this.a0[i] = alpha; this.a[i] = alpha;
    this.life[i] = 0; this.ml[i] = Math.max(0.01, life);
    this.drag[i] = drag; this.g[i] = grav; this.grow[i] = grow;
    this.fl[i] = flags; this.alive[i] = 1;
    if (i + 1 > this.high) this.high = i + 1;
    return i;
  }

  update(dt) {
    const P = this.p, Vv = this.v, wind = this.wind, rect = this.rect;
    for (let i = 0; i < this.high; i++) {
      if (!this.alive[i]) continue;
      const L = (this.life[i] += dt), ml = this.ml[i], f = this.fl[i], i3 = i * 3;
      if (L >= ml) {
        this.alive[i] = 0; this.s[i] = 0; this.a[i] = 0;
        if (f & F.CRACKLE) this.crackles.push(P[i3], P[i3 + 1], P[i3 + 2]);
        continue;
      }
      const t = L / ml, d = Math.exp(-this.drag[i] * dt);
      let vx = Vv[i3] * d, vy = Vv[i3 + 1] * d + this.g[i] * dt, vz = Vv[i3 + 2] * d;
      if (f & F.SMOKE) { vx += (wind[0] - vx) * 0.4 * dt; vz += (wind[2] - vz) * 0.4 * dt; }
      const py = P[i3 + 1];
      let x = P[i3] + vx * dt, y = py + vy * dt, z = P[i3 + 2] + vz * dt;
      if (f & (F.BOUNCE | F.SMOKE)) {
        const fy = rect ? floorAt(rect, x, z) : 0;
        if (py >= fy - 0.03) {
          if ((f & F.BOUNCE) && y < fy + 0.004) { y = fy + 0.004; if (vy < 0) vy = -vy * 0.28; vx *= 0.65; vz *= 0.65; }
          else if ((f & F.SMOKE) && y < fy + 0.02) { y = fy + 0.02; vy = Math.abs(vy) * 0.3; }
        }
      }
      P[i3] = x; P[i3 + 1] = y; P[i3 + 2] = z;
      Vv[i3] = vx; Vv[i3 + 1] = vy; Vv[i3 + 2] = vz;
      const k = Math.pow(t, 0.6);
      const cr = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * k;
      const cg = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * k;
      const cb = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * k;
      this.c[i3] = cr; this.c[i3 + 1] = cg; this.c[i3 + 2] = cb;
      let a;
      if (f & F.SMOKE) {
        a = this.a0[i] * Math.min(1, t * 10) * Math.pow(1 - t, 1.4);
      } else {
        a = this.a0[i] * Math.pow(1 - t, 1.1);
        if ((f & F.TWINKLE) && t > 0.4 && Math.random() < 0.45) a *= 0.1;
        if (f & F.STROBE) a *= Math.sin(L * 45) > 0 ? 1 : 0.04;
      }
      this.a[i] = a;
      this.s[i] = this.s0[i] * (1 + this.grow[i] * t) * ((f & F.SMOKE) ? 1 : 1 - 0.45 * t);
      if ((f & F.TRAIL) && Math.random() < 0.7) {
        this.spawn(x, y, z, vx * 0.06, vy * 0.06, vz * 0.06,
          0.22 + Math.random() * 0.35, this.s0[i] * 0.55,
          cr * 0.75, cg * 0.75, cb * 0.75, cr * 0.35, cg * 0.12, cb * 0.05, 2.2, -1.5, 0, 0, a * 0.9);
      }
    }
    let h = this.high;
    while (h > 0 && !this.alive[h - 1]) h--;
    const n = Math.max(h, this._lastUploaded || 0); // also clear what was drawn last frame
    this.high = h;
    this._lastUploaded = h;
    this.points.geometry.setDrawRange(0, h);
    for (const key in this.attrs) {
      const at = this.attrs[key];
      at.clearUpdateRanges();
      if (n > 0) { at.addUpdateRange(0, n * at.itemSize); at.needsUpdate = true; }
    }
  }

  clear() { this.alive.fill(0); this.a.fill(0); this.s.fill(0); this.high = 0; }
}

/** Paper / jute bits that fly, flutter and settle on the floor (ground or roof). */
export class Debris {
  constructor(max = 900) {
    this.max = max;
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.r = new Float32Array(max * 3); this.rv = new Float32Array(max * 3);
    this.sz = new Float32Array(max * 2); this.life = new Float32Array(max);
    this.state = new Uint8Array(max); // 0 dead, 1 flying, 2 resting, 3 fading
    this.cursor = 0;
    this.rect = null;
    this.dummy = new THREE.Object3D();
    this.col = new THREE.Color();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) { this.mesh.setMatrixAt(i, zero); this.mesh.setColorAt(i, this.col.set(0xffffff)); }
  }

  burst(pos, n, colors, speed = 3, sizeRange = [0.012, 0.03]) {
    if (!colors || !colors.length) return;
    for (let k = 0; k < n; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
      const i3 = i * 3;
      const th = Math.random() * Math.PI * 2, up = 0.35 + Math.random() * 0.65;
      const sp = speed * (0.3 + Math.random() * 0.9), hz = Math.sqrt(1 - up * up);
      this.p[i3] = pos.x; this.p[i3 + 1] = pos.y; this.p[i3 + 2] = pos.z;
      this.v[i3] = Math.cos(th) * hz * sp; this.v[i3 + 1] = up * sp * 1.2; this.v[i3 + 2] = Math.sin(th) * hz * sp;
      for (let a = 0; a < 3; a++) { this.r[i3 + a] = Math.random() * 6; this.rv[i3 + a] = (Math.random() - 0.5) * 30; }
      const s = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
      this.sz[i * 2] = s; this.sz[i * 2 + 1] = s * (0.5 + Math.random() * 0.6);
      this.life[i] = 0; this.state[i] = 1;
      this.mesh.setColorAt(i, this.col.set(colors[(Math.random() * colors.length) | 0]));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const d = this.dummy;
    let touched = false;
    for (let i = 0; i < this.max; i++) {
      const st = this.state[i];
      if (!st) continue;
      this.life[i] += dt;
      if (st === 2) { if (this.life[i] > 45) this.state[i] = 3; else continue; } // resting bits cost nothing
      const i3 = i * 3;
      let scale = 1;
      if (st === 1) {
        const drag = Math.exp(-2.2 * dt), py = this.p[i3 + 1];
        this.v[i3] = this.v[i3] * drag + Math.sin(this.life[i] * 7 + i) * 0.8 * dt;
        this.v[i3 + 1] = this.v[i3 + 1] * drag - 9.8 * dt;
        this.v[i3 + 2] = this.v[i3 + 2] * drag + Math.cos(this.life[i] * 6 + i) * 0.8 * dt;
        for (let a = 0; a < 3; a++) { this.p[i3 + a] += this.v[i3 + a] * dt; this.r[i3 + a] += this.rv[i3 + a] * dt; }
        const fy = floorAt(this.rect, this.p[i3], this.p[i3 + 2]);
        if (this.p[i3 + 1] <= fy + 0.003 && py >= fy - 0.03) {
          this.p[i3 + 1] = fy + 0.008 + (i % 50) * 0.00004;
          this.r[i3] = -Math.PI / 2; this.r[i3 + 2] = 0;
          this.state[i] = 2;
        } else if (this.p[i3 + 1] < -1) this.state[i] = 0;
      } else if (st === 3) {
        scale = Math.max(0, 1 - (this.life[i] - 45) / 3);
        if (scale <= 0) this.state[i] = 0;
      }
      d.position.set(this.p[i3], this.p[i3 + 1], this.p[i3 + 2]);
      d.rotation.set(this.r[i3], this.r[i3 + 1], this.r[i3 + 2]);
      d.scale.set(this.sz[i * 2] * scale, this.sz[i * 2 + 1] * scale, 1);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      touched = true;
    }
    if (touched) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
