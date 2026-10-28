#!/usr/bin/env node
// Camera shake test (GDD 13): drives the real game loop with a fake animation-frame clock,
// records the camera every frame and fails when the camera motion is not smooth.
// Covers live riding and replay (0.25x, 1x, 4x), with the Behind, CLOSE (since 1.14.0) and Top-down cameras.
// Usage: node tests/camera_shake.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
// RMS deviation from a 0.4 s moving average of: camera speed (share of mean speed), camera turn rate (rad/s),
// direction of camera travel (rad/s) and the bike's position on screen (px)
// The window is 0.4 s of game time, so it shrinks with the replay speed (at 4x the track goes by 4x faster).
const LIMITS = { pos: 0.02, rot: 0.08, dir: 0.08, scr: 2.0 }, WIN0 = 12;

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.addInitScript(() => { // fake requestAnimationFrame: the test decides when frames happen
    window.__rafQ = []; window.requestAnimationFrame = cb => { window.__rafQ.push(cb); return 1; };
    window.__tick = t => { const q = window.__rafQ; window.__rafQ = []; for (const cb of q) cb(t); };
    try { localStorage.clear(); } catch (e) { }
  });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  // frame helper inside the page: run n frames of ~60 fps with a little timing jitter, record the camera
  await page.evaluate(() => {
    let t = 1000, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    window.__tick(t);
    window.__run = n => {
      const S = window.__sgp, C = S.CAM, out = [];
      for (let k = 0; k < n; k++) {
        const dt = 1000 / 60 + (rnd() - 0.5) * 3; t += dt; window.__tick(t);
        const b = S.W.player, sc = S.worldToScreenX(b.x, b.y);
        out.push({ dt: dt / 1000, x: C.x, y: C.y, rot: C.rot, sx: sc[0], sy: sc[1] });
      }
      return out;
    };
  });
  const metrics = (rec, speed) => {
    const WIN = Math.max(2, Math.round(WIN0 / speed));
    const sp = [], om = [], dir = [], sx = [], sy = [];
    const wrap = d => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    let pa = null;
    for (let k = 1; k < rec.length; k++) {
      const a = rec[k - 1], b = rec[k], dx = b.x - a.x, dy = b.y - a.y;
      sp.push(Math.hypot(dx, dy) / b.dt); om.push(wrap(b.rot - a.rot) / b.dt);
      const ang = Math.atan2(dy, dx); dir.push(pa === null ? 0 : wrap(ang - pa) / b.dt); pa = ang;
      sx.push(b.sx); sy.push(b.sy);
    }
    dir.shift();
    const dev = arr => { const r = []; for (let k = WIN; k < arr.length - WIN; k++) { let m = 0; for (let j = -WIN; j <= WIN; j++) m += arr[k + j]; m /= 2 * WIN + 1; r.push(arr[k] - m); } return r; };
    const rms = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
    const mean = sp.reduce((s, x) => s + x, 0) / sp.length;
    const ex = dev(sx), ey = dev(sy);
    return { pos: rms(dev(sp)) / Math.max(1, mean), rot: rms(dev(om)), dir: rms(dev(dir)), scr: Math.sqrt(rms(ex) ** 2 + rms(ey) ** 2), mean };
  };
  const results = [];
  const check = (name, rec, speed = 1) => {
    const m = metrics(rec, speed), bad = Object.keys(LIMITS).filter(k => m[k] > LIMITS[k]); results.push(!bad.length);
    console.log(`${bad.length ? 'FAIL' : 'PASS'}  ${name.padEnd(20)} speed ${(m.pos * 100).toFixed(2)}%  turn ${m.rot.toFixed(3)}  direction ${m.dir.toFixed(3)}  screen ${m.scr.toFixed(2)} px  (${(m.mean * 3.6).toFixed(0)} km/h)${bad.length ? '  over limit: ' + bad.join(', ') : ''}`);
  };
  console.log(`limits: speed ${LIMITS.pos * 100}%, turn ${LIMITS.rot} rad/s, direction ${LIMITS.dir} rad/s, screen ${LIMITS.scr} px`);

  // record one lap with the AI riding the player's bike (fast, outside the frame loop); qualifying starts
  // from the pit box as practice did before 1.16.0, so the replay checks cover the same part of the lap
  await page.evaluate(() => {
    const S = window.__sgp; S.UI.opts.mode = 'practice'; S.UI.launch('quali', {});
    const W = S.W, b = W.player; b.autopilot = true; W.paused = true; let g = 0;
    while (b.laps.length < 1 && g < 120 * 900) { S.simStep(S.SUB); g++; }
    W.paused = false;
  });
  for (const cam of ['behind', 'close', 'chase']) {
    // live riding: AI on the player's bike, through Copse and Maggotts/Becketts
    await page.evaluate(cam => { const S = window.__sgp; S.UI.opts.cam = cam; S.UI.opts.train = 'on'; S.UI.opts.trainS = 1450 * S.T.DS - 400; S.UI.opts.trainV = 250; S.UI.launch('practice', {}); const b = S.W.player; b.trainHold = false; b.autopilot = true; }, cam);
    await page.evaluate(() => window.__run(30));
    check(`live ${cam}`, await page.evaluate(() => window.__run(480)));
    // replay of the recorded lap
    for (const speed of [0.25, 1, 4]) {
      await page.evaluate(([cam, speed]) => { const S = window.__sgp; S.UI.toMenu(); const R = S.Lib.data[S.Lib.meta[0].id]; S.RP.open([R], 'menu'); S.setCamModeX(cam); S.RP.seek(40); S.RP.setSpeed(speed); }, [cam, speed]);
      await page.evaluate(() => window.__run(30));
      check(`replay ${cam} ${speed}x`, await page.evaluate(n => window.__run(n), speed === 4 ? 240 : 480), speed);
      await page.evaluate(() => window.__sgp.RP.close());
    }
  }
  await browser.close();
  const failed = results.filter(r => !r).length;
  console.log(failed ? `${failed} of ${results.length} camera checks FAILED` : `all ${results.length} camera checks passed`);
  if (failed) process.exitCode = 1;
})();
