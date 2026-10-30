// Unit tests for src/replay.js (GDD 13b): recorder, file format, library, ghosts, replay viewer.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, makeRec, plain } = require('./load');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const tick = () => new Promise(r => setImmediate(r));
function session(kind, extra, lo) {
  const g = load(lo); g.G.setupSession(kind, g.G.UI.sessionOpts(Object.assign({ train: null }, extra)));
  return Object.assign(g, { W: g.G.W, b: g.G.W.player, T: g.G.T });
}
// in-memory IndexedDB with the three stores of the old library
function fakeIDB(stores) {
  const req = result => { const r = { result }; queueMicrotask(() => { r.onsuccess && r.onsuccess({ target: r }); }); return r; };
  const db = {
    stores, transaction: (name, mode) => ({
      objectStore: () => ({
        mode, get: k => req(stores[name][k]), getAll: () => req(Object.values(stores[name])),
        put: (v, k) => { stores[name][k] = v; return req(); }, clear: () => { stores[name] = {}; return req(); }
      })
    })
  };
  return { db, open() { const r = { result: db }; queueMicrotask(() => r.onsuccess()); return r; } };
}
// a saved_tracks folder handle with files {name: text}
function fakeDir(files, perm = 'granted') {
  return {
    name: 'saved_tracks', kind: 'directory', files,
    async *entries() { for (const [n, t] of Object.entries(files)) yield [n, { kind: 'file', getFile: async () => ({ name: n, text: async () => t }) }]; },
    requestPermission: async () => perm, queryPermission: async () => perm,
    getFileHandle: async n => ({ createWritable: async () => ({ write: async d => { files[n] = d; }, close: async () => { } }) })
  };
}

test('r2: rounds to steps of 1/k', () => {
  const { G } = load(); assert.equal(G.r2(1.23456, 100), 1.23); assert.equal(G.r2(7.25, 10), 7.3); assert.equal(G.r2(-0.0004, 1000), -0);
});

// --- recorder --------------------------------------------------------------
test('Rec.start: a new recording of the session and the rider', () => {
  const { G, W, b } = session('practice'); G.Rec.start(); const R = G.Rec.cur;
  assert.equal(R.format, 'silverstone-gp-session'); assert.equal(R.kind, 'practice'); assert.equal(R.rider.name, b.name);
  assert.deepEqual(R.start, { kind: 'grid', t: 0, slot: W.gridSlot + 1 }); assert.equal(R.samples.dt, 0.1); assert.equal(R.samples.x.length, 0);
});
test('Rec.sample: samples land on the 0.1 s grid, interpolated between physics steps', () => {
  const { G, W, b } = session('practice'); G.Rec.start(); const S = G.Rec.cur.samples;
  const at = (t, x) => { W.time = t; b.x = x; b.progress = x; G.Rec.sample(); };
  at(0, 0); at(0.06, 6); at(0.12, 12);
  assert.equal(S.x.length, 2); assert.equal(S.x[1], 10, 'the 0.1 s sample between 0.06 and 0.12');
  b.crashed = true; b.crash = { bk: { x: 99, y: 5 } }; at(0.2, 20); assert.equal(S.x[2], 99); assert.equal(S.v[2], 0);
});
test('Rec.lap: laps with autopilot and invalid flags', () => {
  const { G } = session('practice'); G.Rec.start();
  G.Rec.lap(1.23456, 131.5, 130.26544, true, true);
  assert.deepEqual(G.Rec.cur.laps[0], { start: 1.235, end: 131.5, time: 130.265, ap: 1, inv: 1 });
  G.Rec.cur = null; G.Rec.lap(0, 1, 1); // no recording: nothing happens
});
test('Rec.snapshot: a finished copy with best lap and race result', () => {
  const { G, W, b } = session('sprint'); G.Rec.start();
  G.Rec.lap(5, 135, 130); G.Rec.lap(135, 263, 128, false, true); G.Rec.lap(263, 400, 127, true);
  W.raceStartT = 5.1234; b.finished = true; b.finishT = 1300.4567; b.pits = 1;
  const R = G.Rec.snapshot();
  assert.equal(R.bestLap, 130, 'invalid and autopilot laps are not the best'); assert.equal(R.raceStart, 5.123); assert.equal(R.start.t, 5.123);
  assert.equal(R.finishT, 1300.457); assert.ok(R.position >= 1); assert.equal(R.pits, 1);
  assert.notEqual(R, G.Rec.cur);
});
test('Rec.stop: kept in the library when it holds a lap', () => {
  const { G, env } = session('practice'); G.Rec.start(); assert.equal(G.Rec.stop(), null, 'nothing to keep');
  G.Rec.start(); G.Rec.sample(); G.Rec.lap(1, 131, 130);
  const R = G.Rec.stop();
  assert.ok(R); assert.equal(G.Rec.cur, null); assert.equal(G.Rec.last, R);
  assert.ok(G.Lib.meta.some(m => m.id === R.id)); assert.equal(JSON.parse(env.ls.getItem('sgp_sessions')).length, 1);
});
test('recStartOf: grid, spot or box', () => {
  assert.equal(session('sprint', { gridPos: 'front' }).G.recStartOf().slot, 3);
  const t = session('practice', { train: { s: 1000.04, v: 50.123 } }).G.recStartOf(); assert.deepEqual(t, { kind: 'spot', t: 0, s: 1000, v: 50.12 });
  assert.deepEqual(session('practice').G.recStartOf(), { kind: 'grid', t: 0, slot: 12 });
  assert.deepEqual(session('quali').G.recStartOf(), { kind: 'box', t: 0 });
});
test('recStart: the saved start, or one guessed for old files', () => {
  const { G } = load();
  assert.deepEqual(G.recStart({ start: { kind: 'spot', t: 2, s: 5 } }), { kind: 'spot', t: 2, s: 5 });
  assert.deepEqual(G.recStart({ mode: 'race', raceStart: 6.2 }), { kind: 'grid', t: 6.2 });
  assert.deepEqual(G.recStart({ mode: 'practice', start: { kind: 'moon', t: 0 } }), { kind: 'box', t: 0 });
  assert.deepEqual(G.recStart({ mode: 'race', raceStart: 1, start: { kind: 'grid', t: -1 } }), { kind: 'grid', t: 1 });
});
test('recLaunch: the last standing sample before the bike moves', () => {
  const { G } = load(); const R = makeRec(G, { stand: 2, laps: 1 });
  near(G.recLaunch(R, 0), 1.9, 1e-9); near(G.recLaunch(R, 5), 5, 1e-9, 'already moving');
  near(G.recLaunch(makeRec(G, { v: 0.1, laps: 0, end: 3 }), 0.5), 0.5, 1e-9, 'never moves');
});
test('recTimeAt: when the lap passes a track distance', () => {
  const { G } = load(); const R = makeRec(G, { v: 60, laps: 2 }), l = R.laps[1];
  near(G.recTimeAt(R, l, 600), l.start + 10, 0.05);
  near(G.recTimeAt(R, l, G.T.L - 1), l.start + (G.T.L - 1) / 60, 0.05);
});
test('recFileName: kind, rider, best lap and local date', () => {
  const { G } = load(); const R = makeRec(G, { kind: 'quali', laps: 1, date: new Date(2026, 9, 30, 9, 5).toISOString() });
  R.bestLap = 98.127; R.rider.name = 'Jo Ão!';
  assert.equal(G.recFileName(R), 'silverstone_quali_Joo_1-38-127_2026-10-30_0905.json');
  R.kind = 'gp'; R.bestLap = 0; R.rider.name = '***';
  assert.equal(G.recFileName(R), 'silverstone_gp_rider_nolap_2026-10-30_0905.json');
});
test('recValid: format checks and cleaned rider fields', () => {
  const { G } = load(); const R = makeRec(G, { laps: 1 });
  R.rider = { name: 'A very long rider name indeed', num: 140, team: 99 };
  assert.equal(G.recValid(R), true); assert.equal(R.rider.name.length, 20); assert.equal(R.rider.num, 99); assert.equal(R.rider.team, G.TEAMS.length - 1); assert.equal(R.rider.short, 'A V');
  for (const bad of [null, { ...R, format: 'x' }, { ...R, track: 'monza' }, { ...R, id: 5 }, { ...R, laps: null }, { ...R, samples: { ...R.samples, v: [1] } }]) assert.equal(G.recValid(bad), false);
});
test('recMeta: the list entry of a recording', () => {
  const { G } = load(); const R = makeRec(G, { laps: 2 }); const m = G.recMeta(R, 'import');
  assert.equal(m.id, R.id); assert.equal(m.src, 'import'); assert.equal(m.laps, 2); assert.equal(m.file, G.recFileName(R)); assert.equal(m.samples, undefined);
});
test('b64, unb64: bytes round trip', () => {
  const { G } = load(); const u = new Uint8Array(70000).map((_, k) => (k * 31) & 255);
  assert.deepEqual(G.unb64(G.b64(u)), u); assert.equal(G.b64(new Uint8Array([104, 105])), 'aGk=');
});
test('packCh, unpackCh: delta channels, big jumps escaped', () => {
  const { G } = load(); const a = [0, 1.25, -3.5, 4000.75, -4000, 4000];
  assert.deepEqual(G.unpackCh(G.packCh(a, 100), 100), a);
});
test('packRec, unpackRec: compact form keeps the samples, s comes back from p', () => {
  const { G } = load(); const R = makeRec(G, { laps: 1 }); const P = G.packRec(R);
  assert.equal(P.samples.enc, 'd16'); assert.equal(typeof P.samples.x, 'string'); assert.equal(R.samples.x.length > 0, true);
  const U = G.unpackRec(plain(P));
  for (const k of ['x', 'y', 'h', 'v', 'lean', 'p']) U.samples[k].forEach((v, i) => near(v, R.samples[k][i], 1e-9, k));
  U.samples.s.forEach((v, i) => near(v, R.samples.s[i], 0.051));
});

// --- library ---------------------------------------------------------------
const stored = (G, recs) => JSON.stringify(recs.map(R => G.packRec(R)));
test('Lib.init: sessions from localStorage, ghost list checked, no IndexedDB needed', async () => {
  const pre = load(); const A = makeRec(pre.G, { id: 'ra' }), B = makeRec(pre.G, { id: 'rb', date: '2026-10-31T10:00:00.000Z' });
  const { G } = load({ storage: { sgp_sessions: stored(pre.G, [A, B]), sgp_ghosts: ['rb', 'gone'], sgp_ghost_sync: 'rb' } });
  assert.deepEqual(G.Lib.meta.map(m => m.id), ['rb', 'ra'], 'newest first'); assert.deepEqual(G.Lib.ghosts, ['rb']); assert.equal(G.Lib.sync, 'rb');
  const bad = load({ storage: { sgp_sessions: '{nope' } }).G.Lib; assert.equal(bad.meta.length, 0); assert.equal(bad.stored, false);
});
test('Lib.init, Lib.migrate, Lib.tx: the old IndexedDB library moves to localStorage once', async () => {
  const g = load(); const { G, env } = g; const A = makeRec(G, { id: 'old1' });
  const idb = fakeIDB({ meta: { old1: G.recMeta(A, 'auto') }, data: { old1: A }, kv: {} }); env.idb = idb;
  G.Lib.meta = []; G.Lib.data = {}; env.ls.removeItem('sgp_sessions');
  await G.Lib.init();
  assert.ok(G.Lib.data.old1); assert.equal(JSON.parse(env.ls.getItem('sgp_sessions')).length, 1);
  assert.deepEqual(idb.db.stores.meta, {}, 'old stores cleared');
  assert.equal(G.Lib.tx('kv', 1).mode, 'readwrite'); assert.equal(G.Lib.tx('kv').mode, 'readonly');
});
test('Lib.sort, Lib.changed, Lib.get: newest first, change callback, lookup', async () => {
  const { G } = load(); await tick(); const L = G.Lib; let n = 0; L.onChange = () => n++;
  L.meta = [{ id: 'a', date: '2026-01-01' }, { id: 'b', date: '2026-02-01' }]; L.sort(); assert.equal(L.meta[0].id, 'b');
  L.changed(); assert.equal(n, 1);
  L.data = { a: { id: 'a' } }; assert.deepEqual(await L.get('a'), { id: 'a' }); assert.equal(await L.get('zz'), null);
});
test('Lib.loadGhosts, Lib.saveGhosts: only ghosts that exist are kept and saved', async () => {
  const { G, env } = load(); await tick(); const L = G.Lib; L.meta = [{ id: 'a' }]; L.ghosts = ['a', 'b']; L.sync = 'a';
  L.loadGhosts(); assert.deepEqual(L.ghosts, ['a']); assert.equal(env.ls.getItem('sgp_ghosts'), '["a"]'); assert.equal(env.ls.getItem('sgp_ghost_sync'), 'a');
  env.ls.full = true; L.saveGhosts();
});
test('Lib.add, Lib.persist: own sessions saved, the newest 10, imports for this visit', () => {
  const { G, env } = load(); const L = G.Lib;
  for (let k = 0; k < 12; k++) L.add(makeRec(G, { id: 'r' + k, date: `2026-10-${10 + k}T10:00:00.000Z`, laps: 1 }), 'auto');
  assert.equal(L.meta.length, 10); assert.equal(JSON.parse(env.ls.getItem('sgp_sessions')).length, 10); assert.ok(!L.data.r0 && L.data.r11);
  assert.equal(L.add(makeRec(G, { id: 'imp', laps: 1 }), 'import'), true); assert.equal(JSON.parse(env.ls.getItem('sgp_sessions')).length, 10);
  assert.equal(L.add({ format: 'x' }, 'import'), false);
  assert.equal(L.add(makeRec(G, { id: 'r11', laps: 1 }), 'import'), true, 'own session wins'); assert.equal(L.meta.find(m => m.id === 'r11').src, 'auto');
  env.ls.full = true; L.persist(); assert.match(L.status, /Browser storage is full/);
});
test('Lib.del: removed from the list, the ghosts and storage', () => {
  const { G, env } = load(); const L = G.Lib; L.add(makeRec(G, { id: 'x1', laps: 1 }), 'auto'); L.ghosts = ['x1'];
  L.del('x1'); assert.equal(L.meta.length, 0); assert.deepEqual(L.ghosts, []); assert.equal(JSON.parse(env.ls.getItem('sgp_sessions')).length, 0);
});
test('Lib.syncId, Lib.setSync: the marked ghost, else the first one', () => {
  const { G } = load(); const L = G.Lib; L.ghosts = ['a', 'b']; L.sync = 'zz';
  assert.equal(L.syncId(), 'a'); L.setSync('b'); assert.equal(L.syncId(), 'b'); L.setSync('nope'); assert.equal(L.sync, 'b');
  L.ghosts = []; assert.equal(L.syncId(), '');
});
test('Lib.toggleGhost, Lib.ghostRecs: up to four ghosts at once', () => {
  const { G } = load(); const L = G.Lib; L.ghosts = []; L.data = {};
  for (const id of ['a', 'b', 'c', 'd', 'e']) { L.data[id] = { id }; L.toggleGhost(id); }
  assert.deepEqual(L.ghosts, ['a', 'b', 'c', 'd']); assert.match(L.status, /Up to 4 ghosts/);
  L.sync = 'a'; L.toggleGhost('a'); assert.deepEqual(L.ghosts, ['b', 'c', 'd']); assert.equal(L.sync, 'b');
  delete L.data.c; assert.deepEqual(L.ghostRecs().map(R => R.id), ['b', 'd']);
});
test('Lib.importText, Lib.importFiles: JSON sessions in, other files skipped', async () => {
  const { G } = load(); const L = G.Lib; const R = makeRec(G, { id: 'imp1', laps: 1 });
  assert.equal(L.importText('not json', 'import'), 0); assert.equal(L.importText(JSON.stringify(R), 'import'), 1);
  const f = (name, text) => ({ name, text: async () => text });
  await L.importFiles([f('a.json', JSON.stringify(makeRec(G, { id: 'imp2', laps: 1 }))), f('b.json', '{}'), f('index.json', '[]'), f('c.txt', 'x')], 'import');
  assert.equal(L.status, 'Loaded 1 recording, skipped 1 file that are not Silverstone GP sessions.'); assert.ok(L.data.imp2);
});
test('Lib.canPickDir, Lib.pickDir, Lib.readDir: the saved_tracks folder', async () => {
  const { G, env } = load(); const L = G.Lib;
  assert.equal(L.canPickDir(), false);
  const dir = fakeDir({ 'a.json': JSON.stringify(makeRec(G, { id: 'fold1', laps: 1 })), 'index.json': '[]' });
  env.win.showDirectoryPicker = async () => dir; assert.equal(L.canPickDir(), true);
  await L.pickDir(); assert.equal(L.dir, dir); assert.ok(L.data.fold1); assert.match(L.status, /^saved_tracks: Loaded 1 recording\./);
  env.win.showDirectoryPicker = async () => { const e = new Error('no'); e.name = 'NotAllowedError'; throw e; };
  await L.pickDir(); assert.match(L.status, /Could not open the folder: no/);
});
test('Lib.reloadDir: asks for access again, or picks a folder', async () => {
  const { G, env } = load(); const L = G.Lib; let picked = 0;
  env.win.showDirectoryPicker = async () => { picked++; return fakeDir({}); };
  L.dir = null; await L.reloadDir(); assert.equal(picked, 1);
  L.dir = fakeDir({}, 'denied'); await L.reloadDir(); assert.equal(L.dirOK, false); assert.equal(L.status, 'Folder access was not granted.');
});
test('Lib.writeDir, Lib.export: saved to the folder, else downloaded', async () => {
  const { G, env } = load(); const L = G.Lib; const R = makeRec(G, { id: 'w1', laps: 1 });
  L.dir = null; assert.equal(await L.writeDir(R), false);
  const made = []; const ce = env.doc.createElement; env.doc.createElement = t => { const e = ce(t); made.push(e); return e; };
  await L.export(R); const a = made.find(e => e.tagName === 'A');
  assert.ok(a); assert.equal(a.download, G.recFileName(R)); assert.equal(a.parentNode, null, 'removed after the click');
  L.dir = fakeDir({}); L.dirOK = false; assert.equal(await L.writeDir(R), true); assert.ok(L.dir.files[G.recFileName(R)]);
  await L.export(R); assert.match(L.status, /^Saved silverstone_practice_/);
  L.dir = fakeDir({}, 'denied'); L.dirOK = false; assert.equal(await L.writeDir(R), false);
});
test('Lib.fetchIndex: over http the saved_tracks index is loaded', async () => {
  const { G, env } = load(); const L = G.Lib; const R = makeRec(G, { id: 'web1', laps: 1 });
  let asked = 0; env.fetch = async url => { asked++; return url.endsWith('index.json') ? { ok: true, json: async () => ({ files: ['a b.json'] }) } : { ok: url === 'saved_tracks/a%20b.json', text: async () => JSON.stringify(R) }; };
  await L.fetchIndex(); assert.equal(asked, 0, 'not from file://');
  env.win.location.protocol = 'http:'; await L.fetchIndex();
  assert.ok(L.data.web1); assert.equal(L.status, 'saved_tracks: loaded 1 recording.');
});

// --- ghosts ----------------------------------------------------------------
test('recAt: smooth position, speed and track distance at any time', () => {
  const { G } = load(); const R = makeRec(G, { v: 60, laps: 1 }), S = R.samples;
  const q = G.recAt(R, 10.05);
  near(q.v, 60, 1e-9); near(q.p, (S.p[100] + S.p[101]) / 2, 1e-9);
  near(Math.hypot(q.x - (S.x[100] + S.x[101]) / 2, q.y - (S.y[100] + S.y[101]) / 2), 0, 0.3);
  near(G.recAt(R, -5).p, S.p[0], 1e-9); near(G.recAt(R, 1e6).p, S.p.at(-1), 1e-9);
});
test('bestPool: own valid laps, autopilot laps only when there are no others', () => {
  const { G } = load();
  assert.deepEqual(G.bestPool({ laps: [{ time: 1 }, { time: 2, inv: 1 }, { time: 3, ap: 1 }] }).map(l => l.time), [1]);
  assert.deepEqual(G.bestPool({ laps: [{ time: 3, ap: 1 }, { time: 2, inv: 1 }] }).map(l => l.time), [3]);
});
test('makeGhost: a ghost rider with its best lap and lap chain', () => {
  const { G } = load(); const R = makeRec(G, { laps: 2 }); R.laps[1].time -= 1;
  const g = G.makeGhost(R);
  assert.equal(g.best, R.laps[1]); assert.equal(g.chain.length, 2); near(g.chainT, R.laps[0].time + R.laps[1].time, 1e-9);
  assert.equal(g.id, 'g' + R.id); assert.equal(g.name, 'Ghost Rider (ghost)'); assert.equal(g.isRace, false); assert.equal(g.ghost, true);
});
test('Ghost.setup: none in qualifying; grid, line and spot starts in practice', () => {
  const g = load(); const grid = makeRec(g.G, { id: 'gr', stand: 3, start: { kind: 'grid', t: 0 } }), line = makeRec(g.G, { id: 'li' });
  const nolap = makeRec(g.G, { id: 'nl', laps: 0, end: 5 });
  assert.equal(session('quali', { ghosts: [line] }).W.ghosts.length, 0);
  const p = session('practice', { ghosts: [grid, line, nolap] });
  assert.deepEqual(p.W.ghosts.map(x => x.sync), ['rec', 'line']); near(p.W.ghosts[0].launch, 2.9, 1e-9);
  const s = session('practice', { ghosts: [line, makeRec(g.G, { id: 'l2', v: 55 })], train: { s: 1500, v: 50 }, syncId: 'l2' });
  assert.equal(s.W.syncRef.rec.id, 'l2'); assert.deepEqual(s.W.ghosts.map(x => x.sync), ['spot', 'spot']);
  near(s.W.syncRef.vSpot, 55, 1e-6);
  const ref = s.W.syncRef; near(s.G.recAt(ref.rec, ref.t0).p % s.T.L, 1500, 1, 'reference stands on the spot');
});
test('Ghost.place: pose from a sample, brake light when slowing', () => {
  const { G } = load(); const g = { ctl: {} };
  G.Ghost.place(g, { x: 1, y: 2, h: 3, v: 4, lean: 0.5, dv: -1 });
  assert.deepEqual(plain(g), { ctl: { brk: 1 }, x: 1, y: 2, h: 3, v: 4, lean: 0.5 });
});
test('Ghost.step, Ghost.stepPractice: ghosts stand until the first input, then ride from the line', () => {
  const g = load(); const R = makeRec(g.G, { id: 'li', v: 60 });
  const { G, W, b } = session('practice', { ghosts: [R] }); const gh = W.ghosts[0];
  G.Ghost.step(); assert.equal(gh.show, false, 'line ghost waits for a line crossing');
  W.startT = 0; W.lineT = 10; W.time = 15; G.Ghost.step();
  assert.equal(gh.show, true); near(gh.s, G.T.wrapS(G.recAt(R, gh.best.start + 5).p), 1e-6);
  W.time = 10 + gh.best.time + 1; G.Ghost.step(); assert.equal(gh.show, false, 'after its best lap');
  const sp = session('practice', { ghosts: [R], train: { s: 1500, v: 50 } }); sp.G.Ghost.step();
  assert.equal(sp.W.ghosts[0].show, true); assert.equal(sp.W.ghosts[0].v, 0, 'standing on the spot');
});
test('Ghost.stepRace, Ghost.raceSample: a race ghost rides its race and finishes', () => {
  const g = load(); const R = makeRec(g.G, { id: 'race', kind: 'sprint', raceStart: 2, stand: 2.3, v: 80, laps: 1 }); // launches 0.3 s after lights out
  const { G, W } = session('sprint', { ghosts: [R] }); const gh = W.ghosts[0]; W.totalLaps = 1;
  G.Ghost.stepRace(gh); assert.equal(gh.show, true); near(gh.v, 0, 1e-9, 'on the grid before the start');
  W.phase = 'run'; W.raceStartT = 1; W.time = 31; G.Ghost.stepRace(gh);
  near(gh.progress, G.recAt(R, 32).p, 1e-6); assert.ok(gh.lapStartT > 0);
  W.time = 1 + R.laps[0].end - 2 + 0.2; G.Ghost.stepRace(gh);
  assert.equal(gh.finished, true); assert.equal(W.flag, true); assert.match(G.HUD.tick[0].t, /\(ghost\) takes the chequered flag/);
  const h = session('sprint', { ghosts: [R] }), gx = h.W.ghosts[0]; h.W.phase = 'run'; h.W.raceStartT = 1; h.W.time = 1e4;
  assert.equal(h.G.Ghost.raceSample(gx, 1e4), null); h.G.Ghost.stepRace(gx); assert.equal(gx.dnf, true); assert.match(h.G.HUD.tick[0].t, /out of recording/);
});
test('Ghost.raceSample: a practice recording loops its laps from the line', () => {
  const g = load(); const R = makeRec(g.G, { v: 60, laps: 2 });
  const { G, T } = session('sprint'); const gh = G.makeGhost(R), lt = R.laps[0].time;
  near(G.Ghost.raceSample(gh, 10).p, 600, 1); near(G.Ghost.raceSample(gh, lt + 10).p, T.L + 600, 1);
  near(G.Ghost.raceSample(gh, 2 * lt + 10).p, 2 * T.L + 600, 1, 'second time round the chain');
});

// --- replay viewer ---------------------------------------------------------
test('rpBestLap, rpDist: best lap and continuous distance', () => {
  const { G } = load();
  const R = makeRec(G, { laps: 2 }); assert.equal(G.rpBestLap(R), R.laps[0]); assert.equal(G.rpBestLap({ laps: [] }), null);
  const c = G.rpDist(R); near(c.at(-1), R.samples.p.at(-1) - R.samples.p[0], 0.2); assert.ok(c.every((v, k) => !k || v >= c[k - 1]));
});
function replay(n = 1, back = 'menu') {
  const g = load(); const recs = Array.from({ length: n }, (_, k) => makeRec(g.G, { id: 'rp' + k, v: 60 - k * 5, laps: 2 }));
  g.G.RP.open(recs, back); return Object.assign(g, { RP: g.G.RP, recs });
}
test('RP.open: the replay takes over the world', () => {
  const { G, RP, env } = replay(2);
  assert.equal(G.UI.state, 'replay'); assert.equal(RP.items.length, 2); assert.equal(RP.align, 'best');
  assert.equal(G.W.bikes.length, 1); assert.equal(G.W.ghosts.length, 1); assert.equal(env.doc.getElementById('rbar').hidden, false);
  assert.equal(replay(1).RP.align, 'start'); const r = load(); r.G.RP.open([null]); assert.equal(r.G.UI.state, 'menu', 'nothing to show');
});
test('RP.setAlign: best laps, lap N or session start', () => {
  const { RP, recs } = replay(2);
  RP.setAlign('best'); assert.equal(RP.items[0].off, recs[0].laps[0].start); near(RP.dur, recs[1].laps[0].time, 1e-9);
  RP.lapN = 2; RP.setAlign('lap'); assert.equal(RP.items[0].off, recs[0].laps[1].start);
  RP.lapN = 9; RP.setAlign('lap'); assert.equal(RP.lapN, 2, 'lap number clamped');
  RP.setAlign('start'); assert.equal(RP.items[0].off, 0); assert.ok(RP.items[0].trace.length > 100);
});
test('RP.laps: lap marks on the session timeline', () => {
  const { RP, recs } = replay(1);
  const m = RP.laps(); assert.deepEqual(m.map(x => x.n), [1, 2]); near(m[0].t, recs[0].laps[0].start, 1e-9); assert.equal(m[0].best, true);
  RP.setAlign('best'); assert.deepEqual(RP.laps(), []);
});
test('RP.step, RP.place: time runs at the replay speed and stops at the ends', () => {
  const { RP, G } = replay(1);
  RP.step(2); near(RP.t, 2, 1e-9); assert.equal(G.W.player.show, true); near(RP.items[0].dist, 120, 0.5);
  RP.speed = 4; RP.step(1); near(RP.t, 6, 1e-9);
  RP.step(1e5); assert.equal(RP.t, RP.dur); assert.equal(RP.playing, false);
  RP.playing = true; RP.speed = -8; RP.step(1e5); assert.equal(RP.t, 0); assert.equal(RP.playing, false);
  RP.place(); assert.equal(RP.items[0].lap, 0, 'before the line: out lap');
});
test('RP.gap: time behind the reference at the same distance', () => {
  const { RP } = replay(2); RP.seek(20);
  assert.equal(RP.gap(RP.items[0]), null);
  const g = RP.gap(RP.items[1]); assert.ok(g > 1.5 && g < 2, 'slower rider about 1.7 s behind after 20 s: ' + g);
});
test('RP.seek, RP.setSpeed: jump within the replay, a speed starts playing', () => {
  const { RP } = replay(1);
  RP.seek(-5); assert.equal(RP.t, 0); RP.seek(1e9); assert.equal(RP.t, RP.dur);
  RP.playing = false; RP.setSpeed(2); assert.equal(RP.speed, 2); assert.equal(RP.playing, true);
});
test('RP.faster, RP.rew, RP.ff, RP.slow: speed buttons', () => {
  const { RP } = replay(1);
  RP.speed = 1; RP.faster(1); assert.equal(RP.speed, 2); RP.faster(-1); RP.faster(-1); assert.equal(RP.speed, 0.5);
  RP.speed = 8; RP.faster(1); assert.equal(RP.speed, 8);
  RP.speed = 1; RP.rew(); assert.equal(RP.speed, -1); RP.rew(); assert.equal(RP.speed, -2); RP.speed = -8; RP.rew(); assert.equal(RP.speed, -8);
  RP.speed = 0.5; RP.ff(); assert.equal(RP.speed, 2); RP.ff(); assert.equal(RP.speed, 4); RP.ff(); RP.ff(); assert.equal(RP.speed, 8);
  RP.slow(); assert.equal(RP.speed, 0.5); RP.slow(); assert.equal(RP.speed, 0.25);
});
test('RP.toggle: pause and play, again from the start at the end', () => {
  const { RP } = replay(1);
  RP.toggle(); assert.equal(RP.playing, false); RP.toggle(); assert.equal(RP.playing, true);
  RP.t = RP.dur; RP.speed = 1; RP.playing = false; RP.toggle(); assert.equal(RP.t, 0); assert.equal(RP.playing, true);
  RP.t = 0; RP.speed = -2; RP.playing = false; RP.toggle(); assert.equal(RP.speed, 1);
});
test('RP.lapJump: next and previous lap marks', () => {
  const { RP } = replay(1); const m = RP.laps();
  RP.seek(0); RP.lapJump(1); near(RP.t, m[0].t, 1e-9); RP.lapJump(1); near(RP.t, m[1].t, 1e-9); RP.lapJump(1); assert.equal(RP.t, RP.dur);
  RP.lapJump(-1); near(RP.t, m[1].t, 1e-9);
  RP.setAlign('best'); RP.seek(5); RP.lapJump(-1); assert.equal(RP.t, 0, 'no marks: to the start');
});
test('RP.cycle: the camera follows the next bike', () => {
  const { RP, G } = replay(3);
  RP.cycle(); assert.equal(RP.follow, 1); assert.equal(G.W.player, RP.items[1].g); RP.cycle(); RP.cycle(); assert.equal(RP.follow, 0);
});
test('RP.close: back to the menu, the pause menu or the results', () => {
  const m = replay(1); m.RP.close(); assert.equal(m.G.UI.state, 'menu'); assert.equal(m.env.doc.getElementById('menu').hidden, false); assert.equal(m.env.doc.getElementById('rbar').hidden, true);
  const g = load(); const { G, env } = g; G.UI.launch('practice', {}); const me = G.W.player; G.W.paused = true;
  G.RP.open([makeRec(G, { laps: 1 })], 'pause'); assert.notEqual(G.W.player, me); G.RP.close();
  assert.equal(G.W.player, me); assert.equal(G.UI.state, 'play'); assert.equal(G.W.paused, true); assert.equal(env.doc.getElementById('pause').hidden, false);
  const r = replay(1, 'results'); r.RP.close(); assert.equal(r.G.UI.state, 'results'); assert.equal(r.env.doc.getElementById('results').hidden, false);
});
