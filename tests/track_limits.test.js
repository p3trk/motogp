#!/usr/bin/env node
// Track limits test (GDD 6a, since 1.20.0): practice laps with a trip beyond the kerb are invalid and never a best;
// kerbs and the strip beside the pit lane are legal. Races (Phase 2, GDD 1.21.0): the count, the warning thresholds, the
// Long Lap loop at Stowe (geometry, serving, 2.5 s top-up, not served), the gain given back and the last lap drop.
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

  // race (Phase 2, since 1.21.0): count, warning, Long Lap, gain given back, last lap drop
  const race = async (kind, fn) => {
    await page.evaluate(k => { window.__sgp.UI.launch(k, {}); }, kind);
    await page.waitForFunction(() => window.__sgp.UI.state === 'play');
    return page.evaluate(fn);
  };
  const r = await race('sprint', () => {
    const { W, T, SURF, trackLimitsX, limitRefX } = window.__sgp;
    const b = W.player; W.phase = 'run'; b.finished = false; b.autopilot = false; b.lap = 2;
    const at = (surf, s, d, t) => { W.time = t; b.surf = surf; b.s = s; b.d = d; trackLimitsX(b); };
    const ref = limitRefX(1000, 1100), out = { ref };
    const cut = (t0, lostBy) => { at(SURF.GRASS, 1000, -20, t0); at(SURF.ASPH, 1100, 0, t0 + ref + lostBy); };
    cut(100, 0.2); out.c1 = { tl: b.tl, pen: b.pen, ll: b.llPend.length };            // lost 0.2 s: counted, no time
    cut(200, 0.8); out.wide = { tl: b.tl, pen: b.pen };                                 // lost 0.8 s: not counted
    cut(300, -0.4); out.c2 = { tl: b.tl, pen: b.pen, ll: b.llPend.length };           // gained 0.4 s: counted, +0.4 s
    cut(400, 0); out.c3 = { tl: b.tl, pen: b.pen, ll: b.llPend.length, until: b.llPend[0] && b.llPend[0].until }; // 3rd: Long Lap
    cut(500, -1.25); out.adv = { tl: b.tl, pen: b.pen, ll: b.llPend.length };         // clear advantage: Long Lap at once
    at(SURF.GRAVEL, 3000, -20, 600); b.crashes++; at(SURF.ASPH, 3200, 0, 600.5); out.crash = { tl: b.tl, pen: b.pen };
    b.lap = W.totalLaps - 2; const p0 = b.pen, n0 = b.llPend.length; cut(700, -1.5); out.late = { pen: b.pen - p0, ll: b.llPend.length - n0 };
    return out;
  });
  const rnd = x => Math.round(x * 10) / 10;
  check('reference time is positive', r.ref > 0, r);
  check('an infraction that lost under 0.5 s is counted without time', r.c1.tl === 1 && r.c1.pen === 0 && r.c1.ll === 0, r.c1);
  check('a slow run wide is not counted', r.wide.tl === 1 && r.wide.pen === 0, r.wide);
  check('a gain is given back as time and counted', r.c2.tl === 2 && rnd(r.c2.pen) === 0.4, r.c2);
  check('10 lap race: the 3rd infraction gives a Long Lap and resets the count', r.c3.tl === 0 && r.c3.ll === 1 && r.c3.until === 5, r.c3);
  check('a clear advantage gives a Long Lap at once, not counted', r.adv.tl === 0 && r.adv.ll === 2 && rnd(r.adv.pen) === 1.7, r.adv);
  check('a crash and respawn is not judged', r.crash.tl === 0 && rnd(r.crash.pen) === 1.7, r.crash);
  check('a Long Lap with fewer than 3 laps left is 3 s at once', rnd(r.late.pen) === 4.5 && r.late.ll === 0, r.late);

  const g = await race('gp', () => {
    const { W, T, SURF, trackLimitsX, limitRefX } = window.__sgp;
    const b = W.player; W.phase = 'run'; b.finished = false; b.autopilot = false; b.lap = 2;
    const ref = limitRefX(1000, 1100), seen = [];
    for (let k = 0; k < 5; k++) { W.time = 100 * k + 100; b.surf = SURF.GRASS; b.s = 1000; b.d = -20; trackLimitsX(b); W.time += ref; b.surf = SURF.ASPH; b.s = 1100; b.d = 0; trackLimitsX(b); seen.push(b.tl + ':' + b.llPend.length); }
    return seen;
  });
  check('Grand Prix: Long Lap at the 5th infraction', JSON.stringify(g) === '["1:0","2:0","3:0","4:0","0:1"]', g);

  const l = await race('sprint', () => {
    const { W, T, SURF, PHYS, trackLimitsX, longLapX, limitRefX, completeLapX } = window.__sgp;
    const b = W.player, LL = T.LL; W.phase = 'run'; b.finished = false; b.autopilot = false; b.lap = 2;
    const out = { len: LL.sB - LL.sA, side: LL.sg };
    // the lane lies on tarmac run-off from end to end, starts and ends at the kerb, and is about 22 m out at the apex
    let onRun = true; for (let s = LL.sA; s <= LL.sB; s += 2) { const i = T.idx(s); if (T.surface(i, s, LL.sg * LL.off(s)) !== SURF.RUN) onRun = false; }
    const i0 = T.idx(LL.sA); out.onRun = onRun; out.endGap = LL.off(LL.sA) - LL.w / 2 - T.EDGE[LL.side][i0] - T.KERB[LL.side][i0];
    out.depth = LL.off(LL.sM) - LL.off(LL.sA);
    // pass through the lane in dur seconds
    const pass = (dur, dOff) => { const t0 = 1000; let tA = -1, tB = -1, prev = LL.sA - 6; for (let k = 0; k <= 160; k++) { const s = LL.sA - 6 + k * (LL.sB - LL.sA + 12) / 160; b.prevS = prev; b.s = s; b.d = LL.sg * (s >= LL.sA && s <= LL.sB ? LL.off(s) + (dOff || 0) : 0); b.surf = T.surface(T.idx(s), s, b.d); W.time = t0 + dur * k / 160; if (tA < 0 && prev < LL.sA && s >= LL.sA) tA = W.time; if (tB < 0 && prev < LL.sB && s >= LL.sB) tB = W.time; longLapX(b); trackLimitsX(b); prev = s; } return tB - tA; };
    const ref = limitRefX(LL.sA, LL.sB); out.ref = ref;
    b.llPend = [{ until: 5 }]; pass(ref + 4); out.slow = { left: b.llPend.length, pen: b.pen, off: b.offT, tl: b.tl };
    b.llPend = [{ until: 5 }]; b.pen = 0; const tf = pass(ref + 1); out.fast = { left: b.llPend.length, pen: b.pen, want: Math.ceil((2.5 - (tf - ref)) * 10 - 1e-6) / 10 };
    b.llPend = [{ until: 5 }]; b.pen = 0; pass(ref + 4, 8); out.missed = { left: b.llPend.length, pen: b.pen };
    b.llPend = [{ until: 3 }]; b.pen = 0; W.time = b.lapStartT + 130; completeLapX(b); out.due = { left: b.llPend.length, pen: b.pen };
    return out;
  });
  check('Long Lap lane is on tarmac run-off from end to end', l.onRun, l);
  check('Long Lap lane starts at the kerb and swings out about 22 m', Math.abs(l.endGap) < 0.6 && l.depth > 15, l);
  check('riding the lane serves the Long Lap and is not a track limits trip', l.slow.left === 0 && l.slow.pen === 0 && l.slow.tl === 0 && l.slow.off < 0, l.slow);
  check('a Long Lap always costs 2.5 s (top-up)', l.fast.left === 0 && l.fast.want > 1 && Math.abs(l.fast.pen - l.fast.want) < 1e-9, l.fast);
  check('missing the lane does not serve it', l.missed.left === 1, l.missed);
  check('a Long Lap not served in its 3 laps is 5 s', l.due.left === 0 && l.due.pen === 5, l.due);

  const d = await race('sprint', () => {
    const { W, applyDropX, standings } = window.__sgp;
    const b = W.player, a = W.bikes.find(x => !x.isPlayer), L = W.totalLaps;
    a.finished = true; a.lap = L; a.finishT = 1300.3; b.finished = true; b.lap = L; b.finishT = 1300; W.finishOrder = [b, a];
    b.dropBehind = a; applyDropX(b); const st = standings();
    return { aFirst: st.indexOf(a) < st.indexOf(b), drop: b.dropPen };
  });
  check('last lap: the player is placed behind the rival', d.aFirst && d.drop > 0.29 && d.drop < 0.31, d);

  await browser.close();
  if (fails.length) { console.log('\n' + fails.length + ' failed'); process.exit(1); }
  console.log('\nall track limits checks passed');
})().catch(e => { console.error(e); process.exit(1); });
