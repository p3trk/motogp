#!/usr/bin/env node
// Behind camera seam test (GDD 11a): the tilted view is built from two ground images (near band at full
// detail, far band at lower resolution) projected onto the screen in thin horizontal strips. Straight lines
// on the ground must stay straight on screen, with no kink where the strips or the two bands join.
// Draws a test pattern of straight lines through the real projection, in live riding and in replay, and
// measures how far each line bends sharply from one screen row to the next.
// Usage: node tests/tilt_seam.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const LIMIT = 0.5; // px: largest sharp bend of a straight line between neighbouring screen rows
const SIZES = [[1280, 800, 1], [1470, 830, 2], [1024, 700, 1]];

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let failed = 0, total = 0;
  for (const [w, h, sf] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: sf });
    page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
    await page.goto(FILE);
    await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
    const measure = () => page.evaluate(() => {
      const S = window.__sgp;
      // pattern: black ground with white lines along the view direction and diagonals, in ground-canvas pixels
      const G = S.tiltProjectX((g, RW, RH) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, RW, RH); g.strokeStyle = '#fff'; g.lineWidth = 3;
        for (let n = -10; n <= 10; n++) { g.beginPath(); g.moveTo(RW / 2 + n * 70, 0); g.lineTo(RW / 2 + n * 70 + n * 40, RH); g.stroke(); }
      });
      const c = document.getElementById('game'), ctx = c.getContext('2d'), k = c.width / G.VW;
      const P = 1.3 * G.VH, a = 40 * Math.PI / 180, uTop = G.RH * Math.cos(a) * P / (P + G.RH * Math.sin(a));
      const y0 = Math.ceil((G.VH - uTop + 25) * k), y1 = Math.floor((G.VH - 4) * k), Wd = c.width;
      const img = ctx.getImageData(0, y0, Wd, y1 - y0).data, lum = (x, y) => { const i = (y * Wd + x) * 4; return img[i] + img[i + 1] + img[i + 2]; };
      // follow each line upwards from the bottom row by its brightness centroid
      const bottom = y1 - y0 - 1, starts = [];
      for (let x = 2; x < Wd - 2; x++) if (lum(x, bottom) > 300 && lum(x - 1, bottom) <= lum(x, bottom) && lum(x + 1, bottom) < lum(x, bottom)) starts.push(x);
      let worst = 0, worstY = 0;
      for (const x0 of starts) {
        let x = x0; const xs = [];
        for (let y = bottom; y >= 0; y--) {
          let sw = 0, sx = 0; const r = Math.max(3, Math.round(4 * k));
          for (let q = Math.max(0, Math.round(x) - r); q <= Math.min(Wd - 1, Math.round(x) + r); q++) { const v = Math.max(0, lum(q, y) - 150); sw += v; sx += v * q; }
          if (sw < 200) break; x = sx / sw; xs.push([y, x]);
        }
        for (let i = 2; i < xs.length - 2; i++) { // sharp bend: a row's step against the steps two rows away
          const d = Math.abs((xs[i + 1][1] - xs[i][1]) - ((xs[i + 2][1] - xs[i - 2][1]) / 4)) / k;
          if (d > worst) { worst = d; worstY = (xs[i][0] + y0) / k; }
        }
      }
      return { lines: starts.length, worst, worstY: Math.round(worstY) };
    });
    // live riding (Behind camera), then replay of the recorded lap
    await page.evaluate(() => {
      const S = window.__sgp; S.UI.opts.cam = 'behind'; S.UI.opts.train = 'off'; S.UI.launch('practice', {}); S.setCamModeX('behind');
      const W = S.W, b = W.player; b.autopilot = true; W.paused = true; let g = 0;
      while (b.laps.length < 1 && g < 120 * 900) { S.simStep(S.SUB); g++; }
      W.paused = false; S.drawWorldX();
    });
    const live = await measure();
    await page.evaluate(() => { const S = window.__sgp; S.UI.toMenu(); S.RP.open([S.Lib.data[S.Lib.meta[0].id]], 'menu'); S.setCamModeX('behind'); S.RP.seek(40); S.drawWorldX(); });
    const rep = await measure();
    for (const [name, m] of [['live', live], ['replay', rep]]) {
      total++; const bad = m.lines < 5 || m.worst > LIMIT; if (bad) failed++;
      console.log(`${bad ? 'FAIL' : 'PASS'}  ${(name + ' ' + w + 'x' + h + ' @' + sf + 'x').padEnd(24)} lines ${m.lines}  sharpest bend ${m.worst.toFixed(2)} px at screen row ${m.worstY} (limit ${LIMIT} px)`);
    }
    await page.close();
  }
  await browser.close();
  console.log(failed ? `${failed} of ${total} seam checks FAILED` : `all ${total} seam checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
