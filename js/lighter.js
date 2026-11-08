// A pocket lighter: either held in your hand (follows the cursor) or flown in automatically.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createFlames } from './environment.js';
import { ease } from './utils.js';

const FLAME_W = 0.02, FLAME_H = 0.05;
const HAND_ROT = new THREE.Euler(0.15, -0.35, 0.32);

export class Lighter {
  constructor(scene, tl, audio) {
    this.tl = tl; this.audio = audio;
    this.S = 1.0;
    this.busy = false;       // auto animation running
    this.following = false;  // held by the cursor
    const g = (this.group = new THREE.Group());
    g.visible = false;
    scene.add(g);
    const plastic = new THREE.MeshPhysicalMaterial({ color: 0xe0115f, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.92 });
    const fluid = new THREE.MeshStandardMaterial({ color: 0xffd28a, roughness: 0.1, transparent: true, opacity: 0.55 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.6, roughness: 0.5 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    add(new RoundedBoxGeometry(0.024, 0.072, 0.013, 2, 0.004), plastic, 0, 0.036, 0);
    add(new THREE.BoxGeometry(0.02, 0.04, 0.009), fluid, 0, 0.026, 0);
    add(new THREE.BoxGeometry(0.0242, 0.017, 0.0132), metal, 0, 0.0805, 0);
    this.wheel = add(new THREE.CylinderGeometry(0.0048, 0.0048, 0.007, 14), dark, 0.0045, 0.0935, 0);
    this.wheel.rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.011, 0.0035, 0.011), dark, -0.005, 0.0915, 0);
    g.scale.setScalar(this.S);

    this.flameBase = new THREE.Vector3(-0.003, 0.094, 0);
    this.flame = createFlames([{ pos: new THREE.Vector3(0, 0, 0), w: FLAME_W, h: FLAME_H }]);
    this.flame.position.copy(this.flameBase);
    this.flame.visible = false;
    g.add(this.flame);
    this.light = new THREE.PointLight(0xffa040, 0, 2.5, 2);
    this.light.position.copy(this.flameBase).add(new THREE.Vector3(0.04, 0.09, 0.06)); // keep it off the cracker's surface
    g.add(this.light);
    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
  }

  _setFlame(k) {
    this.flame.visible = k > 0.01;
    this._m.makeScale(FLAME_W * k, FLAME_H * k, 1);
    this.flame.setMatrixAt(0, this._m);
    this.flame.instanceMatrix.needsUpdate = true;
    this.light.intensity = 0.16 * k;
  }

  /** World point where the flame is hottest (what touches the fuse). */
  contactPoint(out = new THREE.Vector3()) {
    out.copy(this.flameBase).multiplyScalar(this.S).applyEuler(this.group.rotation).add(this.group.position);
    out.y += FLAME_H * 0.3;
    return out;
  }

  /** Hold the lighter so its flame sits at `point` (cursor in the world). */
  follow(point) {
    if (this.busy) return;
    const g = this.group;
    if (!this.following) {
      this.following = true;
      g.rotation.copy(HAND_ROT);
      g.visible = true;
      this._setFlame(1);
      this.audio.lighterClick();
    }
    const base = this._v.copy(this.flameBase).multiplyScalar(this.S).applyEuler(g.rotation);
    g.position.copy(point).sub(base);
    g.position.y -= FLAME_H * 0.3;
    // a little hand tremble
    g.rotation.z = HAND_ROT.z + Math.sin(performance.now() * 0.004) * 0.03;
  }

  stopFollow() {
    if (!this.following) return;
    this.following = false;
    if (!this.busy) { this.group.visible = false; this._setFlame(0); }
  }

  /** Auto mode: fly in, flick, light the bati, fly out. Resolves when the fuse catches. */
  async lightAt(tip, floorY = 0) {
    this.stopFollow();
    this.busy = true;
    const g = this.group, S = this.S, tl = this.tl;
    const low = tip.y - floorY < 0.2;
    g.rotation.set(0, -0.35, low ? 1.3 : 0.45);
    const base = this.flameBase.clone().multiplyScalar(S).applyEuler(g.rotation);
    const end = tip.clone().sub(base).sub(new THREE.Vector3(0, FLAME_H * 0.28, 0));
    const start = end.clone().add(new THREE.Vector3(0.55, 0.32, 0.45));
    g.position.copy(start);
    g.visible = true;
    this._setFlame(0);
    try {
      await tl.tween(0.7, (k) => g.position.lerpVectors(start, end, k), ease.outCubic);
      this.audio.lighterClick();
      tl.tween(0.25, (k) => { this.wheel.rotation.y = -k * 6; }, ease.outCubic);
      await tl.tween(0.12, (k) => this._setFlame(k), ease.outCubic);
      await tl.wait(0.5);
    } finally {
      this._retreat(start, end);
    }
  }

  async _retreat(start, end) {
    const g = this.group, tl = this.tl;
    await tl.wait(0.25);
    tl.tween(0.2, (k) => this._setFlame(1 - k), ease.linear);
    await tl.tween(0.55, (k) => g.position.lerpVectors(end, start, k), ease.inCubic);
    g.visible = false;
    this.busy = false;
  }
}
