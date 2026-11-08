// Procedural canvas textures: rangoli, cracker wrappers, twine, plaster, windows, skyline…
import * as THREE from 'three';

export const FONT_HI = '"Tiro Devanagari Hindi","Nirmala UI","Mangal","Kohinoor Devanagari",serif';
export const FONT_EN = '"Poppins","Segoe UI",Arial,sans-serif';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function toTexture(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function grain(g, w, h, n, alpha, rand, light = '255,255,255', dark = '0,0,0') {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? light : dark},${(rand() * alpha).toFixed(3)})`;
    const s = rand() * 1.6 + 0.4;
    g.fillRect(rand() * w, rand() * h, s, s);
  }
}

function blobs(g, w, h, n, rand, cols, rMin, rMax) {
  for (let k = 0; k < n; k++) {
    const x = rand() * w, y = rand() * h, rad = rMin + rand() * (rMax - rMin);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, cols[(rand() * cols.length) | 0]);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

/* ------------------------------------------------------------------ sprites */

export function sparkTexture() {
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.12, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.32, 'rgba(255,255,255,0.35)');
  gr.addColorStop(0.65, 'rgba(255,255,255,0.06)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return toTexture(c, { srgb: false });
}

export function smokeTexture() {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(7);
  for (let i = 0; i < 36; i++) {
    const a = r() * Math.PI * 2, d = r() * S * 0.22;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, rad = S * (0.12 + r() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${0.1 + r() * 0.12})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, S, S);
  return toTexture(c, { srgb: false });
}

export function scorchTexture() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(11);
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = r() * S * 0.22;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, rad = S * (0.08 + r() * 0.18);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(10,7,5,${0.3 + r() * 0.3})`);
    gr.addColorStop(1, 'rgba(10,7,5,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, r0 = S * 0.06, r1 = S * (0.22 + r() * 0.25);
    g.strokeStyle = `rgba(12,9,7,${0.15 + r() * 0.25})`;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    g.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0);
    g.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1);
    g.stroke();
  }
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S / 2);
  m.addColorStop(0, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, S, S);
  return toTexture(c);
}

/* -------------------------------------------------------------- environment */

export function groundTexture() {
  const S = 1024, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(5);
  g.fillStyle = '#3a322c'; g.fillRect(0, 0, S, S);
  const T = S / 4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = (r() - 0.5) * 22;
    g.fillStyle = `rgb(${(122 + v) | 0},${(108 + v) | 0},${(95 + v) | 0})`;
    g.fillRect(i * T, j * T, T, T);
    g.save();
    g.beginPath(); g.rect(i * T, j * T, T, T); g.clip();
    blobs(g, T, T, 0, r, [], 0, 0);
    for (let k = 0; k < 26; k++) {
      const x = i * T + r() * T, y = j * T + r() * T, rad = 8 + r() * 44;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() < 0.5 ? 'rgba(40,30,25,0.12)' : 'rgba(255,240,220,0.07)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.restore();
  }
  g.fillStyle = '#3a312b';
  for (let i = 0; i <= 4; i++) { g.fillRect(i * T - 3, 0, 6, S); g.fillRect(0, i * T - 3, S, 6); }
  grain(g, S, S, 26000, 0.16, r);
  return toTexture(c, { repeat: [20, 20] });
}

export function plasterTexture(color = '#e2b48a', seed = 9) {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(seed);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  blobs(g, S, S, 70, r, ['rgba(90,50,30,0.07)', 'rgba(255,255,255,0.07)'], 20, 110);
  for (let k = 0; k < 12; k++) {
    const x = r() * S;
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, 'rgba(60,40,30,0.08)'); gr.addColorStop(1, 'rgba(60,40,30,0)');
    g.fillStyle = gr; g.fillRect(x, 0, 2 + r() * 6, S * (0.3 + r() * 0.6));
  }
  grain(g, S, S, 12000, 0.1, r);
  return toTexture(c, { repeat: [1, 1] });
}

export function windowTexture(seed = 1) {
  const W = 256, H = 300, c = makeCanvas(W, H), g = c.getContext('2d'), r = mulberry32(seed);
  const gr = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.8);
  gr.addColorStop(0, '#fff0c0'); gr.addColorStop(0.5, '#ffc768'); gr.addColorStop(1, '#d9772a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const cc = ['#b0173a', '#7b1fa2', '#c2185b', '#e65100', '#1565c0'][(r() * 5) | 0];
  for (const side of [0, 1]) {
    g.save();
    if (side) { g.translate(W, 0); g.scale(-1, 1); }
    g.fillStyle = cc;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.3, 0);
    g.quadraticCurveTo(W * 0.2, H * 0.45, W * 0.12, H * 0.62);
    g.quadraticCurveTo(W * 0.18, H * 0.85, W * 0.22, H);
    g.lineTo(0, H); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
    for (let k = 1; k < 5; k++) {
      g.beginPath(); g.moveTo(W * 0.06 * k, 0);
      g.quadraticCurveTo(W * 0.045 * k, H * 0.5, W * 0.05 * k, H); g.stroke();
    }
    g.restore();
  }
  g.strokeStyle = '#2b1a10'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
  g.lineWidth = 4;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo((W * k) / 4, 0); g.lineTo((W * k) / 4, H); g.stroke(); }
  g.beginPath(); g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5); g.stroke();
  g.lineWidth = 3;
  for (let k = 0; k < 4; k++) { g.beginPath(); g.arc((W * (k + 0.5)) / 4, H * 0.5, W / 8, Math.PI, 0); g.stroke(); }
  return toTexture(c);
}

export function doorTexture() {
  const W = 256, H = 420, c = makeCanvas(W, H), g = c.getContext('2d');
  let gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#5a2a12'); gr.addColorStop(0.55, '#c8682a'); gr.addColorStop(1, '#8a4a22');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#6b3a1e';
  g.beginPath(); g.moveTo(0, H); g.lineTo(W * 0.2, H * 0.72); g.lineTo(W * 0.8, H * 0.72); g.lineTo(W, H); g.fill();
  const cx = W / 2, cy = H * 0.5;
  gr = g.createRadialGradient(cx, cy, 5, cx, cy, W * 0.6);
  gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.25, 'rgba(255,190,90,0.85)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffd27a';
  g.beginPath(); g.moveTo(cx - 40, cy + 50); g.lineTo(cx - 40, cy - 20);
  g.quadraticCurveTo(cx, cy - 80, cx + 40, cy - 20); g.lineTo(cx + 40, cy + 50); g.closePath(); g.fill();
  g.strokeStyle = '#b5651d'; g.lineWidth = 6; g.stroke();
  for (let k = 0; k < 7; k++) {
    const x = W * 0.22 + k * W * 0.093, y = H * 0.79;
    g.fillStyle = '#7a3b1a'; g.beginPath(); g.ellipse(x, y, 9, 4, 0, 0, Math.PI * 2); g.fill();
    const fg = g.createRadialGradient(x, y - 9, 0, x, y - 9, 12);
    fg.addColorStop(0, '#fffbe0'); fg.addColorStop(0.4, '#ffb340'); fg.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(x, y - 9, 12, 0, 7); g.fill();
  }
  for (let k = 0; k < 14; k++) {
    g.fillStyle = k % 2 ? '#ff8f00' : '#ffc107';
    g.beginPath(); g.arc((W * (k + 0.5)) / 14, 14 + Math.sin((k / 13) * Math.PI) * 16, 8, 0, 7); g.fill();
  }
  return toTexture(c);
}

export function rangoliTexture(seed, pal) {
  const S = 1024, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(seed);
  const P = (i) => pal[i % pal.length];
  g.translate(S / 2, S / 2);
  const petal = (r0, r1, w) => {
    g.beginPath(); g.moveTo(r0, 0);
    g.quadraticCurveTo((r0 + r1) / 2, w, r1, 0);
    g.quadraticCurveTo((r0 + r1) / 2, -w, r0, 0); g.closePath();
  };
  const ring = (n, r0, r1, w, fill, stroke, off = 0, lw = 5) => {
    for (let i = 0; i < n; i++) {
      g.save(); g.rotate(off + (i * Math.PI * 2) / n); petal(r0, r1, w);
      g.fillStyle = fill; g.fill();
      if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
      g.restore();
    }
  };
  const circle = (rad, fill, stroke, lw = 6) => {
    g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  };
  const dots = (rad, n, size, col, off = 0) => {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = off + (i * Math.PI * 2) / n;
      g.beginPath(); g.arc(Math.cos(a) * rad, Math.sin(a) * rad, size, 0, 7); g.fill();
    }
  };
  const n1 = [12, 16, 8][(r() * 3) | 0];
  ring(n1 * 2, 385, 498, 30, P(4), '#fff', Math.PI / (n1 * 2), 4);
  ring(n1, 300, 488, 74, P(0), '#fff8e1', 0, 7);
  ring(n1, 300, 430, 40, P(1), null, 0);
  dots(455, n1, 9, '#fff');
  circle(302, P(2), '#fff', 9);
  ring(n1, 190, 300, 46, P(3), '#fff', Math.PI / n1, 5);
  circle(196, P(5), '#fff', 7);
  dots(180, n1 * 3, 6, '#fff');
  ring(8, 62, 176, 42, P(1), '#fff', 0, 4);
  ring(8, 70, 150, 22, P(6), null, Math.PI / 8);
  circle(70, P(0), '#fff', 6);
  // centre: a little diya
  g.fillStyle = '#8d3b14';
  g.beginPath(); g.ellipse(0, 16, 44, 20, 0, 0, Math.PI); g.fill();
  g.fillStyle = '#ffd54f';
  g.beginPath(); g.moveTo(0, -48); g.quadraticCurveTo(24, -6, 0, 14); g.quadraticCurveTo(-24, -6, 0, -48); g.fill();
  g.fillStyle = '#fff3c4';
  g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(10, -4, 0, 8); g.quadraticCurveTo(-10, -4, 0, -24); g.fill();
  dots(503, n1 * 4, 7, '#ffffff');
  dots(500, n1 * 4, 4, P(1), Math.PI / (n1 * 4));
  g.setTransform(1, 0, 0, 1, 0, 0);
  // powdery grain only on painted pixels
  g.globalCompositeOperation = 'source-atop';
  grain(g, S, S, 70000, 0.28, r);
  g.globalCompositeOperation = 'source-over';
  return toTexture(c);
}

export function footprintsTexture() {
  const W = 256, H = 512, c = makeCanvas(W, H), g = c.getContext('2d');
  const foot = (x, y, flip, s) => {
    g.save(); g.translate(x, y); g.scale(flip ? -s : s, s);
    g.fillStyle = '#d81b3c';
    g.beginPath(); g.ellipse(0, 0, 15, 28, 0.08, 0, 7); g.fill();
    g.beginPath(); g.ellipse(2, 32, 11, 13, 0, 0, 7); g.fill();
    for (const [tx, ty, tr] of [[-11, -36, 6], [-2, -40, 5], [6, -39, 4.5], [12, -35, 4], [16, -29, 3.5]]) {
      g.beginPath(); g.arc(tx, ty, tr, 0, 7); g.fill();
    }
    g.restore();
  };
  foot(92, 150, false, 1.25); foot(164, 120, true, 1.25);
  foot(92, 390, false, 1.25); foot(164, 360, true, 1.25);
  return toTexture(c);
}

export function textPlateTexture(text) {
  const W = 256, H = 160, c = makeCanvas(W, H), g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 96px ${FONT_HI}`;
  g.lineWidth = 10; g.strokeStyle = '#ffd54f'; g.strokeText(text, W / 2, H / 2 + 6);
  g.fillStyle = '#b71c1c'; g.fillText(text, W / 2, H / 2 + 6);
  return toTexture(c);
}

export function kandilTexture(base, accent) {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(60,0,0,0.6)'; g.lineWidth = 3;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo((i * S) / 8, 0); g.lineTo((i * S) / 8, S); g.stroke(); }
  for (let i = 0; i < 8; i++) {
    const cx = ((i + 0.5) * S) / 8;
    g.fillStyle = accent;
    g.beginPath(); g.moveTo(cx, S * 0.2); g.lineTo(cx + 12, S * 0.5); g.lineTo(cx, S * 0.8); g.lineTo(cx - 12, S * 0.5); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,220,0.95)'; g.beginPath(); g.arc(cx, S * 0.5, 4, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(90,0,0,0.55)'; g.fillRect(0, 0, S, S * 0.08); g.fillRect(0, S * 0.92, S, S * 0.08);
  return toTexture(c);
}

export function skylineTexture(seed = 3, withTemple = false) {
  const W = 2048, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), r = mulberry32(seed);
  const warm = ['#ffcf70', '#ffe2a0', '#ffb35a', '#fff0c8'];
  const cols = ['#ff3b3b', '#3bff6a', '#3b8bff', '#ffd83b', '#ff3bd8', '#3bfff2', '#ff8a1e'];
  let x = 0;
  while (x < W) {
    const bw = 60 + r() * 170, bh = H * (0.16 + r() * 0.5), top = H - bh;
    g.fillStyle = `rgb(${(14 + r() * 8) | 0},${(11 + r() * 6) | 0},${(26 + r() * 10) | 0})`;
    g.fillRect(x, top, bw, bh);
    for (let wy = top + 12; wy < H - 8; wy += 22)
      for (let wx = x + 8; wx < x + bw - 10; wx += 18)
        if (r() < 0.32) {
          g.fillStyle = warm[(r() * warm.length) | 0];
          g.globalAlpha = 0.5 + r() * 0.5; g.fillRect(wx, wy, 8, 11); g.globalAlpha = 1;
        }
    if (r() < 0.8) {
      for (let lx = x + 3; lx < x + bw - 3; lx += 6) {
        g.fillStyle = cols[((lx / 6) | 0) % cols.length];
        g.beginPath(); g.arc(lx, top + 3 + Math.sin(((lx - x) / bw) * Math.PI) * 6, 1.9, 0, 7); g.fill();
      }
      if (r() < 0.65) {
        const col = cols[(r() * cols.length) | 0];
        for (let sx = x + 6; sx < x + bw - 4; sx += 8) {
          const len = 20 + r() * bh * 0.45;
          g.fillStyle = r() < 0.5 ? col : cols[(r() * cols.length) | 0];
          for (let sy = top + 7; sy < top + len; sy += 6) { g.beginPath(); g.arc(sx, sy, 1.5, 0, 7); g.fill(); }
        }
      }
    }
    x += bw + (r() < 0.3 ? r() * 24 : 0);
  }
  if (withTemple) {
    const cx = W * 0.62, base = H, hgt = H * 0.78, w = 150;
    g.fillStyle = '#120e22';
    g.beginPath(); g.moveTo(cx - w, base); g.lineTo(cx - w * 0.72, base - hgt * 0.45);
    g.quadraticCurveTo(cx - w * 0.5, base - hgt * 0.95, cx, base - hgt);
    g.quadraticCurveTo(cx + w * 0.5, base - hgt * 0.95, cx + w * 0.72, base - hgt * 0.45);
    g.lineTo(cx + w, base); g.closePath(); g.fill();
    g.fillStyle = '#ffd36b';
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const px = cx - w + (w * 0.28) * t * 0;
      const lx = cx - w + t * (w * 0.28), ly = base - t * hgt * 0.45;
      g.beginPath(); g.arc(lx, ly, 2.2, 0, 7); g.fill();
      g.beginPath(); g.arc(2 * cx - lx, ly, 2.2, 0, 7); g.fill();
      void px;
    }
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const ax = cx - w * 0.72, ay = base - hgt * 0.45, bx = cx - w * 0.5, by = base - hgt * 0.95, ex = cx, ey = base - hgt;
      const qx = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * bx + t * t * ex;
      const qy = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * by + t * t * ey;
      g.beginPath(); g.arc(qx, qy, 2.2, 0, 7); g.fill();
      g.beginPath(); g.arc(2 * cx - qx, qy, 2.2, 0, 7); g.fill();
    }
    g.fillStyle = '#ff7a00';
    g.beginPath(); g.moveTo(cx, base - hgt - 4); g.lineTo(cx, base - hgt - 50); g.lineTo(cx + 34, base - hgt - 40); g.lineTo(cx, base - hgt - 30); g.fill();
  }
  return toTexture(c);
}

export function dotStripTexture(seed = 4) {
  const W = 256, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), r = mulberry32(seed);
  const cols = ['#ff4040', '#40ff70', '#4090ff', '#ffe040', '#ff40e0', '#40fff0', '#ff9020'];
  for (let sx = 6; sx < W; sx += 12) {
    const len = H * (0.35 + r() * 0.6), col = cols[(r() * cols.length) | 0];
    for (let sy = 5; sy < len; sy += 11) {
      g.fillStyle = r() < 0.75 ? col : cols[(r() * cols.length) | 0];
      g.beginPath(); g.arc(sx, sy, 2.6, 0, 7); g.fill();
    }
  }
  return toTexture(c);
}

/* ------------------------------------------------------------ cracker skins */

export function paperTexture({
  w = 512, h = 256, bg = '#c62828', bands = [], text = '', sub = '', textColor = '#fff3c4',
  subColor = null, font = `800 64px ${FONT_EN}`, subFont = `56px ${FONT_HI}`, seed = 1,
  repeatText = 1, motif = null, textY = 0.42, subY = 0.72,
}) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), r = mulberry32(seed);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (const b of bands) {
    g.fillStyle = b.color; g.fillRect(0, b.y * h, w, b.h * h);
    if (b.zig) {
      g.fillStyle = b.zig;
      const y0 = b.y * h, hh = b.h * h, step = hh * 1.2;
      for (let x = 0; x < w; x += step) {
        g.beginPath(); g.moveTo(x, y0 + hh); g.lineTo(x + step / 2, y0); g.lineTo(x + step, y0 + hh); g.fill();
      }
    }
  }
  if (motif === 'stars') {
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, s = 3 + r() * 7;
      g.fillStyle = ['#ffd54f', '#ffffff', '#ff80ab', '#80d8ff'][(r() * 4) | 0];
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI) / 5 - Math.PI / 2, rr = k % 2 ? s * 0.45 : s;
        k ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.closePath(); g.fill();
    }
  } else if (motif === 'dots') {
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.3})`;
      g.beginPath(); g.arc(r() * w, r() * h, 1.5 + r() * 3, 0, 7); g.fill();
    }
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k < repeatText; k++) {
    const x = ((k + 0.5) * w) / repeatText;
    if (text) {
      g.font = font; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.strokeText(text, x, h * textY); g.fillStyle = textColor; g.fillText(text, x, h * textY);
    }
    if (sub) {
      g.font = subFont; g.fillStyle = subColor || textColor; g.fillText(sub, x, h * subY);
    }
  }
  // paper wrinkles + grain
  for (let i = 0; i < 18; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.04 + r() * 0.05})`; g.lineWidth = 1 + r() * 2;
    g.beginPath(); const x = r() * w; g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 80, h); g.stroke();
  }
  grain(g, w, h, (w * h) / 18, 0.14, r);
  return toTexture(c);
}

export function foilTexture(color = '#d4a017', seed = 5) {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(seed);
  const gr = g.createLinearGradient(0, 0, S, 0);
  gr.addColorStop(0, color); gr.addColorStop(0.45, '#fff6c8'); gr.addColorStop(0.55, color); gr.addColorStop(1, '#6b4a00');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.08 + r() * 0.15})`;
    g.lineWidth = 1; g.beginPath();
    const x = r() * S, y = r() * S; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30); g.stroke();
  }
  return toTexture(c);
}

export function twineTexture() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(31);
  g.fillStyle = '#6e4f28'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 5) {
    const l = 150 + ((r() * 45) | 0);
    g.strokeStyle = `rgb(${l + 35},${l + 5},${l - 60})`; g.lineWidth = 3.4;
    g.beginPath();
    for (let x = 0; x <= S; x += 16) {
      const yy = y + 2.5 + Math.sin(x * 0.05 + y) * 0.8;
      x ? g.lineTo(x, yy) : g.moveTo(x, yy);
    }
    g.stroke();
    g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 1;
    for (let x = (y * 3) % 7; x < S; x += 7) { g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x + 4, y + 4.5); g.stroke(); }
  }
  for (let i = 0; i < 600; i++) {
    g.strokeStyle = `rgba(235,205,150,${0.2 + r() * 0.3})`; g.lineWidth = 0.7;
    const x = r() * S, y = r() * S;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 16, y + (r() - 0.5) * 6); g.stroke();
  }
  return toTexture(c);
}

export function aluTexture() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(41);
  g.fillStyle = '#8c5a33'; g.fillRect(0, 0, S, S);
  blobs(g, S, S, 50, r, ['rgba(60,30,10,0.18)', 'rgba(255,220,180,0.12)'], 15, 70);
  // newspaper patches
  for (let i = 0; i < 6; i++) {
    const x = r() * S, y = r() * S, w = 80 + r() * 120, h = 60 + r() * 100;
    g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.8);
    g.fillStyle = 'rgba(225,215,195,0.9)'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,40,40,0.55)';
    for (let ly = 6; ly < h - 4; ly += 6) for (let lx = 5; lx < w - 8; lx += 2 + r() * 14) g.fillRect(lx, ly, 2 + r() * 10, 2);
    g.restore();
  }
  // red print
  g.save(); g.translate(S * 0.5, S * 0.5); g.rotate(-0.15);
  g.fillStyle = '#b3121f'; g.fillRect(-170, -60, 340, 120);
  g.fillStyle = '#ffe082'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 54px ${FONT_EN}`; g.fillText('ALU BOMB', 0, -16);
  g.font = `46px ${FONT_HI}`; g.fillText('आलू बम', 0, 34);
  g.restore();
  // crumple creases
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${r() < 0.5 ? '255,235,210' : '40,20,5'},${0.1 + r() * 0.2})`;
    g.lineWidth = 1 + r() * 2; g.beginPath();
    let x = r() * S, y = r() * S; g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }
  grain(g, S, S, 14000, 0.14, r);
  return toTexture(c);
}

export function anarTexture() {
  const W = 512, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), r = mulberry32(21);
  g.fillStyle = '#c62828'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = 'rgba(255,230,120,0.7)'; g.beginPath(); g.arc(r() * W, r() * H * 0.3, 2 + r() * 3, 0, 7); g.fill();
  }
  g.fillStyle = '#ffd23f'; g.fillRect(0, H * 0.3, W, H * 0.32);
  g.fillStyle = '#1b7a3a'; g.fillRect(0, H * 0.62, W, H * 0.38);
  // zigzag trims
  for (const [y, col] of [[H * 0.3, '#ffffff'], [H * 0.6, '#ffffff']]) {
    g.fillStyle = col;
    for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x + 8, y); g.lineTo(x + 16, y + 12); g.fill(); }
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k < 2; k++) {
    const x = ((k + 0.5) * W) / 2;
    g.font = `800 62px ${FONT_EN}`; g.fillStyle = '#b71c1c'; g.fillText('ANAR', x, H * 0.4);
    g.font = `48px ${FONT_HI}`; g.fillStyle = '#1b5e20'; g.fillText('अनार', x, H * 0.53);
  }
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = H * 0.66 + r() * H * 0.3, s = 6 + r() * 8;
    g.fillStyle = r() < 0.5 ? '#ffd54f' : '#f48fb1';
    for (let p = 0; p < 5; p++) {
      const a = (p * Math.PI * 2) / 5;
      g.beginPath(); g.arc(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.45, 0, 7); g.fill();
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, s * 0.3, 0, 7); g.fill();
  }
  grain(g, W, H, 14000, 0.12, r);
  return toTexture(c);
}

export function stripeTexture(colors, seed = 2) {
  const W = 256, H = 64, c = makeCanvas(W, H), g = c.getContext('2d'), r = mulberry32(seed);
  const sw = W / colors.length;
  colors.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(i * sw, 0); g.lineTo(i * sw + sw, 0); g.lineTo(i * sw + sw + H, H); g.lineTo(i * sw + H, H); g.fill();
    g.beginPath(); g.moveTo(i * sw - W, 0); g.lineTo(i * sw + sw - W, 0); g.lineTo(i * sw + sw + H - W, H); g.lineTo(i * sw + H - W, H); g.fill();
  });
  grain(g, W, H, 2000, 0.15, r);
  return toTexture(c, { repeat: [1, 1] });
}
