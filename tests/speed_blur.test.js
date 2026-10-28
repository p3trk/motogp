#!/usr/bin/env node
// Speed blur test (GDD 11f): at top speed the surroundings blur into zoom streaks in the Behind and CLOSE cameras,
// while the road with its kerbs and the bikes stay sharp. Puts the player on the Hangar Straight at a set speed
// (bike held at that speed, no input) and compares frames drawn with Speed blur On and Off, at 1470x830 @2x and
// 1280x800, with Behind and CLOSE. The road mask for measuring is built here from the track edges and kerbs
// projected to the screen (not the game's own mask): road pixels are at least 3 px inside it, off-road pixels at
// least 10 px outside it, below the horizon and away from bikes. The streak check draws square dots of one screen size
// on the ground and compares the sharpness along the line to the horizon point, outer quarter against centre in the
// same screen rows, with the blur at almost no strength as reference (same 1/4 copy, no zoom).
// Also: Top-down is never blurred, the start-screen option and the strength slider, replay paused above and below
// the start speed, and the frame cost limit (15 %).
// Usage: node tests/speed_blur.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const SIZES = [[1470, 830, 2], [1280, 800, 1]];
const COST = 0.15; // largest share the blur may add to drawing the world

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let failed = 0, total = 0;
  const check = (ok, name, info) => { total++; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} ${info || ''}`); };
  const ready = page => page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const open = async (w, h, sf) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: sf });
    page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
    // fake requestAnimationFrame: the test decides when frames happen, so the game loop never runs on its own
    // between two frames that are compared (and slow test frames never trigger the slow-machine quality drop)
    await page.addInitScript(() => {
      window.__rafQ = []; window.requestAnimationFrame = cb => { window.__rafQ.push(cb); return 1; };
      window.__tick = t => { const q = window.__rafQ; window.__rafQ = []; for (const cb of q) cb(t); };
    });
    await page.goto(FILE); await ready(page);
    await helpers(page, true);
    return page;
  };
  const helpers = (page, clear) => page.evaluate(clear => {
      if (clear) for (const k of ['sgp_cam', 'sgp_cam_close', 'sgp_opts']) localStorage.removeItem(k);
      const S = window.__sgp;
      // helpers inside the page
      window.__place = (cam, kmh) => { // practice spot start on the Hangar Straight, held at this speed
        const T = S.T, c = T.corners.find(c => c.name === 'Hangar Straight');
        S.UI.opts.mode = 'practice'; S.UI.opts.cam = cam; S.UI.opts.train = 'on'; S.UI.opts.trainS = T.wrapS(c.s + 200); S.UI.opts.trainV = 100;
        S.UI.launch('practice', {}); S.setCamModeX(cam);
        const b = S.W.player; b.v = kmh / 3.6; b.trainHold = true;
        for (let k = 0; k < 90; k++) window.__frame(); // bake the tiles around
      };
      let t = 1000; window.__tick(t);
      window.__frame = () => { t += 1000 / 60; S.CAM.init = false; window.__tick(t); };
      window.__shot = blur => { // one frame with Speed blur On or Off, as device pixels
        S.UI.opts.blur = blur ? 'on' : 'off'; window.__frame();
        const c = document.getElementById('game'); return c.getContext('2d').getImageData(0, 0, c.width, c.height);
      };
      window.__masks = c => { // road (3 px inside), off-road (10 px outside, below the horizon, away from bikes), bike
        const T = S.T, TL = S.TILT, k = c.width / innerWidth, VW = innerWidth, VH = innerHeight;
        const mk = () => { const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const g = m.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.lineJoin = 'round'; return [m, g]; };
        const RW = Math.round(VW * TL.wk), RH = Math.round(VH * TL.hk), P = TL.p * VH, yMax = RH + 0.4 * P / Math.sin(TL.a);
        const runs = []; let cur = null;
        for (let i = 0; i <= T.N + 1; i++) {
          const q = i % T.N, [cx, cy] = S.worldToCanvasX(T.X[q], T.Y[q]), ok = cx > -0.3 * RW && cx < 1.3 * RW && cy > -0.05 * RH && cy < yMax;
          if (!ok) { cur = null; continue; } if (!cur) runs.push(cur = []);
          cur.push([S.worldToScreenX(...T.pt(q, -(T.WL[q] + T.KERB[1][q]))), S.worldToScreenX(...T.pt(q, T.WR[q] + T.KERB[0][q]))]);
        }
        const poly = (g, r) => { g.beginPath(); r.forEach((p, j) => j ? g.lineTo(...p[0]) : g.moveTo(...p[0])); for (let j = r.length - 1; j >= 0; j--) g.lineTo(...r[j][1]); g.closePath(); };
        const [mi, gi] = mk(), [mo, go] = mk();
        for (const r of runs) { poly(gi, r); gi.fillStyle = '#fff'; gi.fill(); }
        gi.globalCompositeOperation = 'destination-out'; gi.lineWidth = 6; for (const r of runs) { poly(gi, r); gi.stroke(); }
        go.fillStyle = go.strokeStyle = '#fff'; go.lineWidth = 20; for (const r of runs) { poly(go, r); go.fill(); go.stroke(); }
        const uTop = RH * Math.cos(TL.a) * P / (P + RH * Math.sin(TL.a)), hy = VH - uTop + 20;
        go.fillRect(0, 0, VW, hy);
        const b = S.W.player, [bx, by] = S.worldToScreenX(b.x, b.y), Lpx = S.TILT.minLen * 3;
        go.beginPath(); go.arc(bx, by, Lpx, 0, 7); go.fill();
        const A = mi.getContext('2d').getImageData(0, 0, c.width, c.height).data, B = mo.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const road = new Uint8Array(c.width * c.height), off = new Uint8Array(c.width * c.height), bike = new Uint8Array(c.width * c.height);
        const br = S.TILT.minLen * 0.35 * k;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          const i = y * c.width + x; road[i] = A[i * 4 + 3] > 250 ? 1 : 0; off[i] = B[i * 4 + 3] < 5 ? 1 : 0;
          bike[i] = Math.hypot(x - bx * k, y - by * k) < br ? 1 : 0;
        }
        return { road, off, bike, w: c.width, h: c.height };
      };
    }, clear);
  // sharpness of the off-road pixels (mean absolute luminance step to the right and down neighbour), overall and per
  // zone, plus the largest differences between On and Off over road and bike pixels
  const compare = (page, cam, kmh) => page.evaluate(([cam, kmh]) => {
    window.__place(cam, kmh);
    const on = window.__shot(true), off = window.__shot(false), M = window.__masks(document.getElementById('game'));
    const w = M.w, h = M.h, lum = (d, i) => d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
    const st = (d, i) => Math.abs(lum(d, i) - lum(d, i + 1)) + Math.abs(lum(d, i) - lum(d, i + w));
    let sOn = 0, sOff = 0, n = 0;
    for (let i = 0; i < w * (h - 1) - 1; i++) { if (!M.off[i] || !M.off[i + 1] || !M.off[i + w]) continue; sOn += st(on.data, i); sOff += st(off.data, i); n++; }
    const diff = mask => { let n = 0, bad = 0, mx = 0; for (let i = 0; i < w * h; i++) { if (mask && !mask[i]) continue; const d = Math.max(Math.abs(on.data[i * 4] - off.data[i * 4]), Math.abs(on.data[i * 4 + 1] - off.data[i * 4 + 1]), Math.abs(on.data[i * 4 + 2] - off.data[i * 4 + 2])); n++; if (d > 2) bad++; mx = Math.max(mx, d); } return { n, ok: n ? 1 - bad / n : 1, mx }; };
    return { v: window.__sgp.W.player.v * 3.6, shOn: sOn / n, shOff: sOff / n, road: diff(M.road), bike: diff(M.bike), all: diff(null) };
  }, [cam, kmh]);
  // streaks grow towards the edges: a uniform dot pattern drawn into the ground looks the same all across a screen row
  // (one horizontal scale per row), so the sharpness kept by the blur can be compared between the outer quarter and the
  // centre in the same rows (off-road pixels only)
  const streaks = (page, cam) => page.evaluate(cam => {
    const S = window.__sgp; window.__place(cam, 340); S.UI.opts.blur = 'on';
    const M = window.__masks(document.getElementById('game')), w = M.w, h = M.h;
    // square dots of the same size on screen at any depth (z, zv: ground px per screen px across and along that row)
    const draw = blur => { S.tiltProjectX((g, RW, RH) => { g.fillStyle = '#000'; g.fillRect(0, 0, RW, RH); g.fillStyle = '#fff'; const P = S.TILT.p * innerHeight, sa = Math.sin(S.TILT.a), ca = Math.cos(S.TILT.a); for (let y = RH, n = 0; y > 0; n++) { const z = (P + (RH - y) * sa) / P, zv = z * z / ca, d = 48 * z; for (let x = (n & 1) * d / 2; x < RW; x += d) g.fillRect(x, y - 12 * zv, 12 * z, 12 * zv); y -= 48 * zv; } }); if (blur) S.speedBlurX(); const c = document.getElementById('game'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
    // sharpness along the line to the horizon point (the direction a zoom streak smears): step to the neighbour pixel
    // that lies outward from it
    const TL = S.TILT, VH = innerHeight, kp = w / innerWidth, P = TL.p * VH, RH = Math.round(VH * TL.hk);
    const hx = w / 2, hy = Math.max(0, VH - RH * Math.cos(TL.a) * P / (P + RH * Math.sin(TL.a))) * kp;
    // against the blur at almost no strength (the same 1/4 copy, no zoom), so only the streaks are measured
    const bs = TL.bs, on = draw(true); TL.bs = 0.01; const off = draw(true); TL.bs = bs; const st = (d, i) => { const x = i % w, y = (i - x) / w, dx = x - hx, dy = y - hy, l = Math.hypot(dx, dy) || 1, j = i + Math.round(dx / l) + Math.round(dy / l) * w; return Math.abs(d[i * 4] - d[j * 4]); };
    const Z = { oOn: 0, oOff: 0, mOn: 0, mOff: 0 };
    for (let y = 0; y < h - 1; y++) {
      const r = { oOn: 0, oOff: 0, mOn: 0, mOff: 0, no: 0, nm: 0 };
      for (let x = 0; x < w - 1; x++) {
        const i = y * w + x; if (!M.off[i] || !M.off[i + 1] || !M.off[i + w]) continue;
        if (x < w / 4 || x >= 3 * w / 4) { r.oOn += st(on, i); r.oOff += st(off, i); r.no++; } else if (Math.abs(x - w / 2) < w / 8) { r.mOn += st(on, i); r.mOff += st(off, i); r.nm++; }
      }
      if (r.no >= 20 && r.nm >= 20) for (const k in Z) Z[k] += r[k];
    }
    window.__frame();
    return { outer: Z.oOn / Z.oOff, mid: Z.mOn / Z.mOff };
  }, cam);
  const pct = x => (x * 100).toFixed(1) + ' %';

  for (const [w, h, sf] of SIZES) {
    const page = await open(w, h, sf);
    for (const cam of ['behind', 'close']) {
      const tag = `${w}x${h} @${sf}x ${cam}`;
      const r0 = await compare(page, cam, 0), r250 = await compare(page, cam, 250), r290 = await compare(page, cam, 290), r340 = await compare(page, cam, 340);
      check(r0.all.mx <= 1 && r250.all.mx <= 1, `${tag}: no blur at 0 and 250 km/h`, `largest difference ${r0.all.mx} / ${r250.all.mx}`);
      const drop = 1 - r340.shOn / r340.shOff;
      check(drop >= 0.3, `${tag}: surroundings blurred at 340 km/h`, `off-road sharpness ${r340.shOff.toFixed(2)} -> ${r340.shOn.toFixed(2)} (${pct(drop)} lower, need 30 %)`);
      const { outer: ro, mid: rm } = await streaks(page, cam);
      check(ro < rm, `${tag}: streaks grow towards the screen edges`, `dot pattern, sharpness kept in the same rows: outer quarter ${pct(ro)}  centre ${pct(rm)}`);
      check(r340.road.n > 1000 && r340.road.ok >= 0.99, `${tag}: road sharp at 340 km/h`, `${pct(r340.road.ok)} of ${r340.road.n} road pixels within 2 levels`);
      check(r340.bike.n > 50 && r340.bike.ok >= 0.99, `${tag}: bike sharp at 340 km/h`, `${pct(r340.bike.ok)} of ${r340.bike.n} bike pixels within 2 levels`);
      const s250 = r250.shOn, s290 = r290.shOn, s340 = r340.shOn;
      check(s290 < s250 && s290 > s340, `${tag}: fades in with speed`, `off-road sharpness 250 ${s250.toFixed(2)}  290 ${s290.toFixed(2)}  340 ${s340.toFixed(2)}`);
    }
    if (sf === 2) {
      const td = await compare(page, 'chase', 340);
      check(td.all.mx <= 1, 'Top-down: frames identical with blur On and Off', `largest difference ${td.all.mx}`);
    }
    await page.close();
  }

  // option Off on the start screen, kept after a reload; strength slider 0 for one camera only
  {
    let page = await open(1280, 800, 1);
    await page.locator('#optBlur button', { hasText: 'Off' }).click();
    await page.reload(); await ready(page); await helpers(page, false);
    const r = await page.evaluate(() => {
      const S = window.__sgp, opt = S.UI.opts.blur, chip = document.querySelector('#optBlur [aria-pressed="true"]').textContent;
      window.__place('behind', 340); window.__frame();
      const c = document.getElementById('game'), d = () => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const a = d(); S.UI.opts.blur = 'on'; window.__frame(); const b = d(); S.UI.opts.blur = 'off'; window.__frame(); const e = d();
      let mxOff = 0, mxOn = 0; for (let i = 0; i < a.length; i++) { mxOff = Math.max(mxOff, Math.abs(a[i] - e[i])); mxOn = Math.max(mxOn, Math.abs(a[i] - b[i])); }
      return { opt, chip, mxOff, mxOn };
    });
    check(r.opt === 'off' && r.chip === 'Off' && r.mxOff <= 1 && r.mxOn > 20, 'option Off: no blur at 340 km/h, kept after reload', `option ${r.opt}  pressed "${r.chip}"  difference to blur Off ${r.mxOff}  (with On ${r.mxOn})`);
    await page.evaluate(() => { window.__sgp.UI.opts.blur = 'on'; window.__place('close', 340); });
    await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__sgp.W.paused);
    await page.evaluate(() => { const rg = document.getElementById('cam_bs'); rg.value = 0; rg.dispatchEvent(new Event('input', { bubbles: true })); });
    const z = await page.evaluate(() => {
      const S = window.__sgp, mx = (a, b) => { let m = 0; for (let i = 0; i < a.data.length; i++) m = Math.max(m, Math.abs(a.data[i] - b.data[i])); return m; };
      S.UI.togglePause(); const res = {};
      for (const cam of ['close', 'behind']) { window.__place(cam, 340); res[cam] = mx(window.__shot(true), window.__shot(false)); }
      return Object.assign(res, { saved: JSON.parse(localStorage.getItem('sgp_cam_close') || '{}').bs });
    });
    check(z.close <= 1 && z.behind > 20 && z.saved === 0, 'strength 0 turns the blur off for that camera only', `CLOSE difference ${z.close}  Behind difference ${z.behind}  saved CLOSE strength ${z.saved}`);
    await page.close();
  }

  // replay: paused at a point above 340 km/h shows the blur, at a point below 260 km/h it does not
  {
    const page = await open(1470, 830, 2);
    const r = await page.evaluate(() => {
      const S = window.__sgp, W = S.W;
      S.UI.opts.cam = 'behind'; S.UI.opts.train = 'off'; S.UI.launch('practice', {});
      const b = W.player; b.autopilot = true; b.trainHold = false; W.paused = true; let g = 0;
      while (b.laps.length < 1 && g < 120 * 900) { S.simStep(S.SUB); g++; }
      W.paused = false; S.UI.toMenu();
      const R = S.Lib.data[S.Lib.meta[0].id], V = R.samples.v, dt = R.samples.dt;
      // the recording passes 340 km/h at most briefly on the autopilot; take its fastest sample, raised to 340 km/h
      let kmax = 0; for (let k = 0; k < V.length; k++) if (V[k] > V[kmax]) kmax = k;
      const vmax = V[kmax] * 3.6; V[kmax] = Math.max(V[kmax], 340 / 3.6); if (kmax > 0) V[kmax - 1] = Math.max(V[kmax - 1], 340 / 3.6); if (kmax + 1 < V.length) V[kmax + 1] = Math.max(V[kmax + 1], 340 / 3.6);
      let kslow = -1; for (let k = 50; k < V.length; k++) if (V[k] * 3.6 > 120 && V[k] * 3.6 < 220) { kslow = k; break; }
      S.RP.open([R], 'menu'); S.setCamModeX('behind');
      const mx = (a, b) => { let m = 0; for (let i = 0; i < a.data.length; i++) m = Math.max(m, Math.abs(a.data[i] - b.data[i])); return m; };
      const at = k => { S.RP.seek(k * dt); if (S.RP.playing) S.RP.toggle(); for (let n = 0; n < 60; n++) window.__frame(); const v = W.player.v * 3.6; return { v, d: mx(window.__shot(true), window.__shot(false)) }; };
      const fast = at(kmax), slow = at(kslow); S.RP.close();
      return { vmax, fast, slow };
    });
    check(r.fast.v >= 330 && r.fast.d > 20, 'replay paused at 340 km/h: blurred', `followed bike ${r.fast.v.toFixed(0)} km/h (recording max ${r.vmax.toFixed(0)})  difference On/Off ${r.fast.d}`);
    check(r.slow.v < 260 && r.slow.d <= 1, 'replay paused below 260 km/h: not blurred', `followed bike ${r.slow.v.toFixed(0)} km/h  difference On/Off ${r.slow.d}`);
    await page.close();
  }

  // frame cost: median time of drawing the world plus the blur over 300 frames at 340 km/h, CLOSE, 1470x830 @2x
  {
    const page = await open(1470, 830, 2);
    const r = await page.evaluate(async () => {
      const S = window.__sgp; window.__place('close', 340);
      const c = document.getElementById('game'), one = document.createElement('canvas'); one.width = one.height = 1; const g = one.getContext('2d');
      const sync = () => { g.drawImage(c, 0, 0, 1, 1); g.getImageData(0, 0, 1, 1); }; // waits for the GPU (reads back a 1 px copy, so the game canvas stays on the GPU)
      const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1], tOn = [], tOff = [];
      for (let k = 0; k < 40; k++) { S.UI.opts.blur = k & 1 ? 'on' : 'off'; S.drawWorldX(); sync(); }
      for (let k = 0; k < 600; k++) {
        const on = k & 1; S.UI.opts.blur = on ? 'on' : 'off'; sync();
        const t0 = performance.now(); S.drawWorldX(); sync(); (on ? tOn : tOff).push(performance.now() - t0);
        if (k % 50 === 49) await new Promise(r => setTimeout(r, 0));
      }
      return { on: med(tOn), off: med(tOff), q: S.TILT.q };
    });
    const add = r.on / r.off - 1;
    check(add <= COST && r.q === 1, 'frame cost of the blur at most 15 %', `world ${r.off.toFixed(2)} ms -> with blur ${r.on.toFixed(2)} ms (+${pct(add)}, +${(r.on - r.off).toFixed(2)} ms)`);
    await page.close();
  }

  await browser.close();
  console.log(failed ? `${failed} of ${total} speed blur checks FAILED` : `all ${total} speed blur checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
