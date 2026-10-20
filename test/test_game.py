"""Zombie Stack headless test (Chrome + SwiftShader WebGL, served over a local web server)."""
import asyncio, os, re, glob, hashlib
from playwright.async_api import async_playwright
import threading, http.server, functools, socketserver
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)

async def page(b, auto_q=False, manual=True, url=None, **kw):
    ctx = await b.new_context(accept_downloads=True, **kw)
    na = '' if auto_q else 'window.__zsNoAutoQ = true;'
    await ctx.add_init_script(f"window.__zsSeed = 4242; window.__zsPDB = true; {na} try{{if(!sessionStorage.getItem('zsInit')){{sessionStorage.setItem('zsInit','1'); localStorage.clear();}}}}catch(e){{}}")
    pg = await ctx.new_page(); pg.set_default_timeout(240000); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    await pg.goto(url or URL); await pg.wait_for_function('document.body.classList.contains("ready")', timeout=90000)
    if manual: await pg.evaluate('window.__zsManual = true; __zs.step(1/30, 3)')
    return ctx, pg, logs

def pxs(im): return im.get_flattened_data() if hasattr(im, 'get_flattened_data') else list(im.getdata())
def bright_share(path, thr=250):
    im = Image.open(path).convert('RGB'); px = pxs(im); return sum(1 for r, g, b in px if r >= thr and g >= thr and b >= thr) / (im.width * im.height)
def mean(path): im = Image.open(path).convert('L'); px = pxs(im); return sum(px) / len(px)
async def shot(pg, name):
    await pg.evaluate('__zs.step(1/30)'); await pg.wait_for_timeout(1200); await pg.screenshot(path=OUT + name); return OUT + name
async def lg_since(pg, k): return await pg.evaluate(f'__zs.log.slice({k}).map(e => e.n)')
async def mark(pg): return await pg.evaluate('__zs.log.length')
async def until(pg, cond, maxf=4000): return await pg.evaluate(f'(() => {{ let i = 0; for (; i < {maxf} && !({cond}); i++) __zs.stepq(1/30); __zs.step(1/30); return i; }})()')
st = lambda pg: pg.evaluate('({s: __zs.S.state, H: __zs.S.H, lives: __zs.S.lives, combo: __zs.S.combo, n: __zs.tower().length, t: __zs.S.timeLeft, score: __zs.S.score})')
async def perfect(pg, settle=45): return await pg.evaluate(f'(() => {{ const i = __zs.aimDrop(900); __zs.stepq(1/30, {settle}); return i; }})()')
async def climb(pg, h):
    for _ in range(12):
        if (await st(pg))['H'] >= h: break
        await perfect(pg)
EDGE = '''(settle) => { let pv = -1e9, i = -1; for (let k = 0; k < 900 && __zs.S.state === 'play'; k++) { __zs.stepq(1/30, 1); const c = __zs.cur(); if (!c || c.state !== 'hang' || c.age < .5) continue; const x = Math.abs(__zs.predict() - (__zs.tower().length ? __zs.tower().slice(-1)[0].x : 0)); if (x < pv && x > .25) { __zs.drop(); i = k; break; } pv = x; } __zs.stepq(1/30, settle); return i; }'''
MISS = '''(settle) => { for (let k = 0; k < 600 && !(__zs.cur() && __zs.cur().state === 'hang' && __zs.cur().age > .5); k++) __zs.stepq(1/30); __zs.drop(); const P = __zs._dbg.pieces.find(p => p.state === 'fall'); if (P) { P.body.position.x = 7; P.body.velocity.set(0, -2, 0); } __zs.stepq(1/30, settle); return !!P; }'''
BLACK = '''(n) => { const gl = __zs.renderer.getContext(), px = new Uint8Array(4); let k = 0; for (let i = 0; i < n; i++) { __zs.step(1/30); let lit = 0; for (const [fx, fy] of [[.5, .5], [.25, .3], [.75, .3], [.25, .75], [.75, .75]]) { gl.readPixels(Math.floor(gl.drawingBufferWidth * fx), Math.floor(gl.drawingBufferHeight * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (px[0] + px[1] + px[2] >= 3) lit++; } if (!lit) k++; } return k; }'''
CAMOK = '''(n) => { let worst = 1e9, under = 0; for (let i = 0; i < n; i++) { __zs.stepq(1/30); const c = __zs.camClear(); worst = Math.min(worst, c); if (__zs.cam().p[1] < 1.1) under++; } __zs.step(1/30); return [worst, under]; }'''
SWING = '''(n) => { let m = 0; for (let i = 0; i < n; i++) { __zs.stepq(1/30); m = Math.max(m, Math.abs(__zs.theta())); } return m; }'''

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        ctx, pg, logs = await page(b, viewport={'width': 1280, 'height': 800})
        check('menu visible, EN default, title', await pg.is_visible('#menu.show') and 'Zombie Stack' in await pg.text_content('h1') and 'Classic' in await pg.text_content('#btnClassic'))
        check("graphics label reads 'Normal' by default", 'Normal' in await pg.text_content('#btnQ'), await pg.text_content('#btnQ'))
        m0 = mean(await shot(pg, 'shot-first.png')); check('first frames are not black', m0 > 12, round(m0, 1))
        await pg.evaluate('__zs.step(1/30, 200)'); lg = await pg.evaluate('__zs.log.map(e => e.n)')
        check('menu: graveyard ambience beds (rain, wind, breathing)', {'~rain', '~wind', '~breath_loop'} <= set(lg), sorted(set(x for x in lg if x[0] == '~')))
        check('menu: music from recorded organ / pizzicato / timpani samples', sum(1 for n in lg if re.match(r'(org|ped|pz|cb|tp)_', n)) >= 6, sorted(set(lg))[:12])
        check('menu: a demo zombie tower stands on the crypt', await pg.evaluate('__zs.tower().length') == 4)
        check('menu: crane swings a zombie over the crypt', await pg.evaluate('!!__zs.cur() && __zs.cur().state === "hang"') and await pg.evaluate(f'({SWING})(60)') > .05)
        bs = bright_share(await shot(pg, 'shot-menu.png')); check('menu no glare', bs < .004, round(bs, 5))
        await pg.click('#btnLang'); de = await pg.text_content('#btnClassic'); await shot(pg, 'shot-menu-de.png')
        check('DE toggle', 'Klassisch' in de and 'Auf Zeit' in await pg.text_content('#btnTimed'), de)
        await pg.wait_for_timeout(200); await pg.reload(wait_until='load'); await pg.wait_for_function('document.body.classList.contains("ready") && window.__zs'); await pg.evaluate('window.__zsManual = true')
        check('language remembered after reload', 'Klassisch' in await pg.text_content('#btnClassic')); await pg.click('#btnLang')
        check('difficulty default Medium', await pg.evaluate('__zs.diff()') == 'medium' and 'on' in (await pg.get_attribute('#diff [data-d=medium]', 'class') or ''))
        # ---- classic medium ----
        await pg.evaluate('__zs.log.length = 0'); await pg.click('#btnClassic'); await pg.evaluate('__zs.step(1/30, 40)')
        s = await st(pg); check('Classic starts: play state, 3 lives, height 0', s['s'] == 'play' and s['lives'] == 3 and s['H'] == 0 and await pg.is_visible('#hLivesBox'), s)
        check('hint explains the one control', await pg.is_visible('#hint.show') and 'Space' in await pg.text_content('#hint'))
        check('NEXT preview shows the coming piece', len((await pg.text_content('#nextBox')).strip()) > 3, await pg.text_content('#nextBox'))
        lg = await pg.evaluate('__zs.log.map(e => e.n)'); check('crane lowers a piece with chain + creak sounds', 'chain_rattle' in lg and 'creak_long' in lg)
        sw0 = await pg.evaluate(f'({SWING})(90)'); check('the piece swings on the rope (gentle start)', .1 < sw0 < .32, round(sw0, 3))
        ons = await pg.evaluate('(() => { let on = 0, off = 0; for (let i = 0; i < 120; i++) { __zs.stepq(1/30); if (__zs.onTarget()) on++; else off++; } return [on, off]; })()')
        check('landing marker turns green only over the target', ons[0] > 0 and ons[1] > ons[0], ons)
        k = await mark(pg); await perfect(pg); s = await st(pg); tw = await pg.evaluate('__zs.tower()')
        check('perfect drop: snaps dead-centre and locks', s['combo'] == 1 and len(tw) == 1 and abs(tw[0]['x']) < .01 and tw[0]['locked'], (s, tw[:1]))
        l = await lg_since(pg, k); check('perfect drop: organ chord + timpani + sparkle', sum(1 for n in l if n.startswith('org_')) >= 3 and 'sparkle' in l, sorted(set(l)))
        check('perfect pop text', any('PERFECT' in x for x in await pg.evaluate('window.__pops || []')))
        check('landing thud from a real sample', any(n in l for n in ('thud_wood', 'thud_a', 'thud_b', 'body_fall', 'punch', 'impact', 'stone_1', 'stone_2', 'splat')), sorted(set(l)))
        await perfect(pg); await perfect(pg); s = await st(pg); bn = await pg.evaluate('window.__banners')
        check('3 perfects in a row: streak banner', s['combo'] == 3 and any('STREAK' in x for x in bn), (s['combo'], bn))
        check('HUD height follows the tower', s['H'] > 1 and await pg.text_content('#hH') == f"{s['H']:.1f} m", (s['H'], await pg.text_content('#hH')))
        await pg.evaluate("__zs.setNext('shambler')"); await perfect(pg); await pg.evaluate("__zs.setNext('brute')"); k = await mark(pg); await perfect(pg)
        check('zombie lands on zombie: they grab each other (constraint + sound)', 'zombie_grab' in await lg_since(pg, k) and await pg.evaluate('__zs.constraints()') > 5)
        k = await mark(pg); await pg.evaluate("__zs.setNext('tombstone')"); await perfect(pg, 5); await perfect(pg)
        l = await lg_since(pg, k); check('tombstones land with stone thuds', any(n in l for n in ('stone_1', 'stone_2')))
        k = await mark(pg); c0 = (await st(pg))['combo']; await pg.evaluate(f'({EDGE})(50)'); s = await st(pg); pops = await pg.evaluate('(window.__pops || []).slice(-3)')
        check('off-centre drop: combo resets, honest feedback', s['combo'] == 0 and c0 >= 1 and any(x in ' '.join(pops) for x in ('Nice', 'Wobbly', 'Missed')), (c0, s, pops))
        tw = await pg.evaluate('__zs.tower()')
        check('physics sanity: pieces stay in the play plane, no NaN, upright', all(abs(t['q'][0]) < 1e-3 and abs(t['q'][1]) < 1e-3 and all(v == v for v in [t['x'], t['y']]) for t in tw), [(round(t['x'], 2), round(t['y'], 2)) for t in tw])
        check('physics sanity: tower grows upward piece by piece', all(tw[i + 1]['y'] > tw[i]['y'] - .3 for i in range(len(tw) - 1)) and len(tw) >= 7, [round(t['y'], 2) for t in tw])
        await pg.evaluate('__zs.stepq(1/30, 120)'); tw2 = await pg.evaluate('__zs.tower()')
        check('physics sanity: settled tower does not drift (2 s)', len(tw2) == len(tw) and max(abs(a['y'] - b['y']) for a, b in zip(tw, tw2)) < .08)
        check('lower tower is frozen (kinematic), only the top pieces simulate', sum(1 for t in tw2 if t['frozen']) >= len(tw2) - 7 and not tw2[-1]['frozen'], [t['frozen'] for t in tw2])
        k = await mark(pg); l0 = (await st(pg))['lives']; await pg.evaluate(f'({MISS})(80)'); s = await st(pg); l = await lg_since(pg, k)
        check('miss: piece falls into the grave, −1 life, thud + groan', s['lives'] == l0 - 1 and 'body_fall' in l and 'dirt' in l, (l0, s))
        p = await shot(pg, 'shot-play.png'); check('play no glare', bright_share(p) < .004, round(bright_share(p), 5))
        bk = await pg.evaluate(f'({BLACK})(20)'); check('no black frames during play', bk == 0, bk)
        cam = await pg.evaluate(f'({CAMOK})(90)'); check('camera never clips into the crane, pieces or ground (play)', cam[0] > 0 and cam[1] == 0, cam)
        # power-ups
        await pg.evaluate("__zs.setNext('coffin', 'glue')"); await perfect(pg); await perfect(pg); g = await pg.evaluate('__zs.S.glue')
        check('glue potion collected: next drops stick (counter + HUD badge)', g == 3 and 'Glue' in await pg.text_content('#powers'), (g, await pg.text_content('#powers')))
        await pg.evaluate("__zs.setNext('coffin', 'slow')"); await perfect(pg); await perfect(pg); s1 = await pg.evaluate('__zs.S.slow')
        check('slow-mo potion: the crane swings slowly for 3 drops', s1 == 3 and 'Slow' in await pg.text_content('#powers'), s1)
        await pg.evaluate("__zs.setNext('coffin', 'freeze')"); k = await mark(pg); await perfect(pg); await perfect(pg); fz = await pg.evaluate('[__zs.S.freezeT, __zs.tower().filter(t => t.frozen).length, __zs.tower().length]')
        check('freeze potion: whole tower frozen solid for 12 s + ice sounds', fz[0] > 8 and fz[1] >= fz[2] - 1 and 'freeze' in await lg_since(pg, k), fz)
        # milestones
        mb = await pg.evaluate('window.__banners.join(" | ")'); check('3 m milestone: lightning strikes the top', '3 m' in mb and 'thunder_big' in await pg.evaluate('__zs.log.map(e => e.n)'), mb[:200])
        await pg.evaluate('__zs.cheat(Math.max(0, Math.floor((4.7 - __zs.S.H) / .5)))'); await climb(pg, 6.0); l = await pg.evaluate('__zs.log.map(e => e.n)')
        check('6 m milestone: bat swarm', '6 m' in await pg.evaluate('window.__banners.join(" ")') and 'bat_swarm' in l)
        await pg.evaluate('__zs.cheat(Math.max(0, Math.floor((8.7 - __zs.S.H) / .5)))'); await climb(pg, 10.0); await pg.evaluate('__zs.stepq(1/30, 120)')
        check('10 m milestone: the full moon rises', await pg.evaluate('__zs.W.moon') > .9 and '10 m' in await pg.evaluate('window.__banners.join(" ")'))
        sw1 = await pg.evaluate(f'({SWING})(120)'); check('swing gets wider as the tower grows', sw1 > sw0 + .05, (round(sw0, 3), round(sw1, 3)))
        cy = await pg.evaluate('__zs.cam().p[1]'); check('camera rises with the tower', cy > 8, round(cy, 2))
        p = await shot(pg, 'shot-tall.png'); check('tall tower + moon no glare', bright_share(p) < .004, round(bright_share(p), 5))
        cam = await pg.evaluate(f'({CAMOK})(60)'); check('camera clear at height', cam[0] > 0 and cam[1] == 0, cam)
        await pg.evaluate('__zs.cheat(Math.max(0, Math.floor((13.7 - __zs.S.H) / .5)))'); await climb(pg, 15.0); await pg.evaluate('__zs.stepq(1/30, 120)')
        check('15 m milestone: above the storm, stars appear', await pg.evaluate('__zs.W.stars') > .9 and '15 m' in await pg.evaluate('window.__banners.join(" ")'))
        # collapse
        k = await mark(pg)
        for _ in range(5):
            await pg.evaluate(f'({MISS})(10)')
            if (await st(pg))['s'] != 'play': break
            await pg.evaluate('__zs.stepq(1/30, 40)')
        await pg.evaluate('__zs.stepq(1/30, 8)'); s = await st(pg); ts = await pg.evaluate('__zs.S.ts')
        check('last life lost: the tower collapses in dramatic slow motion', s['s'] == 'collapse' and ts < .4, (s, ts))
        l = await lg_since(pg, k); check('collapse: topple + big growl + horde groan + organ', {'topple', 'growl_big', 'groan_crowd'} <= set(l) and any(n.startswith('ped_') for n in l))
        await pg.evaluate('__zs.stepq(1/30, 25)'); p = await shot(pg, 'shot-collapse.png'); check('collapse frame not black, no glare', mean(p) > 15 and bright_share(p) < .004, (round(mean(p), 1), round(bright_share(p), 5)))
        cam = await pg.evaluate(f'({CAMOK})(60)'); check('camera clear during the collapse', cam[0] > 0 and cam[1] == 0, cam)
        await until(pg, '__zs.S.state === "end"', 400); await pg.evaluate('__zs.step(1/30, 30)')
        check('end screen: height, rank, score, stats', await pg.is_visible('#end.show') and ' m' in await pg.text_content('#eH') and len(await pg.text_content('#eRank')) > 3 and 'Score' in await pg.text_content('#eScore'))
        check("share-card name defaults to 'Player'", await pg.input_value('#eName') == 'Player')
        check('new record stored as highscore for this mode', 'record' in (await pg.text_content('#eBest')).lower() and await pg.evaluate('+localStorage.getItem("zs-best-classic-medium")') > 1500, await pg.evaluate('localStorage.getItem("zs-best-classic-medium")'))
        await shot(pg, 'shot-end.png')
        async with pg.expect_download() as dl: await pg.click('#btnCard')
        d = await dl.value; await d.save_as(OUT + 'card.png'); im = Image.open(OUT + 'card.png')
        check('share card 1080×1350 PNG download', im.size == (1080, 1350) and d.suggested_filename == 'my-zombie-tower.png', (im.size, d.suggested_filename))
        snap = await pg.evaluate('[window.__zsCardSnap, __zs.S.bestSnap && __zs.S.bestSnap.list.length, +window.__zsCardLive.toFixed(2), +__zs.S.maxH.toFixed(2)]')
        check('after the collapse the card rebuilds the tower as it stood at its best height', snap[0] >= 20 and snap[0] == snap[1] and snap[2] < snap[3] - .25, snap)
        check('share card not black, no glare', mean(OUT + 'card.png') > 20 and bright_share(OUT + 'card.png') < .01, (round(mean(OUT + 'card.png'), 1), round(bright_share(OUT + 'card.png'), 5)))
        await pg.click('#btnMenu'); await pg.evaluate('__zs.step(1/30, 5)')
        check('menu shows the classic highscore', 'm' in await pg.text_content('#bestClassic'), await pg.text_content('#bestClassic'))
        # ---- timed ----
        await pg.click('#btnTimed'); await pg.evaluate('__zs.step(1/30, 20)'); s = await st(pg)
        check('Timed mode: 90 s timer, no lives', s['s'] == 'play' and await pg.is_visible('#hTimeBox') and not await pg.is_visible('#hLivesBox') and 89 < s['t'] <= 90, s)
        for _ in range(3): await perfect(pg)
        t0 = (await st(pg))['t']; await perfect(pg); t1 = (await st(pg))['t']
        check('Timed: perfect streak adds +2 s', t1 > t0 - 1, (t0, t1))
        t0 = (await st(pg))['t']; await pg.evaluate(f'({MISS})(30)'); t1 = (await st(pg))['t']; check('Timed: a miss costs 5 s', t0 - t1 > 5, (t0, t1))
        await until(pg, '__zs.S.state !== "play"', 4000); s = await st(pg); bn = await pg.evaluate('window.__banners')
        check("Timed: time up → the tower freezes and is measured", s['s'] in ('collapse', 'end') and any('Time' in x for x in bn), (s, bn[-2:]))
        await until(pg, '__zs.S.state === "end"', 300)
        check('Timed: streak time bonus is capped (the clock always runs out)', await pg.evaluate('__zs.S.bonusT') <= 20)
        check('Timed: separate highscore per mode', await pg.evaluate('+localStorage.getItem("zs-best-timed-medium")') > 0 and await pg.evaluate('+localStorage.getItem("zs-best-classic-medium")') > 1500)
        await pg.click('#btnAgain'); await pg.evaluate('__zs.step(1/30, 5)'); check('Play again restarts the same mode', (await st(pg))['s'] == 'play' and await pg.evaluate('__zs.S.mode') == 'timed')
        await pg.keyboard.press('Escape'); await pg.evaluate('__zs.step(1/30, 3)'); check('Escape ends the run', (await st(pg))['s'] == 'end')
        await pg.click('#btnMenu')
        # ---- hard ----
        await pg.click('#diff [data-d=hard]'); await pg.click('#btnClassic'); await pg.evaluate('__zs.step(1/30, 20)')
        check('Hard: only 2 lives', (await st(pg))['lives'] == 2)
        for _ in range(4): await perfect(pg)
        await until(pg, '__zs.S.gust', 1200); w = await pg.evaluate('(() => { let m = 0; for (let i = 0; i < 60; i++) { __zs.stepq(1/30); m = Math.max(m, Math.abs(__zs.S.wind)); } return m; })()')
        check('Hard: wind gusts push the tower (banner + force)', w > .2 and any('Gust' in x for x in await pg.evaluate('window.__banners')), w)
        check('Hard: no console errors so far', not logs, logs[:3])
        await pg.keyboard.press('Escape'); await pg.click('#btnMenu')
        # ---- easy ----
        await pg.click('#diff [data-d=easy]'); await pg.click('#btnClassic'); await pg.evaluate('__zs.step(1/30, 20)')
        check('Easy: 5 lives', (await st(pg))['lives'] == 5)
        await pg.keyboard.press('Escape'); await pg.click('#btnMenu'); await pg.click('#diff [data-d=medium]')
        # ---- kids ----
        await pg.click('#btnKids'); check('Kids toggle hides difficulty', not await pg.is_visible('#diff'))
        await pg.click('#btnClassic'); await pg.evaluate('__zs.step(1/30, 20)')
        check('Kids: no lives, finish button', not await pg.is_visible('#hLivesBox') and 'Finish' in await pg.text_content('#btnQuit'))
        for _ in range(6): await pg.evaluate(f'({MISS})(40)')
        s = await st(pg); check('Kids: misses just go "poof", never game over', s['s'] == 'play' and any('Poof' in x for x in await pg.evaluate('window.__pops')), s)
        for _ in range(4): await pg.evaluate(f'({EDGE})(60)')
        tw = await pg.evaluate('__zs.tower()'); check('Kids: gentle auto-straighten keeps the stack centred', len(tw) >= 3 and max(abs(t['x']) for t in tw) < .5, [round(t['x'], 2) for t in tw])
        await pg.click('#btnQuit'); await pg.evaluate('__zs.step(1/30, 5)'); check('Kids: Finish shows the end screen', (await st(pg))['s'] == 'end')
        await pg.click('#btnMenu'); await pg.click('#btnKids')
        labels = []
        for _ in range(4): await pg.click('#btnQ'); labels.append(await pg.text_content('#btnQ'))
        check('quality cycles Low/Normal/High/Ultra', any('Normal' in l for l in labels) and any('Ultra' in l for l in labels) and any('Low' in l for l in labels), labels)
        g0 = await pg.evaluate('__zs.S.gt'); await pg.evaluate('__zs.step(-1); __zs.step(NaN); __zs.step(Infinity)'); g1 = await pg.evaluate('__zs.S.gt')
        check('frame clock: negative / NaN / huge steps never go backwards (≤ 1/20 s)', g0 <= g1 <= g0 + 0.051, (g0, g1))
        await pg.evaluate('window.__zsManual = false'); l0 = await pg.evaluate('__zs.last()'); dt = await pg.evaluate(f'__zs.advance({l0} - 500)'); l1 = await pg.evaluate('__zs.last()'); await pg.evaluate('window.__zsManual = true')
        check('rAF timestamp earlier than the last one: dt 0, clock kept', dt == 0 and l1 >= l0, (dt, l0, l1))
        await pg.evaluate("(() => { __zs.W.flash = NaN; __zs.W.strike = NaN; __zs.W.moon = NaN; __zs.S.phi = NaN; __zs.S.focus = NaN; __zs.S.ts = NaN; })()"); bk = await pg.evaluate(f'({BLACK})(10)')
        check('NaN in effect values never blacks out the frame', bk == 0 and await pg.evaluate('Number.isFinite(__zs.cam().p[1])'), bk)
        names = set(await pg.evaluate('Object.keys(window.ZS_SOUNDS)'))
        check('sound log contains only bundled sample names', all(n.lstrip('~') in names for n in set(await pg.evaluate('__zs.log.map(e => e.n)'))))
        check('no console errors (desktop)', not logs, logs[:3])
        await ctx.close()
        # real time
        ctx, pg, logs = await page(b, auto_q=True, manual=False, viewport={'width': 1280, 'height': 800}); await pg.wait_for_timeout(4000)
        q5 = await pg.evaluate('[__zs.quality(), __zs.fps.n]')
        g0 = await pg.evaluate('__zs.S.gt'); await pg.click('#btnClassic'); await pg.wait_for_function('__zs.cur() && __zs.cur().state === "hang" && __zs.cur().age > .6', timeout=60000)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(1500)
        r = await pg.evaluate('({gt: __zs.S.gt, st: __zs.S.state, n: __zs.pieces().filter(p => p.state !== "hang").length})')
        check('real-time loop: clock runs forward, Space drops a piece', r['gt'] > g0 + .5 and r['st'] == 'play' and r['n'] >= 1, (g0, r))
        check('auto quality does not step down at startup (first seconds are ignored)', q5 == ['mid', 0], q5)
        check('no console errors (real time)', not logs, logs[:3])
        await ctx.close()
        ctx, pg, logs = await page(b, url='file://' + ROOT + '/index.html', viewport={'width': 800, 'height': 600})
        check('works from file:// (single bundled script + embedded sounds)', await pg.evaluate('!!window.__zs && Object.keys(window.ZS_SOUNDS).length') >= 100 and not logs, logs[:2])
        await ctx.close()
        # ---- phone (touch) ----
        ctx, pg, logs = await page(b, viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        await shot(pg, 'shot-mobile-menu.png')
        r = await pg.eval_on_selector('#menu', 'e => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; }'); check('mobile menu fits', r[0] >= 0 and r[1] <= 844, r)
        await pg.tap('#btnClassic'); await pg.evaluate('__zs.step(1/30, 40)')
        check('touch: tap hint shown', 'Tap' in await pg.text_content('#hint'))
        await pg.evaluate("(() => { for (let i = 0; i < 300 && !(__zs.cur() && __zs.cur().age > .6); i++) __zs.stepq(1/30); __zs.step(1/30); })()")
        n0 = await pg.evaluate('__zs.pieces().filter(p => p.state !== "hang").length'); await pg.tap('#game', position={'x': 195, 'y': 500}); await pg.evaluate('__zs.step(1/30, 60)')
        n1 = await pg.evaluate('__zs.pieces().filter(p => p.state !== "hang").length'); check('touch: tapping the screen drops the piece', n1 == n0 + 1, (n0, n1))
        for _ in range(6): await perfect(pg)
        mp = await shot(pg, 'shot-mobile-play.png')
        bb = [await pg.eval_on_selector(s, 'e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }') for s in ['#hud', '#top']]
        check('mobile HUD visible, inside the screen, not under the buttons', bb[0][0] >= 0 and bb[0][1] <= 390 and (bb[0][2] >= bb[1][3] - 1 or bb[0][1] <= bb[1][0] + 1) and bb[0][3] <= 844, bb)
        fr = await pg.evaluate('(() => { const t = __zs.screen([0, __zs.top(), 0]), c = __zs.cur(); const h = c ? __zs.screen([c.x, c.y, 0]) : t; return [t.y, h.y]; })()')
        check('mobile: tower top and hanging piece framed on screen', 120 < fr[1] < fr[0] < 800, fr)
        check('mobile play no glare', bright_share(mp) < .004, round(bright_share(mp), 5))
        await pg.evaluate('__zs.end(); __zs.step(1/30, 40)'); await shot(pg, 'shot-mobile-end.png')
        r = await pg.eval_on_selector('#end', 'e => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; }'); check('mobile end panel fits', r[0] >= 0 and r[1] <= 844, r)
        check('no console errors (mobile)', not logs, logs[:3])
        await ctx.close(); await b.close()
    src = ''.join(open(f, encoding='utf8').read() for f in glob.glob(ROOT + '/src/*.js') + [ROOT + '/index.html', ROOT + '/css/style.css'])
    check('no synth oscillators (real samples only)', 'createOscillator' not in src and 'OscillatorNode' not in src and 'createOscillator' not in open(ROOT + '/js/game.bundle.js').read())
    check('real physics engine bundled (cannon-es) + Three.js', 'cannon-es' in open(ROOT + '/package.json').read() and 'LockConstraint' in src)
    texts = ''.join(open(f, encoding='utf8', errors='ignore').read() for f in glob.glob(ROOT + '/src/*.js') + [ROOT + '/index.html'] + glob.glob(ROOT + '/*.md') + glob.glob(ROOT + '/LICENSES/*.md'))
    check('no email addresses', not re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', texts))
    ab = ''.join(map(chr, (65, 73)))
    check('visible text uses SI, never the other abbreviation', not re.search(r'\b' + ab + r'\b', texts))
    BAN = {'4991c47202960c57', '043f4ce6d84aff1d', '7dbef27a673fea64', '849c39839ba51811', '55579b557896d0ce'}
    hit = sorted({w for w in re.findall(r'[A-Za-zÀ-ÿ]+', re.sub(r'frank-otto\.github\.io|github\.com/frank-otto', '', texts)) if hashlib.sha256(w.lower().encode()).hexdigest()[:16] in BAN})
    check('no personal names', not hit, hit)
    snd = glob.glob(ROOT + '/sounds/*.mp3'); bundle = open(ROOT + '/js/sounds-src.js').read()
    check('all sounds are bundled CC0 recordings', len(snd) >= 100 and all(('"' + os.path.basename(f)[:-4] + '"') in bundle for f in snd), len(snd))
    lic = open(ROOT + '/LICENSES/SOUNDS.md', encoding='utf8').read() if os.path.exists(ROOT + '/LICENSES/SOUNDS.md') else ''
    ids = ['58626', '338059', '125405', '463721', '213509', '366672', '189281', '254735', '339184', '168650', '387240', '447922', '268500', '269232', '264062', '179341', '265580', '494071', '452645', '396447', '245768', '404687', '243614']
    check('sound credits list the Freesound IDs', all(i in lic for i in ids), [i for i in ids if i not in lic])
    print(f'\n{sum(R)}/{len(R)} passed'); return all(R)
ok = asyncio.run(main()); raise SystemExit(0 if ok else 1)
