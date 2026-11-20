#!/usr/bin/env node
// 3D track test (GDD 11o): the walls, barriers and fences of phase 2 and the trackside objects of phase 4 stand up in
// the 3D view, and they add motion on screen.
// - Hangar Straight, CLOSE, 1470x830 @2x: a point on the track face of the concrete wall, 0.8 m up, shows the wall
//   with the 3D walls on and the grass behind it with them off (test switch 7), so the wall stands up.
// - Copse: the tyre wall on the outside is dark where it stands.
// - Switching the walls off brings the flat walls back into the ground tiles; Classic graphics keep them flat.
// - Phase 4: a braking board before Stowe stands up (its face at 1 m is grey to white: far away the black numbers and
//   the white blend) and the start lights show red over the grid.
// - Phase 3: a tree stands up (its crown, 4 m up, differs from the grass with the scenery off), a grandstand shows its
//   crowd, the Wing's first garage door is in its team colour, the tree line stands above the far edge of the ground;
//   frame cost of all 3D scenery at Abbey and at Club under 15 %.
// - Speed feel (phase 4 done-check): over 60 frames at speed along the Hangar Straight, the pixel change per frame in
//   the outer 25 % of the screen is larger with the 3D scenery on than off (test switch 7).
// - Frame cost: drawing the world with the 3D scenery at most 15 % more than without (median, blocks of frames, so
//   the ground tiles are not baked again every frame).
// Placement on the ground (no barrier on the road, kerbs, run-off, gravel or pit lane) is checked over the whole lap
// by the unit tests (tests/unit/scenery3d.test.js).
// Usage: node tests/track3d.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const COST = 0.15;

// phase 3: a tree, a grandstand, the Wing's doors and the tree line
async function phase3(page, check) {
    const r = await page.evaluate(async () => {
      const S = window.__sgp, T = S.T, HS = S.PHYS.VS, out = {}; await window.__place('Hangar Straight', 100, 300);
      const b = S.W.player, fw = [Math.cos(b.h), Math.sin(b.h)], lf = [-fw[1], fw[0]];
      const seen = t => { const dx = t.x - b.x, dy = t.y - b.y, a = dx * fw[0] + dy * fw[1], l = Math.abs(dx * lf[0] + dy * lf[1]); return a > 25 && a < 90 && l > 20 && l < 60 && !t.gone3d; };
      const t = S.SCN.trees.find(seen);
      out.tree = t ? window.__onOff(window.__scr(t.x, t.y, 0.62 * (1.6 * t.r + 2) * HS)) : null;
      // the tree line: just above the far edge of the ground, in the middle of the screen
      const k = document.getElementById('game').width / innerWidth;
      out.line = window.__onOff([Math.round(innerWidth / 2 * k), Math.round((S.horizonYX() - 3) * k)]);
      await window.__place('Abbey', -110, 250);
      const st = S.SCN.stands.find(q => Math.hypot(q.x - S.W.player.x, q.y - S.W.player.y) < 200);
      if (st) { const ca = Math.cos(st.a), sa = Math.sin(st.a), ly = -st.flip * st.h / 2 + st.flip * (st.h - 4) * 0.5; out.stand = window.__onOff(window.__scr(st.x - sa * ly, st.y + ca * ly, 4.5 * HS)); }
      await window.__place('Hamilton Straight', 0, 0);
      const PIT = T.PIT, sr = PIT.boxS(0), q = T.idx(sr), col = S.TEAMS[0].c1, bk = S.W.player, q0 = T.idx(sr - 40); // 40 m before the first box
      Object.assign(bk, { x: T.X[q0], y: T.Y[q0], h: T.H[q0], i: q0, s: q0 * T.DS, v: 0 }); S.CAM.init = false; S.W.paused = false; S.frameX(performance.now()); S.W.paused = true;
      out.door = { px: window.__px(window.__scr(...T.pt(q, PIT.garage - 0.1), 2 * HS)), col: [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16)) };
      return out;
    });
    check(r.tree && r.tree.d > 40, 'a tree stands up (its crown 4 m up is not grass)', r.tree ? `crown rgb ${r.tree.on}, without 3D scenery ${r.tree.off}` : 'no tree in view');
    check(r.stand && r.stand.d > 40, 'Abbey: the grandstand shows its crowd above the ground', r.stand ? `rgb ${r.stand.on}, without ${r.stand.off}` : 'no stand near Abbey');
    const dd = r.door.px.reduce((a, v, k) => a + Math.abs(v - r.door.col[k]), 0);
    check(dd < 150, 'the Wing: the first garage door is in its team colour', `rgb ${r.door.px} vs team ${r.door.col} (difference ${dd})`);
    check(r.line.d > 15, 'the tree line stands above the far edge of the ground', `rgb ${r.line.on}, without ${r.line.off}`);
  }

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
    // the colours at a device pixel with the 3D scenery on and off (test switch 7)
    window.__onOff = pt => { const S = window.__sgp; S.PERF.noWalls = false; const on = window.__px(pt); S.PERF.noWalls = true; const off = window.__px(pt); S.PERF.noWalls = false; return { on, off, d: on.reduce((a, v, k) => a + Math.abs(v - off[k]), 0) }; };
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
  // phase 4: a braking board before Stowe stands up, and the start lights show over the grid
  {
    const r = await page.evaluate(async () => {
      const S = window.__sgp, T = S.T, HS = S.PHYS.VS; await window.__place('Stowe', -330, 250);
      const b = S.W.player, ahead = q => (q - b.i + T.N) % T.N;
      const bd = T.boards.filter(x => ahead(x.i) * T.DS > 30 && ahead(x.i) * T.DS < 120).sort((u, v) => ahead(u.i) - ahead(v.i))[0];
      const e = bd.side > 0 ? T.WR[bd.i] : T.WL[bd.i], pt = window.__scr(...T.pt(bd.i, bd.side * (e + 3.2)), 1.0 * HS);
      S.PERF.noWalls = false; const on = window.__px(pt); S.PERF.noWalls = true; const off = window.__px(pt); S.PERF.noWalls = false;
      return { on, off, ahead: ahead(bd.i) * T.DS, dist: bd.dist };
    });
    const d = r.on.reduce((a, v, k) => a + Math.abs(v - r.off[k]), 0);
    check(Math.max(...r.on) - Math.min(...r.on) < 30 && Math.min(...r.on) > 80 && d > 60, 'Stowe: a braking board stands up (grey to white at 1 m)', `${r.dist} board rgb ${r.on}, without 3D scenery ${r.off}, ${r.ahead.toFixed(0)} m ahead`);
    const g = await page.evaluate(async () => {
      const S = window.__sgp, T = S.T; await window.__place('Hamilton Straight', 0, 0); // practice: stands at the pit exit, then placed
      const b = S.W.player, q = T.N - 40; Object.assign(b, { x: T.X[q], y: T.Y[q], h: T.H[q], i: q, s: q * T.DS, v: 0 });
      S.CAM.init = false; S.W.paused = false; S.frameX(performance.now()); S.W.paused = true;
      return window.__px(window.__scr(T.X[0], T.Y[0], 6.7 * S.PHYS.VS));
    });
    check(g[0] > g[1] + 40 && g[0] > g[2] + 40, 'start gantry: the start lights are red over the grid', `rgb ${g}`);
  }
  // speed feel: more motion at the screen edges with the 3D scenery
  {
    const r = await page.evaluate(async () => {
      const S = window.__sgp, c = document.createElement('canvas'); c.width = 368; c.height = 208; const g = c.getContext('2d');
      // the summed colour change of the outer quarters of the screen between two frames, and the pixels counted
      const edgeChange = (d, prev) => {
        let sum = 0, n = 0;
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            if (x > c.width * 0.25 && x < c.width * 0.75) { continue; }
            const i = (y * c.width + x) * 4; sum += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]); n++;
          }
        }
        return [sum, n];
      };
      const run = async noWalls => {
        S.PERF.noWalls = noWalls; await window.__place('Hangar Straight', 20, 300); S.PERF.noWalls = noWalls;
        let t = performance.now(), prev = null, sum = 0, n = 0; S.W.paused = false;
        for (let k = 0; k < 60; k++) {
          t += 1000 / 60; S.frameX(t); g.drawImage(S.screenX(), 0, 0, c.width, c.height);
          const d = g.getImageData(0, 0, c.width, c.height).data;
          if (prev) { const [a, m] = edgeChange(d, prev); sum += a; n += m; }
          prev = d;
        }
        S.W.paused = true; S.PERF.noWalls = false;
        return { motion: sum / n, kmh: S.W.player.v * 3.6 };
      };
      return { on: await run(false), off: await run(true) };
    });
    check(r.on.motion > r.off.motion * 1.05, 'speed feel: more motion at the screen edges with 3D scenery', `pixel change per frame ${r.off.motion.toFixed(2)} -> ${r.on.motion.toFixed(2)} (+${((r.on.motion / r.off.motion - 1) * 100).toFixed(0)} %) at ${r.on.kmh.toFixed(0)} km/h`);
  }
  await phase3(page, check);
  // Classic graphics keep the flat walls
  {
    const r = await page.evaluate(async () => {
      const S = window.__sgp; S.UI.opts.gfx = 'classic'; await window.__place('Hangar Straight', 100, 300); S.drawWorldX();
      const res = { on: S.walls3DOn(), tiles: S.TILE_WALLS.on3d }; S.UI.opts.gfx = '3d'; return res;
    });
    check(!r.on && !r.tiles, 'Classic graphics: no 3D walls, flat walls in the tiles', `walls3DOn ${r.on}, tiles without flat walls ${r.tiles}`);
  }
  // frame cost of the 3D scenery (walls and trackside)
  {
    const r = await page.evaluate(async () => {
      const S = window.__sgp, res = {};
      for (const [corner, off, kmh] of [['Abbey', -110, 250], ['Club', -100, 200]]) {
      await window.__place(corner, off, kmh);
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
      res[corner] = { on: med(tOn), off: med(tOff) };
      }
      return res;
    });
    for (const [corner, m] of Object.entries(r)) {
      const add = m.on / m.off - 1;
      check(add <= COST, `${corner}: frame cost of the 3D scenery at most 15 %`, `world ${m.off.toFixed(2)} ms -> with 3D scenery ${m.on.toFixed(2)} ms (+${(add * 100).toFixed(1)} %)`);
    }
  }
  await browser.close();
  console.log(failed ? `${failed} of ${total} 3D track checks FAILED` : `all ${total} 3D track checks passed`);
  if (failed || process.exitCode) process.exitCode = 1;
})();
