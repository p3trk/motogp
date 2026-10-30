#!/usr/bin/env node
// Sense of speed test (GDD 11h): closer zoom at speed (Behind and CLOSE), wider view above 200 km/h with the horizon
// kept in place, no canvas reallocation while the speed changes, speed lines above 280 km/h, camera vibration at
// speed (none at rest, when paused or with Speed effects Off; at most 2 x vib on a kerb at top speed), trackside
// distance posts on the grass along the straights, and the frame cost limit (10 % over the 1.23.0 settings).
// Usage: node tests/speed_feel.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const COST = 0.10; // largest share 1.24.0 may add to drawing the world at top speed

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let failed = 0, total = 0;
  const check = (ok, name, info) => { total++; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(56)} ${info || ''}`); };
  const open = async (w, h, sf) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: sf });
    page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
    // fake requestAnimationFrame: the test decides when frames happen (as in speed_blur)
    await page.addInitScript(() => {
      window.__rafQ = []; window.requestAnimationFrame = cb => { window.__rafQ.push(cb); return 1; };
      window.__tick = t => { const q = window.__rafQ; window.__rafQ = []; for (const cb of q) cb(t); };
      // count canvas size changes
      window.__resizes = 0; const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
      Object.defineProperty(HTMLCanvasElement.prototype, 'width', { get() { return d.get.call(this); }, set(v) { window.__resizes++; d.set.call(this, v); } });
    });
    await page.goto(FILE); await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
    await page.evaluate(() => {
      for (const k of ['sgp_cam', 'sgp_cam_close', 'sgp_opts']) localStorage.removeItem(k);
      const S = window.__sgp; let t = 1000; window.__tick(t);
      window.__frame = snap => { t += 1000 / 60; if (snap) S.CAM.init = false; window.__tick(t); };
      window.__place = (cam, kmh, fx) => { // practice spot start on the Hangar Straight, held at this speed
        const T = S.T, c = T.corners.find(c => c.name === 'Hangar Straight');
        S.UI.opts.mode = 'practice'; S.UI.opts.cam = cam; S.UI.opts.fx = fx || 'on'; S.UI.opts.train = 'on'; S.UI.opts.trainS = T.wrapS(c.s + 200); S.UI.opts.trainV = 100;
        S.UI.launch('practice', {}); S.setCamModeX(cam);
        const b = S.W.player; b.v = kmh / 3.6; b.trainHold = true;
        for (let k = 0; k < 60; k++) window.__frame(true);
      };
      window.__sky = () => { // rows at the top that are sky (as in camera_tuning)
        const c = document.getElementById('game'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let rows = 0;
        for (let y = 0; y < c.height; y++) { let n = 0; for (let x = 0; x < c.width; x += 4) { const i = (y * c.width + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2]; if (B > 150 && B >= G && G >= R - 5 && R > 90) n++; } if (n > c.width / 8) rows++; else break; }
        return rows / c.height;
      };
    });
    return page;
  };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;

  const page = await open(1470, 830, 2);
  // 1) zoom at 160 and 320 km/h on the 1470 x 830 screen (GDD 11h table)
  const zoom = await page.evaluate(() => { const out = {}; for (const cam of ['behind', 'close']) for (const kmh of [160, 320]) { window.__place(cam, kmh); out[cam + kmh] = window.__sgp.CAM.ppm; } return out; });
  check(near(zoom.behind160, 19.9, 0.15) && near(zoom.behind320, 13.9, 0.15), 'Behind zoom 19.9 / 13.9 px/m at 160 / 320 km/h', `${zoom.behind160.toFixed(2)} / ${zoom.behind320.toFixed(2)} px/m`);
  check(near(zoom.close160, 30, 0.01) && near(zoom.close320, 26.8, 0.15), 'CLOSE zoom 30 / 26.8 px/m at 160 / 320 km/h', `${zoom.close160.toFixed(2)} / ${zoom.close320.toFixed(2)} px/m`);

  // 2) wider view: none below 200 km/h or with Speed effects Off, full at 340; the horizon stays put
  const wd = await page.evaluate(() => {
    const S = window.__sgp, r = {};
    for (const cam of ['behind', 'close']) {
      window.__place(cam, 190); r[cam + 190] = S.CAM.w;
      window.__place(cam, 340, 'off'); r[cam + 'off'] = S.CAM.w; r[cam + 'skyOff'] = window.__sky(); r[cam + 'yOff'] = S.worldToScreenX(...S.T.pt(S.W.player.i + 10, 0))[1];
      window.__place(cam, 340); r[cam + 340] = S.CAM.w; r[cam + 'sky'] = window.__sky(); r[cam + 'y'] = S.worldToScreenX(...S.T.pt(S.W.player.i + 10, 0))[1];
    }
    return r;
  });
  for (const cam of ['behind', 'close']) {
    check(wd[cam + 190] === 0 && wd[cam + 'off'] === 0 && near(wd[cam + 340], 1, 1e-6), `${cam}: widen 0 at 190 km/h and Off, full at 340`, `${wd[cam + 190]} / ${wd[cam + 'off']} / ${wd[cam + 340]}`);
    check(wd[cam + 'y'] < wd[cam + 'yOff'] - 2, `${cam}: road 20 m ahead drawn higher (stretched) when wide`, `y ${wd[cam + 'yOff'].toFixed(1)} -> ${wd[cam + 'y'].toFixed(1)} px`);
    check(wd[cam + 'sky'] <= wd[cam + 'skyOff'] + 0.01, `${cam}: no more sky when wide`, `sky ${(wd[cam + 'skyOff'] * 100).toFixed(1)} % -> ${(wd[cam + 'sky'] * 100).toFixed(1)} %`);
  }

  // 3) no canvas reallocation while the speed goes from 190 to 340 km/h and back
  const rs = await page.evaluate(() => {
    const S = window.__sgp; window.__place('behind', 340); const b = S.W.player, n0 = window.__resizes;
    for (let k = 0; k <= 120; k++) { b.v = (190 + 150 * Math.abs(Math.sin(k / 20))) / 3.6; window.__frame(); }
    return window.__resizes - n0;
  });
  check(rs === 0, 'no canvas reallocation while the speed changes', `${rs} canvas size changes`);

  // 4) speed lines: drawn at 340 km/h, none at 250 km/h, with Speed effects Off or when paused
  const sl = await page.evaluate(() => {
    const S = window.__sgp, n = (cam, kmh, fx, pause) => { window.__place(cam, kmh, fx); if (pause) S.W.paused = true; for (let k = 0; k < 10; k++) window.__frame(); const c = S.SPL.lines.length; S.W.paused = false; return c; };
    return { b340: n('behind', 340), c340: n('close', 340), t340: n('chase', 340), b250: n('behind', 250), off: n('behind', 340, 'off'), paused: n('behind', 340, 'on', true) };
  });
  check(sl.b340 >= 8 && sl.c340 >= 8 && sl.t340 >= 8, 'speed lines at 340 km/h in all three cameras', `Behind ${sl.b340}  CLOSE ${sl.c340}  Top-down ${sl.t340} lines`);
  check(sl.b250 === 0 && sl.off === 0 && sl.paused === 0, 'no speed lines at 250 km/h, Off, or paused', `${sl.b250} / ${sl.off} / ${sl.paused}`);
  const edge = await page.evaluate(() => { const S = window.__sgp; window.__place('behind', 340); for (let k = 0; k < 10; k++) window.__frame(); return S.SPL.lines.every(q => q.x < 0.3 * innerWidth + 1e-6 || q.x > 0.7 * innerWidth - 1e-6); });
  check(edge, 'speed lines start in the outer 30 % of the width');

  // 5) camera vibration
  const vb = await page.evaluate(() => {
    const S = window.__sgp, T = S.T, r = {};
    window.__place('behind', 0); r.rest = S.speedVibX();
    window.__place('behind', 340); r.top = S.speedVibX();
    S.W.paused = true; r.paused = S.speedVibX(); S.W.paused = false;
    window.__place('behind', 340, 'off'); r.off = S.speedVibX();
    // on a kerb at top speed, braking hard: the most it shakes
    window.__place('behind', 340); const b = S.W.player; let k = 0; while (!(T.KERB[0][k] > 1)) k++;
    [b.x, b.y] = T.pt(k, T.WR[k] + T.KERB[0][k] / 2); b.i = k; S.CAM.dec = 15; r.kerb = S.speedVibX();
    return r;
  });
  check(vb.rest === 0 && vb.paused === 0 && vb.off === 0, 'no vibration at rest, paused or Off', `${vb.rest} / ${vb.paused} / ${vb.off} px`);
  check(near(vb.top, 1.5 * 0.9973, 0.005), 'vibration about 1.5 px at 340 km/h on a straight', `${vb.top.toFixed(3)} px`);
  check(near(vb.kerb, 3, 1e-6), 'kerb + braking at top speed: 2 x vib = 3 px', `${vb.kerb.toFixed(3)} px`);

  // 6) distance posts: on the grass along the straights, about every 25 m
  const posts = await page.evaluate(() => { const S = window.__sgp, T = S.T, P = { i: 0, s: 0, d: 0 }; let bad = 0;
    for (const q of S.GEO.posts) { T.project(q.x, q.y, -1, P); if (T.surface(P.i, P.s, P.d) !== S.SURF.GRASS) bad++; }
    return { n: S.GEO.posts.length, bad }; });
  check(posts.n >= 40 && posts.bad === 0, 'distance posts along the straights, all on grass', `${posts.n} posts, ${posts.bad} not on grass`);
  await page.close();

  // 7) frame cost: median time of drawing the world and the speed lines at 340 km/h, Behind, 1470x830 @2x,
  // 1.24.0 settings against the 1.23.0 ones (zoom factor 1.0, depth 2.6, no widen, Speed effects Off)
  {
    const page = await open(1470, 830, 2);
    const r = await page.evaluate(async () => {
      const S = window.__sgp, TL = S.TILT; window.__place('behind', 340);
      const c = document.getElementById('game'), one = document.createElement('canvas'); one.width = one.height = 1; const g = one.getContext('2d');
      const sync = () => { g.drawImage(c, 0, 0, 1, 1); g.getImageData(0, 0, 1, 1); };
      const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1], tNew = [], tOld = [], NEW = { zK: TL.zK, hk: TL.hk, wd: TL.wd };
      const set = old => { Object.assign(TL, old ? { zK: 1.0, hk: 2.6, wd: 0 } : NEW); S.UI.opts.fx = old ? 'off' : 'on'; S.resizeX(); window.__frame(true); for (let k = 0; k < 20; k++) { S.drawWorldX(); sync(); } };
      for (let blk = 0; blk < 8; blk++) {
        const old = blk & 1; set(old);
        for (let k = 0; k < 60; k++) { sync(); const t0 = performance.now(); S.drawWorldX(); S.drawSpeedLinesX(1 / 60); sync(); (old ? tOld : tNew).push(performance.now() - t0); }
        await new Promise(r => setTimeout(r, 0));
      }
      return { nw: med(tNew), old: med(tOld), q: TL.q };
    });
    const add = r.nw / r.old - 1;
    check(add <= COST && r.q === 1, 'frame cost of 1.24.0 at most 10 % over 1.23.0', `world ${r.old.toFixed(2)} ms -> ${r.nw.toFixed(2)} ms (${add >= 0 ? '+' : ''}${(add * 100).toFixed(1)} %)`);
    await page.close();
  }

  await browser.close();
  console.log(failed ? `${failed} of ${total} speed feel checks FAILED` : `all ${total} speed feel checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
