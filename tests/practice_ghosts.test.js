#!/usr/bin/env node
// Practice ghosts test (GDD 11c): the ghost of a practice recording without a standing start rides with the
// player's timed laps from the first line crossing. Since 1.16.0 practice starts on the grid (Curve training Off),
// so no such ghost is shown on the standing lap before the line; the curve-training spot start is checked in
// practice_start.test.js (the ghost is now shown on the spot, which replaced the 1.15.0 rule).
// Usage: node tests/practice_ghosts.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const r = await page.evaluate(() => {
    const S = window.__sgp, W = S.W, MAX = 400 * 240;
    // record a practice session from a curve-training spot (no standing start) with one completed timed lap on autopilot
    S.UI.opts.mode = 'practice'; S.UI.opts.train = 'on'; S.UI.launch('practice', {});
    W.player.autopilot = true; W.player.trainHold = false;
    let g = 0; while (W.player.laps.length < 1 && g++ < MAX) S.simStep(S.SUB);
    S.UI.toMenu();
    const id = S.Lib.meta[0] && S.Lib.meta[0].id;
    if (!id) return { err: 'no recording was saved' };
    S.Lib.ghosts.slice().forEach(x => S.Lib.toggleGhost(x)); S.Lib.toggleGhost(id);
    // Curve training Off: start on the grid and ride until 30 s past the first line crossing
    S.UI.opts.train = 'off'; S.UI.launch('practice', {}); W.player.autopilot = true;
    W.player.trainHold = false; // as if W was pressed on the grid
    const o = { train: !!W.train, grid: W.gridStart, ghosts: W.ghosts.length, kind: W.ghosts[0] && W.ghosts[0].sync, beforeLine: false, onLap: false, line: false };
    g = 0;
    while (g++ < MAX) {
      S.simStep(S.SUB);
      const shown = W.ghosts.some(x => x.show);
      if (W.lineT < 0) { if (shown) o.beforeLine = true; continue; }
      o.line = true; if (shown) o.onLap = true;
      if (W.time - W.lineT > 30) break;
    }
    S.UI.toMenu(); return o;
  });
  await browser.close();
  if (r.err) { console.error('FAIL', r.err); process.exit(1); }
  const checks = [];
  const ck = (name, ok, info) => { checks.push(ok); console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  ck('Curve training Off: practice starts on the grid', !r.train && r.grid);
  ck('one ghost set up, waiting for the line', r.ghosts === 1 && r.kind === 'line', `ghosts=${r.ghosts} sync=${r.kind}`);
  ck('player reaches the line', r.line);
  ck('no ghost before the first line crossing', !r.beforeLine);
  ck('ghost shown from the first line crossing', r.onLap);
  const bad = checks.filter(x => !x).length;
  console.log(bad ? `practice_ghosts: ${bad} of ${checks.length} checks failed` : `practice_ghosts: all ${checks.length} checks passed`);
  if (bad) process.exitCode = 1;
})();
