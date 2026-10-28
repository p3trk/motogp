#!/usr/bin/env node
// Behind camera tuning test (GDD 11a): the pause menu shows a Camera tuning panel with the Behind camera only.
// It has 12 sliders, each with a number box; changed values apply to the camera at once, are kept after a
// reload (localStorage 'sgp_cam'), and Reset to defaults brings back the built-in values.
// Usage: node tests/camera_tuning.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const DEG = Math.PI / 180;
// defaults in display units (tilt in degrees, bike height and fade zone in %)
const DEF = { a: 40, p: 1.3, bike: 20, zMax: 20, zBase: 30, zK: 1.0, wk: 2.3, hk: 2.6, nearQ: 0.75, farQ: 0.45, fade: 30, minLen: 40 };
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
  const isDef = T => Object.keys(DEF).every(k => near(T[k], DEF[k] * (UNIT[k] || 1)));
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

  // e) hidden with the Top-down camera (panel built first in a Behind pause, then a Top-down session paused)
  await pauseBehind();
  await page.evaluate(() => window.__sgp.UI.togglePause());
  await page.evaluate(() => { const S = window.__sgp; S.UI.opts.cam = 'chase'; S.UI.opts.train = 'off'; S.UI.launch('practice', {}); S.setCamModeX('chase'); });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__sgp.W.paused);
  p = await panel();
  const pauseOpen = await page.$eval('#pause', el => !el.hidden);
  check(pauseOpen && !p.visible, 'panel hidden in the Top-down pause menu', `pause menu ${pauseOpen ? 'open' : 'closed'}  panel ${p.exists ? (p.visible ? 'visible' : 'hidden') : 'not built'}`);

  await browser.close();
  console.log(failed ? `${failed} of ${total} camera tuning checks FAILED` : `all ${total} camera tuning checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
