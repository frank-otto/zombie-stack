// Music, all played on recorded samples (VSCO 2 CE, CC0): our own slow D-minor graveyard march on pipe organ,
// contrabass, timpani and pizzicato strings. Layers join as the tower grows (intensity 0..1).
import { note, play } from './audio.js';
const CH = { Dm: { b: 38, p: [62, 65, 69, 74], o: [50, 53, 57] }, Bb: { b: 34, p: [58, 62, 65, 70], o: [50, 53, 58] }, Gm: { b: 31, p: [55, 58, 62, 67], o: [50, 55, 58] }, A: { b: 33, p: [57, 61, 64, 69], o: [49, 52, 57] }, F: { b: 29, p: [57, 60, 65, 69], o: [48, 53, 57] }, C: { b: 36, p: [60, 64, 67, 72], o: [48, 52, 55] } };
const GROOVES = {
  // menu: sparse organ chords + bass, wind does the rest
  menu: { bpm: 66, prog: ['Dm', 'Bb', 'Gm', 'A'], bar(b, c, k) { const E = [];
    E.push([0, () => c.o.forEach(m => note('org', m, .085 * k, 3.6, 0, .75))]); E.push([0, () => note('cb', c.b, .38 * k, 0, 0, .4)]); E.push([2.5, () => note('cb', c.b + 7, .2 * k, 0, 0, .4)]);
    if (b % 2 === 1) E.push([3, () => note('hp', c.p[3], .1 * k, 0, 0, .6)]); return E; } },
  // game: a zombie march; I = intensity (height), adds timpani, pizzicato and organ stabs
  game: { bpm: 76, prog: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'Bb', 'A'], bar(b, c, k, I) { const E = [];
    E.push([0, () => note('cb', c.b, .42 * k, 0, 0, .35)]); E.push([1.5, () => note('cb', c.b, .22 * k, 0, 0, .35)]); E.push([2, () => note('cb', c.b + 7, .3 * k, 0, 0, .35)]); E.push([3, () => note('cb', c.b + 5, .22 * k, 0, 0, .35)]);
    E.push([0, () => c.o.forEach(m => note('org', m, (.07 + .05 * I) * k, 3.7, 0, .75))]);
    if (I > .15) { E.push([0, () => play('tp_4', .3 * k, Math.pow(2, ((c.b - 38) % 12) / 24), 0, .4)]); E.push([2, () => play('tp_3', .2 * k, 1, 0, .4)]); }
    if (I > .35) [0, 1, 2, 3].forEach(q => E.push([q + .5, () => note('pz', c.p[(q + b) % 4], .14 * k, 0, 0, .45, (q - 1.5) * .25)]));
    if (I > .6) { E.push([1, () => c.o.forEach(m => note('org', m + 12, .1 * k, .25, 0, .6))]); E.push([3, () => c.o.forEach(m => note('org', m + 12, .1 * k, .25, 0, .6))]); }
    if (I > .8 && b % 4 === 3) E.push([3.5, () => play('crash', .14 * k, .9, 0, .5)]);
    if (b % 4 === 0) E.push([0, () => play('bd', .3 * k, .8, 0, .4)]); return E; } }
};
export class Player {
  constructor() { this.g = null; this.on = false; this.vol = 1; this.I = 0; }
  start(name, t0) { this.g = GROOVES[name]; this.name = name; this.t0 = t0; this.spb = 60 / this.g.bpm; this.bar = -1; this.q = []; this.on = true; }
  stop() { this.on = false; this.q = []; }
  beat(t) { return this.on ? (t - this.t0) / this.spb : 0; }
  step(t) { if (!this.on) return; const bt = this.beat(t); const b = Math.floor(bt / 4);
    while (this.bar < b + 1) { this.bar++; if (this.bar < 0) continue; const ch = CH[this.g.prog[this.bar % this.g.prog.length]]; for (const [be, f] of this.g.bar(this.bar, ch, this.vol, this.I)) this.q.push([this.t0 + (this.bar * 4 + be) * this.spb, f]); this.q.sort((a, b2) => a[0] - b2[0]); }
    while (this.q.length && this.q[0][0] <= t) { const [, f] = this.q.shift(); f(); } }
}
