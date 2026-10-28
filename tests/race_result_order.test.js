#!/usr/bin/env node
// Race result order test (GDD 11, since 1.19.4): finishers are ranked by laps completed first, then by the order they
// crossed the line. A rider who crosses the line after the flag a lap down must not be listed above a lead-lap rider.
// Usage: node tests/race_result_order.test.js [path/to/index.html]   (needs Playwright + Chromium)
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

  // a 10 lap race; then the finish is faked: the winner and the 2nd place finish on the lead lap, the 3rd place is a lap
  // down and crosses the line after the flag (the bad order before 1.19.4 listed it above the lead-lap rider who crossed later)
  await page.evaluate(() => { window.__sgp.UI.launch('sprint', {}); });
  await page.waitForFunction(() => window.__sgp.UI.state === 'play');
  const r = await page.evaluate(() => {
    const { W, standings } = window.__sgp;
    const [a, b, c, d] = W.bikes.filter(x => !x.isPlayer).slice(0, 3).concat([W.player]);
    const L = W.totalLaps;
    a.finished = true; a.lap = L; W.finishOrder.push(a);
    d.finished = true; d.lap = L; W.finishOrder.push(d);
    c.finished = true; c.lap = L - 1; W.finishOrder.push(c);
    b.finished = false; b.lap = L; b.progress = 0;
    // finish order: winner a, then the lapped rider c (crossed the line first), then lead-lap rider d
    W.finishOrder = [a, c, d];
    const st = standings();
    return { order: st.map(x => x.name), laps: st.map(x => x.lap), c: c.name, d: d.name, a: a.name };
  });
  const idxC = r.order.indexOf(r.c), idxD = r.order.indexOf(r.d);
  check('lapped rider is below the lead-lap rider who crossed after him', idxD < idxC, r);
  check('winner stays first', r.order[0] === r.a, r);

  await browser.close();
  if (fails.length) { console.log('\n' + fails.length + ' failed'); process.exit(1); }
  console.log('\nall race result order checks passed');
})().catch(e => { console.error(e); process.exit(1); });
