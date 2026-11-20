// Unit tests for src/scenery3d.js (GDD 11o, phase 2): 3D walls, Armco, tyre walls and debris fences. The barriers
// must stand on the wall line and never on the road, kerbs, run-off, gravel or pit lane; a point of their geometry
// must land where gl3DPlanePoint puts that world point; pieces out of view are not drawn. No WebGL here: the renderer
// is a stand-in that records what is drawn.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, placeAt } = require('./load');

// the player on the Hangar Straight with the CLOSE camera settled (tilted)
function tilted() {
  const g = load(); const { G } = g;
  G.UI.opts.cam = 'close'; G.UI.launch('practice', {});
  const b = G.W.player, hs = G.T.corners.find(c => c.name === 'Hangar Straight');
  placeAt(G, b, hs.s + 100, 0); b.trainHold = false; b.v = 30;
  G.CAM.init = false; for (let k = 0; k < 60; k++) G.updateCamera(1 / 60);
  return Object.assign(g, { b });
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const newBuf = () => ({ pos: [], col: [] });
// a flat stand-in for at(): track point q, distance d, height z (scaled)
const flatAt = G => (q, d, z) => [q, d, z * G.WALL_HS];
// the surface under a world point, judged by the nearest part of the circuit
// the world points of a piece that touch the ground (z = 0): vertices and post feet; gantry beams over the road are in the air
function groundPoints(p) { return p.meshes.flatMap(m => (m.isInstancedMesh ? postFeet(m) : vertexFeet(m)).map(([x, y]) => [x + p.ox, y + p.oy])); }
// the feet of the posts standing on the ground (base height 0), piece-relative
function postFeet(m) {
  const a = m.instanceMatrix.array, pts = [];
  for (let i = 0; i < m.count; i++) { if (a[i * 16 + 14] < 0.01) pts.push([a[i * 16 + 12], a[i * 16 + 13]]); }
  return pts;
}
// the vertices at ground level, piece-relative
function vertexFeet(m) {
  const a = m.geometry.attributes.position.array, pts = [];
  for (let i = 0; i < a.length; i += 3) { if (a[i + 2] < 0.01) pts.push([a[i], a[i + 1]]); }
  return pts;
}
function surfaceAt(G, x, y) { const o = { i: -1 }; G.T.project(x, y, -1, o); return G.T.surface(o.i, o.s, o.d); }

test('walls3DOn: with the 3D ground, unless test switch 7 is on', () => {
  const { G } = tilted();
  assert.equal(G.walls3DOn(), false, 'no WebGL here');
  G.GL3D.ok = true; assert.equal(G.walls3DOn(), true);
  G.PERF.noWalls = true; assert.equal(G.walls3DOn(), false);
});
test('wallSmooth: short runs take the kind before them; long runs and gaps stay', () => {
  const { G } = load();
  const k = Uint8Array.from([1, 1, 1, 2, 2, 1, 1, 0, 0, 2, 2, 2, 2]);
  assert.deepEqual([...G.wallSmooth(k, 3)], [1, 1, 1, 1, 1, 1, 1, 0, 0, 2, 2, 2, 2]);
});
test('wallKinds: open at the garages, tyre walls outside Copse, Armco only far back, kinds in long runs', () => {
  const { G } = load(); const T = G.T, K = G.WALL_KIND;
  const k0 = G.wallKinds(0), k1 = G.wallKinds(1);
  const mid = T.idx((T.PIT.flatIn + T.PIT.flatOut) / 2); assert.equal(k0[mid], K.NONE, 'garage frontage open');
  const c = T.corners.find(q => q.name === 'Copse'), out = T.KS[c.i] > 0 ? k1 : k0, ins = T.KS[c.i] > 0 ? k0 : k1;
  assert.equal(out[c.i], K.TYRE, 'tyre wall outside Copse'); assert.notEqual(ins[c.i], K.TYRE, 'not on the inside');
  for (const [s, k] of [[0, k0], [1, k1]]) for (let i = 0; i < T.N; i++) {
    if (k[i] === K.ARMCO) assert.ok(T.WALL[s][i] - T.EDGE[s][i] > 15, `Armco near the track at ${i}`);
  }
  assert.ok(k0.filter(v => v === K.CONCRETE).length > 1000 && k1.filter(v => v === K.ARMCO).length > 500);
});
test('wallTyres: tyres on the outside of Copse where there is a barrier, not across a gap', () => {
  const { G } = load(); const T = G.T, K = G.WALL_KIND, c = T.corners.find(q => q.name === 'Copse'), s = T.KS[c.i] > 0 ? 1 : 0;
  const kind = new Uint8Array(T.N).fill(K.CONCRETE); kind[c.i + 5] = K.NONE;
  G.wallTyres(kind, s);
  assert.equal(kind[c.i], K.TYRE); assert.equal(kind[c.i + 30], K.TYRE); assert.equal(kind[c.i + 31], K.CONCRETE); assert.equal(kind[c.i + 5], K.NONE);
  const other = new Uint8Array(T.N).fill(K.CONCRETE); G.wallTyres(other, 1 - s); assert.equal(other[c.i], K.CONCRETE, 'inside stays concrete');
});
test('wallGaps: a barrier is dropped where it would stand off the grass', () => {
  const { G } = load(); const T = G.T, K = G.WALL_KIND;
  const kind = new Uint8Array(T.N).fill(K.CONCRETE), saved = T.WALL[0][300];
  T.WALL[0][300] = 1; // a wall moved onto the road
  G.wallGaps(kind, 0); T.WALL[0][300] = saved;
  assert.equal(kind[300], K.NONE); assert.equal(kind[200], K.CONCRETE);
});
test('wallPitKinds: concrete beside the flat pit lane only', () => {
  const { G } = load(); const T = G.T, PIT = T.PIT, pk = G.wallPitKinds();
  assert.equal(pk[T.idx((PIT.flatIn + PIT.flatOut) / 2)], G.WALL_KIND.CONCRETE);
  assert.equal(pk[T.idx(PIT.flatOut + 40)], 0); assert.equal(pk[T.idx(PIT.flatIn - 40)], 0);
});
test('wallClear: grass and the wall line yes, the road and the gravel no', () => {
  const { G } = load(); const T = G.T;
  assert.equal(G.wallClear(T.X[300], T.Y[300]), false, 'centre line');
  assert.equal(G.wallClear(...T.pt(300, T.WALL[0][300] + 0.2)), true, 'behind the wall line');
  const i = T.RT[1].findIndex((t, k) => t === G.SURF.GRAVEL && T.RUN[1][k] > 4);
  assert.equal(G.wallClear(...T.pt(i, -(T.EDGE[1][i] + T.KERB[1][i] + 2))), false, 'gravel');
});
test('wallRGB: linear RGB of a colour, kept', () => {
  const { G } = load();
  assert.deepEqual(G.wallRGB('#ffffff'), [1, 1, 1]);
  const g = G.wallRGB('#808080'); assert.ok(g[0] > 0.2 && g[0] < 0.25, 'sRGB 0.5 is about 0.22 linear: ' + g[0]);
  assert.equal(G.wallRGB('#808080'), g);
});
test('wallQuad: two triangles a-b-c, a-c-d in one colour', () => {
  const { G } = load(); const buf = newBuf();
  G.wallQuad(buf, [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], '#ffffff');
  assert.deepEqual(buf.pos, [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1]);
  assert.deepEqual(buf.col, Array(18).fill(1));
});
test('wallConcrete: face, painted band, top and back; 1 m high (scaled), blue or white by 6 m block', () => {
  const { G } = load(); const buf = newBuf(), at = flatAt(G);
  G.wallConcrete(buf, at, 0, 1, 10, 10, true);
  assert.equal(buf.pos.length, 4 * 18);
  const zs = []; for (let i = 2; i < buf.pos.length; i += 3) zs.push(buf.pos[i]);
  near(Math.max(...zs), G.WALL_HS, 1e-9, 'top'); assert.equal(Math.min(...zs), 0);
  const ds = []; for (let i = 1; i < buf.pos.length; i += 3) ds.push(buf.pos[i]);
  assert.deepEqual([Math.min(...ds), Math.max(...ds)], [10, 10 + G.WALL_TH]);
  assert.deepEqual(buf.col.slice(18, 21), G.wallRGB(G.WALL_COL.blue), 'band of the first block');
  const plain = newBuf(); G.wallConcrete(plain, at, 0, 1, 10, 10, false); assert.deepEqual(plain.col.slice(18, 21), G.wallRGB(G.WALL_COL.face));
});
test('wallArmco: two steel rails on the wall line, under 1 m', () => {
  const { G } = load(); const buf = newBuf();
  G.wallArmco(buf, flatAt(G), 0, 1, 25, 25);
  assert.equal(buf.pos.length, 2 * 18);
  for (let i = 0; i < buf.pos.length; i += 3) { assert.equal(buf.pos[i + 1], 25); assert.ok(buf.pos[i + 2] <= 0.8 * G.WALL_HS + 1e-9); }
});
test('wallTyre: three rows of tyres, the belt and the top, 1 m deep in front of the concrete', () => {
  const { G } = load(); const buf = newBuf();
  G.wallTyre(buf, flatAt(G), 0, 1, 10, 10);
  assert.equal(buf.pos.length, 5 * 18);
  const ds = []; for (let i = 1; i < buf.pos.length; i += 3) ds.push(buf.pos[i]);
  assert.deepEqual([Math.min(...ds), Math.max(...ds)], [10, 11]);
  assert.deepEqual(buf.col.slice(3 * 18, 3 * 18 + 3), G.wallRGB(G.WALL_COL.belt), 'belt colour at an even point');
});
test('wallFence: the see-through panel from the wall top to 3 m, the top rail in the solid buffer', () => {
  const { G } = load(); const buf = newBuf(), panel = newBuf();
  G.wallFence(buf, panel, flatAt(G), 0, 1, 10.35, 10.35);
  const pz = []; for (let i = 2; i < panel.pos.length; i += 3) pz.push(panel.pos[i]);
  near(Math.min(...pz), G.WALL_HS, 1e-9); near(Math.max(...pz), G.WALL_FENCE * G.WALL_HS, 1e-9);
  assert.equal(buf.pos.length, 18, 'one rail quad');
});
test('wallSegment: concrete with fence and a post every 4 m, end faces where the run ends, Armco posts lower', () => {
  const { G } = load(); const K = G.WALL_KIND, N = G.T.N;
  const piece = () => ({ ox: 0, oy: 0, buf: newBuf(), panel: newBuf(), posts: [], box: [Infinity, Infinity, -Infinity, -Infinity] });
  const kind = new Uint8Array(N).fill(K.CONCRETE);
  const p = piece(); G.wallSegment(p, kind, 10, 11, 1, 20, 20);
  assert.equal(p.buf.pos.length, (4 + 1) * 18, 'concrete + top rail, no end faces inside a run');
  assert.equal(p.panel.pos.length, 18); assert.ok(p.box[2] > p.box[0], 'the piece box grows');
  kind[12] = K.NONE; const e = piece(); G.wallSegment(e, kind, 10, 11, 1, 20, 20);
  assert.equal(e.buf.pos.length, (4 + 1 + 1) * 18, 'end face before the gap');
  let posts = 0; for (let k = 0; k < 40; k++) { const q = piece(); G.wallSegment(q, kind.fill(K.CONCRETE), k, k + 1, 1, 20, 20); posts += q.posts.length; }
  near(posts, 40 * G.T.DS / G.WALL_POST_STEP, 1, 'posts every 4 m');
  const a = piece(); G.wallSegment(a, new Uint8Array(N).fill(K.ARMCO), 0, 1, 1, 30, 30);
  assert.equal(a.posts.length, 1); assert.equal(a.posts[0][2], 0.8); assert.equal(a.panel.pos.length, 0, 'no fence on Armco');
});
test('wallGeometry: positions, colours and flat normals', () => {
  const { G } = load(); const buf = newBuf();
  G.wallQuad(buf, [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], '#ffffff');
  const g = G.wallGeometry(buf), n = g.attributes.normal.array;
  assert.equal(g.attributes.position.count, 6); assert.equal(g.attributes.color.count, 6);
  near(Math.abs(n[1]), 1, 1e-6, 'a wall in the x-z plane faces along y');
});
test('wallPosts: one instanced box per post, 0.12 m square, scaled height, at its place; width, colour and base per post', () => {
  const { G } = load();
  const m = G.wallPosts([[5, 6, 3], [7, 8, 0.8]], G.walls3DMaterials().post), a = m.instanceMatrix.array;
  assert.equal(m.count, 2); assert.deepEqual([a[0], a[5]], [0.12, 0.12].map(Math.fround));
  near(a[10], 3 * G.WALL_HS, 1e-5); assert.deepEqual([a[12], a[13], a[28], a[29]], [5, 6, 7, 8]);
  const grey = G.wallRGB(G.WALL_COL.post), c = m.instanceColor.array; near(c[0], grey[0], 1e-6, 'fence post grey by default');
  const b = G.wallPosts([[1, 2, 0.2, 0.27, '#151515', 0.6]], G.walls3DMaterials().post), e = b.instanceMatrix.array;
  near(e[0], 0.27, 1e-6, 'width'); near(e[14], 0.6 * G.WALL_HS, 1e-6, 'base height'); assert.ok(b.instanceColor.array[0] < 0.02, 'own colour');
});
test('walls3DMaterials: lit walls with vertex colours, posts, see-through fence; all cut by the clip planes; built once', () => {
  const { G } = load();
  const M = G.walls3DMaterials();
  assert.equal(M.solid.vertexColors, true); assert.equal(M.panel.transparent, true); assert.equal(M.panel.depthWrite, false);
  for (const m of Object.values(M)) assert.equal(m.clippingPlanes, G.WALLS3D.clip);
  assert.equal(G.walls3DMaterials(), M);
});
test('walls3DPiece: walls, posts, boards and adverts, and fence meshes in the walls scene, placed by hand each frame', () => {
  const { G } = load(); G.walls3DInit();
  const p = G.WALLS3D.pieces[0], M = G.WALLS3D.mats; // piece 0: the start/finish straight, with adverts
  assert.deepEqual(p.meshes.map(m => m.material), [M.solid, M.post, M.tex, M.panel]);
  assert.ok(p.meshes[1].isInstancedMesh); assert.equal(p.meshes[3].renderOrder, 1); assert.ok(p.meshes[2].geometry.attributes.uv);
  assert.ok(p.meshes.every(m => !m.matrixAutoUpdate && G.WALLS3D.scene.children.includes(m)));
});
// a ground point that may be off the grass: the pit wall (and the start gantry pillar on it) on the strip between
// the track and the pit lane, as the flat pit wall; a braking board's legs off the road, where the flat board lies
function allowedOffGrass(G, x, y, sf) {
  const S = G.SURF, T = G.T, PIT = T.PIT, o = { i: -1 }; T.project(x, y, -1, o); const sr = T.rel(o.i * T.DS);
  if (sf === S.RUN && Math.abs(o.d - PIT.wallD) < 0.5 && sr > PIT.flatIn - 8 && sr < PIT.flatOut + 8) return true;
  const board = T.boards.some(bd => Math.hypot(...T.pt(bd.i, bd.side * ((bd.side > 0 ? T.WR[bd.i] : T.WL[bd.i]) + 3.2)).map((v, k) => v - [x, y][k])) < 2);
  return board && sf !== S.ASPH && sf !== S.KERB && sf !== S.PIT;
}
test('walls3DBuild: over the whole lap nothing stands on the road, kerbs, run-off, gravel or pit lane', () => {
  const { G } = load(); G.walls3DInit(); const S = G.SURF;
  const W = G.WALLS3D; assert.ok(W.pieces.length > 15);
  const pts = W.pieces.flatMap(groundPoints);
  const bad = pts.filter(([x, y]) => { const sf = surfaceAt(G, x, y); return sf !== S.GRASS && sf !== S.WALL && !allowedOffGrass(G, x, y, sf); });
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} ground points off the grass`);
  assert.ok(pts.length > 20000);
});
test('walls3DInit: one scene with lights, haze and three clip planes; built again only for a new track', () => {
  const { G } = load(); G.walls3DInit(); const W = G.WALLS3D, scene = W.scene;
  assert.ok(scene.fog); assert.equal(W.clip.length, 3); assert.ok(scene.children.some(c => c.isDirectionalLight));
  G.walls3DInit(); assert.equal(W.scene, scene);
  G.T.X = Float64Array.from(G.T.X); G.walls3DInit(); assert.notEqual(W.scene, scene, 'new track: built again');
});
test('walls3DFrame, walls3DMatrix: a point of a piece lands where gl3DPlanePoint puts the world point', () => {
  const { G, b } = tilted();
  const F = G.walls3DFrame(), ox = b.x + 30, oy = b.y - 12, M = G.walls3DMatrix(F, ox, oy);
  for (const [dx, dy, z] of [[0, 0, 0], [15, -4, 1], [-40, 22, 3]]) {
    const q = [0, 1, 2].map(r => M[r * 4] * dx + M[r * 4 + 1] * dy + M[r * 4 + 2] * z + M[r * 4 + 3]);
    const w = G.gl3DPlanePoint(ox + dx, oy + dy, z); q.forEach((v, i) => near(v, w[i], 1e-6, 'axis ' + i));
  }
  G.WALLS3D.shake = [3, 4]; const S = G.walls3DFrame(), a = G.tiltA();
  near(S.O[0] - F.O[0], 3, 1e-9); near(S.O[1] - F.O[1], 4 * Math.cos(a), 1e-9); near(S.O[2] - F.O[2], 4 * Math.sin(a), 1e-9);
  assert.deepEqual(S.ex, F.ex, 'the shake moves the frame, not its axes');
});
test('walls3DVisible: a piece around the camera is drawn, one across the circuit behind it is not', () => {
  const { G, b } = tilted(); G.walls3DInit();
  const box = (x, y) => ({ box: [x - 50, y - 50, x + 50, y + 50] });
  assert.equal(G.walls3DVisible(box(b.x, b.y)), true);
  const back = [b.x - Math.cos(b.h) * 600, b.y - Math.sin(b.h) * 600];
  assert.equal(G.walls3DVisible(box(...back)), false);
});
test('walls3DFog: the haze by distance along the ground, from uniforms shared by all the materials', () => {
  const { G } = load(); const m = G.walls3DFog(new G.THREE.MeshBasicMaterial());
  const sh = { uniforms: {}, vertexShader: 'void main() {\n#include <fog_vertex>\n}' }; m.onBeforeCompile(sh);
  assert.equal(sh.uniforms.fogCa, G.WALLS3D.fogU.fogCa); assert.equal(sh.uniforms.fogSa, G.WALLS3D.fogU.fogSa);
  assert.ok(!sh.vertexShader.includes('#include <fog_vertex>')); assert.match(sh.vertexShader, /vFogDepth = -\(mvPosition\.y \* fogCa \+ mvPosition\.z \* fogSa\) \* fogSa/);
  assert.ok(sh.vertexShader.startsWith('uniform float fogCa; uniform float fogSa;'));
  for (const k of Object.values(G.walls3DMaterials())) assert.equal(typeof k.onBeforeCompile, 'function', 'every walls material');
});
test('walls3DPlace: only pieces in view are shown and placed; haze over the far 22 % of the ground; cut at its edges', () => {
  const { G } = tilted();
  const n = G.walls3DPlace(), W = G.WALLS3D, sa = Math.sin(G.tiltA());
  assert.ok(n > 0 && n < W.pieces.length, `${n} of ${W.pieces.length}`);
  assert.equal(W.pieces.filter(p => p.meshes[0].visible).length, n); assert.equal(W.drawn, n);
  near(W.scene.fog.far, G.RH * sa, 1e-9); near(W.scene.fog.near, 0.78 * G.RH * sa, 1e-9);
  const [far, left] = W.clip, edge = G.groundPoint(G.RW / 2, 0);
  near(far.normal.y * edge[1] + far.normal.z * edge[2] + far.constant, 0, 1e-6, 'far plane through the far edge');
  const ca = Math.cos(G.tiltA()), up = [edge[1] - 50 * sa, edge[2] + 50 * ca]; // 50 px straight up from the far edge
  near(far.normal.y * up[0] + far.normal.z * up[1] + far.constant, 0, 1e-6, 'upright: things on the ground stand into the sky');
  near(W.fogU.fogCa.value, ca, 1e-12); near(W.fogU.fogSa.value, sa, 1e-12);
  near(left.normal.x * (-G.RW / 2) + left.constant, 0, 1e-9);
});
test('walls3DRender: places the walls and draws their scene with clipping on', () => {
  const { G } = tilted();
  const log = [], r = { render: s => log.push(s) }; G.GL3D.cam = new G.THREE.Camera();
  G.walls3DRender(r);
  assert.deepEqual(log, [G.WALLS3D.scene]); assert.equal(r.localClippingEnabled, true);
});
test('gl3DAddLights: ambient, sun and fill light; returns the sun and the fill', () => {
  const { G } = load(); const s = new G.THREE.Scene(), L = G.gl3DAddLights(s);
  assert.deepEqual(s.children.map(c => c.type), ['AmbientLight', 'DirectionalLight', 'DirectionalLight']);
  assert.equal(L.sun, s.children[1]); assert.equal(L.fill, s.children[2]);
});
test('perfNoWalls: switches the 3D walls off and on', () => {
  const { G } = load();
  G.perfNoWalls(); assert.equal(G.PERF.noWalls, true);
  G.perfNoWalls(); assert.equal(G.PERF.noWalls, false);
});
test('tileWallsSync: switching to 3D walls drops the cached tiles; no change keeps them', () => {
  const { G } = load(); const L = G.TLV[0];
  G.getTile(L, 3, -2, true); assert.equal(L.map.size, 1);
  assert.equal(G.tileWallsSync(false), false); assert.equal(L.map.size, 1);
  assert.equal(G.tileWallsSync(true), true); assert.equal(L.map.size, 0); assert.equal(G.TILE_WALLS.on3d, true);
});
test('drawFlatWalls, drawWallShadows: flat walls with fence and pit wall; under 3D walls only a soft shadow', () => {
  const { G } = load(); const g = G.mkCanvas(8, 8).getContext('2d');
  const prev = G.ctx; G.ctx = g;
  try {
    G.drawFlatWalls(); const flat = g.calls.filter(c => c[0] === 'stroke').length;
    g.calls.length = 0; G.drawWallShadows(); const sh = g.calls.filter(c => c[0] === 'stroke');
    assert.ok(flat >= 7); assert.equal(sh.length, 4); assert.ok(sh.every(c => c[1] === G.wallShadowPath() || c[1] === G.GEO.pitWall), 'the shadow follows only the 3D walls');
  } finally { G.ctx = prev; }
});
