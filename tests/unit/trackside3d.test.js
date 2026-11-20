// Unit tests for src/trackside3d.js (GDD 11o, phase 4): braking boards, distance posts, marshal posts, adverts, TV
// towers and gantries in 3D. Each object goes into the piece buffers of scenery3d.js; here one piece takes everything.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const newPiece = () => ({ ox: 0, oy: 0, buf: { pos: [], col: [] }, panel: { pos: [], col: [] }, posts: [], tex: { pos: [], uv: [] }, box: [Infinity, Infinity, -Infinity, -Infinity] });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const zsOf = buf => { const z = []; for (let i = 2; i < buf.pos.length; i += 3) { z.push(buf.pos[i]); } return z; };
// one piece for every track point, with the number of objects built
function onePiece() { const p = newPiece(); return { p, piece: () => p }; }

test('sideAtlas: four braking boards and eight brands on one 2048 x 512 texture, drawn once', () => {
  const { G } = load();
  const A = G.sideAtlas();
  assert.equal(A.canvas.width, 2048); assert.deepEqual(Object.keys(A.uv.board).map(Number).sort((a, b) => a - b), [50, 100, 200, 300]);
  assert.equal(A.uv.brand.length, 8); assert.deepEqual(A.uv.board[300], [0, 0.75, 0.125, 1]);
  const texts = A.canvas.getContext('2d').calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(texts.includes('300') && texts.includes('KESTRAN') && texts.includes('HELIXON'), texts.join());
  assert.equal(G.sideAtlas(), A);
});
test('sidePt: piece-relative point, height scaled like the bikes, the box grows', () => {
  const { G } = load(); const p = newPiece(); p.ox = 10; p.oy = 20;
  assert.deepEqual(G.sidePt(p, 13, 24, 2), [3, 4, 2 * G.WALL_HS]); assert.deepEqual(p.box, [13, 24, 13, 24]);
});
test('sideAt: d out along the normal and a along the track', () => {
  const { G } = load(); const T = G.T, q = 100;
  const [x, y] = G.sideAt(q, 5, 2);
  near(x, T.X[q] + 5 * T.NX[q] + 2 * T.TX[q], 1e-9); near(y, T.Y[q] + 5 * T.NY[q] + 2 * T.TY[q], 1e-9);
  assert.deepEqual(G.sideAt(q, 0), [T.X[q], T.Y[q]], 'on the centre line');
});
test('sideBox: four sides and a top, lined up with the track, from z0 to z1', () => {
  const { G } = load(); const p = newPiece();
  G.sideBox(p, 100, 20, 0, 2, 1, 0, 3, '#ffffff', '#000000');
  assert.equal(p.buf.pos.length, 5 * 18); const z = zsOf(p.buf);
  assert.equal(Math.min(...z), 0); near(Math.max(...z), 3 * G.WALL_HS, 1e-9);
  assert.deepEqual(p.buf.col.slice(4 * 18, 4 * 18 + 3), [0, 0, 0], 'the top in its own colour');
  near(p.box[2] - p.box[0], Math.abs(2 * G.T.TX[100]) + Math.abs(1 * G.T.NX[100]), 1e-6, 'footprint 2 x 1 m');
});
test('sideCard: two triangles with the corners of the uv rectangle', () => {
  const { G } = load(); const p = newPiece();
  G.sideCard(p, [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], [0.1, 0.2, 0.3, 0.4]);
  assert.equal(p.tex.pos.length, 18); assert.deepEqual(p.tex.uv.map(v => +v.toFixed(2)), [0.1, 0.2, 0.3, 0.2, 0.3, 0.4, 0.1, 0.2, 0.3, 0.4, 0.1, 0.4]);
});
test('sideSpot: behind the wall yes; on the road, in the pit compound or on a grandstand no', () => {
  const { G } = load(); const T = G.T;
  assert.equal(G.sideSpot(300, T.WALL[0][300] + 4, 1), true);
  assert.equal(G.sideSpot(300, 0, 1), false, 'road');
  const mid = T.idx((T.PIT.flatIn + T.PIT.flatOut) / 2); assert.equal(G.sideSpot(mid, T.PIT.garage + 20, 1), false, 'pit compound');
  const s = G.SCN.stands[0], k = T.nearestGlobal(s.x, s.y), d = (s.x - T.X[k]) * T.NX[k] + (s.y - T.Y[k]) * T.NY[k];
  assert.equal(G.sideSpot(k, d, 1), false, 'grandstand');
});
test('sideBoards: every braking board stands where the flat one lies, 0.4 to 1.5 m up, with its number', () => {
  const { G } = load(); const { p, piece } = onePiece();
  G.sideBoards(piece);
  const n = G.T.boards.length; assert.equal(p.tex.pos.length, n * 18, 'one card per board');
  const z = []; for (let i = 2; i < p.tex.pos.length; i += 3) z.push(p.tex.pos[i]);
  near(Math.min(...z), 0.4 * G.WALL_HS, 1e-9); near(Math.max(...z), 1.5 * G.WALL_HS, 1e-9);
  assert.equal(p.buf.pos.length, n * 3 * 5 * 18, 'two legs and a back per board');
});
test('sidePosts: each distance post is a white 1 m post with a black band', () => {
  const { G } = load(); const { p, piece } = onePiece();
  G.sidePosts(piece);
  assert.equal(p.posts.length, 2 * G.GEO.posts.length);
  assert.deepEqual(p.posts[0].slice(2), [1, 0.25, '#f4f4f2']); assert.deepEqual(p.posts[1].slice(2), [0.2, 0.27, '#151515', 0.6]);
  assert.deepEqual(p.posts[0].slice(0, 2), [G.GEO.posts[0].x, G.GEO.posts[0].y]);
});
test('sideMarshals: a marshal post every 275 m or so, hut, roof, pole and two flags', () => {
  const { G } = load(); const { p, piece } = onePiece();
  G.sideMarshals(piece);
  const per = 3 * 5 * 18 + 2 * 18, n = p.buf.pos.length / per;
  assert.ok(Number.isInteger(n) && n >= 0.8 * G.T.L / 275, `${n} posts on ${G.T.L.toFixed(0)} m`);
  near(Math.max(...zsOf(p.buf)), 4 * G.WALL_HS, 1e-9, 'pole top');
});
test('sideTowers: a camera tower at most of the ten corners, deck at 5 m', () => {
  const { G } = load(); const { p, piece } = onePiece();
  G.sideTowers(piece);
  const n = p.buf.pos.length / (6 * 5 * 18);
  assert.ok(Number.isInteger(n) && n >= 8, `${n} towers`); near(Math.max(...zsOf(p.buf)), 5.6 * G.WALL_HS, 1e-9);
});
test('sideGantry: pillars, beam over the road, start lights or advert cards', () => {
  const { G } = load();
  const a = newPiece(); G.sideGantry(a, 0, -15, 13, 7, 8, 1.2, true);
  assert.equal(a.buf.pos.length, (2 + 1 + 5) * 5 * 18); assert.equal(a.tex.pos.length, 0);
  const b = newPiece(); G.sideGantry(b, 0, -15, 15, 7, 9.2, 3, false, 2);
  assert.equal(b.tex.pos.length, 5 * 18, 'five 6 m cards over a 30 m span');
  assert.equal(b.buf.pos.length, 3 * 5 * 18);
});
test('sideGantries: the start gantry with lights and two sponsor bridges', () => {
  const { G } = load(); const { p, piece } = onePiece();
  G.sideGantries(piece);
  assert.equal(p.buf.pos.length, (8 + 3 + 3) * 5 * 18); assert.ok(p.tex.pos.length > 0, 'bridge adverts');
});
test('sideAdZones: the outside of the corners and the start/finish straight', () => {
  const { G } = load(); const T = G.T, c = T.corners.find(q => q.name === 'Stowe'), out = T.KS[c.i] > 0 ? 1 : 0;
  const zo = G.sideAdZones(out), zi = G.sideAdZones(1 - out);
  assert.equal(zo[c.i], 1); assert.equal(zi[c.i], 0); assert.equal(zo[0], 1); assert.equal(zi[0], 1);
  const h = T.corners.find(q => q.name === 'Hangar Straight'); assert.equal(zo[T.idx(h.s + 150)] + zi[T.idx(h.s + 150)], 0, 'none mid-straight');
});
test('wallAd: a third of a brand panel on the fence, 1.0 to 1.9 m up, mirrored on the right side', () => {
  const { G } = load(); const at = (q, d, z) => [q, d, z * G.WALL_HS], r = G.sideAtlas().uv.brand[0];
  const L = newPiece(); G.wallAd(L, at, 0, 1, 10, 10, -1);
  const Rp = newPiece(); G.wallAd(Rp, at, 0, 1, 10, 10, 1);
  assert.equal(L.tex.pos.length, 18); near(L.tex.uv[0], r[0], 1e-9, 'left side starts at the brand start');
  const z = []; for (let i = 2; i < L.tex.pos.length; i += 3) z.push(L.tex.pos[i]);
  near(Math.min(...z), 1.0 * G.WALL_HS, 1e-9); near(Math.max(...z), 1.9 * G.WALL_HS, 1e-9);
  assert.deepEqual(Rp.tex.pos.slice(0, 3), [1, 10, G.WALL_HS], 'right side: the card starts at the far point');
  near(Rp.tex.uv[0], r[2] - (r[2] - r[0]) / 3, 1e-9);
});
test('sideBuild: boards, posts, marshals, towers and gantries all go into the pieces', () => {
  const { G } = load(); const { p, piece } = onePiece();
  G.sideBuild(piece);
  assert.ok(p.posts.length > 400 && p.tex.pos.length > 44 * 18 && p.buf.pos.length > 100 * 18);
});
