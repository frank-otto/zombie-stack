// Procedural canvas textures (no image files): stone, wood, grass, zombie skin, cloth, pumpkin, soft dots, smoke.
import * as THREE from 'three';
export const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; };
export const tex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } t.anisotropy = 8; return t; };
export function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function noise2(seed) { const r = rnd(seed), N = 64, v = new Float32Array(N * N); for (let i = 0; i < N * N; i++) v[i] = r();
  const f = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t * t * (3 - 2 * t); const a = v[((yi & 63) * N) + (xi & 63)], b = v[((yi & 63) * N) + ((xi + 1) & 63)], c = v[(((yi + 1) & 63) * N) + (xi & 63)], d = v[(((yi + 1) & 63) * N) + ((xi + 1) & 63)]; return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf); };
  return (x, y) => f(x, y) * .5 + f(x * 2.1, y * 2.1) * .3 + f(x * 4.3, y * 4.3) * .2; }
export function normalFrom(hc, strength = 2) { const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data; const [c, g] = cv(w, h); const im = g.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength; const l = Math.hypot(dx, dy, 1); const i = (y * w + x) * 4; im.data[i] = (-dx / l * .5 + .5) * 255; im.data[i + 1] = (dy / l * .5 + .5) * 255; im.data[i + 2] = (1 / l * .5 + .5) * 255; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c; }
export function softTexture() { const [c, g] = cv(128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
export function smokeTexture(seed = 5) { const [c, g] = cv(256, 256); const r = rnd(seed); for (let i = 0; i < 30; i++) { const x = 128 + (r() - .5) * 120, y = 128 + (r() - .5) * 120, s = 30 + r() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); } return new THREE.CanvasTexture(c); }
// rough castle masonry: courses of irregular blocks, dark mortar, soot towards the top
export function stoneTextures(seed, W = 1024, Hh = 512) {
  const [c, g] = cv(W, Hh), [hc, hg] = cv(W, Hh), r = rnd(seed), n = noise2(seed + 2);
  g.fillStyle = '#17141c'; g.fillRect(0, 0, W, Hh); hg.fillStyle = '#000'; hg.fillRect(0, 0, W, Hh);
  const rows = 9, rh = Hh / rows;
  for (let j = 0; j < rows; j++) { let x = -r() * 60; while (x < W) { const w = 70 + r() * 90, l = 22 + r() * 16, hue = 245 + r() * 35, sat = 6 + r() * 8;
      g.fillStyle = `hsl(${hue},${sat}%,${l}%)`; const y = j * rh; g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, rh - 6, 6); g.fill();
      hg.fillStyle = `rgb(${150 + r() * 80},${150},${150})`; hg.beginPath(); hg.roundRect(x + 3, y + 3, w - 6, rh - 6, 9); hg.fill();
      for (let k = 0; k < 14; k++) { const px = x + r() * w, py = y + r() * rh; g.fillStyle = `rgba(${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},${255},${.03 + r() * .04})`; g.fillRect(px, py, 2 + r() * 10, 1 + r() * 4); }
      x += w; } }
  const im = g.getImageData(0, 0, W, Hh), hm = hg.getImageData(0, 0, W, Hh);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = n(x / 40, y / 40), soot = Math.max(0, 1 - y / Hh * 1.4) * .0; const k = .75 + v * .5 - soot; im.data[i] *= k; im.data[i + 1] *= k; im.data[i + 2] *= k; hm.data[i] = hm.data[i] * (.7 + v * .3); }
  g.putImageData(im, 0, 0); hg.putImageData(hm, 0, 0);
  return { map: c, normal: normalFrom(hc, 4) };
}
export function flagTextures(seed) { // square worn flagstones, darker joints, a faint alchemical circle in the middle (separate decal)
  const S = 1024, [c, g] = cv(S, S), [hc, hg] = cv(S, S), r = rnd(seed), n = noise2(seed + 5);
  g.fillStyle = '#121016'; g.fillRect(0, 0, S, S); hg.fillStyle = '#000'; hg.fillRect(0, 0, S, S);
  const k = 6, s = S / k; for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) { const x = i * s, y = j * s, l = 17 + r() * 12;
    g.fillStyle = `hsl(${250 + r() * 30},${7 + r() * 6}%,${l}%)`; g.beginPath(); g.roundRect(x + 4, y + 4, s - 8, s - 8, 10); g.fill();
    hg.fillStyle = `rgb(${140 + r() * 90},0,0)`; hg.beginPath(); hg.roundRect(x + 5, y + 5, s - 10, s - 10, 14); hg.fill(); }
  const im = g.getImageData(0, 0, S, S), hm = hg.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, v = n(x / 36, y / 36); const kk = .7 + v * .6; im.data[i] *= kk; im.data[i + 1] *= kk; im.data[i + 2] *= kk; hm.data[i] = hm.data[i] * (.6 + v * .4); }
  g.putImageData(im, 0, 0); hg.putImageData(hm, 0, 0);
  return { map: c, normal: normalFrom(hc, 3) };
}
export function woodTexture(seed, base = [70, 44, 30]) { const [c, g] = cv(256, 512), r = rnd(seed), n = noise2(seed);
  const im = g.createImageData(256, 512); for (let y = 0; y < 512; y++) for (let x = 0; x < 256; x++) { const v = n(x / 6, y / 60) * .6 + Math.sin(x / 9 + n(x / 30, y / 30) * 6) * .2 + .4; const i = (y * 256 + x) * 4; im.data[i] = base[0] * v; im.data[i + 1] = base[1] * v; im.data[i + 2] = base[2] * v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, r() * 512, 256, 2); } return c; }
export function copperCoilTexture() { const [c, g] = cv(64, 512); for (let y = 0; y < 512; y += 4) { const l = 40 + (y % 8 ? 10 : 0); g.fillStyle = `hsl(24,62%,${l}%)`; g.fillRect(0, y, 64, 3); g.fillStyle = 'hsl(20,50%,16%)'; g.fillRect(0, y + 3, 64, 1); } return c; }
export function stormSkyCanvas(seed, w = 256, h = 512) { // night storm clouds seen through the gothic windows
  const [c, g] = cv(w, h), r = rnd(seed), n = noise2(seed);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b0d1f'); gr.addColorStop(.6, '#1a1c3a'); gr.addColorStop(1, '#2a2440'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const im = g.getImageData(0, 0, w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = n(x / 50 + 3, y / 34), i = (y * w + x) * 4, k = Math.max(0, v - .45) * 1.8; im.data[i] += 60 * k; im.data[i + 1] += 64 * k; im.data[i + 2] += 96 * k; }
  g.putImageData(im, 0, 0);
  g.fillStyle = '#05060c'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * .86 - Math.max(0, Math.sin(x / 23) * 30 + r() * 10) - (x > w * .55 && x < w * .7 ? 70 : 0)); g.lineTo(w, h); g.fill(); // hills + a distant village tower
  for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(255,200,110,.75)'; g.fillRect(20 + r() * (w - 40), h * .9 + r() * h * .06, 2, 3); }
  return c; }
export function rainCanvas(seed) { const [c, g] = cv(128, 256), r = rnd(seed); g.clearRect(0, 0, 128, 256); for (let i = 0; i < 90; i++) { const x = r() * 128, y = r() * 256, l = 10 + r() * 22; g.strokeStyle = `rgba(190,205,255,${.12 + r() * .25})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + l); g.stroke(); } return c; }

// rotten zombie skin: green-grey mottled base with bruises, stitches drawn on top by the caller
export function skinTexture(seed, hue = 95) { const W = 256, [c, g] = cv(W, W), r = rnd(seed), n = noise2(seed);
  const im = g.createImageData(W, W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = n(x / 22, y / 22), v2 = n(x / 6 + 9, y / 6); const i = (y * W + x) * 4;
    const l = .55 + v * .5 + v2 * .12; im.data[i] = (92 + (hue < 90 ? 20 : 0)) * l; im.data[i + 1] = 118 * l; im.data[i + 2] = 86 * l; if (v < .32) { im.data[i] *= .8; im.data[i + 1] *= .7; im.data[i + 2] *= 1.05; } im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(${60 + r() * 50},${20 + r() * 20},${40 + r() * 30},${.18 + r() * .2})`; g.beginPath(); g.ellipse(r() * W, r() * W, 6 + r() * 16, 4 + r() * 10, r() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(30,20,20,.7)'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { const x = r() * W, y = r() * W, l = 30 + r() * 40; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - .5) * 10); g.stroke(); for (let j = 0; j < l; j += 7) { g.beginPath(); g.moveTo(x + j, y - 4); g.lineTo(x + j + 2, y + 4); g.stroke(); } }
  return c; }
// torn cloth: base colour, weave noise, dirt and rips
export function clothTexture(seed, base) { const W = 128, [c, g] = cv(W, W), r = rnd(seed), n = noise2(seed + 3); const col = base.match(/\w\w/g).map(h => parseInt(h, 16));
  const im = g.createImageData(W, W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = n(x / 14, y / 14) * .6 + ((x + y) % 3 ? .9 : .78) * .4 + (y % 4 ? 0 : -.06); const i = (y * W + x) * 4; im.data[i] = col[0] * v; im.data[i + 1] = col[1] * v; im.data[i + 2] = col[2] * v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(40,30,20,${.2 + r() * .25})`; g.beginPath(); g.ellipse(r() * W, r() * W, 4 + r() * 14, 3 + r() * 8, r() * 3, 0, 7); g.fill(); }
  for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(12,10,8,.85)'; const x = r() * W, y = r() * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + r() * 8, y + 2); g.lineTo(x + 3, y + 10 + r() * 8); g.fill(); }
  return c; }
// pumpkin: orange with dark ribs (u wraps around)
export function pumpkinTexture(seed) { const W = 256, H = 128, [c, g] = cv(W, H), n = noise2(seed);
  const im = g.createImageData(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const rib = Math.pow(Math.abs(Math.sin(x / W * Math.PI * 10)), .35); const v = .62 + rib * .38 + (n(x / 10, y / 10) - .5) * .18; const i = (y * W + x) * 4; im.data[i] = 236 * v; im.data[i + 1] = 112 * v * (.85 + rib * .2); im.data[i + 2] = 22 * v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c; }
// grave grass + dirt, tileable
export function grassTexture(seed) { const W = 512, [c, g] = cv(W, W), r = rnd(seed), n = noise2(seed);
  const im = g.createImageData(W, W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = n(x / 30, y / 30), v2 = n(x / 4, y / 4); const i = (y * W + x) * 4; const dirt = v < .42 ? 1 : 0;
    const l = .6 + v2 * .5; if (dirt) { im.data[i] = 58 * l; im.data[i + 1] = 46 * l; im.data[i + 2] = 40 * l; } else { im.data[i] = 34 * l; im.data[i + 1] = 52 * l; im.data[i + 2] = 40 * l; } im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); for (let k = 0; k < 2600; k++) { const x = r() * W, y = r() * W; g.strokeStyle = `rgba(${50 + r() * 30},${80 + r() * 40},${55 + r() * 20},${.25 + r() * .3})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 3, y - 3 - r() * 5); g.stroke(); }
  return c; }
export function dirtTexture(seed) { const W = 256, [c, g] = cv(W, W), n = noise2(seed);
  const im = g.createImageData(W, W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = n(x / 12, y / 12) * .7 + n(x / 3, y / 3) * .3; const i = (y * W + x) * 4; const l = .45 + v * .7; im.data[i] = 70 * l; im.data[i + 1] = 52 * l; im.data[i + 2] = 40 * l; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c; }
