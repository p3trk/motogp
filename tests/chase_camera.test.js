#!/usr/bin/env node
// Chase camera test (GDD 11o, phase 6): the low follow shot behind the bike, drawn in 3D.
// - Offered: the start screen shows Chase, and C goes Behind -> CLOSE -> Chase -> Top-down.
// - The camera sits behind the bike at the set distance (4.5 m) and height (1.6 m), along the bike's heading on a
//   straight.
// - The horizon is level at about 40 degrees of lean (autopilot through Copse): two points far ahead at eye height,
//   left and right, land on the same screen row; the bike leans in the view.
// - The player's bike is drawn in the lower middle of the screen (the pixel 0.6 m up the bike is not the road behind it).
// - A wall stands up beside the road (the Hangar Straight's concrete wall, 0.8 m up its face, differs with the 3D
//   scenery off: test switch 7), and the sky is blue above the horizon.
// - With Bike graphics Classic, Chase falls back to Behind and the start screen hides it.
// - Frame cost: drawing the world in Chase against CLOSE (median, blocks of frames), reported; at most 1.6 times CLOSE.
// Usage: node tests/chase_camera.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const COST = 1.6;

async function helpers(page) {
  await page.evaluate(() => {
    // places the player at a corner (offset in metres) at a speed in a camera, lets it ride for ms, then pauses
    window.__place = async (cam, corner, off, kmh, ms = 600) => {
      const S = window.__sgp; Object.assign(S.UI.opts, { cam, train: 'off', blur: 'off', fx: 'on', gfx: '3d' }); S.UI.launch('practice', {}); S.setCamModeX(cam);
      const W = S.W, b = W.player, T = S.T, c = T.corners.find(q => q.name === corner);
      const s = ((c.s + off) % T.L + T.L) % T.L, i = T.idx(s);
      Object.assign(b, { x: T.X[i], y: T.Y[i], h: T.H[i], i, s, v: kmh / 3.6, trainHold: false, autopilot: true });
      S.CAM.init = false; W.paused = false; await new Promise(r => setTimeout(r, ms)); W.paused = true;
    };
    // the colour at a css point of the game canvas with the 3D canvas over it, after drawing the world
    window.__px = ([x, y]) => {
      const S = window.__sgp, k = document.getElementById('game').width / innerWidth; S.drawWorldX();
      return [...S.screenX().getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)];
    };
    // a game point z metres up through the Chase camera, in css px
    window.__low = (x, y, z) => window.__sgp.lowProjectPt(x, -y, z);
  });
}

// offered, and the camera placed behind the bike
async function placement(page, check) {
  const r = await page.evaluate(async () => {
    const S = window.__sgp, btn = document.querySelector('#optCam [data-v="low"]');
    S.UI.launch('practice', {}); S.setCamModeX('behind'); const seen = [];
    for (let k = 0; k < 4; k++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' })); seen.push(S.CAM.mode); }
    await window.__place('low', 'Hangar Straight', 100, 0, 300);
    const b = S.W.player, e = S.LOW.eye, back = [b.x - e[0], b.y + e[1]], fw = [Math.cos(b.h), Math.sin(b.h)];
    return { btn: !!btn && !btn.hidden, seen, along: back[0] * fw[0] + back[1] * fw[1], side: Math.abs(back[0] * fw[1] - back[1] * fw[0]), up: e[2], on: S.lowOn() };
  });
  check(r.btn, 'start screen: Chase is offered', `button shown ${r.btn}`);
  check(r.seen.join() === 'close,low,chase,behind', 'C: Behind -> CLOSE -> Chase -> Top-down -> Behind', r.seen.join(' -> '));
  check(r.on && Math.abs(r.along - 4.5) < 0.05 && r.side < 0.05 && Math.abs(r.up - 1.6) < 0.01, 'the camera 4.5 m behind the bike, 1.6 m up', `behind ${r.along.toFixed(2)} m, aside ${r.side.toFixed(2)} m, up ${r.up.toFixed(2)} m`);
}

// level horizon at lean, the bike drawn in the lower middle, a wall standing up, blue sky
async function picture(page, check) {
  const r = await page.evaluate(async () => {
    const S = window.__sgp, T = S.T, out = {};
    await window.__place('low', 'Copse', -120, 220, 0); S.W.paused = false; // ride until the bike leans hard
    for (let t = 0; t < 80 && Math.abs(S.W.player.lean) < 0.6; t++) { await new Promise(res => setTimeout(res, 50)); }
    S.W.paused = true; await new Promise(res => setTimeout(res, 50));
    const b = S.W.player, e = S.LOW.eye, y = S.LOW.yaw, c = Math.cos(y), s = Math.sin(y), far = 3000;
    const L = S.lowProjectPt(e[0] + far * c - 500 * s, e[1] - far * s - 500 * c, e[2]), R = S.lowProjectPt(e[0] + far * c + 500 * s, e[1] - far * s + 500 * c, e[2]);
    out.lean = b.lean * 180 / Math.PI; out.tilt = Math.atan2(R[1] - L[1], Math.abs(R[0] - L[0])) * 180 / Math.PI;
    await window.__place('low', 'Hangar Straight', 100, 0, 300);
    const p = S.W.player, mid = window.__low(p.x, p.y, 0.6), foot = window.__low(p.x, p.y, 0);
    S.PERF.no3d = false; const bike = window.__px(mid); S.PERF.no3d = true; const road = window.__px(mid); S.PERF.no3d = false;
    out.bike = { at: mid.map(Math.round), foot: foot.map(Math.round), on: bike, off: road, VW: innerWidth, VH: innerHeight };
    const i = (p.i + 15) % T.N, wp = T.pt(i, T.WALL[0][i]), wpt = window.__low(wp[0], wp[1], 0.8);
    S.PERF.noWalls = false; const won = window.__px(wpt); S.PERF.noWalls = true; const woff = window.__px(wpt); S.PERF.noWalls = false;
    out.wall = { on: won, off: woff, kind: S.wallKinds(0)[i] };
    out.sky = window.__px([innerWidth / 2, 20]);
    return out;
  });
  check(Math.abs(r.lean) > 30 && Math.abs(r.tilt) < 0.05, 'Copse: the horizon stays level with the bike leaning', `lean ${r.lean.toFixed(1)}°, horizon tilt ${r.tilt.toFixed(3)}°`);
  const d = (a, b) => a.reduce((t, v, k) => t + Math.abs(v - b[k]), 0), B = r.bike;
  check(Math.abs(B.foot[0] - B.VW / 2) < 0.05 * B.VW && B.foot[1] > 0.6 * B.VH && d(B.on, B.off) > 60, 'the bike is drawn in the lower middle of the screen', `foot at ${B.foot}, 0.6 m up rgb ${B.on}, without the 3D bikes ${B.off}`);
  check(r.wall.kind === 1 && d(r.wall.on, r.wall.off) > 60, 'Hangar Straight: the concrete wall stands up beside the road', `0.8 m up its face rgb ${r.wall.on}, without the 3D scenery ${r.wall.off}`);
  check(r.sky[2] > r.sky[0] + 40, 'the sky is blue above the horizon', `rgb ${r.sky}`);
}

// Classic graphics: no Chase
async function classic(page, check) {
  const r = await page.evaluate(async () => {
    const S = window.__sgp; S.UI.opts.gfx = 'classic'; S.UI.sync(); S.UI.launch('practice', {}); S.setCamModeX('low');
    const mode = S.CAM.mode, hidden = document.querySelector('#optCam [data-v="low"]').hidden;
    S.UI.opts.gfx = '3d'; S.UI.sync();
    return { mode, hidden };
  });
  check(r.mode === 'behind' && r.hidden, 'Classic graphics: Chase falls back to Behind and is not offered', `camera ${r.mode}, button hidden ${r.hidden}`);
}

// the frame cost of drawing the world in Chase against CLOSE
async function cost(page, check) {
  const r = await page.evaluate(async () => {
    const S = window.__sgp, res = {}, med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
    const c = document.getElementById('game'), one = document.createElement('canvas'); one.width = one.height = 1; const g = one.getContext('2d');
    const sync = () => { g.drawImage(c, 0, 0, 1, 1); if (S.GL3D.canvas && S.GL3D.shown) { g.drawImage(S.GL3D.canvas, 0, 0, 1, 1); } g.getImageData(0, 0, 1, 1); };
    for (const cam of ['close', 'low']) {
      await window.__place(cam, 'Abbey', -110, 250); const t = [];
      for (let blk = 0; blk < 6; blk++) {
        for (let k = 0; k < 60; k++) { sync(); const t0 = performance.now(); S.drawWorldX(); sync(); if (k >= 20) t.push(performance.now() - t0); }
        await new Promise(res => setTimeout(res, 0));
      }
      res[cam] = med(t);
    }
    return res;
  });
  const k = r.low / r.close;
  check(k <= COST, `Abbey: frame cost of Chase at most ${COST} times CLOSE`, `CLOSE ${r.close.toFixed(2)} ms -> Chase ${r.low.toFixed(2)} ms (${k.toFixed(2)} times)`);
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let failed = 0, total = 0;
  const check = (ok, name, info) => { total++; if (!ok) { failed++; } console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(62)} ${info}`); };
  const page = await browser.newPage({ viewport: { width: 1470, height: 830 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  await helpers(page);
  await placement(page, check);
  await picture(page, check);
  await classic(page, check);
  await cost(page, check);
  await browser.close();
  console.log(failed ? `${failed} of ${total} Chase camera checks FAILED` : `all ${total} Chase camera checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
