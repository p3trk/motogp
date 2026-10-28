#!/usr/bin/env node
// Practice ghosts test (GDD 11c, 11d): a ghost-enabled recording rides with the player's timed laps,
// also in curve training (since 1.15.0), and is never shown while riding from the spot to the line.
// v1.14.0 fails it: curve training set up no ghosts at all.
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
    // record a practice session with one completed timed lap on autopilot, and select it as a ghost
    S.UI.opts.mode = 'practice'; S.UI.opts.train = 'off'; S.UI.launch('practice', {});
    W.player.autopilot = true;
    let g = 0; while (W.player.laps.length < 1 && g++ < MAX) S.simStep(S.SUB);
    S.UI.toMenu();
    const id = S.Lib.meta[0] && S.Lib.meta[0].id;
    if (!id) return { err: 'no recording was saved' };
    if (!S.Lib.ghosts.includes(id)) S.Lib.toggleGhost(id);
    // ride from the start (pit box or training spot) until halfway through the first timed lap
    const run = train => {
      S.UI.opts.mode = 'practice'; S.UI.opts.train = train; S.UI.launch('practice', {}); W.player.autopilot = true;
      W.player.trainHold = false; // as if W was pressed on the training spot
      const o = { train: !!W.train, ghosts: W.ghosts.length, beforeLine: false, onLap: false, line: false };
      let g = 0;
      while (g++ < MAX) {
        S.simStep(S.SUB);
        const shown = W.ghosts.some(x => x.show);
        if (W.player.outLap) { if (shown) o.beforeLine = true; continue; }
        o.line = true; if (shown) o.onLap = true;
        if (W.time - W.player.lapStartT > 30) break;
      }
      S.UI.toMenu(); return o;
    };
    return { on: run('on'), off: run('off') };
  });
  await browser.close();
  if (r.err) { console.error('FAIL', r.err); process.exit(1); }
  const checks = [];
  const ck = (name, ok, info) => { checks.push(ok); console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  for (const [k, o] of [['Curve training On', r.on], ['Curve training Off', r.off]]) {
    ck(`${k}: session ${k.endsWith('On') ? 'is' : 'is not'} curve training`, o.train === k.endsWith('On'));
    ck(`${k}: one ghost set up`, o.ghosts === 1, `ghosts=${o.ghosts}`);
    ck(`${k}: player reaches the line`, o.line);
    ck(`${k}: no ghost before the line`, !o.beforeLine);
    ck(`${k}: ghost shown on the first timed lap`, o.onLap);
  }
  const bad = checks.filter(x => !x).length;
  console.log(bad ? `practice_ghosts: ${bad} of ${checks.length} checks failed` : `practice_ghosts: all ${checks.length} checks passed`);
  if (bad) process.exitCode = 1;
})();
