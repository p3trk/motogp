#!/usr/bin/env node
// Kerb end test (GDD 12): kerbs must narrow to nothing over their first and last 8 m, never end square.
// A square end made the kerb and the gravel / run-off edge next to it jump sideways on one line across
// the track, which looked like a horizontal cut through the screen (fixed in 1.11.3).
// Usage: node tests/kerb_ends.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const MAX_STEP = 0.45; // m: largest change of kerb width between two neighbouring track points (~2 m apart)

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const r = await page.evaluate(MAX => {
    const T = window.__sgp.T, N = T.N, out = { ends: 0, bad: [] };
    for (let s = 0; s < 2; s++) {
      const K = T.KERB[s];
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N, step = Math.abs(K[j] - K[i]);
        if ((K[i] > 0) !== (K[j] > 0)) out.ends++;
        if (step > MAX) out.bad.push({ side: s ? 'left' : 'right', at: Math.round(i * T.DS), from: +K[i].toFixed(2), to: +K[j].toFixed(2) });
      }
    }
    return out;
  }, MAX_STEP);
  await browser.close();
  console.log(`kerb ends checked: ${r.ends}, limit ${MAX_STEP} m per track point`);
  for (const b of r.bad.slice(0, 10)) console.log(`FAIL  ${b.side} kerb at ${b.at} m jumps ${b.from} -> ${b.to} m`);
  if (r.bad.length) { console.log(`${r.bad.length} square kerb ends FAILED`); process.exitCode = 1; }
  else console.log('PASS  all kerb ends narrow smoothly');
})();
