#!/usr/bin/env node
// Behind camera tuning test (GDD 11a): the pause menu shows a Camera tuning panel with the Behind camera only.
// It has 12 sliders, each with a number box; changed values apply to the camera at once, are kept after a
// reload (localStorage 'sgp_cam'), and Reset to defaults brings back the built-in values.
// Since 1.13.0: a profile list (Standard, Close, Custom); a profile sets all sliders, a moved slider shows
// Custom, the profile is kept after a reload, Reset to defaults = Standard, old saved data still loads.
// Since 1.13.1: with Close at 1470x830 @2x, sky is at most 12 % of the screen on a straight at speed.
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
  const check = (ok, name, info) => { total++; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(44)} ${info || ''}`); };
  const ready = () => page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const tilt = () => page.evaluate(() => Object.assign({}, window.__sgp.TILT));
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const isProf = (T, V) => Object.keys(V).every(k => near(T[k], V[k] * (UNIT[k] || 1)));
  const isDef = T => isProf(T, DEF);
  const prof = () => page.evaluate(() => { const b = document.querySelector('#camProfile [aria-pressed="true"]'); return { name: window.__sgp.camProfX(), shown: b ? b.dataset.prof : null, chips: [...document.querySelectorAll('#camProfile button')].map(c => c.textContent) }; });
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

  // f) profile list: Standard / Close / Custom, Standard after Reset to defaults
  await pauseBehind();
  let pr = await prof();
  check(pr.chips.join() === 'Standard,Close,Custom' && pr.shown === 'standard' && pr.name === 'standard', 'profile list, Standard selected', `chips ${pr.chips.join('/')}  selected ${pr.shown}`);

  // g) Close sets all values (and a bigger main canvas for near quality 1.5 on a 2x screen is tested by tilt_seam)
  await page.locator('#camProfile button', { hasText: 'Close' }).click();
  T = await tilt(); pr = await prof();
  const shownA = await page.$eval('#cam_a', el => +el.value);
  check(isProf(T, CLOSE) && pr.shown === 'close' && shownA === CLOSE.a, 'Close sets all 12 values', `${fmt(T)}  tilt slider ${shownA}  selected ${pr.shown}`);

  // h) moving a slider afterwards shows Custom
  await page.evaluate(() => { const rg = document.getElementById('cam_zK'); rg.value = 0.8; rg.dispatchEvent(new Event('input', { bubbles: true })); });
  pr = await prof(); T = await tilt();
  check(pr.shown === 'custom' && pr.name === 'custom' && near(T.zK, 0.8), 'moved slider shows Custom', `selected ${pr.shown}  zoom speed factor ${T.zK}`);

  // i) profile kept after a reload
  await page.locator('#camProfile button', { hasText: 'Close' }).click();
  await page.reload(); await ready();
  await pauseBehind();
  T = await tilt(); pr = await prof();
  check(pr.name === 'close' && pr.shown === 'close' && isProf(T, CLOSE), 'Close profile kept after a reload', `profile ${pr.name}  ${fmt(T)}`);

  // j) Reset to defaults gives Standard
  await page.locator('#pauseCam button', { hasText: 'Reset to defaults' }).click();
  T = await tilt(); pr = await prof();
  check(pr.name === 'standard' && pr.shown === 'standard' && isDef(T), 'Reset to defaults gives Standard', `profile ${pr.name}  ${fmt(T)}`);

  // k) data saved by 1.12.0 (no profile name): defaults load as Standard, other values as Custom
  const old = async v => { await page.evaluate(v => localStorage.setItem('sgp_cam', JSON.stringify(v)), v); await page.reload(); await ready(); return page.evaluate(() => [window.__sgp.camProfX(), window.__sgp.TILT.a]); };
  const o1 = await old(DEF), o2 = await old(Object.assign({}, DEF, { a: 50 }));
  check(o1[0] === 'standard' && o2[0] === 'custom' && near(o2[1], 50 * DEG), 'old saved data loads (Standard / Custom)', `defaults -> ${o1[0]}  tilt 50 -> ${o2[0]}`);
  await page.evaluate(() => localStorage.removeItem('sgp_cam')); await page.reload(); await ready();

  // e) hidden with the Top-down camera (panel built first in a Behind pause, then a Top-down session paused)
  await pauseBehind();
  await page.evaluate(() => window.__sgp.UI.togglePause());
  await page.evaluate(() => { const S = window.__sgp; S.UI.opts.cam = 'chase'; S.UI.opts.train = 'off'; S.UI.launch('practice', {}); S.setCamModeX('chase'); });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__sgp.W.paused);
  p = await panel();
  const pauseOpen = await page.$eval('#pause', el => !el.hidden);
  check(pauseOpen && !p.visible, 'panel hidden in the Top-down pause menu', `pause menu ${pauseOpen ? 'open' : 'closed'}  panel ${p.exists ? (p.visible ? 'visible' : 'hidden') : 'not built'}`);

  // l) Close on a straight at speed (1470x830 @2x): sky rows at the top are at most 12 % of the screen (GDD 1.13.1)
  const p2 = await browser.newPage({ viewport: { width: 1470, height: 830 }, deviceScaleFactor: 2 });
  p2.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await p2.goto(FILE); await p2.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const v0 = await p2.evaluate(() => {
    const S = window.__sgp; try { localStorage.removeItem('sgp_cam'); } catch (e) { }
    S.UI.opts.cam = 'behind'; S.UI.opts.train = 'off'; S.UI.launch('practice', {}); S.setCamModeX('behind'); S.setCamProfileX('close');
    const W = S.W, b = W.player; b.autopilot = true; W.paused = true; let g = 0, hp = b.h, ok = 0;
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
    return { sky: rows / c.height, v, prof: S.camProfX() };
  }, v0);
  check(sk.prof === 'close' && sk.v > 270 && sk.sky <= 0.12, 'Close: sky at most 12 % on a straight', `sky ${(sk.sky * 100).toFixed(1)} %  at ${sk.v.toFixed(0)} km/h`);
  await p2.close();

  await browser.close();
  console.log(failed ? `${failed} of ${total} camera tuning checks FAILED` : `all ${total} camera tuning checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
