// The graveyard at midnight: a stormy sky dome with drifting clouds, a hidden full moon and far lightning; wet grass,
// an open grave with dirt mounds and a stone crypt as the tower's foundation; tombstones, crosses, dead trees, an iron
// fence, a chapel and a mausoleum in the fog; lanterns and candles; rain; a rickety wooden crane with a creaking rope
// and an iron claw; lightning bolts (Line2) and a bat swarm.
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { cv, tex, rnd, softTexture, smokeTexture, stoneTextures, woodTexture, grassTexture, dirtTexture } from './tex.js';

export const QUALITY = {
  low: { dpr: 1, shadows: false, bloom: .7, parts: .45, rain: 500, fog: 6 },
  mid: { dpr: 1.25, shadows: true, shadowSize: 1024, bloom: 1, parts: .75, rain: 1100, fog: 12 },
  high: { dpr: 1.6, shadows: true, shadowSize: 2048, bloom: 1, parts: 1, rain: 1600, fog: 16 },
  ultra: { dpr: 2, shadows: true, shadowSize: 2048, bloom: 1, parts: 1.3, rain: 2200, fog: 20 }
};
export const BASE_TOP = 1.0, BASE_HW = 1.5, BASE_HD = 1.0, MAST = new THREE.Vector3(-3.9, 0, -1.9);
const fin = v => Number.isFinite(v) ? v : 0;

function skyMaterial() {
  return new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, flash: { value: 0 }, moon: { value: 0 }, stars: { value: 0 }, moonDir: { value: new THREE.Vector3(-.36, .3, -1).normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vDir; uniform float time, flash, moon, stars; uniform vec3 moonDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(vec3(.075, .08, .15), vec3(.012, .016, .045), smoothstep(-.05, .55, h));
        float st = step(.9965, hash(floor(d.xy * 420. + d.z * 37.))) * smoothstep(.05, .4, h); col += st * vec3(.7, .75, .95) * (.25 + .75 * stars);
        float md = max(dot(d, moonDir), 0.); float disc = smoothstep(.99725, .9976, md);
        vec2 mp = (d.xy - moonDir.xy) * 60.; float crater = .82 + .18 * noise(mp * 1.3) - .12 * smoothstep(.55, .75, noise(mp * .6 + 3.));
        float halo = pow(md, 900.) * .55 + pow(md, 60.) * .16 + pow(md, 8.) * .05;
        vec2 uv = d.xz / (h + .22) * 1.15 + vec2(time * .018, time * .007);
        float c = fbm(uv * 1.35 + fbm(uv * .6 + time * .01) * .6);
        float cov = mix(.36, .66, moon) - pow(md, 30.) * .25 * moon;
        float cl = smoothstep(cov, cov + .28, c) * smoothstep(-.12, .12, h);
        vec3 ccol = mix(vec3(.06, .065, .11), vec3(.2, .21, .3), c) + (flash * .45 + halo * moon * 1.4) * vec3(.55, .6, .78) * c;
        col += moon * (disc * crater * vec3(1., .95, .82) * .95 + halo * vec3(.5, .56, .78));
        col = mix(col, ccol, cl * (1. - .55 * moon * disc));
        col += flash * .1 * vec3(.6, .66, 1.) * (1. - cl * .3);
        gl_FragColor = vec4(col, 1.); }` });
}
function archShape(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0); return s; }

export function createWorld(renderer, q, seed = 11) {
  const S = new THREE.Scene(); const r = rnd(seed);
  const W = { scene: S, soft: softTexture(), smokeTex: smokeTexture(), colliders: [], arcs: [], bats: [], fogs: [], lanterns: [], candles: [], t: 0, flash: 0, strike: 0, moon: 0, stars: 0, wind: 0, rainK: 1, swarm: 0 };
  S.fog = new THREE.FogExp2('#0d1020', .028); S.background = new THREE.Color('#05060c');
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), skyMaterial()); W.sky.frustumCulled = false; W.sky.renderOrder = -10; S.add(W.sky);
  // ---- lights ----
  W.hemi = new THREE.HemisphereLight('#7383c0', '#2a251c', 1.05); S.add(W.hemi);
  W.key = new THREE.DirectionalLight('#b4c2ff', 2.3); W.key.position.set(-6, 14, 9); S.add(W.key); S.add(W.key.target);
  W.key.shadow.camera.left = -6; W.key.shadow.camera.right = 6; W.key.shadow.camera.top = 7; W.key.shadow.camera.bottom = -7; W.key.shadow.camera.near = 1; W.key.shadow.camera.far = 40; W.key.shadow.bias = -.0006; W.key.shadow.normalBias = .03;
  W.rim = new THREE.DirectionalLight('#6f8cff', 1.1); W.rim.position.set(5, 8, -10); S.add(W.rim); S.add(W.rim.target);
  W.flashLight = new THREE.DirectionalLight('#dfe6ff', 0); W.flashLight.position.set(2, 20, 6); S.add(W.flashLight);
  W.boltLight = new THREE.PointLight('#bcd0ff', 0, 14, 1.6); S.add(W.boltLight);
  // ---- ground, grave, crypt ----
  const gt = tex(grassTexture(seed), true, [36, 36]); const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, color: '#9aa0a0' }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
  const dt = tex(dirtTexture(seed + 1), true, [2, 2]); const dirtM = new THREE.MeshStandardMaterial({ map: dt, roughness: 1 });
  const pit = new THREE.Mesh(new THREE.CircleGeometry(3.1, 40), dirtM); pit.rotation.x = -Math.PI / 2; pit.position.y = .006; pit.scale.set(1.15, .8, 1); pit.receiveShadow = true; S.add(pit);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), new THREE.MeshBasicMaterial({ color: '#030304' })); hole.rotation.x = -Math.PI / 2; hole.position.y = .012; S.add(hole);
  for (const [x, z, s] of [[-2.7, -1.0, 1.0], [2.6, -1.2, .9], [-2.3, 1.2, .6], [2.4, 1.1, .7], [0, -2.1, .8]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), dirtM); m.scale.set(1.1 * s, .42 * s, .8 * s); m.position.set(x, 0, z); m.castShadow = m.receiveShadow = true; S.add(m); }
  { const sh = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.1, 8), new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: .8 })); h.position.y = .55; sh.add(h);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(.24, .3, .02), new THREE.MeshStandardMaterial({ color: '#555b60', metalness: .7, roughness: .45 })); bl.position.y = -.05; sh.add(bl); sh.position.set(2.85, .15, -1.0); sh.rotation.set(.1, -.4, -.35); sh.traverse(o => o.castShadow = true); S.add(sh); }
  const ST = stoneTextures(seed + 4, 512, 256); const stoneMap = tex(ST.map, true); const stoneN = tex(ST.normal, false);
  const cryptM = new THREE.MeshStandardMaterial({ map: stoneMap, normalMap: stoneN, normalScale: new THREE.Vector2(.8, .8), roughness: .92, color: '#a8a4b4' });
  W.crypt = new THREE.Group(); { const body = new THREE.Mesh(new THREE.BoxGeometry(BASE_HW * 2 - .1, BASE_TOP - .12, BASE_HD * 2 - .1), cryptM); body.position.y = (BASE_TOP - .12) / 2; W.crypt.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(BASE_HW * 2, .14, BASE_HD * 2), cryptM); lid.position.y = BASE_TOP - .07; W.crypt.add(lid);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(BASE_HW * 2 + .3, .16, BASE_HD * 2 + .3), cryptM); plinth.position.y = .08; W.crypt.add(plinth);
    const [c, g] = cv(512, 128); g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 512, 128); g.font = '700 74px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(20,18,26,.85)'; g.fillText('R . I . P .', 256, 68); g.fillStyle = 'rgba(190,190,210,.25)'; g.fillText('R . I . P .', 256, 64);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .4), new THREE.MeshStandardMaterial({ map: tex(c), transparent: true, roughness: 1 })); plate.position.set(0, .52, BASE_HD - .045); W.crypt.add(plate);
    for (const sx of [-1, 1]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(.11, .13, BASE_TOP - .2, 10), cryptM); col.position.set(sx * (BASE_HW - .2), (BASE_TOP - .2) / 2 + .1, BASE_HD - .02); W.crypt.add(col); }
    W.crypt.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); S.add(W.crypt); }
  // candles on the crypt corners (outside the tower footprint, flame sprites)
  const flameC = (() => { const [c, g] = cv(64, 128); const gr = g.createRadialGradient(32, 84, 2, 32, 74, 50); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(.25, 'rgba(255,170,60,.9)'); gr.addColorStop(.6, 'rgba(220,70,20,.35)'); gr.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(32, 74, 24, 54, 0, 0, 7); g.fill(); return tex(c); })(); W.flameT = flameC;
  for (const [x, z] of [[-1.85, 1.15], [1.85, 1.15]]) { const cg = new THREE.Group(); const wax = new THREE.Mesh(new THREE.CylinderGeometry(.05, .055, .32, 10), new THREE.MeshStandardMaterial({ color: '#e8e0c8', roughness: .6, emissive: '#3a2410', emissiveIntensity: .4 })); wax.position.y = .16; cg.add(wax);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameC, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); f.position.y = .4; f.scale.set(.1, .2, 1); cg.add(f); cg.position.set(x, .16, z); S.add(cg); W.candles.push(f); }
  // ---- tombstones, crosses, obelisks (kept out of the camera corridor) ----
  const tombM = new THREE.MeshStandardMaterial({ map: stoneMap, normalMap: stoneN, roughness: .95, color: '#8d8c9c' });
  const mossM = new THREE.MeshStandardMaterial({ map: stoneMap, normalMap: stoneN, roughness: .95, color: '#6f7a6a' });
  const archG = new THREE.ExtrudeGeometry(archShape(.7, 1.0), { depth: .16, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 2, curveSegments: 10 }); archG.translate(0, 0, -.08);
  let placed = 0, guard = 0; while (placed < 34 && guard++ < 600) { const a = r() * Math.PI * 2, d = 3.6 + r() * 15; const x = Math.sin(a) * d, z = Math.cos(a) * d - 2;
    if (z > 1.5 && Math.abs(x) < 4.6 + (z - 1.5) * .35) continue; if (Math.hypot(x - MAST.x, z - MAST.z) < 1.4) continue; if (Math.abs(x) < 3.3 && Math.abs(z) < 2.6) continue;
    const kind = r(); const g = new THREE.Group(); const mat = r() < .4 ? mossM : tombM; let rad = .6;
    if (kind < .55) { const m = new THREE.Mesh(archG, mat); const s = .8 + r() * .7; m.scale.setScalar(s); g.add(m); rad = .5 * s; }
    else if (kind < .8) { const v = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.3, .14), mat); v.position.y = .65; const h = new THREE.Mesh(new THREE.BoxGeometry(.7, .15, .14), mat); h.position.y = .95; g.add(v, h); }
    else { const o = new THREE.Mesh(new THREE.CylinderGeometry(.06, .22, 1.9, 4), mat); o.position.y = .95; o.rotation.y = Math.PI / 4; const b = new THREE.Mesh(new THREE.BoxGeometry(.5, .3, .5), mat); b.position.y = .15; g.add(o, b); }
    g.position.set(x, -.02, z); g.rotation.set((r() - .5) * .18, (r() - .5) * .9, (r() - .5) * .2); g.traverse(o => { if (o.isMesh) { o.castShadow = d < 10; o.receiveShadow = true; } }); S.add(g); W.colliders.push({ p: new THREE.Vector3(x, .6, z), r: rad + .2 }); placed++; }
  // ---- dead trees ----
  const barkM = new THREE.MeshStandardMaterial({ color: '#1c1714', roughness: 1 });
  const branch = (g, len, rad, depth, rr) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * .6, rad, len, 6), barkM); m.position.y = len / 2; m.castShadow = true; g.add(m);
    if (depth <= 0) return; for (let i = 0; i < 2 + (rr() < .5 ? 1 : 0); i++) { const c = new THREE.Group(); c.position.y = len * (.6 + rr() * .35); c.rotation.set((rr() - .5) * 1.4, rr() * 6.28, (rr() - .5) * 1.6); g.add(c); branch(c, len * (.55 + rr() * .2), rad * .6, depth - 1, rr); } };
  for (const [x, z, s] of [[-7.5, -5.5, 1.3], [8.5, -7, 1.5], [-12, -12, 1.8], [11, 2, 1.1], [-9, 3.5, 1.0], [4, -15, 1.6]]) { const g = new THREE.Group(); branch(g, 2.6 * s, .2 * s, 3, rnd(Math.floor(x * 31 + z * 7))); g.position.set(x, 0, z); g.rotation.z = (r() - .5) * .2; S.add(g); W.colliders.push({ p: new THREE.Vector3(x, 1.5, z), r: .6 * s }); }
  // ---- iron fence (instanced) ----
  { const n = 140, R0 = 17; const bar = new THREE.CylinderGeometry(.025, .025, 1.5, 5); bar.translate(0, .75, 0); const im = new THREE.InstancedMesh(bar, new THREE.MeshStandardMaterial({ color: '#16161c', metalness: .7, roughness: .5 }), n); const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const a = Math.PI * .1 + i / n * Math.PI * 1.8; m4.makeTranslation(Math.sin(a) * R0 * 1.05, 0, Math.cos(a) * R0 - 5 - 4); im.setMatrixAt(i, m4); } S.add(im); }
  // ---- chapel + mausoleum ----
  const darkM = new THREE.MeshStandardMaterial({ map: stoneMap, roughness: 1, color: '#55546a' }), roofM = new THREE.MeshStandardMaterial({ color: '#17161e', roughness: .9 }), winM = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb050', emissiveIntensity: 1.4 });
  { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 8), darkM); b.position.y = 2; g.add(b); const roof = new THREE.Mesh(new THREE.CylinderGeometry(.01, 3.6, 2.6, 4, 1), roofM); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 1.6); roof.position.y = 5.3; g.add(roof);
    const t = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), darkM); t.position.set(0, 4, 4.6); g.add(t); const sp = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 4), roofM); sp.position.set(0, 10, 4.6); sp.rotation.y = Math.PI / 4; g.add(sp);
    for (const z of [-2.5, 0, 2.5]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(.6, 1.4), winM); w.position.set(2.51, 2.4, z); w.rotation.y = Math.PI / 2; g.add(w); } const tw = new THREE.Mesh(new THREE.PlaneGeometry(.5, 1.1), winM); tw.position.set(1.01, 6, 4.6); tw.rotation.y = Math.PI / 2; g.add(tw);
    g.position.set(-16, 0, -24); g.rotation.y = .5; S.add(g); }
  { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), darkM); b.position.y = 1.2; g.add(b); const roof = new THREE.Mesh(new THREE.CylinderGeometry(.01, 2.4, 1.2, 4), roofM); roof.rotation.y = Math.PI / 4; roof.position.y = 3; g.add(roof);
    for (const x of [-1.1, 1.1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.14, .16, 2.4, 10), darkM); c.position.set(x, 1.2, 1.65); g.add(c); } const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.7), new THREE.MeshBasicMaterial({ color: '#050407' })); door.position.set(0, .85, 1.51); g.add(door);
    g.position.set(9, 0, -10); g.rotation.y = -.6; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); S.add(g); W.colliders.push({ p: new THREE.Vector3(9, 1.2, -10), r: 2.3 }); }
  // distant hills
  for (const [x, z, s] of [[-40, -60, 30], [25, -70, 38], [70, -40, 30], [-70, -20, 28]]) { const h = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), new THREE.MeshStandardMaterial({ color: '#0d1018', roughness: 1 })); h.scale.set(s, s * .32, s * .6); h.position.set(x, -2, z); S.add(h); }
  // ---- lanterns on posts ----
  for (const [x, z] of [[-3.6, 2.6], [3.9, -2.6]]) { const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, 1.9, 8), new THREE.MeshStandardMaterial({ color: '#1a1a20', metalness: .6, roughness: .5 })); post.position.y = .95; g.add(post);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(.13, .1, .28, 6), new THREE.MeshStandardMaterial({ color: '#ffcf80', emissive: '#ff9a3a', emissiveIntensity: 1.6, transparent: true, opacity: .85 })); cage.position.y = 2.0; g.add(cage);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.17, .14, 6), post.material); cap.position.y = 2.2; g.add(cap); const pl = new THREE.PointLight('#ff9a48', 5, 9, 1.7); pl.position.y = 2.0; g.add(pl);
    g.position.set(x, 0, z); S.add(g); W.lanterns.push({ pl, cage, base: 5, ph: r() * 6 }); W.colliders.push({ p: new THREE.Vector3(x, 1.2, z), r: .35 }); }
  // ---- ground fog ----
  for (let i = 0; i < 20; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.smokeTex, color: '#8d96b8', transparent: true, opacity: .1, depthWrite: false, fog: true })); const a = r() * 6.28, d = 3 + r() * 14;
    s.position.set(Math.sin(a) * d, .5 + r() * .7, Math.cos(a) * d - 3); s.scale.set(6 + r() * 5, 2 + r() * 1.5, 1); s.userData = { vx: (r() - .5) * .25, o: .06 + r() * .07 }; S.add(s); W.fogs.push(s); }
  // ---- rain ----
  { const n = 2200, p = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = (r() - .5) * 18, y = r() * 26, z = (r() - .5) * 14 + 2; p.set([x, y, z, x, y - .35, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); W.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#a8b6dc', transparent: true, opacity: .3, depthWrite: false })); W.rain.frustumCulled = false; S.add(W.rain); W.rainY = 0; }
  // ---- crane: wooden mast + boom, counterweight, pulley, rope, iron claw, lantern ----
  const wt = woodTexture(seed + 9, [92, 62, 40]); const mastT = tex(wt, true); mastT.wrapS = mastT.wrapT = THREE.RepeatWrapping; const woodM = new THREE.MeshStandardMaterial({ map: mastT, roughness: .85, color: '#b49a84' });
  const boomT = tex(wt, true); boomT.wrapS = boomT.wrapT = THREE.RepeatWrapping; boomT.repeat.set(1, 3); const boomM = new THREE.MeshStandardMaterial({ map: boomT, roughness: .85, color: '#b49a84' });
  const ironM = new THREE.MeshStandardMaterial({ color: '#2b2d33', metalness: .75, roughness: .42 });
  W.crane = { g: new THREE.Group(), mastT };
  const C = W.crane; S.add(C.g);
  C.mast = new THREE.Mesh(new THREE.BoxGeometry(.42, 1, .42), woodM); C.mast.castShadow = true; C.g.add(C.mast);
  C.mast2 = new THREE.Mesh(new THREE.BoxGeometry(.2, 1, .2), woodM); C.mast2.castShadow = true; C.g.add(C.mast2);
  C.braces = []; for (let i = 0; i < 40; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, 1.0), woodM); b.visible = false; C.g.add(b); C.braces.push(b); }
  C.boom = new THREE.Mesh(new THREE.BoxGeometry(.32, .32, 1), boomM); C.boom.castShadow = true; C.g.add(C.boom);
  C.strut = new THREE.Mesh(new THREE.BoxGeometry(.16, .16, 1), boomM); C.strut.castShadow = true; C.g.add(C.strut);
  C.weight = new THREE.Mesh(new THREE.BoxGeometry(.8, .7, .7), cryptM); C.weight.castShadow = true; C.g.add(C.weight);
  C.pulley = new THREE.Mesh(new THREE.TorusGeometry(.2, .05, 8, 20), ironM); C.g.add(C.pulley);
  C.rope = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, 1, 6), new THREE.MeshStandardMaterial({ color: '#6a5a44', roughness: 1 })); C.rope.castShadow = true; C.g.add(C.rope);
  C.claw = new THREE.Group(); C.g.add(C.claw); const hub = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .2, 12), ironM); hub.position.y = .1; C.claw.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.09, .025, 6, 12), ironM); ring.position.y = .26; C.claw.add(ring);
  C.fingers = []; for (let i = 0; i < 4; i++) { const piv = new THREE.Group(); const sx = i < 2 ? -1 : 1, sz = i % 2 ? -1 : 1; piv.position.set(sx * .16, .02, sz * .12); C.claw.add(piv);
    const a = new THREE.Mesh(new THREE.BoxGeometry(.05, .34, .06), ironM); a.position.set(sx * .04, -.15, 0); a.rotation.z = sx * .12; piv.add(a); const h = new THREE.Mesh(new THREE.BoxGeometry(.13, .05, .06), ironM); h.position.set(-sx * .03, -.31, 0); piv.add(h); C.fingers.push({ piv, sx, arm: a }); }
  C.claw.traverse(o => { if (o.isMesh) o.castShadow = true; });
  C.lantern = new THREE.Mesh(new THREE.CylinderGeometry(.11, .09, .24, 6), new THREE.MeshStandardMaterial({ color: '#ffd08a', emissive: '#ff9a3a', emissiveIntensity: 1.5, transparent: true, opacity: .9 })); C.g.add(C.lantern);
  C.light = new THREE.PointLight('#ffae5c', 7, 9, 1.6); C.g.add(C.light);
  W.colliders.push({ mast: true, r: .55 });
  // ---- lightning bolts ----
  for (let i = 0; i < 10; i++) { const mk = (w, c, o) => { const g = new LineGeometry(); g.setPositions(new Float32Array(30 * 3)); const m = new LineMaterial({ color: c, linewidth: w, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, worldUnits: false }); const l = new Line2(g, m); l.frustumCulled = false; l.visible = false; S.add(l); return l; };
    W.arcs.push({ core: mk(2.4, '#eef3ff', 1), glow: mk(9, '#7f9cff', .35), life: 0, max: 1, a: new THREE.Vector3(), b: new THREE.Vector3(), amp: .3, jt: 0 }); }
  W.setRes = (w, h) => W.arcs.forEach(a => { a.core.material.resolution.set(w, h); a.glow.material.resolution.set(w, h); });
  // ---- bats ----
  { const batM = new THREE.MeshBasicMaterial({ color: '#07070c', side: THREE.DoubleSide, fog: false }); const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -.06, .32, .04, -.02, 0, 0, .08, .32, .04, -.02, .26, -.05, .07, 0, 0, .08]), 3));
    for (let i = 0; i < 46; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 4), batM); b.scale.set(1, .8, 1.5); g.add(b); const L = new THREE.Mesh(wing, batM), R = new THREE.Mesh(wing, batM); R.scale.x = -1; g.add(L, R); g.visible = false; g.scale.setScalar(.9 + r() * .7); S.add(g); W.bats.push({ g, L, R, ph: r() * 6.28, rad: 2.2 + r() * 3.2, sp: .8 + r() * .9, dy: (r() - .5) * 3, fl: 9 + r() * 6, out: 0 }); } }
  W.cryptCollider = { p: new THREE.Vector3(0, .5, 0), r: 1.7 }; W.colliders.push(W.cryptCollider);
  return W;
}

// ---- crane pose: pivot (boom tip), swing angle, rope length, claw opening ----
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _qq = new THREE.Quaternion();
function beam(mesh, a, b) { _m.subVectors(b, a); const len = _m.length() || 1e-3; mesh.position.copy(a).addScaledVector(_m, .5); mesh.scale.set(1, 1, len); mesh.lookAt(b); }
export function poseCrane(W, pivot, ang, rope, open, spread, t) {
  const C = W.crane, top = pivot.y + .25; const mh = top + .3;
  C.mast.position.set(MAST.x, mh / 2, MAST.z); C.mast.scale.y = mh; C.mastT.repeat.set(1, mh / 2.2);
  C.mast2.position.set(MAST.x + .55, mh / 2, MAST.z - .45); C.mast2.scale.y = mh;
  const nb = Math.min(C.braces.length, Math.floor(mh / 1.1)); for (let i = 0; i < C.braces.length; i++) { const b = C.braces[i]; b.visible = i < nb; if (!b.visible) continue; const y0 = i * 1.1 + .4; _a.set(MAST.x, y0, MAST.z); _b.set(MAST.x + .55, y0 + .9, MAST.z - .45); if (i % 2) { _a.y += .9; _b.y -= .9; } beam(b, _a, _b); }
  _a.set(MAST.x, top, MAST.z); _b.set(pivot.x + .25, top, pivot.z); beam(C.boom, _a, _b);
  _a.set(MAST.x, top - 1.5, MAST.z); _b.set((MAST.x + pivot.x) * .5, top, (MAST.z + pivot.z) * .5); beam(C.strut, _a, _b);
  C.weight.position.set(MAST.x - .75, top - .55, MAST.z - .6); C.weight.rotation.y = .5;
  C.pulley.position.set(pivot.x, top - .02, pivot.z); C.pulley.rotation.set(0, 0, t * -2 * (open > 0 ? 0 : 1));
  const cx = pivot.x + Math.sin(ang) * rope, cy = pivot.y - Math.cos(ang) * rope;
  _a.set(pivot.x, pivot.y + .2, pivot.z); _b.set(cx, cy + .28, pivot.z); _m.subVectors(_b, _a); const L = _m.length(); C.rope.position.copy(_a).addScaledVector(_m, .5); C.rope.scale.set(1, L, 1); C.rope.quaternion.setFromUnitVectors(_up, _m.normalize());
  C.claw.position.set(cx, cy, pivot.z); C.claw.rotation.z = ang * .3;
  for (const f of C.fingers) { f.piv.position.x = f.sx * Math.max(.16, spread); f.piv.rotation.z = f.sx * (-.05 + open * .9); f.arm.scale.y = 1; }
  C.lantern.position.set(pivot.x + .45, top - .45 + Math.sin(t * 1.3) * .02, pivot.z + .3); C.light.position.copy(C.lantern.position).add(_a.set(0, -.1, .3));
  return { x: cx, y: cy };
}
// jagged bolt: midpoint displacement (n = 30 points), optional fork
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Vector3(), _u = new THREE.Vector3(), _arr = new Float32Array(30 * 3);
function boltPoints(a, b, amp, out, R = Math.random) { const n = 30; _d.subVectors(b, a); const len = _d.length(); _u.set(_d.y, -_d.x + .3, _d.z + .2).normalize(); _q.crossVectors(_d, _u).normalize(); _u.crossVectors(_q, _d).normalize();
  let o1 = 0, o2 = 0; for (let i = 0; i < n; i++) { const k = i / (n - 1); const env = Math.sin(Math.PI * k); o1 = o1 * .55 + (R() - .5) * amp * len * .3; o2 = o2 * .55 + (R() - .5) * amp * len * .3;
    _p.copy(a).addScaledVector(_d, k).addScaledVector(_u, o1 * env).addScaledVector(_q, o2 * env); out[i * 3] = fin(_p.x); out[i * 3 + 1] = fin(_p.y); out[i * 3 + 2] = fin(_p.z); } }
export function zap(W, a, b, opt = {}) { let arc = W.arcs.find(x => x.life <= 0); if (!arc) arc = W.arcs.reduce((m, x) => x.life < m.life ? x : m, W.arcs[0]);
  arc.a.copy(a); arc.b.copy(b); arc.life = arc.max = opt.life || .3; arc.amp = opt.amp ?? .3; arc.jt = 0; arc.core.material.linewidth = opt.big ? 4 : 2.2; arc.glow.material.linewidth = opt.big ? 15 : 8; arc.glow.material.color.set(opt.color || '#7f9cff'); return arc; }
// a strike from the storm into a point (the tower top); far = background bolt
export function strike(W, target, far = false, R = Math.random) {
  if (far) { const x = (R() - .5) * 60, z = -35 - R() * 25; _a.set(x, 40, z); _b.set(x + (R() - .5) * 8, 2, z); zap(W, _a.clone(), _b.clone(), { life: .35, amp: .25 }); W.flash = Math.max(W.flash, .45); return; }
  _a.set(target.x + (R() - .5) * 4, target.y + 22, target.z - 4); zap(W, _a.clone(), target.clone(), { life: .6, amp: .2, big: 1, color: '#9fb8ff' });
  zap(W, _a.clone().lerp(target, .5), target.clone().add(_b.set((R() - .5) * 3, -2 - R() * 2, (R() - .5))), { life: .45, amp: .35 });
  zap(W, target.clone(), target.clone().add(_b.set(1.2, -1.4, .3)), { life: .35, amp: .5 }); zap(W, target.clone(), target.clone().add(_b.set(-1.3, -1.1, -.2)), { life: .35, amp: .5 });
  W.flash = Math.max(W.flash, 1); W.strike = 1; W.boltLight.position.copy(target).add(_b.set(0, .8, 1.2)); }
export function swarm(W, center) { W.swarm = 9; W.swarmY = center; W.bats.forEach((b, i) => { b.out = 0; b.g.visible = true; b.ph = i / W.bats.length * 6.28 * 3; b.g.position.set(-14 + Math.random() * 4, center - 4 + Math.random() * 3, -6 + Math.random() * 6); }); }
export function updateWorld(W, t, dt, I = {}) {
  W.t = t; const R = Math.random; const focus = fin(I.focus) || 2;
  W.flash = Math.max(0, fin(W.flash) - dt * 2.4); W.strike = Math.max(0, fin(W.strike) - dt * 1.7); W.moon = Math.min(1, Math.max(0, fin(W.moon))); W.stars = Math.max(0, Math.min(1, fin(W.stars)));
  const fl = W.flash; W.flashLight.intensity = fl * 2.6 * (fl > .5 || R() < .7 ? 1 : .3); W.boltLight.intensity = W.strike * 24;
  const u = W.sky.material.uniforms; u.time.value = t; u.flash.value = fl; u.moon.value = W.moon; u.stars.value = W.stars; W.sky.position.set(I.camX || 0, I.camY || 0, I.camZ || 0);
  W.key.intensity = 1.5 + W.moon * .9; W.key.color.setRGB(.62 + W.moon * .15, .7 + W.moon * .12, 1); W.hemi.intensity = .55 + W.moon * .25 + fl * .3;
  W.key.position.set(-6, focus + 12, 9); W.key.target.position.set(0, focus - 1.5, 0); W.rim.position.set(5, focus + 6, -10); W.rim.target.position.set(0, focus - 1, 0);
  W.flashLight.position.set(2, focus + 18, 8);
  // rain follows the camera focus, slants with the wind
  { const p = W.rain.geometry.attributes.position, n = Math.min(p.count / 2, I.rainN || 1100); W.rain.geometry.setDrawRange(0, n * 2); const sp = 16 * dt, wx = fin(W.wind) * .35 + .05; const y0 = focus - 9;
    for (let i = 0; i < n; i++) { let y = p.getY(i * 2) - sp, x = p.getX(i * 2) + wx * sp * .6; if (y < y0) y += 26; if (y > y0 + 26) y -= 26; if (x > 9) x -= 18; if (x < -9) x += 18; p.setXYZ(i * 2, x, y, p.getZ(i * 2)); p.setXYZ(i * 2 + 1, x - wx * .35, y - .38, p.getZ(i * 2)); } p.needsUpdate = true; W.rain.material.opacity = .26 + fl * .2; }
  W.fogs.forEach((s, i) => { s.position.x += s.userData.vx * dt + fin(W.wind) * dt * .4; if (s.position.x > 18) s.position.x = -18; if (s.position.x < -18) s.position.x = 18; s.material.opacity = s.userData.o * (1 + fl * .6) * (i < (I.fogN || 12) ? 1 : 0); });
  W.lanterns.forEach(l => { const k = .9 + Math.sin(t * 7 + l.ph) * .05 + Math.sin(t * 17 + l.ph) * .04; l.pl.intensity = l.base * k; });
  W.candles.forEach((f, i) => { const k = .85 + Math.sin(t * 13 + i * 3) * .08 + Math.sin(t * 31 + i) * .06; f.scale.set(.1 * k, .2 * (2 - k), 1); });
  W.crane.light.intensity = 7 * (.92 + Math.sin(t * 9) * .04);
  for (const a of W.arcs) { if (a.life <= 0) { a.core.visible = a.glow.visible = false; continue; } a.life -= dt; a.jt -= dt;
    if (a.jt <= 0) { a.jt = 1 / 20; boltPoints(a.a, a.b, a.amp, _arr); a.core.geometry.setPositions(_arr); a.glow.geometry.setPositions(_arr); }
    const k = Math.max(0, a.life / a.max), fk = k * (R() < .25 ? .45 : 1); a.core.material.opacity = Math.min(1, fk * 1.3); a.glow.material.opacity = .35 * fk; a.core.visible = a.glow.visible = a.life > 0; }
  // bat swarm: sweeps in, spirals around the tower top, then scatters upward
  if (W.swarm > 0) { W.swarm -= dt; const cy = fin(I.top) + 1.2; const leave = W.swarm < 2.5;
    W.bats.forEach((b, i) => { b.ph += dt * b.sp * 1.6; const tx = Math.sin(b.ph) * b.rad, tz = Math.cos(b.ph) * b.rad * .7, ty = cy + b.dy + Math.sin(b.ph * 2.3) * .5; _a.set(tx, ty, tz);
      if (leave) { b.out += dt; _a.set(tx * (1 + b.out * 2.5), ty + b.out * b.out * 6, tz * (1 + b.out)); } const g = b.g; _b.copy(g.position); g.position.lerp(_a, 1 - Math.exp(-dt * 2.2)); _m.subVectors(g.position, _b); if (_m.lengthSq() > 1e-6) { _b.copy(g.position).add(_m); g.lookAt(_b); }
      const f = Math.sin(t * b.fl + b.ph) * .9; b.L.rotation.z = f; b.R.rotation.z = -f; });
    if (W.swarm <= 0) W.bats.forEach(b => b.g.visible = false); }
}
