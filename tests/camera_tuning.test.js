#!/usr/bin/env node
// Camera tuning test (GDD 11a): the pause menu shows a Camera tuning panel with the Behind or CLOSE camera only.
// It has 12 sliders, each with a number box; changed values apply to the camera at once, are kept after a
// reload (localStorage 'sgp_cam'), and Reset to defaults brings back the built-in values.
// Since 1.14.0 CLOSE is its own camera (the 1.13.x profile list is gone): chosen on the start screen and kept after
// a reload, C cycles Behind -> CLOSE -> Top-down in a session and in replay, CLOSE starts with the Close values,
// its panel has its own title, Behind and CLOSE keep separate values ('sgp_cam' / 'sgp_cam_close'), Reset per
// camera, an old saved Close profile gives Behind its defaults. With CLOSE at 1470x830 @2x, sky is at most 12 %
// of the screen on a straight at speed (GDD 1.13.1).
// Usage: node tests/camera_tuning.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const DEG = Math.PI / 180;
// defaults in display units (tilt in degrees, bike height and fade zone in %)
const DEF = { a: 40, p: 1.3, bike: 20, zMax: 20, zBase: 30, zK: 1.0, wk: 2.3, hk: 2.6, nearQ: 0.75, farQ: 0.45, fade: 30, minLen: 40 };
const CLOSE = { a: 55, p: 1.8, bike: 8, zMax: 30, zBase: 12, zK: 0.4, wk: 3.5, hk: 6, nearQ: 1.5, farQ: 0.7, fade: 30, minLen: 40 };
const UNIT = { a: DEG, bike: 0.01, fade: 0.01 }; // display unit -> TILT value

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  let failed = 0, total = 0;
  const check = (ok, name, info) => { total++; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(50)} ${info || ''}`); };
  const ready = () => page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const tilt = () => page.evaluate(() => Object.assign({}, window.__sgp.TILT));
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const isProf = (T, V) => Object.keys(V).every(k => near(T[k], V[k] * (UNIT[k] || 1)));
  const isDef = T => isProf(T, DEF);
  const isClose = T => isProf(T, CLOSE);
  const st = () => page.evaluate(() => { const S = window.__sgp, t = document.getElementById('camTitle'), P = document.getElementById('pauseCam'), b = document.querySelector('#optCam [aria-pressed="true"]');
    return { mode: S.CAM.mode, opt: S.UI.opts.cam, chip: b ? b.textContent : null, title: t ? t.textContent : null, panel: !!P && !P.hidden, cam: S.camNameX() }; });
  const stored = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
  const pauseCam = async cam => { // start practice with this camera (start-screen option) and pause with Escape
    await page.evaluate(cam => { const S = window.__sgp; if (S.W.paused && S.UI.state === 'play') S.UI.togglePause(); S.UI.opts.cam = cam; S.UI.opts.train = 'off'; S.UI.launch('practice', {}); }, cam);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__sgp.W.paused);
  };
  const slide = (k, v) => page.evaluate(([k, v]) => { const rg = document.getElementById('cam_' + k); rg.value = v; rg.dispatchEvent(new Event('input', { bubbles: true })); }, [k, v]);
  const fmt = T => `tilt ${(T.a / DEG).toFixed(1)}°  zoom max ${T.zMax}`;
  // start practice with the Behind camera and pause it the way a player does (Escape)
  const pauseBehind = async () => {
    await page.evaluate(() => { const S = window.__sgp; S.UI.opts.cam = 'behind'; S.UI.opts.train = 'off'; S.UI.launch('practice', {}); S.setCamModeX('behind'); });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__sgp.W.paused);
  };
  const panel = () => page.evaluate(() => {
    const P = document.getElementById('pauseCam');
    if (!P) return { exists: false, visible: false, sliders: 0, boxes: 0 };
    const rows = [...P.querySelectorAll('input[type=range]')];
    return { exists: true, visible: !P.hidden && !document.getElementById('pause').hidden && P.offsetParent !== null,
      sliders: rows.length, boxes: rows.filter(r => r.parentNode.querySelector('input[type=number]')).length };
  });

  await page.goto(FILE);
  await ready();
  await page.evaluate(() => { try { localStorage.removeItem('sgp_cam'); } catch (e) { } });
  await page.reload(); await ready();

  // a) panel in the Behind pause menu
  await pauseBehind();
  let p = await panel();
  check(p.visible, 'panel visible in the Behind pause menu');
  check(p.sliders === 12 && p.boxes === 12, '12 sliders, each with a number box', `sliders ${p.sliders}  number boxes ${p.boxes}`);

  // b) change tilt with the slider and zoom maximum with the number box
  await page.evaluate(() => {
    const rg = document.getElementById('cam_a'); rg.value = 50; rg.dispatchEvent(new Event('input', { bubbles: true })); rg.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.fill('#cam_zMax + input[type=number]', '25');
  await page.locator('#cam_zMax + input[type=number]').dispatchEvent('change');
  let T = await tilt();
  check(near(T.a, 50 * DEG) && T.zMax === 25, 'values applied (tilt 50°, zoom max 25)', fmt(T));
  const sliderZ = await page.$eval('#cam_zMax', el => +el.value);
  check(sliderZ === 25, 'slider follows the number box', `zoom max slider ${sliderZ}`);

  // c) kept after a reload
  await page.reload(); await ready();
  T = await tilt();
  check(near(T.a, 50 * DEG) && T.zMax === 25, 'values kept after a reload (localStorage)', fmt(T));

  // d) Reset to defaults, also after another reload
  await pauseBehind();
  p = await panel();
  const shown = await page.$eval('#cam_a', el => +el.value);
  check(p.visible && shown === 50, 'panel shows the saved values', `tilt slider ${shown}`);
  await page.locator('#pauseCam button', { hasText: 'Reset to defaults' }).click();
  T = await tilt();
  check(isDef(T), 'Reset to defaults restores all 12 values', fmt(T));
  await page.reload(); await ready();
  T = await tilt();
  check(isDef(T), 'defaults kept after a reload', fmt(T));

  // f) Behind panel title
  await pauseCam('behind');
  let S0 = await st();
  check(S0.title === 'Camera tuning (Behind)', 'panel title for Behind', `title "${S0.title}"`);
  await page.evaluate(() => window.__sgp.UI.togglePause());

  // g) CLOSE chosen on the start screen, kept after a reload, starts with the Close values
  await page.evaluate(() => window.__sgp.UI.toMenu());
  await page.locator('#optCam button', { hasText: 'CLOSE' }).click();
  await page.reload(); await ready();
  S0 = await st();
  check(S0.opt === 'close' && S0.chip === 'CLOSE', 'CLOSE chosen on the start screen, kept after reload', `option ${S0.opt}  pressed "${S0.chip}"`);
  await pauseCam('close');
  T = await tilt(); S0 = await st();
  check(S0.mode === 'close' && isClose(T), 'CLOSE starts with the Close values', `camera ${S0.mode}  ${fmt(T)}  depth ${T.hk}  far ${T.farQ}`);
  check(S0.panel && S0.title === 'Camera tuning (CLOSE)', 'panel shown for CLOSE with its title', `title "${S0.title}"`);

  // h) values tuned on CLOSE do not change Behind and are kept after a reload ('sgp_cam_close')
  await slide('zK', 0.8);
  T = await tilt();
  const sc = await stored('sgp_cam_close'), sb = await stored('sgp_cam');
  check(near(T.zK, 0.8) && sc && near(sc.zK, 0.8) && (!sb || near(sb.zK, DEF.zK)), 'CLOSE value saved in sgp_cam_close only', `zoom speed factor ${T.zK}  sgp_cam_close ${sc && sc.zK}  sgp_cam ${sb ? sb.zK : 'none'}`);
  await page.reload(); await ready();
  await pauseCam('close'); const Tc = await tilt();
  await pauseCam('behind'); const Tb = await tilt();
  check(near(Tc.zK, 0.8) && isDef(Tb), 'CLOSE value kept after reload, Behind unchanged', `CLOSE zK ${Tc.zK}  Behind ${isDef(Tb) ? 'defaults' : fmt(Tb)}`);

  // i) C cycles Behind -> CLOSE -> Top-down -> Behind in a session; in the pause menu C switches the panel
  const seq = [];
  for (let k = 0; k < 3; k++) { await page.keyboard.press('KeyC'); const x = await st(); seq.push(`${x.mode}/${x.opt}/${x.panel ? x.title.replace('Camera tuning ', '') : '-'}`); }
  check(seq.join() === 'close/close/(CLOSE),chase/chase/-,behind/behind/(Behind)', 'C cycles cameras in a session (paused)', seq.join('  '));
  await page.evaluate(() => window.__sgp.UI.togglePause());
  const seqLive = [];
  for (let k = 0; k < 3; k++) { await page.keyboard.press('KeyC'); seqLive.push((await st()).mode); }
  check(seqLive.join() === 'close,chase,behind', 'C cycles cameras while riding', seqLive.join(' -> '));

  // j) Reset to defaults per camera
  await pauseCam('close'); await slide('a', 45); await slide('zK', 0.9);
  await page.locator('#pauseCam button', { hasText: 'Reset to defaults' }).click();
  T = await tilt();
  check(isClose(T), 'Reset on CLOSE gives the Close values', fmt(T));
  await pauseCam('behind'); await slide('a', 33);
  await page.locator('#pauseCam button', { hasText: 'Reset to defaults' }).click();
  T = await tilt();
  check(isDef(T), 'Reset on Behind gives the Behind values', fmt(T));
  await page.evaluate(() => window.__sgp.UI.togglePause());

  // k) replay: starts with the start-screen camera, C cycles all three
  await page.evaluate(() => {
    const S = window.__sgp; S.UI.opts.cam = 'behind'; S.UI.opts.train = 'off'; S.UI.launch('practice', {});
    const W = S.W, b = W.player; b.autopilot = true; b.trainHold = false; W.paused = true; let g = 0;
    while (b.laps.length < 1 && g < 120 * 900) { S.simStep(S.SUB); g++; }
    W.paused = false; S.UI.toMenu(); S.UI.opts.cam = 'close'; S.RP.open([S.Lib.data[S.Lib.meta[0].id]], 'menu');
  });
  const r0 = (await st()).mode, rs = [];
  for (let k = 0; k < 3; k++) { await page.keyboard.press('KeyC'); rs.push((await st()).mode); }
  check(r0 === 'close' && rs.join() === 'chase,behind,close', 'replay: start-screen camera, C cycles', `start ${r0}  then ${rs.join(' -> ')}`);
  await page.evaluate(() => window.__sgp.RP.close());

  // l) old data: sgp_cam saved by 1.13.x with the Close profile unchanged gives Behind its defaults; other values stay
  const old = async v => { await page.evaluate(v => { localStorage.setItem('sgp_cam', JSON.stringify(v)); localStorage.removeItem('sgp_cam_close'); }, v); await page.reload(); await ready(); await pauseCam('behind'); return [await tilt(), await stored('sgp_cam')]; };
  const [o1, s1] = await old(Object.assign({ profile: 'close' }, CLOSE)), [o2] = await old(Object.assign({ profile: 'custom' }, CLOSE, { zK: 0.8 })), [o3] = await old(Object.assign({}, DEF, { a: 50 }));
  check(isDef(o1) && !('profile' in (s1 || {})), 'old Close profile: Behind starts from defaults', `Behind ${isDef(o1) ? 'defaults' : fmt(o1)}  profile field ${s1 && 'profile' in s1 ? 'kept' : 'gone'}`);
  check(near(o2.zK, 0.8) && near(o2.a, 55 * DEG) && near(o3.a, 50 * DEG), 'other old saved values stay with Behind', `custom -> ${fmt(o2)}  1.12 tilt 50 -> ${(o3.a / DEG).toFixed(1)}°`);
  await page.evaluate(() => { window.__sgp.UI.togglePause(); localStorage.removeItem('sgp_cam'); localStorage.removeItem('sgp_cam_close'); }); await page.reload(); await ready();

  // e) hidden with the Top-down camera (panel built first in a Behind pause, then a Top-down session paused)
  await pauseBehind();
  await page.evaluate(() => window.__sgp.UI.togglePause());
  await page.evaluate(() => { const S = window.__sgp; S.UI.opts.cam = 'chase'; S.UI.opts.train = 'off'; S.UI.launch('practice', {}); S.setCamModeX('chase'); });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__sgp.W.paused);
  p = await panel();
  const pauseOpen = await page.$eval('#pause', el => !el.hidden);
  check(pauseOpen && !p.visible, 'panel hidden in the Top-down pause menu', `pause menu ${pauseOpen ? 'open' : 'closed'}  panel ${p.exists ? (p.visible ? 'visible' : 'hidden') : 'not built'}`);

  // m) CLOSE on a straight at speed (1470x830 @2x): sky rows at the top are at most 12 % of the screen (GDD 1.13.1)
  const p2 = await browser.newPage({ viewport: { width: 1470, height: 830 }, deviceScaleFactor: 2 });
  p2.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await p2.goto(FILE); await p2.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const v0 = await p2.evaluate(() => {
    const S = window.__sgp; try { localStorage.removeItem('sgp_cam'); localStorage.removeItem('sgp_cam_close'); } catch (e) { }
    S.UI.opts.cam = 'close'; S.UI.opts.train = 'off'; S.UI.launch('practice', {});
    const W = S.W, b = W.player; b.autopilot = true; b.trainHold = false; W.paused = true; let g = 0, hp = b.h, ok = 0;
    while (g < 120 * 300) { // drive until 0.5 s on a straight above 270 km/h
      S.simStep(S.SUB); g++; const yaw = Math.abs(((b.h - hp + 9 * Math.PI) % (2 * Math.PI)) - Math.PI) * 120; hp = b.h;
      ok = b.v > 75 && yaw < 0.02 ? ok + 1 : 0; if (ok > 60) break;
    }
    S.CAM.init = false; // the next frame snaps the zoom to the target for this speed
    return b.v * 3.6;
  });
  await p2.waitForTimeout(300);
  const sk = await p2.evaluate(v => {
    const S = window.__sgp;
    const c = document.getElementById('game'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let rows = 0;
    for (let y = 0; y < c.height; y++) { // a row is sky while at least 1/8 of it is the blue-to-haze sky colour
      let n = 0; for (let x = 0; x < c.width; x += 4) { const i = (y * c.width + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2]; if (B > 150 && B >= G && G >= R - 5 && R > 90) n++; }
      if (n > c.width / 8) rows++; else break;
    }
    return { sky: rows / c.height, v, cam: S.CAM.mode };
  }, v0);
  check(sk.cam === 'close' && sk.v > 270 && sk.sky <= 0.12, 'CLOSE: sky at most 12 % on a straight', `sky ${(sk.sky * 100).toFixed(1)} %  at ${sk.v.toFixed(0)} km/h`);
  await p2.close();

  await browser.close();
  console.log(failed ? `${failed} of ${total} camera tuning checks FAILED` : `all ${total} camera tuning checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
