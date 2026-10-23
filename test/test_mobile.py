"""Zombie Stack – phone regression test (real touch emulation, 8 configs).
WebKit iPhone 13, iPhone 8 (375×667), iPhone SE (320×568) + Chromium Pixel 7 – each portrait AND landscape.
Checks: language follows the browser; every start / in-play / end control is tappable, on screen, not covered and ≥ 44 px;
no panel is cut off and nothing scrolls; invisible (opacity 0) UI is also visibility:hidden; ONE tap on the play button starts play
and unlocks audio; the game is playable by touch; memory stays flat over repeated rounds; no console errors.
Run: python3 test/test_mobile.py [base-url]   (exit 0 = all passed; screenshots → test/shots/mobile/)"""
import asyncio, os, sys, threading, http.server, functools, socketserver
from playwright.async_api import async_playwright
G = {'hook': '__zs', 'play': '#btnClassic [data-t=classic]', 'playText': {'en': '🏚️ Classic', 'de': '🏚️ Klassisch'}, 'lang': '#btnLang',
     'startPanels': ['#menu'], 'startHits': ['#btnClassic', '#btnTimed', '#diff button', '#btnKids', '#btnQ', '#btnSound', '#btnLang'],
     'startTaps': ['#diff button[data-d=easy]', '#diff button[data-d=hard]', '#diff button[data-d=medium]'], 'startTapsOk': "__zs.diff() === 'medium'", 'startTapsInfo': '__zs.diff()',
     'startClear': "(() => { const a = document.getElementById('menu').getBoundingClientRect(); return [...document.querySelectorAll('#top .pill')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').every(e => { const r = e.getBoundingClientRect(); return r.right <= a.left || r.left >= a.right || r.bottom <= a.top || r.top >= a.bottom; }) || [Math.round(a.top), Math.round(a.right)]; })()",
     'isPlay': "__zs.S.state === 'play'", 'stateInfo': '__zs.S.state', 'audio': "__zs.audioState() === 'running'", 'audioInfo': '__zs.audioState()',
     'playHits': ['#btnQuit', '#btnQ', '#btnSound', '#btnLang'], 'mayHide': ['#btnQ'],  # quality button is menu-only on narrow phones (by design)
     'touchName': 'a tap drops the hanging zombie (playable by touch)',
     'hudBox': "(() => { const a = [...document.querySelectorAll('#hud .chip, #side .chip')].filter(e => e.getClientRects().length && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect()), t = [...document.querySelectorAll('#top .pill')].map(e => e.getBoundingClientRect()); const bad = []; for (const r of a) { if (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) bad.push('off'); for (const q of t) if (!(r.right <= q.left || r.left >= q.right || r.bottom <= q.top || r.top >= q.bottom)) bad.push('overlap'); } return !bad.length || bad; })()",
     'toEnd': "__zs.S.end = 'quit'; __zs.end()", 'isEnd': "__zs.S.state === 'end' && document.getElementById('end').classList.contains('show')",
     'endPanels': ['#end'], 'endHits': ['#eName', '#btnCard', '#btnShare', '#btnAgain', '#btnMenu'], 'again': '#btnAgain',
     'mem': "[__zs.renderer.info.memory.geometries, __zs.renderer.info.memory.textures]", 'memName': 'GPU geometries / textures', 'memTol': 6}
async def G_touch(pg, W, H):
    c0 = None; n = 0
    for k in range(4):
        await pg.wait_for_timeout(800); c0 = await ev(pg, '__zs.cur()')
        await pg.touchscreen.tap(W * .5, H * .55); await pg.wait_for_timeout(300); n = await ev(pg, '__zs.S.dropN || 0')
        if n: break
    return n >= 1, (c0 and c0['state'], n)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('SHOTS', ROOT + '/test/shots/mobile/'); os.makedirs(OUT, exist_ok=True)
if len(sys.argv) > 1: URL = sys.argv[1]
else:
    class _Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    _srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
    threading.Thread(target=_srv.serve_forever, daemon=True).start(); URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
ONLY = os.environ.get('ONLY', ''); HK = G['hook']; R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)
DEVICES = [('webkit', 'iPhone 13', False, 'de-DE'), ('webkit', 'iPhone 13', True, 'en-US'), ('webkit', 'iPhone 8', False, 'en-US'), ('webkit', 'iPhone 8', True, 'de-AT'),
           ('webkit', 'iPhone SE', False, 'de-DE'), ('webkit', 'iPhone SE', True, 'en-GB'), ('chromium', 'Pixel 7', False, 'de-DE'), ('chromium', 'Pixel 7', True, 'en-US')]
HIT = """sels => sels.flatMap(sel => { const all = [...document.querySelectorAll(sel)].filter(e => !e.closest('[data-qa-skip]')); if (!all.length) return [[sel, 'missing']]; return all.map((e, i) => { const n = sel + (all.length > 1 ? '#' + i : '');
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return [n, 'hidden'];
  if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return [n, 'off-screen ' + [r.left, r.top, r.right, r.bottom].map(Math.round)];
  for (const [fx, fy] of [[.5, .5], [.2, .5], [.8, .5]]) { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (!t || !(t === e || e.contains(t) || (e.tagName === 'INPUT' && e.closest('label') && e.closest('label').contains(t)))) return [n, 'covered by ' + (t ? (t.id || String(t.className) || t.tagName) : 'nothing')]; }
  if (r.height < 43.5 || r.width < 43.5) return [n, 'too small ' + Math.round(r.width) + 'x' + Math.round(r.height)]; return [n, 'ok']; }); })"""
NOSCROLL = "(() => { const d = document.scrollingElement; return d.scrollHeight <= innerHeight + 1 && d.scrollWidth <= innerWidth + 1; })()"
FITS = """sels => sels.map(s => document.querySelector(s)).filter(e => e && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none').map(e => { const r = e.getBoundingClientRect();
  const kids = [...e.querySelectorAll('*')].filter(k => { const c = getComputedStyle(k); return c.display !== 'none' && c.visibility !== 'hidden' && k.getClientRects().length; });
  const out = kids.filter(k => { const q = k.getBoundingClientRect(); return q.width > 0 && (q.bottom > Math.min(r.bottom, innerHeight) + 1 || q.top < Math.max(r.top, 0) - 1 || q.right > Math.min(r.right, innerWidth) + 1 || q.left < Math.max(r.left, 0) - 1); }).map(k => k.id || String(k.className) || k.tagName).slice(0, 4);
  return [e.id, r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1, e.scrollHeight <= e.clientHeight + 1, out]; })"""
GHOSTS = """(() => [...document.querySelectorAll('body *')].filter(e => { if (e.tagName === 'CANVAS' || e.closest('[data-qa-skip]')) return false; if (e.getAnimations && e.getAnimations().some(a => a.playState === 'running')) return false; /* mid fade / popup animation */ const c = getComputedStyle(e); if (c.visibility === 'hidden' || c.display === 'none') return false;
  if (parseFloat(c.opacity) > 0.01) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; }).map(e => e.id || String(e.className) || e.tagName).slice(0, 6))()"""
async def ev(pg, js): return await pg.evaluate(js)
async def until(pg, js, secs=20):
    for _ in range(int(secs * 5)):
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(200)
    return False
async def hit(pg, sels):
    h = await ev(pg, f'({HIT})({sels!r})'); bad = {k: v for k, v in h if v != 'ok' and not (v == 'missing' and k in G.get('optional', []))}; return bad, len(h)
async def fits(pg, sels):
    f = await ev(pg, f'({FITS})({sels!r})'); return [x for x in f if not (x[1] and x[2] and not x[3])], len(f)
async def tap_el(pg, sel):
    r = await ev(pg, f"(() => {{ const r = document.querySelector({sel!r}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
    await pg.touchscreen.tap(r[0], r[1])
async def boot(b, d, loc):
    ctx = await b.new_context(**d, locale=loc)
    await ctx.add_init_script(G.get('init', '') + "; try{if(!sessionStorage.getItem('qaInit')){sessionStorage.setItem('qaInit','1'); localStorage.clear();" + G.get('initStore', '') + "}}catch(e){}")
    pg = await ctx.new_page(); pg.set_default_timeout(30000); errs = []
    pg.on('console', lambda m: errs.append(m.text[:160]) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:160]))
    await pg.goto(URL, timeout=120000); await pg.wait_for_function(G.get('ready', f'document.body.classList.contains("ready") && window.{HK}'), timeout=150000)
    return ctx, pg, errs
async def run(p, eng, dev, land, loc):
    d = dict(p.devices[dev]); d.pop('default_browser_type', None)
    if land: d['viewport'] = {'width': d['viewport']['height'], 'height': d['viewport']['width']}
    W, H = d['viewport']['width'], d['viewport']['height']; tag = f"{dev.replace(' ', '')}-{'land' if land else 'port'}"; T = f'[{tag} {eng} {W}×{H} {loc}]'
    kw = {} if eng == 'webkit' else dict(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    b = await (p.webkit if eng == 'webkit' else p.chromium).launch(**kw)
    try:
        ctx, pg, errs = await boot(b, d, loc)
        want = 'de' if loc.startswith('de') else 'en'
        await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}{tag}-0-start.png')
        pt = (await pg.inner_text(G['play'])).strip()
        check(f'{T} language follows the browser ({want})', await ev(pg, 'document.documentElement.lang') == want and pt.lower() == G['playText'][want].lower(), pt)
        # ---------- start screen ----------
        check(f'{T} start: nothing scrolls', await ev(pg, NOSCROLL))
        bad, n = await fits(pg, G['startPanels']); check(f'{T} start: panels fully on screen, nothing cut off ({n})', not bad, bad)
        bad, n = await hit(pg, G['startHits']); check(f'{T} start: every control tappable, on screen, ≥ 44 px ({n})', not bad, bad)
        gh = await ev(pg, GHOSTS); check(f'{T} start: invisible UI is visibility:hidden', not gh, gh)
        if G.get('startClear'):
            ov = await ev(pg, G['startClear']); check(f'{T} start: panel clear of the corner buttons', ov is True, ov)
        for s in G.get('startTaps', []):   # e.g. difficulty buttons: tap each, then make sure we are still on the start screen
            await tap_el(pg, s); await pg.wait_for_timeout(150)
        if G.get('startTaps'): check(f'{T} start: option buttons respond to taps', await ev(pg, G.get('startTapsOk', 'true')), await ev(pg, G.get('startTapsInfo', '0')))
        await tap_el(pg, G['lang']); await pg.wait_for_timeout(250); l1 = await ev(pg, 'document.documentElement.lang')
        check(f'{T} tap the DE/EN toggle switches the language', l1 != want, l1)
        if l1 != 'de': await tap_el(pg, G['lang']); await pg.wait_for_timeout(250)
        bad, _ = await fits(pg, G['startPanels']); bad2, _ = await hit(pg, G['startHits'])
        of = await ev(pg, "[...document.querySelectorAll('button')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && e.scrollWidth > e.clientWidth + 2).map(e => e.id || e.textContent.trim().slice(0, 16))")
        check(f'{T} German start screen fits too (no cut-off, no overflowing button text)', not bad and not bad2 and not of and await ev(pg, NOSCROLL), (bad, bad2, of))
        await pg.screenshot(path=f'{OUT}{tag}-0-start-de.png')
        await ctx.close()
        # ---------- fresh load: ONE tap ----------
        ctx, pg, errs2 = await boot(b, d, loc); errs += errs2
        await pg.wait_for_timeout(800); await tap_el(pg, G['play'])
        ok = await until(pg, G['isPlay'], 15)
        check(f'{T} ONE tap on {G["playText"][want]} from page load → playing', ok, await ev(pg, G.get('stateInfo', 'document.body.className')))
        check(f'{T} audio unlocks on that first tap', await until(pg, G['audio'], 6), await ev(pg, G['audioInfo']))
        await pg.wait_for_timeout(700); await pg.screenshot(path=f'{OUT}{tag}-1-play.png')
        check(f'{T} play: nothing scrolls', await ev(pg, NOSCROLL))
        bad, n = await hit(pg, G['playHits']); bad = {k: v for k, v in bad.items() if not (v == 'hidden' and k in G.get('mayHide', []))}; check(f'{T} play: HUD controls tappable, on screen, ≥ 44 px ({n})', not bad, bad)
        if G.get('hudBox'):
            ov = await ev(pg, f"(() => {{ const r = {G['hudBox']}; return r; }})()"); check(f'{T} play: HUD fits the screen, no overlaps', ov is True, ov)
        okT, info = await G_touch(pg, W, H); check(f'{T} {G["touchName"]}', okT, info)
        await pg.wait_for_timeout(700); gh = await ev(pg, GHOSTS); check(f'{T} play: invisible UI is visibility:hidden', not gh, gh)
        # ---------- end screen ----------
        await ev(pg, G['toEnd']); ok = await until(pg, G['isEnd'], 15); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'{OUT}{tag}-2-end.png')
        bad, n = await fits(pg, G['endPanels']); check(f'{T} end: card fully on screen, nothing cut off ({n})', ok and not bad, bad)
        bad, n = await hit(pg, G['endHits']); check(f'{T} end: every button tappable, on screen, ≥ 44 px ({n})', not bad, bad)
        check(f'{T} end: nothing scrolls', await ev(pg, NOSCROLL))
        gh = await ev(pg, GHOSTS); check(f'{T} end: invisible UI is visibility:hidden', not gh, gh)
        # ---------- memory stays flat over repeated rounds ----------
        if eng == 'chromium':
            m = []
            for k in range(5):
                await tap_el(pg, G['again']); await until(pg, G['isPlay'], 10); await pg.wait_for_timeout(1200)
                await ev(pg, G['toEnd']); await until(pg, G['isEnd'], 15); await pg.wait_for_timeout(600)
                m.append(await ev(pg, G['mem']))
            check(f'{T} memory flat over 5 rounds after warm-up — a leak would grow every round ({G["memName"]})', all(abs(x[i] - m[2][i]) <= G.get('memTol', 2) for x in m[2:] for i in range(len(x))), m)
        check(f'{T} no console / page errors', not errs, errs[:3])
    finally: await b.close()
async def main():
    async with async_playwright() as p:
        for cfg in DEVICES:
            if ONLY and ONLY not in cfg[1].replace(' ', '') + ('-land' if cfg[2] else '-port'): continue
            n0 = len(R)
            for att in (1, 2):
                try: await asyncio.wait_for(run(p, *cfg), 420); break
                except Exception as e:
                    msg = (str(e) or type(e).__name__).split('\n')[0][:200]
                    if att == 1 and ('crash' in msg.lower() or 'closed' in msg.lower() or 'Timeout' in msg):
                        print(f'RETRY {cfg[1]} {cfg[2]}: browser crashed / timed out ({msg})', flush=True); del R[n0:]; continue
                    check(f'[{cfg[1]} {"land" if cfg[2] else "port"}] run completed', False, msg); break
    print(f'\n{sum(R)}/{len(R)} mobile checks passed'); sys.exit(0 if R and all(R) else 1)
asyncio.run(main())
