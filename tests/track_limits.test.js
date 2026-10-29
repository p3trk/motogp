#!/usr/bin/env node
// Track limits test (GDD 6a, since 1.20.0): practice laps with a trip beyond the kerb are invalid and never a best;
// kerbs and the strip beside the pit lane are legal; in a race a cut gives a time penalty that counts in the result order.
// Usage: node tests/track_limits.test.js [path/to/index.html]   (needs Playwright + Chromium)
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

  // practice: a timed lap with a trip onto the gravel, then a clean lap
  await page.evaluate(() => { window.__sgp.UI.launch('practice', {}); });
  await page.waitForFunction(() => window.__sgp.UI.state === 'play');
  const p = await page.evaluate(() => {
    const { W, T, Records, SURF, trackLimitsX, completeLapX } = window.__sgp;
    const b = W.player; b.outLap = false; b.gridCross = false; b.trainHold = false; b.autopilot = false;
    const at = (surf, s, d) => { b.surf = surf; b.s = s; b.d = d; trackLimitsX(b); };
    const s0 = T.L / 2, out = {};
    at(SURF.KERB, s0, -9); out.kerb = b.lapInv;
    const sp = T.wrapS((T.PIT.flatIn + T.PIT.flatOut) / 2); at(SURF.RUN, sp, T.WR[T.idx(sp)] + 1); out.pitStrip = b.lapInv; at(SURF.ASPH, sp, 0);
    at(SURF.GRAVEL, s0, -20); out.gravel = b.lapInv;
    at(SURF.ASPH, s0 + 30, 0);
    W.time = b.lapStartT + 125; completeLapX(b);
    const e1 = Records.d.laps[Records.d.laps.length - 1];
    out.inv1 = e1.inv; out.best1 = b.bestLap; out.modeBest1 = !!Records.d.best.practice; out.trace1 = Records.d.traceT; out.next = b.lapInv;
    W.time = b.lapStartT + 131; completeLapX(b);
    const e2 = Records.d.laps[Records.d.laps.length - 1];
    out.inv2 = !!e2.inv; out.best2 = b.bestLap; out.trace2 = Records.d.traceT; out.lapsInv = b.lapsInv;
    return out;
  });
  check('kerb is legal', p.kerb === false, p);
  check('the strip beside the pit lane is not judged', p.pitStrip === false, p);
  check('gravel makes the lap invalid', p.gravel === true, p);
  check('invalid lap is saved with inv', p.inv1 === 1, p);
  check('invalid lap is not a session best, mode best or all-time trace', p.best1 === 0 && !p.modeBest1 && !p.trace1, p);
  check('the next lap starts valid', p.next === false, p);
  check('a clean lap is valid and becomes the best', !p.inv2 && Math.abs(p.best2 - 131) < 0.01 && Math.abs(p.trace2 - 131) < 0.01, p);
  check('lap list marks the invalid lap', JSON.stringify(p.lapsInv) === '[true,false]', p);

  // race: a cut, a slow run wide, a crash; then the result order with the penalty
  await page.evaluate(() => { window.__sgp.UI.launch('sprint', {}); });
  await page.waitForFunction(() => window.__sgp.UI.state === 'play');
  const r = await page.evaluate(() => {
    const { W, T, SURF, trackLimitsX, limitRefX, standings } = window.__sgp;
    const b = W.player; W.phase = 'run'; b.finished = false; b.autopilot = false;
    const at = (surf, s, d, t) => { W.time = t; b.surf = surf; b.s = s; b.d = d; trackLimitsX(b); };
    const s0 = 1000, out = { ref: limitRefX(s0, s0 + 100) };
    at(SURF.GRASS, s0, -20, 100); at(SURF.ASPH, s0 + 100, 0, 100 + out.ref * 0.5); out.cut = b.pen;
    at(SURF.RUN, 2000, -20, 200); at(SURF.ASPH, 2020, 0, 205); out.wide = b.pen;
    at(SURF.GRAVEL, 3000, -20, 300); b.crashes++; at(SURF.ASPH, 3200, 0, 300.5); out.crash = b.pen;
    const a = W.bikes.find(x => !x.isPlayer); const L = W.totalLaps;
    a.finished = true; a.lap = L; a.finishT = 1300.5; b.finished = true; b.lap = L; b.finishT = 1300; W.finishOrder = [b, a];
    const st = standings(); out.aFirst = st.indexOf(a) < st.indexOf(b);
    return out;
  });
  const want = Math.ceil((2 + r.ref * 0.5) * 10 - 1e-6) / 10;
  check('reference time is positive', r.ref > 0, r);
  check('a cut gives 2 s + the time gained', Math.abs(r.cut - want) < 1e-9, { ...r, want });
  check('a slow run wide gives no penalty', r.wide === r.cut, r);
  check('a crash and respawn is not judged', r.crash === r.cut, r);
  check('the penalty counts in the result order', r.aFirst, r);

  await browser.close();
  if (fails.length) { console.log('\n' + fails.length + ' failed'); process.exit(1); }
  console.log('\nall track limits checks passed');
})().catch(e => { console.error(e); process.exit(1); });
