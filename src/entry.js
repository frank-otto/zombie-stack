import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createWorld, updateWorld, poseCrane, strike, swarm, QUALITY, BASE_TOP, BASE_HW, BASE_HD, MAST } from './world.js';
import { TYPES, POTIONS, makePiece, disposePiece, animatePiece, setGlow } from './pieces.js';
import { createFX, sparks, puff, updateFX } from './fx.js';
import { Player } from './music.js';
import * as A from './audio.js';
import { T } from './i18n.js';

const URL_TXT = 'frank-otto.github.io/zombie-stack';
const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let seed = (window.__zsSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const V3 = p => new THREE.Vector3(p.x, p.y, p.z);
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), fin = v => Number.isFinite(v) ? v : 0;
const DIFF = {
  easy: { A0: .2, A1: .46, w0: 1.45, w1: 2.1, perf: .16, lives: 5, time: 120, wind: 0, potion: 6, mix: { coffin: 3, shambler: 3, brute: 3, crawler: 1, tombstone: 1, pumpkin: 1, head: .5, stander: .5 } },
  medium: { A0: .24, A1: .56, w0: 1.65, w1: 2.5, perf: .11, lives: 3, time: 90, wind: 0, potion: 8, mix: { coffin: 2, shambler: 3, brute: 2, crawler: 2, tombstone: 1.5, pumpkin: 1.5, head: 1, stander: 1.2 } },
  hard: { A0: .28, A1: .68, w0: 1.85, w1: 2.9, perf: .08, lives: 2, time: 75, wind: 1, potion: 9, mix: { coffin: 1.5, shambler: 2.5, brute: 1.5, crawler: 2, tombstone: 2, pumpkin: 2, head: 1.5, stander: 2 } },
  kids: { A0: .16, A1: .34, w0: 1.3, w1: 1.75, perf: .3, lives: 0, time: 90, wind: 0, potion: 4, mix: { coffin: 3, shambler: 3, brute: 3, pumpkin: 2, head: 1 } }
};
const MILESTONES = [3, 6, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100];
const KEEP = 7, ROPE = 2.1, CLAW = .36, HREF = 8, GRAV = 9.82;
const S = { state: 'menu', mode: 'classic', lang: ls.get('zs-lang', 'en'), diff: ls.get('zs-diff', 'medium'), kids: ls.get('zs-kids', '0') === '1', q: ls.get('zs-q', ''), qUser: !!ls.get('zs-q', ''),
  name: ls.get('zs-name', 'Player') || 'Player', gt: 0, pt: 0, ts: 1, score: 0, combo: 0, bestCombo: 0, perfects: 0, lives: 3, timeLeft: 0, H: 0, maxH: 0, topY: BASE_TOP, focus: 2.4, n: 0, ms: 0,
  glue: 0, slow: 0, freezeT: 0, wind: 0, gust: null, gustNext: 9, phi: 0, phiV: 0, vx: 0, vy: 0, az: .12, newBest: false, end: '', shake: 0 };
if (!DIFF[S.diff] || S.diff === 'kids') S.diff = 'medium';
if (!QUALITY[S.q]) { S.q = 'mid'; S.qUser = false; }
const dkey = () => S.kids ? 'kids' : S.diff, D = () => DIFF[dkey()], bestKey = (m = S.mode) => `zs-best-${m}-${dkey()}`;
A.setClock(() => S.gt);
const t = k => T[S.lang][k] ?? T.en[k] ?? k;

// ---------------- renderer / scene ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__zsPDB });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.14; renderer.shadowMap.type = THREE.PCFShadowMap;
const W = createWorld(renderer, QUALITY[S.q], 11); const scene = W.scene;
const camera = new THREE.PerspectiveCamera(45, 1, .1, 400);
const F = createFX(scene, W.soft, W.smokeTex);
let composer, bloom;
function buildComposer() { if (composer) composer.dispose(); composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .3, .45, .88); composer.addPass(bloom); composer.addPass(new OutputPass()); }
function applyQuality(qn, user) {
  S.q = qn; if (user) { S.qUser = true; ls.set('zs-q', qn); } const q = QUALITY[qn];
  renderer.shadowMap.enabled = q.shadows; W.key.castShadow = q.shadows; if (q.shadows) { W.key.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (W.key.shadow.map) { W.key.shadow.map.dispose(); W.key.shadow.map = null; } }
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  buildComposer(); resize(); $('btnQ').textContent = '⚙ ' + t('q_' + qn);
}
let VW = 1, VH = 1; const portrait = () => VW / VH < .85, wide = () => VW >= 820 && VW >= VH;
function resize() { VW = window.innerWidth; VH = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[S.q].dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(VW, VH); }
  camera.aspect = VW / VH; camera.updateProjectionMatrix(); W.setRes(VW * dpr, VH * dpr); }

// ---------------- physics ----------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAV, 0) }); world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = false; world.solver.iterations = 20; world.solver.tolerance = 1e-4;
world.defaultContactMaterial.friction = .75; world.defaultContactMaterial.restitution = .02; world.defaultContactMaterial.contactEquationStiffness = 2e7; world.defaultContactMaterial.contactEquationRelaxation = 4; world.defaultContactMaterial.frictionEquationStiffness = 2e7;
const groundB = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC }); groundB.addShape(new CANNON.Plane()); groundB.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(groundB);
const baseB = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC }); baseB.addShape(new CANNON.Box(new CANNON.Vec3(BASE_HW, BASE_TOP / 2, BASE_HD))); baseB.position.set(0, BASE_TOP / 2, 0); world.addBody(baseB);
const pieces = [], tower = []; let cur = null, queue = [], nextId = 1; const pend = []; const constraints = [];
const _q = new CANNON.Quaternion(), _v3 = new CANNON.Vec3();
// vertical half-extent of a (rotated) piece
function halfY(P) { const q = P.body.quaternion; const [w, h, d] = P.size; const x = q.x, y = q.y, z = q.z, ww = q.w;
  const r10 = 2 * (x * y + ww * z), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - ww * x); return Math.abs(r10) * w / 2 + Math.abs(r11) * h / 2 + Math.abs(r12) * d / 2; }
function topOf(P) { return P.body.position.y + halfY(P); }
function genType() { const n = S.n; if (n < 2) return 'coffin'; if (n === 2) return 'brute'; const mix = D().mix; let tot = 0; for (const k in mix) tot += mix[k]; let x = rng() * tot; for (const k in mix) { x -= mix[k]; if (x <= 0) return k; } return 'shambler'; }
function genNext() { const n = S.n + queue.length; const pe = D().potion; const pk = n >= 3 && n % pe === pe - 1 ? ['glue', 'slow', 'freeze'][Math.floor(n / pe) % 3] : null; queue.push({ type: (S.n = S.n + 0, genTypeAt(n)), potion: pk }); }
function genTypeAt(n) { const save = S.n; S.n = n; const ty = genType(); S.n = save; return ty; }
function spawn() { while (queue.length < 2) genNext(); const q = queue.shift(); S.n++; genNext(); const P = makePiece(q.type, 1000 + nextId * 7 + Math.floor(rng() * 999), q.potion); P.id = nextId++; P.state = 'hang'; P.spawnT = S.gt; P.lower = 0;
  scene.add(P.g); pieces.push(P); cur = P; S.phase = Math.PI / 2 * (rng() < .5 ? 1 : -1); A.sfx.lower(); if (P.zombie && rng() < .7) setTimer(.4, () => { if (P.state === 'hang') { A.sfx.groan(P.type, .32); P.anim.jaw = 1; } });
  P.body.addEventListener('collide', e => onCollide(P, e)); renderNext(); return P; }
function onCollide(P, e) { const o = e.body; if (o === groundB) { P.ground = true; return; }
  if (P.state !== 'fall' || P.touched) return; const other = o === baseB ? 'base' : pieces.find(x => x.body === o); if (!other || (other !== 'base' && other.state !== 'tower')) return;
  P.touched = true; let iv = 2; try { iv = Math.abs(e.contact.getImpactVelocityAlongNormal()); } catch (er) {} pend.push({ P, other, iv: fin(iv) }); }
function towerTop() { let best = null, y = BASE_TOP; for (const P of tower) { const ty = topOf(P); if (ty > y) { y = ty; best = P; } } return { P: best, y }; }

// ---------------- the swing + drop ----------------
let pivot = new THREE.Vector3(0, BASE_TOP + 6, 0), theta = 0, thetaV = 0, clawOpen = 0;
function swingParams() { const d = D(), k = clamp(tower.length / 24, 0, 1); let A0 = lerp(d.A0, d.A1, k), w = lerp(d.w0, d.w1, k); if (S.slow > 0) w *= .45; return { A: A0, w }; }
function hangPose(P) { const L = ROPE + CLAW + P.size[1] / 2; return { x: pivot.x + Math.sin(theta) * L, y: pivot.y - Math.cos(theta) * L, L }; }
function drop() { if (S.state !== 'play' || !cur || cur.state !== 'hang' || S.gt - cur.spawnT < .45) return false;
  const P = cur, hp = hangPose(P); const vx = hp.L * Math.cos(theta) * thetaV * .5, vy = hp.L * Math.sin(theta) * thetaV * .5;
  P.body.position.set(hp.x, hp.y, 0); P.body.quaternion.setFromEuler(0, 0, theta * .3); P.body.velocity.set(fin(vx), Math.min(0, fin(vy)), 0); P.body.angularVelocity.set(0, 0, 0);
  P.body.linearFactor.set(1, 1, 0); P.body.angularFactor.set(0, 0, 1); world.addBody(P.body); P.state = 'fall'; P.dropT = S.gt; P.touched = false; cur = null; clawOpen = 1;
  A.sfx.release(); if (P.zombie) setTimer(.08, () => { A.sfx.groan(P.type, .42, clamp(hp.x / 4, -.8, .8)); P.anim.jaw = 1; }); S.dropN = (S.dropN || 0) + 1; $('hint').classList.remove('show'); return true; }
function predictX(P) { const hp = hangPose(P); const vx = hp.L * Math.cos(theta) * thetaV * .5; const dy = Math.max(.1, hp.y - P.size[1] / 2 - S.topY); return hp.x + vx * Math.sqrt(2 * dy / GRAV); }

// ---------------- landing, perfect, grab, power-ups ----------------
function aboveTarget() { const tt = towerTop(); return tt.P ? tt.P : null; }
function handleLanding(L) { const P = L.P, other = L.other; if (P.state !== 'fall') return; const below = other === 'base' ? null : other; const bx = below ? below.body.position.x : 0;
  const dx = P.body.position.x - bx; const tol = D().perf * (below ? 1 : 1.6) + (S.kids ? .1 : 0); const onTop = below ? P.body.position.y > below.body.position.y + .05 : true;
  const tt = aboveTarget(); const isTopTarget = !below || below === tt || !tt;
  P.state = 'tower'; P.below = below; P.landT = S.gt; tower.push(P); S.score += 10;
  const k = clamp(L.iv / 5, .2, 1), pan = clamp(P.body.position.x / 4, -.8, .8); A.sfx.land(P.mat, k, P.type, pan); puff(F, new THREE.Vector3(P.body.position.x, P.body.position.y - P.size[1] / 2, .2), 3, '#6a6478', .6);
  const perfect = onTop && isTopTarget && Math.abs(dx) <= tol;
  if (perfect) { S.combo++; S.perfects++; S.bestCombo = Math.max(S.bestCombo, S.combo); P.body.position.x = bx; P.body.velocity.set(0, Math.min(0, P.body.velocity.y), 0); P.body.angularVelocity.set(0, 0, 0);
    if (below) P.body.quaternion.copy(below.body.quaternion); else P.body.quaternion.set(0, 0, 0, 1); P.body.position.y = (below ? topOf(below) : BASE_TOP) + halfY(P) + .001; P.body.position.z = 0; lockTo(P, below);
    const pts = 25 + 15 * (S.combo - 1); S.score += pts; P.glowT = 1.2; S.phiV *= .4; A.sfx.perfect(S.combo); ring(P); sparks(F, new THREE.Vector3(bx, P.body.position.y - P.size[1] / 2, 0), Math.round(70 * QUALITY[S.q].parts), { colors: ['#9dffb0', '#ffffff', '#d8ff70'], speed: 3.2, up: 1.6, life: .9, grav: 3, size: .08 });
    const lab = S.combo >= 8 ? t('horde') : S.combo >= 5 ? t('defied') : S.combo >= 3 ? `${t('streak')} ×${S.combo}` : S.combo === 2 ? `${t('perfect')} ×2` : t('perfect');
    popText(S.combo >= 3 ? `+${pts}` : `${lab}  +${pts}`, S.combo >= 3 ? '#d8ff70' : '#9dffb0', S.combo >= 3 ? 1.5 : 1.25); if (S.combo >= 3) banner(lab); if (S.combo === 5 || S.combo === 8 || (S.combo > 8 && S.combo % 4 === 0)) setTimer(.15, () => bolt(true));
    if (S.mode === 'timed' && S.combo >= 3 && S.bonusT < 20) { S.timeLeft += 2; S.bonusT += 2; popText('+2 s', '#ffe08a', 1); } if (S.kids && S.combo % 3 === 0) A.sfx.kids(); }
  else { S.combo = 0; S.phiV += clamp(dx, -1, 1) * P.mass * .012 / Math.max(1, Math.sqrt(S.H + 1)); popText(Math.abs(dx) < tol * 2.5 ? t('good') : t('ok'), '#cfd8ff', 1);
    if (S.kids && onTop && Math.abs(dx) < P.size[0] * .5 + .45) P.kidsFix = { from: P.body.position.x, t: 0 }; // kids: gently slide it back to the centre, then lock
    else if (S.glue > 0 && below) lockTo(P, below); }
  if (S.glue > 0) { S.glue--; if (!perfect && below) { P.glueT = 1; } sparks(F, V3(P.body.position), 20, { colors: [POTIONS.glue], speed: 1.5, up: .5, life: .8, grav: 4, size: .06 }); }
  if (S.slow > 0) S.slow--;
  if (P.zombie && below && below.zombie) grab(P, below);
  else if (P.zombie && below && rng() < .4) { P.anim.grab = 1; }
  if (P.potion) collectPotion(P);
  if (S.freezeT > 0) freezePiece(P);
  S.nextAt = S.gt + .55; setUI(); }
function lockTo(P, below) { const b = below ? below.body : baseB; const c = new CANNON.LockConstraint(P.body, b, { maxForce: 1e6 }); world.addConstraint(c); constraints.push({ c, a: P, b: below }); P.locked = true; }
function grab(P, below) { const c = new CANNON.PointToPointConstraint(P.body, new CANNON.Vec3(0, -P.size[1] / 2, 0), below.body, below.body.pointToLocalFrame(new CANNON.Vec3(P.body.position.x, P.body.position.y - P.size[1] / 2, 0)), 40 * P.mass);
  world.addConstraint(c); constraints.push({ c, a: P, b: below }); P.anim.grab = 1.6; below.anim.grab = 1.2; A.sfx.grab(clamp(P.body.position.x / 4, -.8, .8)); P.anim.jaw = 1; below.anim.jaw = 1; setTimer(.3, () => popText(t('grab'), '#b8ff9a', .9)); }
function collectPotion(P) { const k = P.potion.kind; P.g.remove(P.potion.grp); P.potion.mat.dispose(); P.potion = null; const at = V3(P.body.position); sparks(F, at, Math.round(90 * QUALITY[S.q].parts), { colors: [POTIONS[k], '#ffffff'], speed: 3, up: 2, life: 1, grav: 2, size: .09 }); A.sfx.powerup();
  if (k === 'glue') { S.glue = 3; A.sfx.glue(); } else if (k === 'slow') { S.slow = 3; A.sfx.slow(); } else { S.freezeT = 12; A.sfx.freeze(); tower.forEach(freezePiece); S.phi *= .2; S.phiV = 0; } banner(t(k)); renderPowers(); }
function freezePiece(P) { if (P.frozen) return; P.frozen = true; P.body.type = CANNON.Body.KINEMATIC; P.body.velocity.set(0, 0, 0); P.body.angularVelocity.set(0, 0, 0); P.body.updateMassProperties();
  const h = P.body.position.y - BASE_TOP, off = S.phi * h * h / (2 * HREF), ang = S.phi * h / HREF; P.rest = { p: V3(P.body.position), q: P.body.quaternion.clone() }; P.rest.p.x -= off; _q.setFromEuler(0, 0, ang); P.rest.q = _q.mult(P.rest.q); }
function unfreezeAll() { for (const P of pieces) if (P.frozen && P.body.world) { P.frozen = false; P.body.type = CANNON.Body.DYNAMIC; P.body.mass = TYPES[P.type].mass; P.body.updateMassProperties(); P.body.linearFactor.set(1, 1, 1); P.body.angularFactor.set(1, 1, 1); P.body.wakeUp(); } }
const rings = []; function ring(P) { const m = new THREE.Mesh(new THREE.RingGeometry(.5, .62, 48), new THREE.MeshBasicMaterial({ color: '#7dff9a', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(P.body.position.x, P.body.position.y - P.size[1] / 2 + .02, 0); scene.add(m); rings.push({ m, t: 0 }); }
function bolt(top = true) { const tt = towerTop(); const at = tt.P ? V3(tt.P.body.position) : new THREE.Vector3(0, BASE_TOP, 0); at.y = tt.y; strike(W, at, false); A.sfx.lightning(true); flashScreen(.22); S.shake = Math.max(S.shake, 1);
  if (tt.P) { tt.P.glowT = 1.4; tt.P.glowCol = '#9fc0ff'; } sparks(F, at, Math.round(120 * QUALITY[S.q].parts), { colors: ['#ffffff', '#bcd2ff', '#7aa0ff'], speed: 4.5, up: 1.5, life: 1, grav: 4, size: .09 }); }

// ---------------- milestones ----------------
function checkMilestones() { while (S.ms < MILESTONES.length && S.H >= MILESTONES[S.ms]) { const m = MILESTONES[S.ms++]; S.score += 100; A.sfx.milestone();
    if (m === 3) { banner(`${m} m · ${t('m3')}`); setTimer(.2, () => bolt()); }
    else if (m === 6) { banner(`${m} m · ${t('m6')}`); swarm(W, S.topY); A.sfx.bats(); }
    else if (m === 10) { banner(`${m} m · ${t('m10')}`); S.moonT = S.gt; A.sfx.moon(); }
    else if (m === 15) { banner(`${m} m · ${t('m15')}`); S.starT = S.gt; for (let i = 0; i < 3; i++) setTimer(.2 + i * .35, () => i === 1 ? bolt() : strike(W, null, true)); }
    else { banner(`${m} m · ${t('mN')}`); setTimer(.2, () => bolt()); if (m % 10 === 0) { swarm(W, S.topY); A.sfx.bats(); } }
    if (S.kids) A.sfx.kids(); } }

// ---------------- lost pieces, collapse, end ----------------
const lostAt = [];
function loseCheck() { for (const P of pieces) { if (!(P.state === 'tower' || P.state === 'fall')) continue; const p = P.body.position; const out = P.ground || p.y < BASE_TOP - .45 || Math.abs(p.x) > 6 || !Number.isFinite(p.x + p.y + p.z); if (!out) continue;
    const wasTower = P.state === 'tower'; P.state = 'lost'; P.lostT = S.gt; const i = tower.indexOf(P); if (i >= 0) tower.splice(i, 1); dropConstraints(P); if (!Number.isFinite(p.x + p.y + p.z)) { p.set(0, -5, 0); P.body.velocity.set(0, 0, 0); }
    if (!wasTower) S.nextAt = S.gt + .8; S.combo = 0;
    if (S.state !== 'play') continue;
    if (S.kids) { A.sfx.poof(); popText(t('poof'), '#ffc8f0', 1.1); puff(F, V3(P.body.position), 6, '#d0a8ff', 1); sparks(F, V3(P.body.position), 40, { colors: ['#ffc8f0', '#c8a8ff', '#ffffff'], speed: 2.5, up: 2, life: .9, grav: 2, size: .08 }); P.poof = true; continue; }
    const fresh = !lostAt.some(t0 => S.gt - t0 < 1.5); puff(F, new THREE.Vector3(p.x, .3, p.z), 5, '#5a5048', 1); lostAt.push(S.gt); if (!fresh) { A.sfx.land('flesh', .5, P.type, clamp(p.x / 4, -.8, .8)); continue; } // one tumble = one penalty
    A.sfx.miss(clamp(p.x / 4, -.8, .8));
    if (S.mode === 'classic') { S.lives--; popText(`${t('miss')} ${t('lifeLost')}`, '#ff9a8a', 1.3); } else { S.timeLeft = Math.max(0, S.timeLeft - 5); popText(`${t('miss')} ${t('timeLost')}`, '#ff9a8a', 1.3); } setUI(); }
  for (let i = lostAt.length - 1; i >= 0; i--) if (S.gt - lostAt[i] > 2.2) lostAt.splice(i, 1);
  if (S.state === 'play' && !S.kids && S.mode === 'classic' && S.lives <= 0) collapse(); }
function dropConstraints(P) { for (let i = constraints.length - 1; i >= 0; i--) { const c = constraints[i]; if (c.a === P || c.b === P) { world.removeConstraint(c.c); constraints.splice(i, 1); } } }
function collapse() { if (S.state !== 'play') return; S.state = 'collapse'; S.cT = S.gt; S.ts = .26; setUI(); hideHUDBits(); banner(t('collapse')); A.sfx.collapse(); music.stop(); flashScreen(.18);
  if (cur && cur.state === 'hang') { scene.remove(cur.g); disposePiece(cur); pieces.splice(pieces.indexOf(cur), 1); cur = null; }
  for (const c of constraints) world.removeConstraint(c.c); constraints.length = 0; unfreezeAll(); const dir = S.phi >= 0 ? 1 : -1;
  for (const P of tower) { const h = Math.max(0, P.body.position.y - BASE_TOP); P.body.applyImpulse(new CANNON.Vec3(dir * (1.6 + h * .5) * P.body.mass * (.6 + rng() * .5), rng() * .8 * P.body.mass, (rng() - .5) * 1.4 * P.body.mass), new CANNON.Vec3(0, P.size[1] * .3, 0)); P.anim.jaw = 1; }
  setTimer(.4, () => strike(W, null, true)); setTimer(.9, () => bolt()); setTimer(4.4, () => endRun()); }
function finishTimed() { if (S.state !== 'play') return; S.state = 'collapse'; S.cT = S.gt; S.ts = 1; banner(t('timeUp')); A.sfx.win(); A.sfx.milestone(); if (cur && cur.state === 'hang') { scene.remove(cur.g); disposePiece(cur); pieces.splice(pieces.indexOf(cur), 1); cur = null; } tower.forEach(freezePiece); setTimer(.3, () => bolt()); setTimer(3.2, () => endRun()); setUI(); }
function endRun() {
  if (S.state === 'end' || S.state === 'menu') return; S.state = 'end'; S.ts = 1; clearTimers(); hideHUDBits(); if (cur && cur.state === 'hang') { scene.remove(cur.g); disposePiece(cur); pieces.splice(pieces.indexOf(cur), 1); cur = null; }
  S.maxH = Math.max(S.maxH, S.H); const hcm = Math.round(S.maxH * 100); const best = +ls.get(bestKey(), 0); S.newBest = hcm > best && hcm > 0; if (S.newBest) ls.set(bestKey(), hcm); S.best = Math.max(best, hcm);
  const bs = +ls.get(bestKey() + '-s', 0); if (S.score > bs) ls.set(bestKey() + '-s', S.score);
  music.start('menu', S.gt + .8); music.vol = .7; if (!S.end) S.end = 'done'; S.rank = rankOf(S.maxH);
  $('eTitle').textContent = S.end === 'collapse' ? t('collapse') : S.mode === 'timed' ? t('timeUp') : t('finished'); $('eRank').textContent = t('r' + S.rank);
  $('eH').textContent = fmtH(S.maxH); $('eScore').textContent = `${t('scoreL')} ${S.score}`; $('eBest').textContent = S.newBest ? t('newBest') : `${t('best')}: ${fmtH(S.best / 100)}`;
  $('eStats').innerHTML = `<span>${t('pieces')}: <b>${tower.length + pieces.filter(p => p.state === 'lost' && !p.poof).length}</b></span><span>${t('perfects')}: <b>${S.perfects}</b></span><span>${t('comboL')}: <b>×${S.bestCombo}</b></span>`;
  $('eName').value = S.name; $('end').classList.add('show'); setUI(); if (!S.newBest && S.end === 'collapse') {} else A.sfx.win(); }
const rankOf = h => h < 3 ? 0 : h < 6 ? 1 : h < 10 ? 2 : h < 15 ? 3 : h < 20 ? 4 : 5;
const fmtH = h => `${(Math.max(0, h)).toFixed(1)} m`;

// ---------------- timers / audio beds ----------------
const timers = []; function setTimer(d, f) { timers.push({ t: S.gt + d, f }); } function clearTimers() { timers.length = 0; }
const music = new Player();
function beds() { A.loop('rain', .3 + (S.state === 'menu' ? 0 : .05), 1); A.loop('wind', .14 + Math.abs(S.wind) * .5 + clamp(S.H / 40, 0, .2), 1 + Math.abs(S.wind) * .2, 1.2); A.loop('breath_loop', S.state === 'play' ? .1 : .05, 1, 1); }
let thunderT = 5, crowT = 14; function ambient(dt) { thunderT -= dt; if (thunderT <= 0) { thunderT = 10 + rng() * 12; strike(W, null, true); setTimer(.3 + rng() * 1.2, () => A.sfx.thunder(true)); }
  crowT -= dt; if (crowT <= 0) { crowT = 16 + rng() * 18; if (rng() < .5) A.sfx.crow(); else A.sfx.owl(); }
  if (S.state === 'play' && tower.length && rng() < dt * .22) { const zs = tower.filter(p => p.zombie).slice(-6); if (zs.length) { const z = zs[Math.floor(rng() * zs.length)]; A.sfx.groan(z.type, .22, clamp(z.body.position.x / 4, -.8, .8)); z.anim.jaw = 1; } } }

// ---------------- flow ----------------
function clearPieces() { for (const c of constraints) world.removeConstraint(c.c); constraints.length = 0; for (const P of pieces) { if (P.body.world) world.removeBody(P.body); scene.remove(P.g); disposePiece(P); } pieces.length = 0; tower.length = 0; cur = null; queue = []; for (const r of rings) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); } rings.length = 0; }
function resetRun() { clearTimers(); clearPieces(); S.score = 0; S.combo = 0; S.bestCombo = 0; S.perfects = 0; S.H = 0; S.maxH = 0; S.topY = BASE_TOP; S.n = 0; S.ms = 0; S.glue = 0; S.slow = 0; S.freezeT = 0; S.wind = 0; S.gust = null; S.gustNext = 10; S.phi = 0; S.phiV = 0; S.ts = 1; S.end = ''; S.newBest = false; S.dropN = 0; S.bonusT = 0; lostAt.length = 0;
  W.moon = 0; W.stars = 0; S.moonT = null; S.starT = null; nextId = 1; }
function start(mode) { A.unlock(); resetRun(); S.mode = mode; S.state = 'play'; S.lives = S.kids ? 0 : D().lives; S.timeLeft = D().time; window.__banners = [];
  $('end').classList.remove('show'); $('menu').classList.remove('show'); music.start('game', S.gt + .3); music.vol = .9; music.I = 0; A.sfx.ui(); A.sfx.stinger();
  pivot.set(0, BASE_TOP + 1.3 + ROPE + CLAW + 1.0, 0); S.nextAt = S.gt + .5; S.focus = BASE_TOP + 1.6;
  $('hint').textContent = t(isTouch ? 'hintT' : 'hint'); setTimer(.8, () => $('hint').classList.add('show')); setTimer(9, () => $('hint').classList.remove('show')); setUI(); renderPowers(); }
function toMenu() { resetRun(); S.state = 'menu'; $('menu').classList.add('show'); $('end').classList.remove('show'); music.start('menu', S.gt + .4); music.vol = .8; demoTower(); applyLang(); setUI(); }
function demoTower() { cheatStack(4, true); S.nextAt = S.gt + .2; }
// instant perfect stack (menu decoration, tests, video)
function cheatStack(n, demo) { for (let i = 0; i < n; i++) { while (queue.length < 2) genNext(); const q = queue.shift(); genNext(); const P = makePiece(i < 2 && demo ? 'coffin' : q.type, 500 + nextId * 13, null); P.id = nextId++; scene.add(P.g); pieces.push(P); P.body.addEventListener('collide', e => onCollide(P, e));
    const tt = towerTop(); const below = tt.P; P.body.position.set(below ? below.body.position.x : 0, tt.y + P.size[1] / 2 + .002, 0); P.body.quaternion.set(0, 0, 0, 1); P.body.linearFactor.set(1, 1, 0); P.body.angularFactor.set(0, 0, 1); world.addBody(P.body);
    P.state = 'tower'; P.below = below; tower.push(P); lockTo(P, below); S.n++; } tower.forEach(P => { if (tower.indexOf(P) < tower.length - KEEP) freezePiece(P); }); const tt = towerTop(); S.topY = tt.y; S.H = tt.y - BASE_TOP; S.maxH = Math.max(S.maxH, S.H);
  if (!demo) { while (S.ms < MILESTONES.length && S.H >= MILESTONES[S.ms]) S.ms++; if (S.H >= 10) W.moon = 1; if (S.H >= 15) W.stars = 1; } S.focus = S.topY + 1.2; pivot.y = S.topY + 1.3 + ROPE + CLAW + 1.0; }

// ---------------- UI ----------------
function setUI() { const st = S.state; document.body.dataset.state = st; document.body.dataset.mode = S.mode; document.body.dataset.kids = S.kids ? '1' : '0';
  $('hH').textContent = fmtH(S.H); $('hScore').textContent = S.score; $('hCombo').textContent = S.combo >= 2 ? `🔥 ×${S.combo}` : ''; $('hComboBox').style.display = S.combo >= 2 ? '' : 'none';
  $('hLivesBox').style.display = S.mode === 'classic' && !S.kids && st !== 'menu' ? '' : 'none'; $('hLives').textContent = '🧠'.repeat(Math.max(0, S.lives)) + '💀'.repeat(Math.max(0, D().lives - S.lives));
  $('hTimeBox').style.display = S.mode === 'timed' && st !== 'menu' ? '' : 'none'; $('hTime').textContent = `${Math.ceil(Math.max(0, S.timeLeft))} s`; $('hTimeBox').classList.toggle('low', S.timeLeft < 10);
  $('btnQuit').textContent = S.kids && st === 'play' ? '✓ ' + t('finish') : '✕'; }
function renderNext() { const q = queue[0]; $('nextBox').innerHTML = q ? `<small>${t('next')}</small><span>${TYPES[q.type].e}</span><b>${t('t_' + q.type)}</b>${q.potion ? `<i style="background:${POTIONS[q.potion]}"></i>` : ''}` : ''; }
function renderPowers() { const el = $('powers'); el.innerHTML = ''; const add = (c, txt) => { const s = document.createElement('span'); s.style.borderColor = c; s.textContent = txt; el.appendChild(s); };
  if (S.glue > 0) add(POTIONS.glue, `🧪 ${t('glueC')} ×${S.glue}`); if (S.slow > 0) add(POTIONS.slow, `⏳ ${t('slowC')} ×${S.slow}`); if (S.freezeT > 0) add(POTIONS.freeze, `🧊 ${t('freezeC')} ${Math.ceil(S.freezeT)} s`); }
function hideHUDBits() { $('hint').classList.remove('show'); $('marker').style.display = 'none'; }
function applyLang() { document.documentElement.lang = S.lang; document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t)); $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN';
  $('keysTip').textContent = t(isTouch ? 'keysHintT' : 'keysHint');
  $('btnKids').classList.toggle('on', S.kids); $('btnKids').setAttribute('aria-pressed', S.kids); document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', b.dataset.d === S.diff)); $('diff').style.display = S.kids ? 'none' : '';
  const bC = +ls.get(bestKey('classic'), 0), bT = +ls.get(bestKey('timed'), 0); $('bestClassic').textContent = bC ? `🏆 ${fmtH(bC / 100)}` : ''; $('bestTimed').textContent = bT ? `🏆 ${fmtH(bT / 100)}` : '';
  $('btnSound').classList.toggle('on', !A.isMuted()); $('btnSound').textContent = A.isMuted() ? '🔇' : '🔊'; $('btnQ').textContent = '⚙ ' + t('q_' + S.q); renderNext(); renderPowers(); setUI(); }
let popAt = 0;
function popText(txt, col, big = 1) { (window.__pops = window.__pops || []).push(txt); const now = performance.now(), delay = Math.max(0, popAt - now); popAt = Math.max(now, popAt) + 420;
  setTimeout(() => { const el = document.createElement('div'); el.className = 'pop'; el.textContent = txt; el.style.color = col; el.style.fontSize = (30 * big * (VW < 600 ? .78 : 1)) + 'px'; $('pops').appendChild(el); setTimeout(() => el.remove(), 1400); }, delay); }
function banner(s) { (window.__banners = window.__banners || []).push(s); const el = $('banner'); el.textContent = s; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function toast(s) { const el = $('toast'); el.textContent = s; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
function flashScreen(k) { const el = $('flash'); el.style.transition = 'none'; el.style.opacity = Math.min(.28, k); void el.offsetWidth; el.style.transition = 'opacity .6s ease-out'; el.style.opacity = 0; }

// ---------------- input ----------------
let isTouch = false;
canvas.addEventListener('pointerdown', e => { A.unlock(); if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } e.preventDefault(); if (S.state === 'play') drop(); });
window.addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; A.unlock(); const k = e.code; if (e.repeat) return;
  if (S.state === 'play' && (k === 'Space' || k === 'Enter' || k === 'ArrowDown' || k === 'KeyS')) { e.preventDefault(); drop(); return; }
  if (k === 'Escape') { if (S.state === 'play') { S.end = 'quit'; endRun(); } else if (S.state === 'end') toMenu(); return; }
  if (S.state === 'menu' && k === 'Enter') { start('classic'); return; } if (S.state === 'menu' && k === 'KeyT') { start('timed'); return; } });
$('btnClassic').onclick = () => start('classic'); $('btnTimed').onclick = () => start('timed');
$('btnAgain').onclick = () => start(S.mode); $('btnMenu').onclick = () => { A.sfx.ui(); toMenu(); };
$('btnQuit').onclick = () => { if (S.state === 'play') { S.end = 'quit'; endRun(); } else if (S.state === 'end') toMenu(); };
$('btnCard').onclick = () => saveCard(false); $('btnShare').onclick = () => saveCard(true);
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('zs-lang', S.lang); applyLang(); A.sfx.ui(); };
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { S.diff = b.dataset.d; ls.set('zs-diff', S.diff); applyLang(); A.unlock(); A.sfx.ui(); });
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('zs-kids', S.kids ? '1' : '0'); applyLang(); A.unlock(); A.sfx.ui(); };
$('btnSound').onclick = () => { A.unlock(); A.setMuted(!A.isMuted()); applyLang(); };
$('btnQ').onclick = () => { const o = ['low', 'mid', 'high', 'ultra']; applyQuality(o[(o.indexOf(S.q) + 1) % 4], true); };
$('eName').addEventListener('keydown', e => e.stopPropagation());
window.addEventListener('resize', resize); document.addEventListener('pointerdown', () => A.unlock(), { once: true });

// ---------------- share card ----------------
async function makeCard() {
  S.name = ($('eName').value || '').trim() || 'Player'; ls.set('zs-name', S.name); try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const CW = 1080, CH = 1350; renderer.setPixelRatio(1); renderer.setSize(CW, CH, false); composer.setPixelRatio(1); composer.setSize(CW, CH); bloom.strength = .22;
  const old = { a: camera.aspect, f: camera.fov, p: camera.position.clone(), q: camera.quaternion.clone() }; const top = Math.max(BASE_TOP + 2, S.topY + .6);
  camera.clearViewOffset(); camera.aspect = CW / CH; camera.fov = 40; camera.updateProjectionMatrix(); const cy = top * .5 + .9, dist = Math.max(8, (top * .5 + 2.6) / Math.tan(THREE.MathUtils.degToRad(20)) * .95);
  camera.position.set(dist * .14, cy + 1.2, dist); camera.lookAt(0, cy - .4, 0); camera.updateMatrixWorld(); W.sky.position.copy(camera.position); composer.render();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d'); k.drawImage(renderer.domElement, 0, 0, CW, CH);
  camera.aspect = old.a; camera.fov = old.f; camera.position.copy(old.p); camera.quaternion.copy(old.q); resize();
  const gr = k.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(6,8,16,.92)'); gr.addColorStop(.26, 'rgba(6,8,16,.05)'); gr.addColorStop(.68, 'rgba(6,8,16,.08)'); gr.addColorStop(1, 'rgba(6,8,16,.95)'); k.fillStyle = gr; k.fillRect(0, 0, CW, CH);
  const Fo = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`; k.textAlign = 'center'; k.lineJoin = 'round';
  const txt = (s, x, y, fill, stroke = 'rgba(8,10,20,.88)', lw = 8) => { k.strokeStyle = stroke; k.lineWidth = lw; k.strokeText(s, x, y); k.fillStyle = fill; k.fillText(s, x, y); };
  k.font = Fo(700, 84); txt('🧟 Zombie Stack', CW / 2, 108, '#d8ffc8', 'rgba(14,30,16,.92)', 10);
  k.font = Fo(700, 150); txt(fmtH(S.maxH || S.H), CW / 2, 268, '#fff0c0', 'rgba(30,16,4,.9)', 14); k.font = Fo(600, 48); txt(t('r' + rankOf(S.maxH || S.H)), CW / 2, 336, '#b8ff9a');
  k.font = Fo(500, 38); txt(`${t('by')} ${S.name.slice(0, 18)}`, CW / 2, 392, '#ffffff');
  k.font = Fo(600, 40); txt(`${t(S.mode === 'timed' ? 'timedT' : 'classicT')} · ${S.kids ? t('kidsT') : t(S.diff)} · ${t('scoreL')} ${S.score} · ${t('perfects')} ${S.perfects}`, CW / 2, 1150, '#ffe08a');
  k.font = Fo(600, 44); txt(t('cardTag'), CW / 2, 1236, '#9dffb8'); k.font = Fo(400, 32); txt(URL_TXT, CW / 2, 1292, 'rgba(255,255,255,.92)');
  window.__zsCard = { w: c.width, h: c.height }; return c;
}
async function saveCard(share) {
  const c = await makeCard(); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'my-zombie-tower.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Zombie Stack — ${fmtH(S.maxH)}! ${t('cardTag')} https://${URL_TXT}/` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-zombie-tower.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast(t('saved'));
}

// ---------------- simulation ----------------
const fillL = new THREE.PointLight('#c9d4ff', 22, 18, 1.1); scene.add(fillL);
const camPos = new THREE.Vector3(1, 3.4, 10), look = new THREE.Vector3(0, 2.4, 0), _v = new THREE.Vector3(), _l = new THREE.Vector3(), _s = new THREE.Vector3();
function colliders() { const out = []; for (const c of W.colliders) { if (c.mast) { out.push({ p: new THREE.Vector3(MAST.x + .25, camPos.y, MAST.z - .2), r: c.r + .3 }); } else out.push(c); } for (const P of pieces) if (P.body.world || P.state === 'hang') out.push({ p: P.g.position, r: Math.max(...P.size) * .55 }); return out; }
function keepClear(p) { for (const c of colliders()) { _v.subVectors(p, c.p); const dd = _v.length(), m = c.r + .7; if (dd < m && dd > 1e-4) p.addScaledVector(_v.normalize(), m - dd); } p.y = Math.max(p.y, 1.2); return p; }
function camTarget(dt) { const st = S.state, pt = portrait(); let R, az = S.az, fy, ly; camera.fov = lerp(camera.fov, pt ? 62 : 45, 1 - Math.exp(-dt * 2));
  if (st === 'menu') { az = .2 + Math.sin(S.gt * .07) * .35; R = pt ? 15 : 11.5; fy = 3.6; ly = 3.0; }
  else if (st === 'collapse' && S.end !== 'timed') { const e = S.gt - S.cT; const k = smooth(e / 2.2); R = lerp(pt ? 12.5 : 9.5, pt ? 19 : 15, k) + S.H * .25 * k; az = .12 + k * .35; fy = lerp(S.focus, Math.max(2.6, S.collY || S.focus * .6), k); ly = fy - .5; }
  else if (st === 'collapse' || st === 'end') { const top = Math.max(BASE_TOP + 2, S.topY); R = (pt ? 13 : 9) + top * (pt ? .9 : .65); az = .15 + Math.sin(S.gt * .1) * .2; fy = top * .55 + .6; ly = top * .5 + .4; }
  else { R = ((pt ? 13 : 9.8) + Math.min(2.5, S.H * .06)) * (window.__zsZoom || 1); az = .1 + Math.sin(S.gt * .06) * .08; fy = S.focus + .9; ly = S.focus + .15; }
  _v.set(Math.sin(az) * R, fy, Math.cos(az) * R); _l.set(0, ly, 0);
  const W2 = wide(); const vx = st === 'menu' ? (W2 ? -.16 : 0) : st === 'end' ? (W2 ? -.18 : 0) : 0, vy = !W2 ? (st === 'menu' ? .2 : st === 'end' ? .22 : 0) : 0; const kv = 1 - Math.exp(-dt * 2.5); S.vx = lerp(S.vx, vx, kv); S.vy = lerp(S.vy, vy, kv);
  camera.setViewOffset(VW, VH, S.vx * VW, S.vy * VH, VW, VH); camera.fov = fin(camera.fov) || 45; camera.updateProjectionMatrix(); }
function physicsStep(h) { // sway the frozen lower tower (kinematic) on a damped oscillator; wind + kids helpers on the live top pieces
  const kids = S.kids, k = kids ? 9 : 3.6, c = kids ? 6 : .55 + (S.freezeT > 0 ? 4 : 0); const drive = S.wind * .045 * (1 + S.H / 12); S.phiV += (-k * S.phi - c * S.phiV + drive) * h; S.phi = clamp(S.phi + S.phiV * h, -.07, .07); if (!Number.isFinite(S.phi + S.phiV)) { S.phi = 0; S.phiV = 0; }
  for (const P of tower) { const B = P.body; if (P.frozen && P.rest) { const hh = P.rest.p.y - BASE_TOP, off = S.phi * hh * hh / (2 * HREF), ang = -S.phi * hh / HREF;
      const tx = P.rest.p.x + off, ty = P.rest.p.y, tz = P.rest.p.z; B.velocity.set((tx - B.position.x) / h, (ty - B.position.y) / h, (tz - B.position.z) / h);
      _q.setFromEuler(0, 0, ang); const tq = _q.mult(P.rest.q); const qd = tq.mult(B.quaternion.conjugate()); const sgn = qd.w < 0 ? -1 : 1; B.angularVelocity.set(2 * qd.x * sgn / h, 2 * qd.y * sgn / h, 2 * qd.z * sgn / h); continue; }
    if (S.state !== 'play') continue;
    if (S.wind) B.applyForce(new CANNON.Vec3(S.wind * .7 * B.mass * clamp((B.position.y - BASE_TOP) / 6, .3, 1.4), 0, 0));
    if (kids && P.kidsFix) { const f = P.kidsFix; f.t += h; const k = Math.min(1, f.t / .7), to = P.below ? P.below.body.position.x : 0, tx = f.from + (to - f.from) * smooth(k);
      B.velocity.x = (tx - B.position.x) / h; B.angularVelocity.z *= .7; if (k >= 1) { P.kidsFix = null; B.velocity.x = 0; lockTo(P, P.below); } continue; }
    if (kids) { const bx = P.below ? P.below.body.position.x * .3 : 0; B.applyForce(new CANNON.Vec3(-(B.position.x - bx) * B.mass * 14 - B.velocity.x * B.mass * 4, 0, 0));
      _v3.set(0, 1, 0); const up = B.quaternion.vmult(_v3); B.applyTorque(new CANNON.Vec3(-up.z * 0 - B.angularVelocity.x * 2, 0, up.x * 30 * B.mass - B.angularVelocity.z * 4 * B.mass)); } }
  world.step(h); }
function step(dt) {
  dt = Math.max(0, Math.min(dt || 0, 1 / 20)); S.gt += dt; // rAF stamps can precede performance.now(): never step backwards
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].t <= S.gt) { const f = timers[i].f; timers.splice(i, 1); f(); }
  for (const k of ['flash', 'strike', 'moon', 'stars', 'wind']) if (!Number.isFinite(W[k])) W[k] = 0; // NaN guard for effect values
  for (const k of ['ts', 'phi', 'phiV', 'focus', 'topY', 'shake', 'wind']) if (!Number.isFinite(S[k])) S[k] = k === 'ts' ? 1 : k === 'focus' ? 2.4 : k === 'topY' ? BASE_TOP : 0;
  music.I = clamp(S.H / 18, 0, 1); music.step(S.gt); ambient(dt); beds();
  const st = S.state;
  if (st === 'collapse') { const e = S.gt - S.cT; S.ts = S.end === 'timed' ? 1 : e < 1.5 ? .3 : Math.min(1, .3 + (e - 1.5) * .8); if (!S.end) S.end = 'collapse'; } else S.ts = 1;
  // swing
  if (st === 'play' || st === 'menu') { const sp = swingParams(); S.phase = fin(S.phase) + sp.w * dt; const th = sp.A * Math.sin(S.phase) + S.wind * .16; thetaV = (th - theta) / Math.max(dt, 1e-4); theta = th; if (!Number.isFinite(theta)) { theta = 0; thetaV = 0; }
    if (Math.abs(Math.cos(S.phase)) < .05 && S.gt - (S.lastCreak || 0) > .4) { S.lastCreak = S.gt; if (st === 'play' && cur) A.sfx.creak(.12 + sp.A * .3, Math.sign(theta) * .4); } }
  if (st === 'play' && !cur && S.gt >= (S.nextAt || 0) && !pieces.some(p => p.state === 'fall')) { spawn(); clawOpen = 0; }
  if (st === 'menu' && !cur && S.gt >= (S.nextAt || 0)) { spawn(); }
  clawOpen = Math.max(0, clawOpen - dt * 1.2);
  // physics (time-scaled for slow motion)
  const ph = 1 / 60; S.acc = (S.acc || 0) + dt * S.ts; let ns = 0; while (S.acc >= ph && ns < 5) { physicsStep(ph); S.acc -= ph; S.pt += ph; ns++; while (pend.length) handleLanding(pend.shift()); } if (ns >= 5) S.acc = 0;
  // stuck fall (never touched anything for 5 s): treat as lost
  for (const P of pieces) if (P.state === 'fall' && S.gt - P.dropT > 5) P.ground = true;
  if (st === 'play' || st === 'collapse') loseCheck();
  // freeze old pieces (they keep swaying on the oscillator); slowly settle the live ones
  if (st === 'play') { for (let i = 0; i < tower.length - KEEP; i++) { const P = tower[i]; if (!P.frozen && P.body.velocity.length() < .25) freezePiece(P); } }
  // tower height
  const tt = towerTop(); S.topY = lerp(S.topY, tt.y, 1 - Math.exp(-dt * 6)); if (st === 'play') { S.H = Math.max(0, tt.y - BASE_TOP); S.maxH = Math.max(S.maxH, S.H); checkMilestones(); }
  if (st === 'collapse') { let sy = 0, n = 0; for (const P of tower) { sy += P.body.position.y; n++; } S.collY = n ? sy / n : 2; }
  // timers: timed mode, power-ups, wind gusts
  if (st === 'play') { if (S.mode === 'timed') { const before = Math.ceil(S.timeLeft); S.timeLeft -= dt; if (Math.ceil(S.timeLeft) !== before && S.timeLeft < 10 && S.timeLeft > 0) A.sfx.tick(); if (S.timeLeft <= 0) { S.end = 'timed'; finishTimed(); } }
    if (S.freezeT > 0) { S.freezeT -= dt; if (S.freezeT <= 0) S.freezeT = 0; }
    if (D().wind && S.H > 1.5) { S.gustNext -= dt; if (!S.gust && S.gustNext <= 0) { S.gust = { t0: S.gt, dur: 3.2, dir: rng() < .5 ? -1 : 1, k: .55 + rng() * .45 }; banner(`${t('gust')} ${S.gust.dir > 0 ? '→' : '←'}`); A.sfx.gust(S.gust.k); }
      if (S.gust) { const e = (S.gt - S.gust.t0) / S.gust.dur; S.wind = S.gust.dir * S.gust.k * Math.sin(Math.PI * clamp(e, 0, 1)); if (e >= 1) { S.gust = null; S.wind = 0; S.gustNext = 8 + rng() * 7; } } } else S.wind = 0;
    if (Math.floor(S.gt * 4) !== S._pw) { S._pw = Math.floor(S.gt * 4); renderPowers(); setUI(); } }
  else S.wind = lerp(S.wind, 0, 1 - Math.exp(-dt * 2));
  W.wind = S.wind; $('windBox').style.display = Math.abs(S.wind) > .08 ? '' : 'none'; $('windBox').textContent = S.wind > 0 ? '💨 →' : '💨 ←';
  // crane follows the tower
  const tgtPivot = Math.max(S.topY, BASE_TOP) + 1.3 + ROPE + CLAW + (cur ? cur.size[1] : 1.0); pivot.y = lerp(pivot.y, tgtPivot, 1 - Math.exp(-dt * 2.2)); pivot.x = 0;
  const cp = poseCrane(W, pivot, theta, ROPE, clawOpen, cur ? cur.size[0] * .32 : .25, S.gt);
  // sync meshes, animate pieces
  for (const P of pieces) { const B = P.body;
    if (P.state === 'hang') { const hp = hangPose(P); P.g.position.set(cp.x, cp.y - CLAW - P.size[1] / 2 + .04, 0); P.g.rotation.set(0, 0, theta * .3); animatePiece(P, S.gt, dt, 'hang'); }
    else { P.g.position.set(B.position.x, B.position.y, B.position.z); P.g.quaternion.set(B.quaternion.x, B.quaternion.y, B.quaternion.z, B.quaternion.w); animatePiece(P, S.gt, dt * S.ts, P.state === 'fall' ? 'fall' : 'tower'); }
    if (P.glowT > 0) { P.glowT -= dt; setGlow(P, Math.max(0, P.glowT) / 1.2, P.glowCol || '#4dff7a'); if (P.glowT <= 0) { P.glowCol = null; setGlow(P, 0); } }
    const ice = P.frozen && S.freezeT > 0 ? Math.min(1, S.freezeT / 2) : 0; if (Math.abs(ice - P.ice) > .02) { P.ice = ice; if (!(P.glowT > 0)) setGlow(P, 0); }
    if (P.state === 'lost' && (P.poof ? S.gt - P.lostT > .1 : S.gt - P.lostT > 3)) { P.state = 'gone'; if (B.world) world.removeBody(B); scene.remove(P.g); } }
  for (let i = pieces.length - 1; i >= 0; i--) if (pieces[i].state === 'gone') { disposePiece(pieces[i]); pieces.splice(i, 1); }
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const k = r.t / .9; r.m.scale.setScalar(1 + k * 3.2); r.m.material.opacity = .55 * (1 - k); if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); } }
  // landing marker: predicted footprint on the tower top (green = PERFECT zone)
  const mk = $('marker'); if (st === 'play' && cur && cur.state === 'hang' && S.gt - cur.spawnT > .3) { const px = predictX(cur); const tp = towerTop(); const bx = tp.P ? tp.P.body.position.x : 0; const ok = Math.abs(px - bx) <= D().perf * (tp.P ? 1 : 1.6) + (S.kids ? .1 : 0);
    marker.visible = true; marker.position.set(px, tp.y + .03, 0); marker.scale.set(cur.size[0], 1, Math.max(.4, cur.size[2])); marker.material.color.set(ok ? '#5dff8a' : '#ffd2a0'); marker.material.opacity = ok ? .5 : .22; target.visible = true; target.position.set(bx, tp.y + .025, 0); S.onTarget = ok; mk.style.display = 'none'; }
  else { marker.visible = false; target.visible = false; S.onTarget = false; }
  // world fx
  if (S.moonT != null) W.moon = smooth((S.gt - S.moonT) / 3.5); if (S.starT != null) W.stars = smooth((S.gt - S.starT) / 3);
  if (st === 'play') S.focus = lerp(S.focus, Math.max(BASE_TOP + 1.5, S.topY + 1.1), 1 - Math.exp(-dt * 1.8));
  camTarget(dt);
  const kc = 1 - Math.exp(-dt * (st === 'collapse' ? 1.6 : 2.2)); camPos.lerp(_v, kc); look.lerp(_l, kc); if (!Number.isFinite(camPos.x + camPos.y + camPos.z)) camPos.set(1, 3.4, 10); keepClear(camPos); camera.position.copy(camPos); fillL.position.set(camPos.x * .45, look.y + 1.2, camPos.z * .45);
  if (window.__zsCam) { const o = window.__zsCam; camPos.set(...o.p); look.set(...o.l); camera.position.copy(camPos); if (o.fov) { camera.fov = o.fov; camera.updateProjectionMatrix(); } } // scripted camera (video opening only)
  if (S.shake > .01) camera.position.lerp(look, Math.min(.08, S.shake * .045)); S.shake *= Math.exp(-dt * 5); // impact = smooth scale punch toward the tower, never a jittery screen shake
  camera.lookAt(look); camera.updateMatrixWorld();
  updateWorld(W, S.gt, dt, { focus: st === 'end' || st === 'collapse' ? Math.max(2, S.topY * .6) : S.focus, top: S.topY, camX: camera.position.x, camY: camera.position.y, camZ: camera.position.z, rainN: QUALITY[S.q].rain, fogN: QUALITY[S.q].fog });
  bloom.strength = (st === 'menu' || st === 'end' ? .22 : .3) * QUALITY[S.q].bloom;
  updateFX(F, dt, VH * renderer.getPixelRatio() * .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
// marker meshes
const marker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#5dff8a', transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 6, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.75, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; marker.renderOrder = 5; scene.add(marker);
const target = new THREE.Mesh(new THREE.PlaneGeometry(.05, .5), new THREE.MeshBasicMaterial({ color: '#d8ff9a', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); target.rotation.x = -Math.PI / 2; target.visible = false; scene.add(target);
function render() { composer.render(); }
const fps = { n: 0, acc: 0, frames: 0, bad: 0, since: 0 };
function fpsTick(dt) { if (document.hidden) return; fps.since += dt; if (fps.since < 6 || dt > .25) return; fps.acc += dt; fps.frames++;
  if (fps.acc >= 1) { const f = fps.frames / fps.acc; fps.acc = 0; fps.frames = 0; fps.n++; fps.bad = f < 32 ? fps.bad + 1 : 0; fps.last = f;
    if (!S.qUser && !window.__zsNoAutoQ && fps.bad >= 4 && S.q !== 'low') { const o = ['low', 'mid', 'high', 'ultra']; const nq = o[o.indexOf(S.q) - 1]; applyQuality(nq); toast(`${t('autoQ')} ${t('q_' + nq)} (${Math.round(f)} fps)`); fps.bad = 0; fps.since = 0; } } }

applyQuality(S.q); applyLang(); toMenu();
try { renderer.compile(scene, camera); } catch (e) {}
for (let i = 0; i < 45; i++) step(1 / 30);
let last = performance.now();
function advance(now) { const dt = Math.max(0, (now - last) / 1000) || 0; last = Math.max(last, now || 0); if (!window.__zsManual) { step(dt); fpsTick(dt); } return dt; } // rAF stamps can be earlier than the last one: never run the clock backwards
function frameLoop(now) { advance(now); render(); requestAnimationFrame(frameLoop); }
requestAnimationFrame(frameLoop);
window.__zs = { S, W, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); }, stepq: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); }, log: A.log, quality: q => q ? applyQuality(q, true) : S.q, renderer, start, end: endRun, toMenu, drop, collapse, cheat: n => cheatStack(n),
  cur: () => cur && { type: cur.type, state: cur.state, potion: cur.potion && cur.potion.kind, size: cur.size, x: cur.g.position.x, y: cur.g.position.y, age: S.gt - cur.spawnT }, predict: () => cur ? predictX(cur) : null, onTarget: () => !!S.onTarget, theta: () => theta,
  tower: () => tower.map(p => ({ type: p.type, x: p.body.position.x, y: p.body.position.y, frozen: !!p.frozen, locked: !!p.locked, top: topOf(p), q: [p.body.quaternion.x, p.body.quaternion.y, p.body.quaternion.z, p.body.quaternion.w] })), pieces: () => pieces.map(p => ({ type: p.type, state: p.state, y: p.body.position.y })),
  respawn: (type, potion = null) => { if (cur && cur.state === 'hang') { scene.remove(cur.g); disposePiece(cur); pieces.splice(pieces.indexOf(cur), 1); cur = null; } while (queue.length < 2) genNext(); queue[0] = { type, potion }; spawn(); },
  setNext: (type, potion = null) => { while (queue.length < 2) genNext(); queue[0] = { type, potion }; renderNext(); }, top: () => towerTop().y, queue: () => queue.map(q => ({ ...q })), constraints: () => constraints.length, diff: () => S.diff,
  // play helper: wait (simulate) until the hanging piece is over the target, then drop (bot + tests + video)
  aimDrop: (maxF = 400, tol = 0, off = 0) => { for (let i = 0; i < maxF; i++) { if (S.state !== 'play') return -1; if (cur && cur.state === 'hang' && S.gt - cur.spawnT > .5) { const tp = towerTop(); const bx = tp.P ? tp.P.body.position.x : 0; if (Math.abs(predictX(cur) - bx - off) <= (tol || D().perf * .45)) { drop(); return i; } } step(1 / 30); } return -2; },
  cam: () => ({ p: camera.position.toArray(), fov: camera.fov }), camClear: () => Math.min(...colliders().filter(c => !pieces.some(P => P.g.position === c.p && P.state === 'hang')).map(c => camera.position.distanceTo(c.p) - c.r)),
  screen: v => { _s.set(...v).project(camera); return { x: (_s.x * .5 + .5) * VW, y: (-_s.y * .5 + .5) * VH, z: _s.z }; }, fps, card: saveCard, cardURL: async () => (await makeCard()).toDataURL('image/jpeg', .92),
  sparks: () => { let n = 0; for (let i = 0; i < F.n; i++) if (F.life[i] > 0) n++; return n; }, advance, last: () => last, bolt, swarm: () => { swarm(W, S.topY); A.sfx.bats(); }, play: A.play, sfx: A.sfx, pivot: () => pivot.toArray(), world, _dbg: { scene, camera, composer, bloom, F, THREE, pieces, tower } };
document.body.classList.add('ready');
