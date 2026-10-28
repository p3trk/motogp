#!/usr/bin/env node
// Practice start test (GDD 2a, 11c, since 1.16.0): practice starts on the race grid slot with no start lights and
// waits for the first input; ghosts start with the player. A standing-start recording launches without its lights
// delay; on a curve-training spot the reference ghost stands on the spot and the others are placed by lap time;
// R, Restart and Go to spot sync them again; old recordings without a start still load.
// The recordings are built inside the test (synthetic samples along the centreline), no hand-made files.
// v1.15.0 fails it (practice starts in the pit box, no ghost on the spot).
// Usage: node tests/practice_start.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const r = await page.evaluate(() => {
    const S = window.__sgp, W = S.W, T = S.T, UI = S.UI, Lib = S.Lib, out = {};
    const wrapD = d => { d = ((d % T.L) + T.L) % T.L; return d > T.L / 2 ? d - T.L : d; };
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let lightsSeen = false;
    const step = n => { for (let k = 0; k < n; k++) { S.simStep(S.SUB); if (W.lights !== 0 || W.phase === 'lights') lightsSeen = true; } };
    const press = () => { S.Input.k.KeyW = true; step(1); S.Input.k.KeyW = false; };
    const until = (el) => { while (W.time - W.startT < el - 1e-9) step(1); };
    const key = code => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
    const setGhosts = ids => { Lib.ghosts.slice().forEach(id => Lib.toggleGhost(id)); ids.forEach(id => Lib.toggleGhost(id)); };
    const practice = train => { UI.opts.mode = 'practice'; UI.opts.train = train; UI.launch('practice', {}); };
    const pose = g => ({ x: g.x, y: g.y, show: g.show, v: g.v });
    // centreline point at track distance s, d metres to the right
    const at = (s, d) => {
      s = T.wrapS(s); const f0 = s / T.DS, i = Math.floor(f0) % T.N, j = (i + 1) % T.N, f = f0 - Math.floor(f0);
      const x = T.X[i] + (T.X[j] - T.X[i]) * f, y = T.Y[i] + (T.Y[j] - T.Y[i]) * f, nx = T.NX[i] + (T.NX[j] - T.NX[i]) * f, ny = T.NY[i] + (T.NY[j] - T.NY[i]) * f;
      return { x: x + nx * d, y: y + ny * d, h: Math.atan2(T.Y[j] - T.Y[i], T.X[j] - T.X[i]) };
    };
    // synthetic recording: progress p0 at t = 0, standing until hold, then acc up to vmax
    let nid = 0;
    const mkRec = o => {
      const dt = 0.1, n = Math.round(o.dur / dt) + 1, Sm = { dt, x: [], y: [], h: [], v: [], lean: [], s: [], p: [] };
      const tA = o.vmax / o.acc, D = t => { const u = t - o.hold; return u <= 0 ? 0 : u < tA ? 0.5 * o.acc * u * u : 0.5 * o.acc * tA * tA + o.vmax * (u - tA); };
      const tOf = dd => { if (dd <= 0) return o.hold; const dA = 0.5 * o.acc * tA * tA; return o.hold + (dd < dA ? Math.sqrt(2 * dd / o.acc) : tA + (dd - dA) / o.vmax); };
      for (let k = 0; k < n; k++) {
        const t = k * dt, p = o.p0 + D(t), q = at(p, o.d), u = t - o.hold;
        Sm.x.push(q.x); Sm.y.push(q.y); Sm.h.push(q.h); Sm.v.push(u <= 0 ? 0 : Math.min(o.vmax, o.acc * u)); Sm.lean.push(0); Sm.s.push(T.wrapS(p)); Sm.p.push(p);
      }
      const laps = []; for (let m = 0; m < 9; m++) { const a = tOf(m * T.L - o.p0), b = tOf((m + 1) * T.L - o.p0); if (m * T.L >= o.p0 && b <= o.dur) laps.push({ start: a, end: b, time: b - a }); }
      const R = { format: 'silverstone-gp-session', version: 1, game: 'Silverstone GP', track: 'silverstone', id: 'test' + (nid++), date: new Date(Date.now() - nid * 60000).toISOString(),
        kind: o.kind, mode: o.mode, totalLaps: o.mode === 'race' ? 10 : 0, rider: { name: o.name, num: o.num, team: o.team, short: o.name.slice(0, 3).toUpperCase() }, aids: true, auto: true,
        laps: o.mode === 'race' ? [] : laps, bestLap: o.mode === 'race' || !laps.length ? 0 : laps[0].time, raceStart: o.raceStart || 0, finishT: 0, position: o.mode === 'race' ? 1 : 0, pits: 0, samples: Sm };
      if (o.start) R.start = o.start;
      return R;
    };
    const add = R => { const ok = Lib.add(R, 'import'); return ok ? R : null; };

    // 1. grid start: same slot as the 10 lap race, not in the pit lane, no lights, held until the first input
    setGhosts([]);
    out.slots = ['pole', 'front', 'mid', 'back'].map(pos => {
      UI.opts.grid = pos; UI.opts.mode = 'sprint'; UI.launch('sprint', {}); const rb = W.player, race = { s: rb.s, d: rb.d, grid: rb.grid };
      practice('off'); const b = W.player;
      return { pos, ds: Math.abs(wrapD(b.s - race.s)), dd: Math.abs(b.d - race.d), grid: b.grid, raceGrid: race.grid, onTrack: b.d < T.WR[b.i] && !b.inPitLane && !b.outLap, lights: W.lights, phase: W.phase };
    });
    UI.opts.grid = 'mid'; practice('off');
    { const b = W.player, x0 = b.x, y0 = b.y; lightsSeen = false; step(240);
      out.hold = { moved: Math.hypot(b.x - x0, b.y - y0), held: !!b.trainHold, startT: W.startT, msg: S.UI && document.getElementById('pause').hidden };
      const t1 = W.time; press(); out.hold.startAt = W.startT - t1;
      b.autopilot = true; let g = 0; while (b.laps.length < 1 && g++ < 120 * 400) step(1);
      const L1 = S.Rec.cur.laps[0]; out.lap1 = { n: b.laps.length, startErr: L1 ? Math.abs(L1.start - W.startT) : 99, timeErr: L1 ? Math.abs(b.laps[0] - (L1.end - W.startT)) : 99, lights: lightsSeen };
    }
    UI.toMenu();

    // 2. race recording, lights out at 6.2 s, launch at 6.5 s (no start field: a file from before 1.16.0)
    const RR = add(mkRec({ name: 'Racer', num: 46, team: 0, mode: 'race', kind: 'sprint', raceStart: 6.2, p0: -8, d: 3.9, hold: 6.5, acc: 8, vmax: 60, dur: 40 }));
    setGhosts([RR.id]); practice('off');
    { const g = W.ghosts[0]; step(60); const a = pose(g); step(60); const b2 = pose(g);
      out.race = { n: W.ghosts.length, sync: g && g.sync, launch: g && g.launch, standing: dist(a, b2), atLaunch: dist(a, { x: RR.samples.x[65], y: RR.samples.y[65] }), shown: a.show };
      press(); until(2);
      const ex = { x: RR.samples.x[85], y: RR.samples.y[85] }, l0 = { x: RR.samples.x[65], y: RR.samples.y[65] };
      out.race.err2 = dist(g, ex); out.race.cover = dist(g, l0); out.race.recCover = dist(ex, l0); out.race.el = W.time - W.startT;
      // re-sync on the grid: R puts the ghost back on its launch pose, standing
      until(5); key('KeyR'); const g2 = W.ghosts[0]; step(120); out.race.resync = dist(g2, l0); out.race.resyncHeld = W.startT < 0 && W.player.trainHold;
    }
    UI.toMenu();

    // 3. spot sync: two practice recordings, A at 50 m/s (start field), B at 45 m/s (old file without start)
    const A = add(mkRec({ name: 'Alpha', num: 11, team: 1, mode: 'practice', kind: 'practice', p0: -300, d: 0, hold: 0, acc: 1e6, vmax: 50, dur: 140, start: { kind: 'box', t: 0 } }));
    const B = add(mkRec({ name: 'Bravo', num: 22, team: 3, mode: 'practice', kind: 'practice', p0: -300, d: 0, hold: 0, acc: 1e6, vmax: 45, dur: 150 }));
    out.loaded = { A: !!A, B: !!B, bLaps: B && B.laps.length };
    setGhosts([A.id, B.id]); Lib.setSync(A.id);
    UI.renderLib(); const sb = [...document.querySelectorAll('#recList button[data-act="sync"]')];
    out.ui = { syncButtons: sb.length, marked: sb.filter(x => x.getAttribute('aria-pressed') === 'true').map(x => x.dataset.id) };
    UI.opts.trainS = 1000; UI.opts.trainV = 180; practice('on');
    UI.togglePause(); const P = document.getElementById('pauseSync'), sel = document.getElementById('optSync');
    out.ui.pause = { shown: !!P && !P.hidden, options: sel ? sel.options.length : 0, value: sel && sel.value }; UI.togglePause();
    { const s0 = 1000, ga = W.ghosts.find(g => g.rec.id === A.id), gb = W.ghosts.find(g => g.rec.id === B.id);
      step(60); const a0 = pose(ga), b0 = pose(gb); step(60);
      press();
      out.spot = { ref: W.syncRef && W.syncRef.rec.id === A.id, sync: W.ghosts.map(g => g.sync).join(), tSpot: ga.t0, onSpot: Math.abs(wrapD(ga.s - s0)), standing: dist(a0, ga) + dist(b0, gb), msg: '' };
      const tau = ga.t0 - ga.rec.laps[0].start; out.spot.tau = tau;
      out.spot.bInto = Math.abs(wrapD(gb.s - 45 * tau)); out.spot.bShown = gb.show;
      until(3); const ex = at(-300 + 50 * (ga.t0 + 3), 0); out.spot.err3 = dist(ga, ex);
      // change the reference to B and press R: B now stands on the spot, A is placed by lap time
      Lib.setSync(B.id); key('KeyR'); step(1);
      const ga2 = W.ghosts.find(g => g.rec.id === A.id), gb2 = W.ghosts.find(g => g.rec.id === B.id);
      out.swap = { ref: W.syncRef && W.syncRef.rec.id === B.id, bOnSpot: Math.abs(wrapD(gb2.s - s0)), aAt: Math.abs(wrapD(ga2.s - 50 * (s0 / 45))) };
      // re-sync after riding 5 s: R and Go to spot put both ghosts back, standing
      const sa = pose(ga2), sbb = pose(gb2);
      press(); W.player.autopilot = true; until(5);
      key('KeyR'); step(120);
      const back = () => { const a = W.ghosts.find(g => g.rec.id === A.id), b = W.ghosts.find(g => g.rec.id === B.id); return { err: dist(a, sa) + dist(b, sbb), v: a.v + b.v, held: W.startT < 0 }; };
      out.resyncR = back();
      press(); W.player.autopilot = true; until(5);
      document.getElementById('btnTrainGo').click(); step(120);
      out.resyncGo = back();
    }
    UI.toMenu();

    // 4. old file on a grid start: B (no start, no standing start) rides from the first line crossing
    setGhosts([B.id]); practice('off');
    { const g = W.ghosts[0]; out.old = { sync: g && g.sync, before: false, after: false };
      press(); W.player.autopilot = true; let k = 0;
      while (W.lineT < 0 && k++ < 120 * 60) { step(1); if (g.show && W.lineT < 0) out.old.before = true; }
      out.old.crossed = W.lineT >= 0; step(120); out.old.after = g.show;
    }
    UI.toMenu();
    return out;
  });
  await browser.close();
  const checks = [];
  const ck = (name, ok, info) => { checks.push(ok); console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  for (const s of r.slots) ck(`grid ${s.pos}: same slot as the 10 lap race, on track, no lights`, s.ds < 0.1 && s.dd < 0.1 && s.grid === s.raceGrid && s.onTrack && s.lights === 0 && s.phase === 'run', `ds ${s.ds.toFixed(3)} m  dd ${s.dd.toFixed(3)} m  P${s.grid}/P${s.raceGrid}`);
  ck('grid: the bike does not move before the first input', r.hold.moved < 1e-6 && r.hold.held && r.hold.startT < 0, `moved ${r.hold.moved.toFixed(4)} m`);
  ck('grid: the start moment is the first input', Math.abs(r.hold.startAt) < 0.02, `${r.hold.startAt.toFixed(3)} s`);
  ck('grid: lap 1 is timed from the first input', r.lap1.n === 1 && r.lap1.startErr < 0.01 && r.lap1.timeErr < 0.01, `start err ${r.lap1.startErr.toFixed(4)} s  time err ${r.lap1.timeErr.toFixed(4)} s`);
  ck('grid: no start lights at any time', !r.lap1.lights);
  ck('race ghost: standing start found, launch at 6.5 s', r.race.n === 1 && r.race.sync === 'rec' && Math.abs(r.race.launch - 6.5) < 0.05, `launch ${r.race.launch}`);
  ck('race ghost: does not move before the first input, on its launch pose', r.race.shown && r.race.standing < 1e-6 && r.race.atLaunch < 0.3, `moved ${r.race.standing.toFixed(4)} m  from launch pose ${r.race.atLaunch.toFixed(3)} m`);
  ck('race ghost: 2 s after the input it is where the recording is 2 s after its launch', r.race.err2 < 0.5 && Math.abs(r.race.cover - r.race.recCover) < 0.5, `err ${r.race.err2.toFixed(3)} m  covered ${r.race.cover.toFixed(2)} / ${r.race.recCover.toFixed(2)} m`);
  ck('race ghost: R puts it back on its launch pose, standing', r.race.resync < 0.3 && r.race.resyncHeld, `${r.race.resync.toFixed(3)} m`);
  ck('old file without start loads', r.loaded.A && r.loaded.B && r.loaded.bLaps >= 1);
  ck('Recordings: Sync on both ghost rows, exactly one marked', r.ui.syncButtons === 2 && r.ui.marked.length === 1, `${r.ui.syncButtons} buttons, marked ${r.ui.marked.join()}`);
  ck('pause menu: Sync ghosts to list with 2 ghosts', r.ui.pause.shown && r.ui.pause.options === 2, JSON.stringify(r.ui.pause));
  ck('spot: both ghosts synced, A is the reference', r.spot.ref && r.spot.sync === 'spot,spot', r.spot.sync);
  ck('spot: reference within 2 m of the spot at the start moment', r.spot.onSpot < 2, `${r.spot.onSpot.toFixed(3)} m  t_spot ${r.spot.tSpot.toFixed(3)} s (expected 26.0)`);
  ck('spot: ghosts stand still until the first input', r.spot.standing < 1e-6);
  ck('spot: 3 s later the reference is where its recording is 3 s after t_spot', r.spot.err3 < 0.5, `${r.spot.err3.toFixed(3)} m`);
  ck('spot: the other ghost is tau seconds into its best lap', r.spot.bShown && r.spot.bInto < 1, `tau ${r.spot.tau.toFixed(3)} s  off ${r.spot.bInto.toFixed(3)} m`);
  ck('spot: new reference + R puts the other ghost on the spot', r.swap.ref && r.swap.bOnSpot < 2 && r.swap.aAt < 1, `B ${r.swap.bOnSpot.toFixed(3)} m from the spot  A off ${r.swap.aAt.toFixed(3)} m`);
  ck('re-sync: R after 5 s puts the ghosts back, standing', r.resyncR.err < 0.01 && r.resyncR.v === 0 && r.resyncR.held, `${r.resyncR.err.toFixed(4)} m`);
  ck('re-sync: Go to spot after 5 s puts the ghosts back, standing', r.resyncGo.err < 0.01 && r.resyncGo.v === 0 && r.resyncGo.held, `${r.resyncGo.err.toFixed(4)} m`);
  ck('old file on the grid: no ghost before the first line crossing', r.old.sync === 'line' && r.old.crossed && !r.old.before, JSON.stringify(r.old));
  ck('old file on the grid: ghost rides from the first line crossing', r.old.after);
  const bad = checks.filter(x => !x).length;
  console.log(bad ? `practice_start: ${bad} of ${checks.length} checks failed` : `practice_start: all ${checks.length} checks passed`);
  if (bad) process.exitCode = 1;
})();
