#!/usr/bin/env node
// Track edge test (GDD 12): no outline drawn beside the track may end square or jump sideways.
// A square end (kerb, run-off, wall or pit lane) shows as a horizontal cut across the screen in the
// Behind camera, in live riding and in replay alike, because both draw the same track geometry.
// Fixed for kerbs in 1.11.3 and for run-off, walls and the pit lane ends in 1.11.4.
// Usage: node tests/track_edges.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
// largest sideways change of each outline between two neighbouring track points (~2 m apart), in m
const LIMITS = { kerb: 0.45, runoff: 2.0, wall: 1.5, pit: 1.5 };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const r = await page.evaluate(LIM => {
    const T = window.__sgp.T, N = T.N, P = T.PIT, out = {};
    const inPit = sr => sr > P.sIn - 2 && sr < P.sOut + 2; // no wall is drawn along the pit lane
    // pit lane outline; builds without P.edge drew the lane from sIn to sOut only, ending square
    const pitEdge = P.edge || ((k, sgn) => { const sr = T.rel(k * T.DS), c = P.center(sr); return c === null ? T.WR[k] : c + sgn * P.halfW(sr); });
    const check = (name, side, f, skip) => {
      const o = out[name] = out[name] || { max: 0, bad: [] };
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N; if (skip && (skip(i) || skip(j))) continue;
        const d = Math.abs(f(j) - f(i)); if (d > o.max) o.max = d;
        if (d > LIM[name]) o.bad.push(`${side} ${name} at ${Math.round(i * T.DS)} m jumps ${f(i).toFixed(2)} -> ${f(j).toFixed(2)} m`);
      }
    };
    for (let s = 0; s < 2; s++) {
      const side = s ? 'left' : 'right', E = T.EDGE[s], K = T.KERB[s], R = T.RUN[s], W = T.WALL[s];
      check('kerb', side, i => K[i]);
      check('runoff', side, i => E[i] + K[i] + (R[i] > 1 ? R[i] : 0));
      check('wall', side, i => W[i], s === 0 ? i => inPit(T.rel(i * T.DS)) : null);
    }
    for (const sgn of [-1, 1]) check('pit', sgn < 0 ? 'inner' : 'outer', k => pitEdge(k, sgn, 0));
    return out;
  }, LIMITS);
  // both modes draw this geometry: make sure the pit exit renders in live riding and in replay without errors
  // (qualifying starts in the pit box; practice starts on the grid since 1.16.0)
  await page.evaluate(() => {
    const S = window.__sgp; S.UI.opts.cam = 'behind'; S.UI.launch('quali', {});
    const W = S.W, b = W.player; b.autopilot = true; W.paused = true; let g = 0;
    while (b.laps.length < 1 && g < 120 * 900) { S.simStep(S.SUB); g++; }
    W.paused = false; S.drawWorldX();
    S.UI.toMenu(); S.RP.open([S.Lib.data[S.Lib.meta[0].id]], 'menu'); S.RP.seek(16); S.drawWorldX(); S.RP.close();
  });
  await browser.close();
  let failed = 0;
  for (const [name, o] of Object.entries(r)) {
    console.log(`${o.bad.length ? 'FAIL' : 'PASS'}  ${name.padEnd(7)} largest step ${o.max.toFixed(2)} m (limit ${LIMITS[name]} m)${o.bad.length ? `, ${o.bad.length} steps over` : ''}`);
    for (const b of o.bad.slice(0, 4)) console.log('      ' + b);
    failed += o.bad.length ? 1 : 0;
  }
  console.log(failed ? `${failed} of ${Object.keys(r).length} outline checks FAILED` : `all ${Object.keys(r).length} outline checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
