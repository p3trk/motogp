#!/usr/bin/env node
// 3D track test (GDD 11o): the walls, barriers and fences of phase 2 stand up in the 3D view.
// - Hangar Straight, CLOSE, 1470x830 @2x: a point on the track face of the concrete wall, 0.8 m up, shows the wall
//   with the 3D walls on and the grass behind it with them off (test switch 7), so the wall stands up.
// - Copse: the tyre wall on the outside is dark where it stands.
// - Switching the walls off brings the flat walls back into the ground tiles; Classic graphics keep them flat.
// - Frame cost: drawing the world with the walls at most 15 % more than without (median, blocks of frames, so the
//   ground tiles are not baked again every frame).
// Placement on the ground (no barrier on the road, kerbs, run-off, gravel or pit lane) is checked over the whole lap
// by the unit tests (tests/unit/scenery3d.test.js).
// Usage: node tests/track3d.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const COST = 0.15;

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let failed = 0, total = 0;
  const check = (ok, name, info) => { total++; if (!ok) { failed++; } console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} ${info}`); };
  const page = await browser.newPage({ viewport: { width: 1470, height: 830 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  await page.evaluate(() => {
    // places the player at a corner (offset in metres) at a speed, lets the camera settle, then pauses
    window.__place = async (corner, off, kmh) => {
      const S = window.__sgp; S.UI.opts.cam = 'close'; S.UI.opts.train = 'off'; S.UI.opts.blur = 'off'; S.UI.launch('practice', {}); S.setCamModeX('close');
      const W = S.W, b = W.player, T = S.T, c = T.corners.find(q => q.name === corner);
      const s = ((c.s + off) % T.L + T.L) % T.L, i = T.idx(s);
      Object.assign(b, { x: T.X[i], y: T.Y[i], h: T.H[i], i, s, v: kmh / 3.6, trainHold: false, autopilot: true });
      S.CAM.init = false; W.paused = false; await new Promise(r => setTimeout(r, 600)); W.paused = true;
    };
    // the screen pixel (device px) of a world point z metres up, through the 3D camera (gl3DProjection)
    window.__scr = (x, y, z) => {
      const S = window.__sgp, p = S.gl3DPlanePoint(x, y, z), P = S.tiltP(), w = P - p[2], k = document.getElementById('game').width / innerWidth;
      return [Math.round((innerWidth / 2 + p[0] * P / w) * k), Math.round((innerHeight + p[1] * P / w) * k)];
    };
    // the colour at a device pixel of the game canvas with the 3D canvas over it, after drawing the world
    window.__px = ([x, y]) => { const S = window.__sgp; S.drawWorldX(); return [...S.screenX().getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3)]; };
  });

  // the concrete wall on the Hangar Straight stands up
  {
    const r = await page.evaluate(async () => {
      const S = window.__sgp, T = S.T; await window.__place('Hangar Straight', 100, 300);
      const b = S.W.player, i = (b.i + 15) % T.N, kinds = S.wallKinds(0), HS = S.PHYS.VS;
      const pt = window.__scr(...T.pt(i, T.WALL[0][i]), 0.8 * HS);
      S.PERF.noWalls = false; const on = window.__px(pt), drawn = S.WALLS3D.drawn, tiles = S.TILE_WALLS.on3d;
      S.PERF.noWalls = true; const off = window.__px(pt), tilesOff = S.TILE_WALLS.on3d; S.PERF.noWalls = false;
      return { kind: kinds[i], on, off, drawn, tiles, tilesOff, pieces: S.WALLS3D.pieces.length, gl: S.walls3DOn() };
    });
    const d = r.on.reduce((a, v, k) => a + Math.abs(v - r.off[k]), 0), grass = r.off[1] > r.off[0] + 20 && r.off[1] > r.off[2] + 20;
    check(r.gl && r.kind === 1 && d > 60 && grass && !(r.on[1] > r.on[0] + 20 && r.on[1] > r.on[2] + 20), 'Hangar Straight: the concrete wall stands up (0.8 m on its face)', `walls on rgb ${r.on}  off rgb ${r.off} (grass)  difference ${d}`);
    check(r.drawn > 0 && r.drawn < r.pieces, 'only the pieces in view are drawn', `${r.drawn} of ${r.pieces} pieces`);
    check(r.tiles && !r.tilesOff, 'test switch 7 brings the flat walls back into the tiles', `3D walls on: tiles without flat walls ${r.tiles}; off: ${r.tilesOff}`);
  }
  // the tyre wall at Copse
  {
    const r = await page.evaluate(async () => {
      const S = window.__sgp, T = S.T; await window.__place('Copse', -110, 250);
      const c = T.corners.find(q => q.name === 'Copse'), s = T.KS[c.i] > 0 ? 1 : 0, kinds = S.wallKinds(s);
      let i = (S.W.player.i + 20) % T.N; while (kinds[i] !== 3) i = (i + 1) % T.N; // the first tyre wall point ahead
      const pt = window.__scr(...T.pt(i, (s ? -1 : 1) * (T.WALL[s][i] + 0.02)), 0.3 * S.PHYS.VS);
      return { rgb: window.__px(pt), ahead: (i - S.W.player.i + T.N) % T.N };
    });
    check(Math.max(...r.rgb) < 90, 'Copse: the tyre wall on the outside is dark', `rgb ${r.rgb} at ${r.ahead * 2} m ahead`);
  }
  // Classic graphics keep the flat walls
  {
    const r = await page.evaluate(async () => {
      const S = window.__sgp; S.UI.opts.gfx = 'classic'; await window.__place('Hangar Straight', 100, 300); S.drawWorldX();
      const res = { on: S.walls3DOn(), tiles: S.TILE_WALLS.on3d }; S.UI.opts.gfx = '3d'; return res;
    });
    check(!r.on && !r.tiles, 'Classic graphics: no 3D walls, flat walls in the tiles', `walls3DOn ${r.on}, tiles without flat walls ${r.tiles}`);
  }
  // frame cost of the walls
  {
    const r = await page.evaluate(async () => {
      const S = window.__sgp; await window.__place('Hangar Straight', 100, 300);
      const c = document.getElementById('game'), one = document.createElement('canvas'); one.width = one.height = 1; const g = one.getContext('2d');
      const sync = () => { g.drawImage(c, 0, 0, 1, 1); if (S.GL3D.canvas && S.GL3D.shown) { g.drawImage(S.GL3D.canvas, 0, 0, 1, 1); } g.getImageData(0, 0, 1, 1); };
      const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1], tOn = [], tOff = [];
      for (let blk = 0; blk < 12; blk++) {
        const on = blk & 1; S.PERF.noWalls = !on;
        for (let k = 0; k < 60; k++) { // the first 20 frames of a block bake the tiles again
          sync(); const t0 = performance.now(); S.drawWorldX(); sync();
          if (k >= 20) (on ? tOn : tOff).push(performance.now() - t0);
        }
        await new Promise(res => setTimeout(res, 0));
      }
      S.PERF.noWalls = false;
      return { on: med(tOn), off: med(tOff) };
    });
    const add = r.on / r.off - 1;
    check(add <= COST, 'frame cost of the 3D walls at most 15 %', `world ${r.off.toFixed(2)} ms -> with walls ${r.on.toFixed(2)} ms (+${(add * 100).toFixed(1)} %)`);
  }
  await browser.close();
  console.log(failed ? `${failed} of ${total} 3D track checks FAILED` : `all ${total} 3D track checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
