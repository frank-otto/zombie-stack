// The undead building blocks: four zombie types (Shambler, Brute, Crawler, Stander), a big zombie head, a coffin,
// a tombstone and a jack-o'-lantern. Each piece = a procedural Three.js model + a cannon-es collision shape.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { cv, tex, rnd, skinTexture, clothTexture, pumpkinTexture, woodTexture, stoneTextures } from './tex.js';
export const TYPES = {
  coffin: { size: [1.9, .42, .78], mass: 3, mat: 'wood', e: '⚰️' },
  shambler: { size: [1.75, .42, .56], mass: 2, mat: 'flesh', e: '🧟', zombie: true },
  brute: { size: [1.5, .66, .8], mass: 4, mat: 'flesh', e: '🧟‍♂️', zombie: true },
  crawler: { size: [1.95, .32, .44], mass: 1.3, mat: 'flesh', e: '🦴', zombie: true },
  stander: { size: [.62, 1.4, .46], mass: 2.2, mat: 'flesh', e: '🧍', zombie: true },
  head: { size: [.64, .6, .6], mass: 1.3, mat: 'flesh', e: '💀', zombie: true },
  tombstone: { size: [1.0, 1.0, .36], mass: 4.5, mat: 'stone', e: '🪦' },
  pumpkin: { size: [.94, .58, .94], mass: 1.4, mat: 'pumpkin', e: '🎃', cyl: true }
};
export const POTIONS = { glue: '#5dff8a', freeze: '#7fe4ff', slow: '#c08cff' };
// shared textures (built once)
let TX = null;
function textures() { if (TX) return TX; const st = stoneTextures(23, 256, 256);
  TX = { skin: [0, 1, 2].map(i => tex(skinTexture(40 + i, i === 2 ? 80 : 95))), cloth: ['#5a4a3a', '#3e4a5e', '#6a3030', '#4a5a3a', '#5a3a5a', '#2e2e34'].map((c, i) => tex(clothTexture(60 + i, c))),
    wood: tex(woodTexture(71, [74, 46, 30])), woodL: tex(woodTexture(72, [96, 62, 40])), stone: tex(st.map), stoneN: tex(st.normal, false), pump: tex(pumpkinTexture(81)), face: faceTex(), rip: ripTex() }; return TX; }
function faceTex() { const [c, g] = cv(256, 256); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ffb040';
  const tri = (x, y, s) => { g.beginPath(); g.moveTo(x - s, y + s * .7); g.lineTo(x + s, y + s * .7); g.lineTo(x, y - s * .8); g.fill(); }; tri(80, 100, 30); tri(176, 100, 30); tri(128, 140, 14);
  g.beginPath(); g.moveTo(50, 168); for (let i = 0; i <= 8; i++) g.lineTo(50 + i * 19.5, 168 + (i % 2 ? 26 : 8) + Math.sin(i / 8 * Math.PI) * 18); for (let i = 8; i >= 0; i--) g.lineTo(50 + i * 19.5, 190 + Math.sin(i / 8 * Math.PI) * 26); g.fill(); return tex(c); }
function ripTex() { const [c, g] = cv(256, 256); g.fillStyle = '#7a7888'; g.fillRect(0, 0, 256, 256); g.font = '700 64px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(25,22,34,.9)'; g.fillText('R.I.P.', 128, 110);
  g.strokeStyle = 'rgba(25,22,34,.8)'; g.lineWidth = 6; g.beginPath(); g.moveTo(128, 140); g.lineTo(128, 220); g.moveTo(98, 165); g.lineTo(158, 165); g.stroke(); return tex(c); }
const std = (o) => new THREE.MeshStandardMaterial({ roughness: .85, ...o });
// ---------- zombies ----------
function zombieHead(P, R, s, skinM, opt = {}) { const h = new THREE.Group();
  const sk = new THREE.Mesh(new THREE.SphereGeometry(R, 18, 14), skinM); sk.scale.set(1, 1.08, .95); h.add(sk);
  const eyeM = new THREE.MeshStandardMaterial({ color: '#fff7b0', emissive: opt.eye || '#d8ff40', emissiveIntensity: 1.2, roughness: .3 }); P.eyes.push(eyeM);
  for (const sx of [-1, 1]) { const so = new THREE.Mesh(new THREE.SphereGeometry(R * .26, 10, 8), std({ color: '#140c10', roughness: 1 })); so.position.set(sx * R * .36, R * .18, R * .78); so.scale.z = .5; h.add(so);
    const e = new THREE.Mesh(new THREE.SphereGeometry(R * (sx < 0 ? .15 : .12), 10, 8), eyeM); e.position.set(sx * R * .36, R * .18, R * .86); h.add(e); }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(R * .1, R * .22, 6), skinM); nose.position.set(0, -.02 * R, R * .98); nose.rotation.x = Math.PI / 2; h.add(nose);
  const jaw = new THREE.Group(); jaw.position.set(0, -R * .35, R * .25); const jm = new THREE.Mesh(new THREE.BoxGeometry(R * .9, R * .32, R * .9), skinM); jm.position.set(0, -R * .1, R * .2); jaw.add(jm);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(R * .7, R * .12, R * .3), std({ color: '#1a0608', roughness: 1 })); mouth.position.set(0, R * .07, R * .55); jaw.add(mouth);
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(R * .09, R * .11, R * .06), std({ color: '#d8cfa0', roughness: .6 })); t.position.set((i - 2) * R * .14, R * .14, R * .64); jaw.add(t); } h.add(jaw); P.jaws.push(jaw);
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(R * .2, 8, 6), skinM); ear.scale.set(.5, 1, .8); ear.position.set(sx * R * .98, 0, 0); h.add(ear); }
  const hairM = std({ color: '#1e1a16', roughness: 1 }); for (let i = 0; i < 7; i++) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(R * .12, R * .45, 5), hairM); const a = (i / 7 - .5) * 2.2; tuft.position.set(Math.sin(a) * R * .7, R * .85, Math.cos(a) * R * .2 - R * .2); tuft.rotation.set(-.4, 0, -a * .6); h.add(tuft); }
  if (opt.brain) { const b = new THREE.Mesh(new THREE.SphereGeometry(R * .42, 10, 8), std({ color: '#d87a8a', roughness: .5, emissive: '#3a0a10', emissiveIntensity: .3 })); b.position.set(R * .25, R * .78, -R * .1); b.scale.y = .6; h.add(b); }
  return h; }
function arm(P, len, rad, sleeveM, skinM, side) { const piv = new THREE.Group(); const up = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * .9, len * .55, 8), sleeveM); up.rotation.x = Math.PI / 2; up.position.z = len * .27; piv.add(up);
  const fo = new THREE.Mesh(new THREE.CylinderGeometry(rad * .8, rad * .7, len * .5, 8), skinM); fo.rotation.x = Math.PI / 2; fo.position.z = len * .75; piv.add(fo);
  const hand = new THREE.Group(); hand.position.z = len; const palm = new THREE.Mesh(new THREE.BoxGeometry(rad * 2.2, rad * .9, rad * 2), skinM); hand.add(palm);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(rad * .4, rad * .4, rad * 1.5), skinM); f.position.set((i - 1.5) * rad * .5, -rad * .1, rad * 1.5); f.rotation.x = .35; hand.add(f); } piv.add(hand); P.arms.push({ piv, side }); return piv; }
function lyingZombie(P, w, h, d, o) { const T = textures(); const skinM = std({ map: T.skin[o.skin], color: '#ffffff', roughness: .8 }), shirtM = std({ map: T.cloth[o.shirt] }), pantsM = std({ map: T.cloth[o.pants] }); P.mats.push(skinM, shirtM, pantsM);
  const g = P.g, hr = Math.min(h * .58, d * .48) * (o.headK || 1);
  const torsoL = w * .42, tx = w / 2 - hr * 2 - torsoL / 2 + .02; const torso = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(h, d) * .46 * (o.belly || 1), torsoL - Math.min(h, d) * .5, 4, 10), shirtM); torso.rotation.z = Math.PI / 2; torso.position.x = tx; torso.scale.set(h / Math.min(h, d), 1, d / Math.min(h, d)); g.add(torso);
  const legL = (tx - torsoL / 2) + w / 2; for (const sz of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(h * .2 * (o.legK || 1), h * .17 * (o.legK || 1), legL, 8), pantsM); leg.rotation.z = Math.PI / 2; leg.position.set(-w / 2 + legL / 2 + .02, -h * .12, sz * d * .22); g.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(.14, h * .42, h * .3), std({ color: '#1a1410' })); shoe.position.set(-w / 2 + .07, -h * .02, sz * d * .22); g.add(shoe); }
  const head = zombieHead(P, hr, 1, skinM, o); head.position.set(w / 2 - hr, h * .05, 0); head.rotation.y = .35; head.rotation.z = -.15; g.add(head); P.head = head;
  for (const sz of [-1, 1]) { const a = arm(P, Math.max(d * .9, .5) * (o.armK || 1), h * .13 * (o.legK || 1), shirtM, skinM, sz); a.position.set(tx + torsoL * .32, h * .12, sz * d * .3); a.rotation.y = sz * .12; g.add(a); }
  if (o.belly > 1.1) { const belt = new THREE.Mesh(new THREE.TorusGeometry(h * .45, .03, 6, 16), std({ color: '#2a1a10' })); belt.rotation.y = Math.PI / 2; belt.position.x = tx - torsoL * .4; belt.scale.set(d / h, 1, 1); g.add(belt); }
}
function standingZombie(P, w, h, d, o) { const T = textures(); const skinM = std({ map: T.skin[o.skin], roughness: .8 }), shirtM = std({ map: T.cloth[o.shirt] }), pantsM = std({ map: T.cloth[o.pants] }); P.mats.push(skinM, shirtM, pantsM);
  const g = P.g, hr = w * .3; const legH = h * .42; for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(w * .13, w * .11, legH, 8), pantsM); leg.position.set(sx * w * .2, -h / 2 + legH / 2 + .05, 0); g.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(w * .3, .1, d * .8), std({ color: '#1a1410' })); shoe.position.set(sx * w * .2, -h / 2 + .05, d * .05); g.add(shoe); }
  const torsoH = h - legH - hr * 2; const torso = new THREE.Mesh(new THREE.CapsuleGeometry(w * .36, torsoH * .6, 4, 10), shirtM); torso.scale.z = d / w * 1.1; torso.position.y = -h / 2 + legH + torsoH / 2; g.add(torso);
  const head = zombieHead(P, hr, 1, skinM, o); head.position.y = h / 2 - hr; head.rotation.x = .12; head.rotation.z = .1; g.add(head); P.head = head;
  for (const sx of [-1, 1]) { const a = arm(P, .62, w * .085, shirtM, skinM, sx); a.position.set(sx * w * .42, -h / 2 + legH + torsoH * .92, 0); a.rotation.y = sx * -.08; g.add(a); }
}
function bigHead(P, w, h, d, o) { const T = textures(); const skinM = std({ map: T.skin[o.skin], roughness: .8 }); P.mats.push(skinM); const head = zombieHead(P, h * .5, 1, skinM, { ...o, brain: true }); head.scale.set(w / h * 1.0, 1, d / h * 1.05); P.g.add(head); P.head = head;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(h * .2, h * .24, .1, 10), std({ color: '#5a1a1a', roughness: .6 })); neck.position.y = -h * .46; P.g.add(neck); }
// ---------- objects ----------
function coffin(P, w, h, d) { const T = textures(); const m = std({ map: T.wood, color: '#c8a888', roughness: .75 }), lidM = std({ map: T.woodL, color: '#c8a888', roughness: .7 }), brass = std({ color: '#b08a4a', metalness: .8, roughness: .35 }); P.mats.push(m, lidM);
  const sh = new THREE.Shape(); const pts = [[-w / 2, -d * .3], [w * .18, -d / 2], [w / 2, -d * .36], [w / 2, d * .36], [w * .18, d / 2], [-w / 2, d * .3]]; sh.moveTo(...pts[0]); pts.slice(1).forEach(p => sh.lineTo(...p)); sh.lineTo(...pts[0]);
  const body = new THREE.ExtrudeGeometry(sh, { depth: h * .78, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 1 }); body.rotateX(Math.PI / 2); body.translate(0, h * .39 - h * .1, 0);
  const b = new THREE.Mesh(body, m); g(P).add(b); const lidG = new THREE.ExtrudeGeometry(sh, { depth: h * .16, bevelEnabled: true, bevelSize: .03, bevelThickness: .02, bevelSegments: 1 }); lidG.rotateX(Math.PI / 2); lidG.translate(0, h / 2 - .02, 0); lidG.scale(1.03, 1, 1.05);
  const lid = new THREE.Mesh(lidG, lidM); g(P).add(lid);
  const cx = new THREE.Mesh(new THREE.BoxGeometry(.6, .035, .09), brass); cx.position.set(w * .12, h / 2 + .005, 0); g(P).add(cx); const cy = new THREE.Mesh(new THREE.BoxGeometry(.09, .035, .32), brass); cy.position.set(w * .2, h / 2 + .005, 0); g(P).add(cy);
  for (const x of [-.45, .15, .6]) for (const sz of [-1, 1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(.06, .015, 6, 10, Math.PI), brass); hd.position.set(x, 0, sz * (x > 0 ? d * .48 : d * .4)); hd.rotation.set(0, 0, Math.PI); g(P).add(hd); } }
function tombstone(P, w, h, d) { const T = textures(); const m = std({ map: T.stone, normalMap: T.stoneN, color: '#a4a2b2', roughness: .95 }), fm = std({ map: T.rip, normalMap: T.stoneN, color: '#b0aec0', roughness: .95 }); P.mats.push(m, fm);
  const sh = new THREE.Shape(); const r = .12; sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d - .04, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 1 }); geo.translate(0, 0, -(d - .04) / 2); const s = new THREE.Mesh(geo, m); g(P).add(s);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * .8, h * .8), fm); face.position.z = d / 2 + .003; g(P).add(face);
  const moss = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), std({ color: '#3a5a2a', roughness: 1 })); moss.scale.set(1.4, .4, .9); moss.position.set(-w * .3, h / 2 - .02, .05); g(P).add(moss); }
function pumpkin(P, w, h) { const T = textures(); const m = std({ map: T.pump, roughness: .6, color: '#ffffff' }); P.mats.push(m);
  const body = new THREE.Mesh(new THREE.SphereGeometry(.5, 28, 16), m); body.scale.set(w / 1, h / 1 * 1.05, w / 1); g(P).add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.04, .07, .16, 6), std({ color: '#4a3a1a' })); stem.position.y = h / 2 + .04; stem.rotation.z = .3; g(P).add(stem);
  const fm = new THREE.MeshStandardMaterial({ map: T.face, transparent: true, color: '#000', emissive: '#ffffff', emissiveMap: T.face, emissiveIntensity: 1.25, alphaMap: T.face, depthWrite: false }); P.eyes.push(fm);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.505, 24, 12, Math.PI * .25, Math.PI * .5, Math.PI * .22, Math.PI * .5), fm); face.scale.copy(body.scale); g(P).add(face); }
const g = P => P.g;
// potion bottle (power-up) tied to a piece
function potion(P, kind) { const c = POTIONS[kind]; const grp = new THREE.Group(); const glassM = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .9, transparent: true, opacity: .85, roughness: .15 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 10), glassM); grp.add(b); const n = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .12, 8), glassM); n.position.y = .14; grp.add(n);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(.045, .04, .05, 8), std({ color: '#8a6a40' })); cork.position.y = .22; grp.add(cork);
  const s = P.size; grp.position.set(s[0] * .15, s[1] / 2 + .15, s[2] / 2 - .05); P.g.add(grp); P.potion = { grp, kind, mat: glassM }; }
// ---------- factory ----------
export function makePiece(type, seed, potionKind) {
  const T = TYPES[type], r = rnd(seed); const P = { type, ...T, size: T.size.slice(), g: new THREE.Group(), mats: [], eyes: [], jaws: [], arms: [], head: null, seed, glow: 0, ice: 0 };
  const [w, h, d] = P.size; const o = { skin: Math.floor(r() * 3), shirt: Math.floor(r() * 6), pants: Math.floor(r() * 6), eye: ['#d8ff40', '#ff5040', '#80ffe0'][Math.floor(r() * 3)] };
  if (type === 'shambler') lyingZombie(P, w, h, d, o);
  else if (type === 'brute') lyingZombie(P, w, h, d, { ...o, belly: 1.25, headK: .85, legK: 1.5, armK: 1.1 });
  else if (type === 'crawler') lyingZombie(P, w, h, d, { ...o, legK: .8, armK: 1.35, headK: 1.1 });
  else if (type === 'stander') standingZombie(P, w, h, d, o);
  else if (type === 'head') bigHead(P, w, h, d, o);
  else if (type === 'coffin') coffin(P, w, h, d);
  else if (type === 'tombstone') tombstone(P, w, h, d);
  else pumpkin(P, w, h);
  if (potionKind) potion(P, potionKind);
  P.g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // physics
  const body = new CANNON.Body({ mass: T.mass, material: null, linearDamping: .05, angularDamping: .2, allowSleep: true, sleepSpeedLimit: .06, sleepTimeLimit: .6 });
  if (T.cyl) body.addShape(new CANNON.Cylinder(w / 2, w / 2, h, 14)); else body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
  P.body = body; P.anim = { reach: 0, grab: 0, jaw: 0, ph: r() * 6.28, flail: 1 }; return P;
}
export function disposePiece(P) { P.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } }); P.mats.concat(P.eyes).forEach(m => m.dispose()); if (P.potion) P.potion.mat.dispose(); }
// procedural life: jaw chatter, arms reaching / grabbing, dangling while carried, head turning
export function animatePiece(P, t, dt, mode) { const A = P.anim; if (!P.zombie) { if (P.potion) { P.potion.grp.rotation.y = t * 1.5; P.potion.mat.emissiveIntensity = .7 + Math.sin(t * 5) * .25; } return; }
  A.jaw = Math.max(0, A.jaw - dt * 1.4); const chew = Math.max(A.jaw, .12 + .1 * Math.sin(t * 1.7 + A.ph)) * (.5 + .5 * Math.abs(Math.sin(t * 9 + A.ph)));
  for (const j of P.jaws) j.rotation.x = Math.min(.6, chew * .7);
  A.grab = Math.max(0, A.grab - dt * .35);
  for (const a of P.arms) { let rx, ry;
    if (mode === 'hang') { rx = Math.sin(t * 3.1 + A.ph + a.side) * .5 + (P.type === 'stander' ? -.1 : .7); ry = Math.sin(t * 2.3 + a.side) * .3; }
    else if (mode === 'fall') { rx = -.6 + Math.sin(t * 14 + a.side) * .4; ry = a.side * .3; }
    else { const reach = -.15 + Math.sin(t * .9 + A.ph + a.side * 1.3) * .18; rx = THREE.MathUtils.lerp(reach, P.type === 'stander' ? .9 : 1.15, Math.min(1, A.grab)); ry = a.side * .1; }
    a.piv.rotation.x += (rx - a.piv.rotation.x) * (1 - Math.exp(-dt * 8)); a.piv.rotation.y = ry; }
  if (P.head && mode !== 'tower') P.head.rotation.y = .35 + Math.sin(t * 2 + A.ph) * .25;
  for (const e of P.eyes) e.emissiveIntensity = 1 + Math.sin(t * 3 + A.ph) * .2 + P.glow * 1.5; }
export function setGlow(P, k, col = '#4dff7a') { P.glow = k; for (const m of P.mats) { if (k > .01) { m.emissive.set(col); m.emissiveIntensity = k * .55; } else if (P.ice > .01) { m.emissive.set('#4aa8e8'); m.emissiveIntensity = P.ice * .2; } else { m.emissiveIntensity = 0; } } }
