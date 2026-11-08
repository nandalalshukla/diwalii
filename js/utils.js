export const R = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const ease = {
  linear: (k) => k,
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  inCubic: (k) => k * k * k,
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outBack: (k) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  },
};

/** Frame-driven scheduler: everything animates on simulation time. */
export class Timeline {
  constructor() {
    this.list = [];
  }
  /** fn(dt, elapsed) -> return false to stop */
  add(fn) {
    this.list.push({ fn, e: 0 });
  }
  wait(s) {
    return new Promise((res) =>
      this.add((dt, e) => {
        if (e >= s) { res(); return false; }
        return true;
      })
    );
  }
  tween(d, fn, easeFn = ease.inOutCubic) {
    return new Promise((res, rej) =>
      this.add((dt, e) => {
        try {
          const k = Math.min(1, e / d);
          fn(easeFn(k), k);
          if (k >= 1) { res(); return false; }
          return true;
        } catch (err) { rej(err); return false; }
      })
    );
  }
  tick(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const u = this.list[i];
      u.e += dt;
      let keep;
      try { keep = u.fn(dt, u.e); } catch (err) { console.error(err); keep = false; }
      if (keep === false) this.list.splice(i, 1);
    }
  }
}
