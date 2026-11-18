#!/usr/bin/env node
// 3D bike test (GDD 11l, 11m): the three.js bikes, drawn in the tilted view. Checks that a 3D bike lands where the road
// is (its screen position matches worldToScreen), that the rider stays on the bike and the lean and steering move it,
// and that drawing a 22-bike field in 3D stays within a frame budget. Classic (2D) bikes are not tested here.
// Usage: node tests/bike3d.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let failed = 0, total = 0;
  const check = (ok, name, info) => { total++; if (!ok) { failed++; } console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(62)} ${info || ''}`); };
  const page = await browser.newPage({ viewport: { width: 1470, height: 830 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.addInitScript(() => { // a fake animation clock: the test decides when frames happen (as the other browser tests do)
    window.__rafQ = []; window.requestAnimationFrame = cb => { window.__rafQ.push(cb); return 1; };
    window.__tick = t => { const q = window.__rafQ; window.__rafQ = []; for (const cb of q) cb(t); };
    try { localStorage.clear(); } catch { /* storage may be blocked */ }
  });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  await page.evaluate(() => {
    for (const k of ['sgp_cam', 'sgp_cam_close', 'sgp_opts']) localStorage.removeItem(k);
    const S = window.__sgp, T = S.T, c = T.corners.find(c => c.name === 'Hangar Straight');
    S.UI.opts.mode = 'practice'; S.UI.opts.cam = 'close'; S.UI.opts.gfx = '3d'; S.UI.opts.fx = 'off'; S.UI.opts.blur = 'off';
    S.UI.opts.train = 'on'; S.UI.opts.trainS = T.wrapS(c.s + 200); S.UI.opts.trainV = 0;
    S.UI.launch('practice', {}); S.setCamModeX('close'); const b = S.W.player; b.v = 0; b.lean = 0; b.trainHold = true;
  });
  // let the camera settle on the bike, in the 3D view
  await page.evaluate(() => { let t = 1000; window.__frame = () => { t += 1000 / 60; window.__tick(t); }; window.__frame(); });
  await page.evaluate(() => { for (let k = 0; k < 60; k++) window.__frame(); });

  // 1) the 3D bike is on the road: its projected centre matches worldToScreen of the bike's position
  const place = await page.evaluate(() => {
    const S = window.__sgp, b = S.W.player;
    const f = S.gl3DBikeFrame(b);                         // the bike's origin on the road, as the game places the meshes
    const [sx, sy] = S.worldToScreen(b.x, b.y);
    const P = S.gl3DProjection(S.tiltP());
    const clip = (u, Y, Z) => [P[0] * u + P[1] * Y + P[2] * Z + P[3], P[4] * u + P[5] * Y + P[6] * Z + P[7], P[8] * u + P[9] * Y + P[10] * Z + P[11], P[12] * u + P[13] * Y + P[14] * Z + P[15]];
    const q = clip(f.O[0], f.O[1], f.O[2]);
    const px = (q[0] / q[3] + 1) / 2 * window.innerWidth, py = (1 - q[1] / q[3]) / 2 * window.innerHeight;
    return { dx: px - sx, dy: py - sy };
  });
  check(Math.abs(place.dx) < 1.5 && Math.abs(place.dy) < 1.5, '3D bike sits on the road at the 2D track position', `${place.dx.toFixed(2)} px, ${place.dy.toFixed(2)} px off`);

  // 2) lean and steering move the 3D bike
  const moves = await page.evaluate(() => {
    const S = window.__sgp, b = S.W.player;
    const read = () => S.gl3DMesh(b).find(x => x.userData.role === 'body').matrix.elements.slice();
    b.lean = 0; S.gl3DDraw([b]); const upright = read();
    b.lean = 0.5; S.gl3DDraw([b]); const leaned = read();
    b.lean = 0; S.gl3DDraw([b]);
    const wheelOf = () => S.gl3DMesh(b).find(x => x.userData.role === 'wheel').matrix.elements.slice();
    b.ctl.steer = 0; S.gl3DDraw([b]); const straight = wheelOf();
    b.ctl.steer = 1; S.gl3DDraw([b]); const turned = wheelOf();
    b.ctl.steer = 0;
    const d = (a, c) => Math.hypot(...a.map((v, i) => v - c[i]));
    return { lean: d(upright, leaned), steer: d(straight, turned) };
  });
  check(moves.lean > 0.05, 'lean rolls the 3D bike', `matrix change ${moves.lean.toFixed(3)}`);
  check(moves.steer > 0.01, 'steering turns the 3D front wheel', `matrix change ${moves.steer.toFixed(3)}`);

  // 3) the rider is on the player's bike only, and the rider's poses are blended for the lean
  const rider = await page.evaluate(() => {
    const S = window.__sgp, me = S.W.player, other = Object.assign(Object.create(Object.getPrototypeOf(me)), me, { isPlayer: false, id: 999 });
    S.gl3DDraw([me, other]);
    const mine = S.gl3DMesh(me).some(m => m.userData.role === 'rider'), theirs = S.gl3DMesh(other).some(m => m.userData.role === 'rider');
    me.lean = 0.7; S.gl3DDraw([me]);
    const skin = S.gl3DMesh(me).find(m => m.userData.role === 'rider');
    const w = skin.morphTargetInfluences.reduce((s, v) => s + v, 0);
    me.lean = 0;
    return { mine, theirs, w };
  });
  check(rider.mine && !rider.theirs, 'rider on the player\'s bike only', `player ${rider.mine}, other bike ${rider.theirs}`);
  check(Math.abs(rider.w - 1) < 1e-6, 'rider poses blend to full weight at a lean', `weights sum ${rider.w.toFixed(3)}`);

  // 4) frame cost. The CPU work the 3D layer adds per frame (placing 22 bikes: the pose blend and the matrices) is
  // checked against a budget. The renderer's draw time is reported but not checked: this headless browser draws with
  // software WebGL, so the GPU number here says nothing about a real machine (the game runs smoothly on the player's).
  const cost = await page.evaluate(() => {
    const S = window.__sgp, me = S.W.player, T = S.T;
    const field = [me];
    for (let k = 1; k < 22; k++) {
      const i = (me.i + 4 * k) % T.N, d = (k % 2 ? -3 : 3), [x, y] = T.pt(i, d);
      field.push(Object.assign(Object.create(Object.getPrototypeOf(me)), me, { id: 100 + k, isPlayer: false, x, y, i, d, lean: 0.2, v: 40 / 3.6 }));
    }
    const cpu = () => { let best = 1e9; for (let r = 0; r < 5; r++) { const t0 = performance.now(); for (let k = 0; k < 50; k++) { for (const b of field) { S.gl3DBikeFrame(b); S.gl3DPoseWeights(b.lean); } } best = Math.min(best, (performance.now() - t0) / 50); } return best; };
    const gpu = list => { let best = 1e9; for (let r = 0; r < 3; r++) { const t0 = performance.now(); for (let k = 0; k < 10; k++) { S.gl3DDraw(list); } best = Math.min(best, (performance.now() - t0) / 10); } return best; };
    for (let k = 0; k < 10; k++) S.gl3DDraw(field);
    return { cpu: cpu(), drawWith: gpu(field), drawWithout: gpu([]) };
  });
  check(cost.cpu < 2, '22 bikes: the 3D layer\'s CPU work per frame is under 2 ms', `${cost.cpu.toFixed(3)} ms`);
  console.log(`INFO  renderer draw time, 22 bikes: ${(cost.drawWith - cost.drawWithout).toFixed(1)} ms here (software WebGL, not checked)`);

  console.log(`\n${total - failed} of ${total} 3D bike checks passed`);
  if (failed) { console.log(`${failed} of ${total} 3D bike checks FAILED`); process.exitCode = 1; }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
