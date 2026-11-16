#!/usr/bin/env node
// Bike drawing per camera test (GDD 11i): on the real screen, in Top-down, Behind and CLOSE, the bike keeps the
// proportions of its drawing (the stretch cancels the camera's squash), a bike turned 20 degrees shows turned about
// 20 degrees, lean moves the rider to the inside, and drawing a 22-bike field costs at most 5 % of the frame.
// The bike is in the Viola Corse livery, the only violet on the track, and is found by its colour.
// Usage: node tests/bike_views.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const VIOLA = 6; // Viola Corse, #6a2bd9

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let failed = 0, total = 0;
  const check = (ok, name, info) => { total++; if (!ok) { failed++; } console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} ${info || ''}`); };
  const page = await browser.newPage({ viewport: { width: 1470, height: 830 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto(FILE); await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  await page.evaluate(team => {
    for (const k of ['sgp_cam', 'sgp_cam_close', 'sgp_opts']) localStorage.removeItem(k);
    const violet = (r, g, b) => r > g + 30 && b > r + 50 && b > 90;
    // bounding box, centre and main axis (degrees from the screen's up direction) of the violet pixels
    const blob = (d, w, h) => {
      let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4; if (!violet(d[i], d[i + 1], d[i + 2])) continue;
        n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const cx = sx / n, cy = sy / n, vxx = sxx / n - cx * cx, vyy = syy / n - cy * cy, vxy = sxy / n - cx * cy;
      return { n, cx, cy, w: x1 - x0 + 1, h: y1 - y0 + 1, ang: 90 - 0.5 * Math.atan2(2 * vxy, vxx - vyy) * 180 / Math.PI };
    };
    window.__screen = () => { const c = document.getElementById('game'); return blob(c.getContext('2d').getImageData(0, 0, c.width, c.height).data, c.width, c.height); };
    // the drawing itself, chassis and rider together, bike pointing +x: length along x, width along y
    window.__drawing = view => {
      const sp = window.__sgp.bikeSpriteX(team, window.__sgp.W.player.num, view), c = document.createElement('canvas');
      c.width = sp.c.width; c.height = sp.c.height; const g = c.getContext('2d'); g.drawImage(sp.c, 0, 0); g.drawImage(sp.r, 0, 0);
      const b = blob(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height); return { len: b.w, wid: b.h };
    };
    window.__place = cam => { // standing on the Hangar Straight, no speed effects, camera settled
      const S = window.__sgp, T = S.T, c = T.corners.find(c => c.name === 'Hangar Straight');
      S.UI.opts.mode = 'practice'; S.UI.opts.cam = cam; S.UI.opts.fx = 'off'; S.UI.opts.blur = 'off'; S.UI.opts.train = 'on'; S.UI.opts.trainS = T.wrapS(c.s + 200); S.UI.opts.trainV = 0;
      S.UI.launch('practice', {}); S.setCamModeX(cam); const b = S.W.player; b.team = team; b.v = 0; b.lean = 0; b.trainHold = true;
      // Behind shows the bike small and at lower quality: zoom in and sharpen as far as CLOSE, so there are enough pixels to measure
      if (cam === 'behind') { Object.assign(S.TILT, { zMax: 30, zBase: 12, nearQ: 1.5 }); S.resizeX(); S.CAM.init = false; }
    };
    // draw once with the bike changed, measure, put it back (no frame runs in between, so the camera stays)
    window.__drawWith = ch => { const S = window.__sgp, b = S.W.player, keep = { h: b.h, lean: b.lean }; Object.assign(b, ch); S.drawWorldX(); const r = window.__screen(); Object.assign(b, keep); return r; };
  }, VIOLA);

  for (const cam of ['chase', 'behind', 'close']) {
    await page.evaluate(cam => window.__place(cam), cam); await page.waitForFunction(() => window.__sgp.CAM.init); // the camera has snapped to the bike
    const r = await page.evaluate(cam => {
      const S = window.__sgp, view = { chase: 'top', behind: 'behind', close: 'close' }[cam], b = S.W.player;
      const d = window.__drawing(view), s0 = window.__drawWith({}), s20 = window.__drawWith({ h: b.h + 20 * Math.PI / 180 });
      const right = window.__drawWith({ lean: 0.7 }), left = window.__drawWith({ lean: -0.7 });
      return { draw: d.len / d.wid, screen: s0.h / s0.w, turn: (d => Math.min(d, 180 - d))(Math.abs(s20.ang - s0.ang) % 180), dxR: right.cx - s0.cx, dxL: left.cx - s0.cx, n: s0.n };
    }, cam);
    check(r.n > 500 && Math.abs(r.screen / r.draw - 1) <= 0.1, `${cam}: on-screen proportions of the drawing (10 %)`, `screen ${r.screen.toFixed(2)}, drawing ${r.draw.toFixed(2)}, ${r.n} px`);
    check(Math.abs(r.turn - 20) <= 4, `${cam}: turned 20 deg shows about 20 deg`, `${r.turn.toFixed(1)} deg`);
    check(r.dxR > 2 && r.dxL < -2, `${cam}: lean moves the rider to the inside`, `right ${r.dxR.toFixed(1)} px, left ${r.dxL.toFixed(1)} px`);
  }

  // frame cost: 22 bikes spread along the straight ahead in CLOSE, against the same frame with no bikes. On a fresh
  // page: reading pixels back (above) moves Chrome's canvases to slower software drawing, which is not the game's cost
  const fresh = await browser.newPage({ viewport: { width: 1470, height: 830 }, deviceScaleFactor: 2 });
  await fresh.goto(FILE); await fresh.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const cost = await fresh.evaluate(() => {
    for (const k of ['sgp_cam', 'sgp_cam_close', 'sgp_opts']) localStorage.removeItem(k);
    const S = window.__sgp, T = S.T, c = T.corners.find(c => c.name === 'Hangar Straight');
    S.UI.opts.mode = 'practice'; S.UI.opts.cam = 'close'; S.UI.opts.fx = 'off'; S.UI.opts.blur = 'off'; S.UI.opts.train = 'on'; S.UI.opts.trainS = T.wrapS(c.s + 200); S.UI.opts.trainV = 0;
    S.UI.launch('practice', {}); S.setCamModeX('close'); const me = S.W.player, field = [me];
    for (let k = 1; k < 22; k++) { const i = (me.i + 4 * k) % T.N, d = (k % 2 ? -3 : 3), [x, y] = T.pt(i, d); field.push(Object.assign(Object.create(Object.getPrototypeOf(me)), me, { x, y, h: T.H[i], i, team: k % 11, num: 10 + k, lean: (k % 3 - 1) * 0.5 })); }
    const time = list => { S.W.bikes = list; let best = 1e9; for (let r = 0; r < 5; r++) { const t0 = performance.now(); for (let k = 0; k < 20; k++) { S.drawWorldX(); } best = Math.min(best, (performance.now() - t0) / 20); } return best; };
    S.W.bikes = field; for (let k = 0; k < 120; k++) S.drawWorldX(); // road tiles and bike drawings made first
    const runs = [0, 1, 2].map(() => { const w = time(field), wo = time([]); return { withBikes: w, without: wo, share: (w - wo) / w }; }).sort((a, b) => a.share - b.share);
    S.W.bikes = [me]; return runs[1]; // the middle of three runs
  });
  check(cost.share <= 0.05, 'frame cost: 22 bikes at most 5 % of the CLOSE frame', `${(cost.share * 100).toFixed(1)} % (${cost.withBikes.toFixed(2)} ms with, ${cost.without.toFixed(2)} ms without)`);

  console.log(failed ? `bike views: ${failed} of ${total} checks failed` : `bike views: all ${total} checks passed`);
  await browser.close();
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
