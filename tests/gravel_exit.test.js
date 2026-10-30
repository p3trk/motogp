#!/usr/bin/env node
// Gravel exit test (GDD 5, since 1.23.0): a stopped bike in the gravel rides out at about 20 km/h with feathered throttle;
// with aids off a held throttle digs the rear wheel in; with no throttle the bike stays still; fast bikes still stop hard.
// Usage: node tests/gravel_exit.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const fails = [];
  const check = (name, ok, info) => { console.log((ok ? 'ok    ' : 'FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if (!ok) fails.push(name); };

  const page = await browser.newPage();
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  await page.evaluate(() => { window.__sgp.UI.launch('practice', {}); });
  await page.waitForFunction(() => window.__sgp.UI.state === 'play');

  const r = await page.evaluate(() => {
    const { W, SURF, stepBikeX } = window.__sgp;
    const b = W.player, dt = 1 / 120;
    // ride straight on gravel for `secs`; thr(t) gives the throttle the rider asks for (W ramps as in world.js)
    const ride = (aids, v0, secs, gas) => {
      Object.assign(b, { assist: aids, auto: true, autopilot: false, held: false, crashed: false, v: v0, vs: 0, lean: 0, gear: 1, slip: 0, wheelie: 0, shiftCut: 0, digT: 0, openT: 0 });
      b.ctl.leanT = 0; b.ctl.steer = 0; b.ctl.brk = 0; b.ctl.thr = 0;
      const x0 = b.x, y0 = b.y; let t = 0, vMax = 0, dug = 0;
      for (; t < secs; t += dt) {
        b.surf = SURF.GRAVEL;
        b.ctl.thr = Math.max(0, Math.min(1, b.ctl.thr + (gas(t) ? 7 : -9) * dt));
        stepBikeX(b, dt);
        if (b.crashed) return { crashed: true };
        vMax = Math.max(vMax, b.v); if (b.dig) dug += dt;
      }
      return { kmh: b.v * 3.6, vMaxKmh: vMax * 3.6, moved: Math.hypot(b.x - x0, b.y - y0), dug };
    };
    const tap = t => (t % 0.33) < 0.2; // short presses of W, three a second
    return {
      aidsHeld: ride(true, 0, 10, () => true),
      aidsHeld5s: ride(true, 0, 5, () => true),
      noAidsHeld: ride(false, 0, 10, () => true),
      noAidsTap: ride(false, 0, 15, tap),
      idle: ride(true, 0, 5, () => false),
      fast: (() => { const out = ride(true, 150 / 3.6, 1, () => false); return { ...out, decelG: (150 - out.kmh) / 3.6 / 9.81 }; })(),
    };
  });
  check('aids on, W held: rides out at 18 to 22 km/h', r.aidsHeld.vMaxKmh >= 18 && r.aidsHeld.vMaxKmh <= 22, r.aidsHeld);
  check('aids on, W held: about 20 km/h within 5 s', r.aidsHeld5s.kmh >= 17, r.aidsHeld5s);
  check('aids off, W held: the wheel digs in, under 5 km/h', r.noAidsHeld.vMaxKmh < 5 && r.noAidsHeld.dug > 5, r.noAidsHeld);
  check('aids off, W tapped: at least 15 km/h, never over 22', r.noAidsTap.vMaxKmh >= 15 && r.noAidsTap.vMaxKmh <= 22, r.noAidsTap);
  check('no throttle: a stopped bike does not move', r.idle.moved === 0 && r.idle.kmh === 0, r.idle);
  check('a bike at 150 km/h loses speed at over 0.6 g', r.fast.decelG > 0.6, r.fast);

  await browser.close();
  if (fails.length) { console.error(fails.length + ' check(s) failed'); process.exit(1); }
  console.log('all gravel exit checks passed');
})();
