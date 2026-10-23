// WebAudio for the embedded CC0 recordings (window.ZS_SOUNDS): zombie groans and grunts, wood, bone and stone thuds,
// a creaking crane rope, chains, thunder, rain and wind, bats, a real pipe organ (VSCO 2 CE), timpani, contrabass and
// pizzicato strings. Nothing is synthesized: pitched instruments re-pitch the nearest recorded note; the graveyard
// echo is a generated convolution reverb (processing only).
// Every sound (and every loop level change) is logged so tests and the video mix can replay it exactly.
let ctx = null, master = null, dry = null, conv = null, bufs = {}, ready = false, muted = false; const loops = {};
export const log = [];
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
export const INS = {
  org: Object.fromEntries([48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81].map(m => [m, m])),
  ped: Object.fromEntries([24, 27, 30, 33, 36, 39, 42].map(m => [m, m])),
  pz: { D3: 50, A3: 57, C4: 60, E4: 64, G4: 67, D5: 74 },
  cb: { E1: 28, Fs1: 30, A1: 33, Cs2: 37, E2: 40 },
  xy: { C5: 72, G5: 79, C6: 84 },
  hp: { D4: 62, A4: 69 }
};
const SORTED = Object.fromEntries(Object.entries(INS).map(([k, v]) => [k, Object.entries(v).sort((a, b) => a[1] - b[1])]));
export function sampleFor(ins, m) { const L = SORTED[ins]; let best = L[0]; for (const e of L) if (Math.abs(e[1] - m) < Math.abs(best[1] - m)) best = e; return { n: ins + '_' + best[0], r: Math.pow(2, (m - best[1]) / 12) }; }
function makeIR(sec = 3.2) { const sr = ctx.sampleRate, n = Math.floor(sr * sec), ir = ctx.createBuffer(2, n, sr); let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * (.5 - .38 * t / sec); d[i] = lp * Math.exp(-t * 1.9) * (i < sr * .02 ? i / (sr * .02) : 1); } } return ir; }
// iOS Safari: create/resume inside the tap, play a 1-sample silent buffer (unlocks output), ask for 'playback' (ignores the mute switch)
function kick(c) { try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {} }
export function audioState() { return ctx ? ctx.state : 'none'; }
export async function unlock() {
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
  if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); kick(ctx); if (ctx.state !== 'running') ctx.resume().catch(() => {}); master = ctx.createGain(); master.gain.value = muted ? 0 : .9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
  dry = ctx.createGain(); dry.connect(master); conv = ctx.createConvolver(); conv.buffer = makeIR(); const wet = ctx.createGain(); wet.gain.value = .32; conv.connect(wet); wet.connect(master);
  const src = window.ZS_SOUNDS || {};
  await Promise.all(Object.keys(src).map(k => new Promise(res => { try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); } })));
  ready = true; window.__zsAudioReady = Object.keys(bufs).length; for (const k in loops) startLoop(k);
}
export function play(n, vol = 1, rate = 1, delay = 0, rev = .4, dur = 0, pan = 0) {
  if (!Number.isFinite(vol)) vol = 0; if (!Number.isFinite(rate) || rate <= 0) rate = 1; if (!Number.isFinite(delay)) delay = 0; if (!Number.isFinite(rev)) rev = 0; if (!Number.isFinite(dur)) dur = 0; if (!Number.isFinite(pan)) pan = 0;
  delay = Math.max(0, delay); log.push({ n, t: clock() + delay, v: vol, r: rate, rv: rev, d: dur, p: pan });
  if (log.length > 8000) log.splice(0, 1500);
  if (!ready || !bufs[n] || !(vol > 0)) return null;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); let out = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
  out.connect(dry); if (rev > 0) { const sg = ctx.createGain(); sg.gain.value = rev; out.connect(sg); sg.connect(conv); }
  const t0 = ctx.currentTime + delay; s.start(t0);
  if (dur > 0) { g.gain.setValueAtTime(vol, t0 + dur); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur + .4); s.stop(t0 + dur + .45); }
  return s;
}
export function note(ins, m, vol = .7, dur = 0, delay = 0, rev = .4, pan = 0) { const { n, r } = sampleFor(ins, m); return play(n, vol, r, delay, rev, dur, pan); }
// looping beds (rain, coil buzz, bubbling, mob): level/rate changes are logged as '~name'
function startLoop(k) { const L = loops[k]; if (!ready || L.src || !bufs[k]) return; L.g = ctx.createGain(); L.g.gain.value = L.v; L.src = ctx.createBufferSource(); L.src.buffer = bufs[k]; L.src.loop = true; L.src.playbackRate.value = L.r; L.src.connect(L.g); L.g.connect(dry); const sg = ctx.createGain(); sg.gain.value = .25; L.g.connect(sg); sg.connect(conv); L.src.start(); }
export function loop(k, v, r = 1, fade = .4) {
  if (!Number.isFinite(v)) v = 0; if (!Number.isFinite(r) || r <= 0) r = 1; if (!Number.isFinite(fade)) fade = .4;
  const L = loops[k] || (loops[k] = { v: 0, r: 1 }); if (Math.abs(L.v - v) < .004 && Math.abs(L.r - r) < .004) return; L.v = v; L.r = r;
  log.push({ n: '~' + k, t: clock(), v, r, f: fade }); startLoop(k);
  if (L.g) { const t = ctx.currentTime; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t); L.g.gain.linearRampToValueAtTime(v, t + fade); L.src.playbackRate.setTargetAtTime(r, t, .15); }
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; }
export function isMuted() { return muted; }
const R = Math.random, rr = a => a[Math.floor(R() * a.length)], jit = (k = .06) => 1 + (R() - .5) * 2 * k;
const GROANS = ['groan_1', 'groan_2', 'groan_3', 'groan_4', 'groan_5', 'groan_short'];
// voice per piece kind: [sample list, rate]
const VOICE = { shambler: [GROANS, 1], brute: [['grunt_1', 'grunt_2', 'groan_1', 'groan_5'], .82], crawler: [['groan_short', 'groan_3', 'groan_2'], 1.18], stander: [GROANS, .95], head: [['groan_short', 'groan_4'], 1.1] };
export const sfx = {
  ui() { play('cl_1', .26, 1.1, 0, .15); },
  groan(kind = 'shambler', v = .5, pan = 0) { const [L, r] = VOICE[kind] || VOICE.shambler; play(rr(L), v, r * jit(.07), 0, .45, 0, pan); },
  grab(pan = 0) { play('zombie_grab', .42, jit(.05), 0, .4, 1.4, pan); play(rr(['grunt_1', 'grunt_2']), .3, 1.1 * jit(), .15, .3, 0, pan); },
  creak(k = .3, pan = 0) { play(rr(['creak_1', 'creak_2', 'creak_3']), k, jit(.08), 0, .35, 0, pan); },
  squeak(k = .2) { play(rr(['squeak_1', 'squeak_2']), k, jit(.08), 0, .3); },
  lower() { play('chain_rattle', .32, 1, 0, .35, 1.2); play('chain', .3, .9, .05, .3); play('creak_long', .18, 1.1, .1, .35, 1.1); },
  release() { play('clank', .45, 1.05 * jit(), 0, .4); play('chain', .3, 1.2, 0, .3); },
  land(mat, k, kind, pan = 0) { k = Math.max(.15, Math.min(1, k));
    if (mat === 'wood') { play(rr(['thud_wood', 'thud_a', 'thud_b']), .55 * k + .2, .9 * jit(), 0, .35, 0, pan); play('knock', .25 * k, .8 * jit(), .02, .3, 0, pan); }
    else if (mat === 'stone') { play(rr(['stone_1', 'stone_2']), .6 * k + .2, jit(), 0, .4, 0, pan); play('gravel_1', .25 * k, jit(), .03, .3, 0, pan); }
    else if (mat === 'pumpkin') { play('splat', .5 * k + .15, .75 * jit(), 0, .3, 0, pan); play('thud_b', .35 * k, 1.15, 0, .3, 0, pan); }
    else { play(rr(['body_fall', 'punch', 'impact']), .5 * k + .2, (kind === 'brute' ? .8 : 1) * jit(), 0, .35, 0, pan); play(rr(['bone_hit', 'bones2']), .3 * k, jit(), .02, .3, 0, pan); }
    play('sub', .25 * k * k, 1, 0, .2); },
  perfect(n) { const step = [0, 3, 5, 7, 10, 12, 15]; const m = 50 + step[Math.min(n - 1, step.length - 1)];
    [m, m + 3, m + 7, m + 12].forEach((x, i) => note('org', x, .34 - i * .03, .8, 0, .65)); note('ped', 26 + (step[Math.min(n - 1, 6)] % 12), .4, 1.1, 0, .6);
    play(rr(['tp_1', 'tp_2', 'tp_3']), .4, 1, 0, .4); play('sparkle', .26, jit(.04), .05, .5); if (n >= 3) { play('choir_ah', .22 + Math.min(.2, n * .03), 1, .05, .6); play('cymcresc', .14, 1.3, 0, .5, .9); } },
  milestone() { [38, 45, 50, 53, 57, 62].forEach((m, i) => note(i < 2 ? 'ped' : 'org', m, i < 2 ? .5 : .32, 2.6, i * .02, .7)); play('gong', .42, .9, 0, .6); play('choir_swell', .45, 1, .1, .7); play('tproll', .3, 1, 0, .5); },
  lightning(near = true) { play('thunder_big', near ? .85 : .5, jit(.03), 0, .3); play('crack', .45, .9, 0, .3); if (near) play('sub', .55, 1, 0, .2); },
  thunder(far = true) { play(far ? 'thunder_soft' : 'thunder', far ? .38 : .6, jit(.04), 0, .3); },
  bats() { play('bat_swarm', .55, 1, 0, .4, 5.2); play('bats', .45, 1, .2, .4); },
  moon() { play('choir_swell', .5, .95, 0, .7); play('howl', .5, 1, .6, .6, 0, -.4); play('owl', .26, 1, 2.6, .5, 0, .5); play('gong', .3, .7, 0, .6); },
  miss(pan = 0) { play('body_fall', .5, .9, 0, .35, 0, pan); play('dirt', .4, 1, .05, .35, 0, pan); play(rr(GROANS), .45, .8, .1, .45, 0, pan); },
  collapse() { play('topple', .85, .95, 0, .35); play('growl_big', .7, .8, .1, .5); play('groan_crowd', .6, .85, .25, .5); play('crumble', .6, .9, .5, .4); play('smash', .45, .85, .9, .4); play('stone_crash', .55, .9, 1.2, .4);
    [24, 27, 30].forEach((m, i) => note('ped', m, .55, 3.5, i * .03, .7)); [48, 51, 54, 57].forEach((m, i) => note('org', m, .28, 3.5, .05 + i * .02, .7)); play('gong', .5, .7, .1, .6); play('crash', .3, .8, .3, .5); },
  glue() { play('splat', .5, .85, 0, .3); play('bubbles_a', .45, .9, .05, .3); play('magic', .32, 1, .1, .5); },
  freeze() { play('freeze', .6, 1, 0, .5); play('freeze_b', .35, 1, .1, .5); play('glass', .3, 1.3, .3, .5); play('xy_C6', .25, 1, .2, .6); },
  slow() { play('fwoosh', .5, .55, 0, .5); play('whisper', .35, .8, 0, .6); play('glissup', .25, .7, .1, .5); },
  powerup() { play('magic', .4, 1.1, 0, .5); play('sparkle', .35, 1, .05, .5); },
  gust(k = .6) { play('fwoosh', .3 + k * .3, .7, 0, .4); },
  crow() { play('crow', .3, 1, 0, .5, 0, (R() - .5) * 1.2); },
  owl() { play('owl', .22, 1, 0, .6, 0, (R() - .5) * 1.4); },
  kids() { play('laugh_kids', .42, 1, 0, .4); },
  poof() { play('magic', .3, 1.2, 0, .4); play('fwoosh', .25, 1.3, 0, .3); },
  win() { play('success', .45, 1, 0, .4); play('sparkle', .3, 1, .3, .5); play('choir_ah', .3, 1, .1, .6); },
  tick() { play('cl_2', .2, 1.4, 0, .1); },
  stinger() { play('stinger', .35, 1, 0, .5); }
};
