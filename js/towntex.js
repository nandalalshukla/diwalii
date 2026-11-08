// Canvas textures for the town: facades (with night emissive maps), concrete, asphalt, dirt, curbs.
import { makeCanvas, toTexture, mulberry32, FONT_EN, FONT_HI } from './textures.js';

function grain(g, w, h, n, alpha, rand) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${(rand() * alpha).toFixed(3)})`;
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

const SHOPS = ['SHARMA KIRANA STORE', 'GUPTA SWEETS', 'JAI AMBE MEDICAL', 'NEW MOBILE POINT', 'AGARWAL CLOTH HOUSE',
  'CHAI CORNER', 'RAJ TAILORS', 'BALAJI HARDWARE', 'SHREE PHOTO STUDIO', 'मिठाई भंडार', 'किराना स्टोर', 'पान भंडार',
  'DIWALI MEGA SALE', 'LAXMI JEWELLERS', 'VERMA ELECTRICALS', 'OM SAI XEROX'];
const BOARD = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#00838f', '#d84315', '#ad1457'];
const CURTAIN = ['#b0173a', '#7b1fa2', '#c2185b', '#e65100', '#1565c0', '#2e7d32', '#f9a825'];

function marigoldArc(g, x0, x1, y, sag, k, waves = 1) {
  for (let mx = x0; mx < x1; mx += 7 * k) {
    g.fillStyle = Math.round(mx / (7 * k)) % 2 ? '#ff8f00' : '#ffc107';
    g.beginPath();
    g.arc(mx, y + Math.abs(Math.sin(((mx - x0) / (x1 - x0)) * Math.PI * waves)) * sag, 3.4 * k, 0, 7);
    g.fill();
  }
}

function windowBay(g, ge, x, y, C, r, balcony, low = false) {
  const k = C / 256;
  const ww = 112 * k, wh = 118 * k, wx = x + (C - ww) / 2, wy = y + (low ? 78 : 56) * k;
  // chajja (concrete sunshade) and its shadow
  g.fillStyle = '#8f887c'; g.fillRect(wx - 24 * k, wy - 28 * k, ww + 48 * k, 13 * k);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(wx - 24 * k, wy - 28 * k, ww + 48 * k, 3 * k);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(wx - 24 * k, wy - 15 * k, ww + 48 * k, 14 * k);
  g.fillStyle = '#4a3426'; g.fillRect(wx - 7 * k, wy - 5 * k, ww + 14 * k, wh + 12 * k);
  const lit = r() < 0.58, cool = r() < 0.4;
  if (lit) {
    const gr = g.createLinearGradient(wx, wy, wx, wy + wh);
    gr.addColorStop(0, cool ? '#eef5ff' : '#ffe6ae'); gr.addColorStop(1, cool ? '#b9cde6' : '#f0ad58');
    g.fillStyle = gr;
    ge.fillStyle = cool ? '#bcd6ff' : '#ffb85c'; ge.fillRect(wx, wy, ww, wh);
  } else g.fillStyle = '#161a22';
  g.fillRect(wx, wy, ww, wh);
  if (r() < 0.7) {
    const cc = CURTAIN[(r() * CURTAIN.length) | 0];
    for (const side of [0, 1]) {
      const cx = side ? wx + ww * 0.74 : wx;
      g.fillStyle = cc; g.fillRect(cx, wy, ww * 0.26, wh);
      if (lit) { ge.fillStyle = 'rgb(120,40,10)'; ge.fillRect(cx, wy, ww * 0.26, wh); }
    }
  }
  for (const c of lit ? [g, ge] : [g]) {
    c.strokeStyle = c === g ? '#2a2a2a' : '#000'; c.lineWidth = 3 * k;
    for (let bx = wx + 14 * k; bx < wx + ww; bx += 14 * k) { c.beginPath(); c.moveTo(bx, wy); c.lineTo(bx, wy + wh); c.stroke(); }
    c.beginPath(); c.moveTo(wx, wy + wh / 2); c.lineTo(wx + ww, wy + wh / 2); c.stroke();
    c.beginPath(); c.arc(wx + ww / 2, wy + wh / 2, ww * 0.22, Math.PI, 0); c.stroke();
  }
  if (balcony) {
    const by = y + C - 64 * k;
    g.fillStyle = '#8f887d'; g.fillRect(x + 4 * k, by + 46 * k, C - 8 * k, 11 * k);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 4 * k, by + 57 * k, C - 8 * k, 7 * k);
    if (r() < 0.5) {
      g.fillStyle = CURTAIN[(r() * CURTAIN.length) | 0]; g.globalAlpha = 0.85;
      g.fillRect(x + 30 * k, by - 2 * k, C * 0.45, 40 * k); g.globalAlpha = 1;
    }
    g.strokeStyle = '#2d2d2d'; g.lineWidth = 3 * k;
    g.beginPath(); g.moveTo(x + 6 * k, by); g.lineTo(x + C - 6 * k, by); g.stroke();
    for (let bx = x + 10 * k; bx < x + C - 6 * k; bx += 11 * k) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by + 46 * k); g.stroke(); }
  } else if (r() < 0.25) {
    const ax = r() < 0.5 ? wx - 74 * k : wx + ww + 16 * k;
    g.fillStyle = '#d8d8d2'; g.fillRect(ax, wy + 40 * k, 58 * k, 42 * k);
    g.strokeStyle = '#999'; g.lineWidth = 1.5 * k;
    for (let ly = wy + 46 * k; ly < wy + 80 * k; ly += 5 * k) { g.beginPath(); g.moveTo(ax + 4 * k, ly); g.lineTo(ax + 54 * k, ly); g.stroke(); }
  }
  if (r() < 0.2) marigoldArc(g, wx - 20 * k, wx + ww + 20 * k, wy - 10 * k, 8 * k, k);
}

function shopBay(g, ge, x, y, C, r) {
  const k = C / 256;
  const bx = x + 10 * k, by = y + 22 * k, bw = C - 20 * k, bh = 46 * k;
  const col = BOARD[(r() * BOARD.length) | 0];
  g.fillStyle = col; g.fillRect(bx, by, bw, bh);
  const name = SHOPS[(r() * SHOPS.length) | 0];
  const fam = /[^\x00-\x7F]/.test(name) ? FONT_HI : FONT_EN;
  let fs = 26 * k;
  g.font = `800 ${fs}px ${fam}`;
  while (g.measureText(name).width > bw - 12 * k && fs > 10) { fs -= 1; g.font = `800 ${fs}px ${fam}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = col === '#f9a825' ? '#3a0a00' : '#fff';
  g.fillText(name, bx + bw / 2, by + bh / 2 + 2 * k);
  if (r() < 0.55) {
    ge.globalAlpha = 0.35; ge.fillStyle = col; ge.fillRect(bx, by, bw, bh); ge.globalAlpha = 1;
    ge.font = g.font; ge.textAlign = 'center'; ge.textBaseline = 'middle'; ge.fillStyle = '#fff4d0';
    ge.fillText(name, bx + bw / 2, by + bh / 2 + 2 * k);
  }
  marigoldArc(g, bx, bx + bw, by + bh + 5 * k, 6 * k, k, 3);
  const sx = x + 14 * k, sy = y + 84 * k, sw = C - 28 * k, sh = C - 84 * k;
  if (r() < 0.65) {
    const cool = r() < 0.5;
    g.fillStyle = cool ? '#eef4f8' : '#f7e3b6'; g.fillRect(sx, sy, sw, sh);
    ge.fillStyle = cool ? '#dbe9ff' : '#ffd890'; ge.fillRect(sx, sy, sw, sh);
    for (let row = 0; row < 4; row++) {
      const ry = sy + 18 * k + row * 34 * k;
      for (let px = sx + 6 * k; px < sx + sw - 10 * k; px += (8 + r() * 10) * k) {
        const ph = (10 + r() * 16) * k, pw = (6 + r() * 6) * k;
        g.fillStyle = BOARD[(r() * BOARD.length) | 0]; g.fillRect(px, ry - ph, pw, ph);
        ge.fillStyle = 'rgba(60,40,20,0.6)'; ge.fillRect(px, ry - ph, pw, ph);
      }
      g.fillStyle = '#6b5b4b'; g.fillRect(sx, ry, sw, 3 * k);
    }
    g.fillStyle = '#7d8187'; g.fillRect(sx, sy, sw, 12 * k);
    ge.fillStyle = '#000'; ge.fillRect(sx, sy, sw, 12 * k);
  } else {
    g.fillStyle = '#8b8f94'; g.fillRect(sx, sy, sw, sh);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let ly = sy; ly < sy + sh; ly += 6 * k) g.fillRect(sx, ly, sw, 2 * k);
    g.fillStyle = '#444'; g.fillRect(sx + sw / 2 - 6 * k, sy + sh - 16 * k, 12 * k, 8 * k);
  }
}

function homeGround(g, ge, x, y, C, r, i) {
  const k = C / 256;
  if (i % 2 === 0) {
    const dw = 78 * k, dh = 150 * k, dx = x + (C - dw) / 2, dy = y + C - dh - 12 * k;
    g.fillStyle = '#3b2a1e'; g.fillRect(dx - 8 * k, dy - 8 * k, dw + 16 * k, dh + 8 * k);
    g.fillStyle = ['#5b3a24', '#2e4a7a', '#6d2a2a', '#3d5a3d'][(r() * 4) | 0]; g.fillRect(dx, dy, dw, dh);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3 * k;
    g.strokeRect(dx + 8 * k, dy + 10 * k, dw / 2 - 12 * k, dh / 2 - 14 * k);
    g.strokeRect(dx + dw / 2 + 4 * k, dy + 10 * k, dw / 2 - 12 * k, dh / 2 - 14 * k);
    if (r() < 0.45) {
      ge.fillStyle = '#ff9c40'; ge.fillRect(dx + dw / 2 - 4 * k, dy, 8 * k, dh);
      g.fillStyle = '#ffcf80'; g.fillRect(dx + dw / 2 - 4 * k, dy, 8 * k, dh);
    }
    marigoldArc(g, dx - 6 * k, dx + dw + 6 * k, dy - 6 * k, 9 * k, k);
  } else windowBay(g, ge, x, y, C, r, false, true);
  g.fillStyle = 'rgba(80,70,60,0.55)'; g.fillRect(x, y + C - 22 * k, C, 22 * k);
}

/** 4 bays x 4 floors of facade, light plaster so per-building vertex colours "paint" it. */
export function facadeTextures(design, seed, S = 1024) {
  const C = S / 4, k = C / 256;
  const c = makeCanvas(S, S), g = c.getContext('2d');
  const e = makeCanvas(S, S), ge = e.getContext('2d');
  const r = mulberry32(seed);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  g.fillStyle = '#ece7dc'; g.fillRect(0, 0, S, S);
  blobs(g, S, S, 120, r, ['rgba(70,60,50,0.10)', 'rgba(255,255,255,0.10)'], C * 0.1, C * 0.5);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x = i * C, y = S - (j + 1) * C;
    if (j === 0) { if (design === 'shop') shopBay(g, ge, x, y, C, r); else homeGround(g, ge, x, y, C, r, i); }
    else windowBay(g, ge, x, y, C, r, design === 'home' && (i === 1 || i === 2) && r() < 0.6);
    g.fillStyle = 'rgba(40,35,30,0.35)'; g.fillRect(x, y, C, 8 * k);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x, y + 8 * k, C, 3 * k);
  }
  g.fillStyle = 'rgba(70,70,70,0.9)'; g.fillRect(S - 12 * k, 0, 7 * k, S);
  for (let s = 0; s < 70; s++) {
    const x = r() * S, y = r() * S, h = (30 + r() * 140) * k;
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(40,35,30,0.24)'); gr.addColorStop(1, 'rgba(40,35,30,0)');
    g.fillStyle = gr; g.fillRect(x, y, (2 + r() * 6) * k, h);
  }
  grain(g, S, S, (S * S) / 45, 0.12, r);
  return { map: toTexture(c, { repeat: [1, 1] }), emissive: toTexture(e, { repeat: [1, 1] }) };
}

export function concreteTexture(seed = 1, base = '#8a857d') {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  blobs(g, S, S, 90, r, ['rgba(30,25,20,0.16)', 'rgba(255,255,255,0.08)', 'rgba(60,70,40,0.1)'], 10, 90);
  for (let i = 0; i < 25; i++) {
    g.strokeStyle = `rgba(20,18,15,${0.2 + r() * 0.25})`; g.lineWidth = 0.8 + r();
    g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  grain(g, S, S, 16000, 0.2, r);
  return toTexture(c, { repeat: [1, 1] });
}

export function asphaltTexture() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(77);
  g.fillStyle = '#3a3836'; g.fillRect(0, 0, S, S);
  blobs(g, S, S, 70, r, ['rgba(0,0,0,0.25)', 'rgba(120,110,100,0.12)'], 10, 80);
  grain(g, S, S, 40000, 0.35, r);
  return toTexture(c, { repeat: [1, 1] });
}

export function dirtTexture() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = mulberry32(88);
  g.fillStyle = '#5e5247'; g.fillRect(0, 0, S, S);
  blobs(g, S, S, 120, r, ['rgba(30,20,10,0.2)', 'rgba(160,140,110,0.12)', 'rgba(60,70,40,0.12)'], 8, 70);
  grain(g, S, S, 40000, 0.3, r);
  return toTexture(c, { repeat: [1, 1] });
}

export function curbTexture() {
  const c = makeCanvas(128, 16), g = c.getContext('2d');
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#1a1a1a' : '#e0b800'; g.fillRect(i * 32, 0, 32, 16); }
  return toTexture(c, { repeat: [1, 1] });
}

export function glowTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return toTexture(c, { srgb: false });
}
