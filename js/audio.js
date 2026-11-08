// Procedural firecracker sound design with Web Audio.
// Every bang = broadband crack transient (saturated) + low thump + body rumble,
// pushed through a convolution "gali" reverb with discrete building echoes.
// Drop real recordings into /sounds and list them in sounds/manifest.json to override.

const R = (a, b) => a + Math.random() * (b - a);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.samples = {};
    this.lastCrackle = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC({ latencyHint: 'interactive' }));
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 6;
    comp.attack.value = 0.001; comp.release.value = 0.22;
    this.master.connect(comp); comp.connect(c.destination);
    this.verb = c.createConvolver();
    this.verb.buffer = this._ir(3.6);
    const vg = c.createGain(); vg.gain.value = 0.85;
    this.verb.connect(vg); vg.connect(this.master);
    this.white = this._noise('white', 4);
    this.brown = this._noise('brown', 4);
    this.curves = {};
    this._loadSamples();
  }

  get now() { return this.ctx.currentTime; }
  get ready() { return !!this.ctx; }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.now, 0.05);
  }

  /* ------------------------------------------------------------ plumbing */

  _noise(type, secs) {
    const c = this.ctx, len = c.sampleRate * secs, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w;
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return b;
  }

  _ir(dur) {
    const c = this.ctx, rate = c.sampleRate, len = Math.floor(rate * dur), b = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / rate;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / dur, 3.4) * 0.3 * Math.min(1, t / 0.03);
      }
      // slap-back echoes off the houses either side of the street
      const echoes = [[0.07, 0.6], [0.125, 0.45], [0.2, 0.38], [0.31, 0.3], [0.45, 0.22], [0.63, 0.16], [0.88, 0.1], [1.25, 0.06]];
      for (const [et, ea] of echoes) {
        const off = Math.floor((et + (ch ? 0.013 : 0) + Math.random() * 0.012) * rate);
        const L = Math.floor(0.03 * rate);
        for (let k = 0; k < L && off + k < len; k++) d[off + k] += (Math.random() * 2 - 1) * ea * Math.exp(-k / (L * 0.22));
      }
    }
    return b;
  }

  _curve(k) {
    const key = k.toFixed(1);
    if (this.curves[key]) return this.curves[key];
    const n = 2048, cv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; cv[i] = Math.tanh(k * x) / Math.tanh(k); }
    return (this.curves[key] = cv);
  }

  _src(buf, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = loop;
    return s;
  }

  _out(node, wet = 0.3, pan = 0) {
    const c = this.ctx;
    let last = node;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p); last = p;
    }
    last.connect(this.master);
    if (wet > 0) { const g = c.createGain(); g.gain.value = wet; last.connect(g); g.connect(this.verb); }
  }

  async _loadSamples() {
    try {
      const res = await fetch('sounds/manifest.json', { cache: 'no-store' });
      if (!res.ok) return;
      const list = await res.json();
      for (const [id, file] of Object.entries(list || {})) {
        try {
          const ab = await (await fetch(`sounds/${file}`)).arrayBuffer();
          this.samples[id] = await this.ctx.decodeAudioData(ab);
        } catch (e) { /* ignore broken sample */ }
      }
    } catch (e) { /* no manifest – synth only */ }
  }

  _sample(id, at = 0, gain = 1) {
    const b = this.samples[id];
    if (!b) return false;
    const s = this._src(b), g = this.ctx.createGain();
    g.gain.value = gain;
    s.connect(g); this._out(g, 0.25);
    s.start(this.now + at);
    return true;
  }

  /* --------------------------------------------------------------- voices */

  /** The core firecracker bang. p = 0..1 power. */
  bang(p, { at = 0, tone = 1, wet = null, pan = 0, gain = 1, lp = 15000 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now + at + 0.004;
    // 1. crack: saturated broadband transient with a fast closing filter
    const n = this._src(this.white);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
    const lpf = c.createBiquadFilter(); lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(lp, t);
    lpf.frequency.exponentialRampToValueAtTime(Math.max(250, lp * 0.07 * tone), t + 0.07 + 0.28 * p);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1.0, t + 0.0012);
    env.gain.exponentialRampToValueAtTime(0.28, t + 0.018 + 0.03 * p);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18 + 0.65 * p);
    const sh = c.createWaveShaper(); sh.curve = this._curve(3 + 4 * p);
    const og = c.createGain(); og.gain.value = (0.55 + 0.45 * p) * gain;
    n.connect(hp); hp.connect(lpf); lpf.connect(env); env.connect(sh); sh.connect(og);
    this._out(og, wet ?? 0.35 + 0.45 * p, pan);
    n.start(t, Math.random() * 2.5); n.stop(t + 1.4 + p);
    // 2. thump: pitch-dropping sine for the chest punch
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150 * tone, t);
    o.frequency.exponentialRampToValueAtTime(34 * tone, t + 0.16 + 0.26 * p);
    const tg = c.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.linearRampToValueAtTime((0.45 + 0.95 * p) * gain, t + 0.003);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3 + 0.6 * p);
    o.connect(tg); this._out(tg, 0.2 + 0.3 * p, pan);
    o.start(t); o.stop(t + 1.2 + p);
    // 3. body rumble for the big boys
    if (p > 0.5) {
      const b = this._src(this.brown);
      const bl = c.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 180 + 220 * p;
      const bg = c.createGain();
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.linearRampToValueAtTime(1.3 * p * gain, t + 0.012);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6 + 1.6 * p);
      b.connect(bl); bl.connect(bg); this._out(bg, 0.6, pan);
      b.start(t, Math.random() * 2); b.stop(t + 3);
    }
    // 4. paper/debris patter
    if (p > 0.3 && gain > 0.5) {
      const k = Math.floor(4 + 10 * p);
      for (let i = 0; i < k; i++) this._tick(at + R(0.15, 1.1), R(0.01, 0.05) * gain, R(-0.6, 0.6));
    }
  }

  _tick(at, vol, pan = 0) {
    const c = this.ctx, t = this.now + at;
    const n = this._src(this.white);
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    n.connect(f); f.connect(g); this._out(g, 0.15, pan);
    n.start(t, Math.random() * 3); n.stop(t + 0.03);
  }

  boom(id) {
    if (!this.ctx) return;
    if (this._sample(id)) return;
    const P = { bullet: [0.38, 1.35], chocolate: [0.62, 1.1], alu: [0.84, 0.9], sutli: [1, 0.72] }[id] || [0.6, 1];
    this.bang(P[0], { tone: P[1] });
    if (id === 'sutli') {
      // the long rolling echo down the gali
      this.bang(0.5, { at: 0.02, tone: 0.55, wet: 1.4, gain: 0.5, lp: 3000 });
    }
  }

  /** Small sharp pop – one cracker of a ladi. */
  pop(vol = 1, pan = 0, at = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now + at + 0.002;
    const n = this._src(this.white);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = R(1400, 3200); f.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1.6 * vol, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.05);
    const sh = c.createWaveShaper(); sh.curve = this._curve(4);
    n.connect(f); f.connect(g); g.connect(sh); this._out(sh, 0.45, pan);
    n.start(t, Math.random() * 3); n.stop(t + 0.15);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(R(200, 260), t); o.frequency.exponentialRampToValueAtTime(60, t + 0.07);
    const og = c.createGain();
    og.gain.setValueAtTime(0.5 * vol, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(og); this._out(og, 0.2, pan);
    o.start(t); o.stop(t + 0.12);
  }

  /** Continuous filtered-noise voice with optional crackle modulation. */
  hiss({ dur, at = 0, type = 'bandpass', freq = 3000, freqEnd = null, q = 0.7, vol = 0.3, crackle = 0, attack = 0.05, release = 0.3, wet = 0.2, pan = 0, src = 'white' }) {
    if (!this.ctx) return { stop() {} };
    const c = this.ctx, t = this.now + at;
    const n = this._src(src === 'brown' ? this.brown : this.white, true);
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.linearRampToValueAtTime(freqEnd, t + dur);
    const m = c.createGain(); m.gain.value = 1;
    if (crackle) {
      let tt = t;
      while (tt < t + dur) {
        tt += R(0.008, 0.05);
        m.gain.setValueAtTime(1 - crackle + crackle * Math.random() * 1.7, tt);
      }
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    const rel = Math.min(release, dur * 0.5);
    g.gain.setValueAtTime(vol, t + dur - rel);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(m); m.connect(g); this._out(g, wet, pan);
    n.start(t, Math.random() * 3); n.stop(t + dur + 0.1);
    return {
      filter: f, gain: g,
      stop: () => {
        try {
          g.gain.cancelScheduledValues(this.now);
          g.gain.setTargetAtTime(0.0001, this.now, 0.05);
          n.stop(this.now + 0.4);
        } catch (e) { /* already stopped */ }
      },
    };
  }

  fuse(dur) {
    if (!this.ctx) return { stop() {} };
    const h = this.hiss({ dur, freq: 3400, q: 0.9, vol: 0.2, crackle: 0.85, wet: 0.08, attack: 0.1 });
    for (let i = 0; i < dur * 4; i++) this._tick(R(0.1, dur), R(0.03, 0.09));
    return h;
  }

  fountain(dur) {
    if (!this.ctx) return;
    this.hiss({ dur, freq: 2300, q: 0.35, vol: 0.5, crackle: 0.4, attack: 0.5, release: 1.4, wet: 0.3 });
    this.hiss({ dur, type: 'lowpass', freq: 320, vol: 0.35, attack: 0.6, release: 1.4, wet: 0.2, src: 'brown' });
    this.hiss({ dur, type: 'highpass', freq: 6000, vol: 0.12, crackle: 0.9, attack: 0.4, release: 1.2, wet: 0.1 });
    for (let i = 0; i < dur * 16; i++) this.pop(R(0.03, 0.12), R(-0.25, 0.25), R(0.6, dur - 0.4));
  }

  sparkler(dur) {
    if (!this.ctx) return { stop() {} };
    const h = this.hiss({ dur, type: 'highpass', freq: 3800, q: 0.5, vol: 0.2, crackle: 0.95, wet: 0.08, attack: 0.2 });
    for (let i = 0; i < dur * 30; i++) this._tick(R(0.2, dur), R(0.02, 0.08), R(-0.3, 0.3));
    return h;
  }

  chakri(dur) {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now;
    const n = this._src(this.white, true);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(1500, t); f.frequency.linearRampToValueAtTime(3600, t + dur * 0.8);
    const lfo = c.createOscillator(); lfo.frequency.setValueAtTime(8, t); lfo.frequency.linearRampToValueAtTime(24, t + dur * 0.7);
    const lfoAmt = c.createGain(); lfoAmt.gain.value = 900;
    lfo.connect(lfoAmt); lfoAmt.connect(f.frequency);
    const am = c.createGain(); am.gain.value = 0.7;
    const lfo2Amt = c.createGain(); lfo2Amt.gain.value = 0.3;
    lfo.connect(lfo2Amt); lfo2Amt.connect(am.gain);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55, t + 0.6);
    g.gain.setValueAtTime(0.55, t + dur - 1); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(am); am.connect(g); this._out(g, 0.25);
    n.start(t, Math.random() * 3); n.stop(t + dur + 0.1);
    lfo.start(t); lfo.stop(t + dur + 0.1);
    this.hiss({ dur, type: 'highpass', freq: 5000, vol: 0.1, crackle: 0.9, attack: 0.5, release: 1, wet: 0.1 });
  }

  rocketLaunch() {
    if (!this.ctx) return;
    const c = this.ctx;
    this.hiss({ dur: 0.4, freq: 2600, q: 0.8, vol: 0.3, crackle: 0.9, wet: 0.1 });
    this.hiss({ dur: 1.8, at: 0.35, freq: 600, freqEnd: 2600, q: 0.8, vol: 0.55, crackle: 0.25, attack: 0.04, release: 1.3, wet: 0.35 });
    const t = this.now + 0.35;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(3100, t + 1.5);
    const vib = c.createOscillator(); vib.frequency.value = 28;
    const va = c.createGain(); va.gain.value = 45;
    vib.connect(va); va.connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1, t + 0.1);
    g.gain.setValueAtTime(0.1, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g); this._out(g, 0.4);
    o.start(t); o.stop(t + 1.9); vib.start(t); vib.stop(t + 1.9);
  }

  mortar() {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now + 0.003;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.2);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(1.2, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(og); this._out(og, 0.35);
    o.start(t); o.stop(t + 0.4);
    const n = this._src(this.white);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
    const g = c.createGain();
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(f); f.connect(g); this._out(g, 0.4);
    n.start(t, Math.random() * 3); n.stop(t + 0.2);
    // rising shell hiss
    this.hiss({ dur: 1.5, at: 0.05, freq: 1800, freqEnd: 900, q: 1.2, vol: 0.12, crackle: 0.6, release: 1, wet: 0.5 });
  }

  airBurst(p = 0.7, delay = 0.08) {
    if (!this.ctx) return;
    this.bang(p, { at: delay, tone: 0.8, wet: 1.1, lp: 6000, gain: 0.85 });
  }

  /** Glittery crackle for crackling stars & sparkler branches (throttled). */
  crackle(n) {
    if (!this.ctx || n <= 0) return;
    const now = this.now;
    if (now - this.lastCrackle < 0.035) return;
    this.lastCrackle = now;
    const k = Math.min(6, n);
    for (let i = 0; i < k; i++) this._tick(R(0, 0.035), R(0.04, 0.12), R(-0.5, 0.5));
  }

  distant(delay = 0.3, power = null) {
    if (!this.ctx) return;
    this.bang(power ?? R(0.35, 0.9), { at: delay, lp: R(900, 1800), gain: R(0.08, 0.2), wet: 1.3, pan: R(-0.9, 0.9) });
  }

  distantLadi() {
    if (!this.ctx) return;
    const pan = R(-0.9, 0.9);
    let at = 0;
    const n = 20 + (Math.random() * 40) | 0;
    for (let i = 0; i < n; i++) {
      at += R(0.03, 0.12);
      this.bang(0.25, { at, lp: 1400, gain: 0.07, wet: 1.2, pan });
    }
  }

  lighterClick() {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now;
    this._tick(0, 0.5);
    this._tick(0.028, 0.25);
    const o = c.createOscillator(); o.frequency.value = 4200;
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); this._out(g, 0.05);
    o.start(t); o.stop(t + 0.06);
    this.hiss({ dur: 0.9, at: 0.03, type: 'lowpass', freq: 900, vol: 0.1, attack: 0.08, release: 0.3, wet: 0.05 });
  }

  place() {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); this._out(g, 0.05);
    o.start(t); o.stop(t + 0.12);
  }
}
