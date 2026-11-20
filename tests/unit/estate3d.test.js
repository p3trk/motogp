// Unit tests for src/estate3d.js (GDD 11o, phase 3): the trees, grandstands, the Wing and the paddock buildings of SCN
// in 3D, and the tree line on the horizon.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, placeAt } = require('./load');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const newBuf = () => ({ pos: [], col: [] });
const zsOf = buf => { const z = []; for (let i = 2; i < buf.pos.length; i += 3) { z.push(buf.pos[i]); } return z; };
function tilted() {
  const g = load(); const { G } = g;
  G.UI.opts.cam = 'close'; G.UI.launch('practice', {});
  const b = G.W.player, hs = G.T.corners.find(c => c.name === 'Hangar Straight');
  placeAt(G, b, hs.s + 100, 0); b.v = 30; G.CAM.init = false; for (let k = 0; k < 60; k++) G.updateCamera(1 / 60);
  return g;
}

test('estTri: one triangle in one colour', () => {
  const { G } = load(); const b = newBuf();
  G.estTri(b, [0, 0, 0], [1, 0, 0], [0, 1, 0], '#ffffff');
  assert.deepEqual(b.pos, [0, 0, 0, 1, 0, 0, 0, 1, 0]); assert.deepEqual(b.col, Array(9).fill(1));
});
test('estBall: 20 faces within the radii about the centre', () => {
  const { G } = load(); const b = newBuf();
  G.estBall(b, 5, 6, 2, 1.5, 0.5, '#ffffff');
  assert.equal(b.pos.length, 20 * 9); const z = zsOf(b);
  near(Math.max(...z) - 2, 0.5 * 0.851, 0.01, 'up radius (icosahedron)'); assert.ok(Math.min(...z) >= 1.5 - 1e-9);
  for (let i = 0; i < b.pos.length; i += 3) assert.ok(Math.hypot(b.pos[i] - 5, b.pos[i + 1] - 6) <= 1.5 + 1e-9);
});
test('estCone: 8 sides from the base circle to the tip', () => {
  const { G } = load(); const b = newBuf();
  G.estCone(b, 2, 1, 4, '#ffffff');
  assert.equal(b.pos.length, 8 * 9); assert.deepEqual(b.pos.slice(6, 9), [0, 0, 4]); near(b.pos[0], 2, 1e-9);
});
test('estAxisBox: four sides and the top', () => {
  const { G } = load(); const b = newBuf();
  G.estAxisBox(b, 0, 0, 0, 1, 2, 3, '#ffffff', '#000000');
  assert.equal(b.pos.length, 5 * 18); assert.equal(Math.max(...zsOf(b)), 3); assert.deepEqual(b.col.slice(4 * 18, 4 * 18 + 3), [0, 0, 0]);
});
test('estTreeGeometry: four shapes, trunk brown at the bottom, crown up to 1, within radius 1', () => {
  const { G } = load(); const trunk = G.wallRGB(G.EST_COL.trunk);
  for (let k = 0; k < 4; k++) {
    const g = G.estTreeGeometry(k), p = g.attributes.position.array, c = g.attributes.color.array;
    let zmax = 0; for (let i = 0; i < p.length; i += 3) { zmax = Math.max(zmax, p[i + 2]); assert.ok(Math.hypot(p[i], p[i + 1]) <= 1.0001, `kind ${k} radius`); }
    assert.ok(zmax <= 1.0001 && zmax > 0.8, `kind ${k} top ${zmax}`); near(c[0], trunk[0], 1e-6, `kind ${k} trunk first`);
  }
});
test('estTreeHeight: 1.6 x crown radius + 2 m', () => {
  const { G } = load();
  assert.deepEqual([G.estTreeHeight(2.5), G.estTreeHeight(7.5)], [6, 14]);
});
test('estTreeBlocked: a tree touching a phase 4 spot gives way', () => {
  const { G } = load(); G.SIDE3D.spots = [[100, 100, 1.5]];
  assert.equal(G.estTreeBlocked({ x: 103, y: 100, r: 2 }), true); assert.equal(G.estTreeBlocked({ x: 110, y: 100, r: 2 }), false);
});
test('estTrees: the trees of a list, one instanced mesh per kind present, sized and turned per tree', () => {
  const { G } = load();
  const ms = G.estTrees(G.walls3DMaterials().solid, G.SCN.trees);
  assert.ok(ms.every(m => m.instanceColor), 'leaf shade per tree');
  assert.equal(ms.length, 4); assert.equal(ms.reduce((a, m) => a + m.count, 0), G.SCN.trees.length);
  assert.equal(G.estTrees(G.walls3DMaterials().solid, G.SCN.trees.filter(q => G.EST_TREE_KIND[q.v] === 2)).length, 1, 'only conifers: one mesh');
  const list = G.SCN.trees.filter(q => G.EST_TREE_KIND[q.v] === 0), t = list[0], i = 0, a = ms[0].instanceMatrix.array;
  near(Math.hypot(a[i * 16], a[i * 16 + 1]), t.r, 1e-4, 'crown radius'); near(a[i * 16 + 10], G.estTreeHeight(t.r) * G.WALL_HS, 1e-3, 'height');
  near(a[i * 16 + 12], t.x, 1e-3); assert.ok(ms[0].instanceColor, 'leaf shade per tree');
});
test('estCrowd: a repeating crowd texture, drawn once', () => {
  const { G } = load(); const t = G.estCrowd();
  assert.equal(t.wrapS, G.THREE.RepeatWrapping); assert.equal(t.image.width, 256); assert.equal(G.estCrowd(), t);
});
test('estStand: 8 tiers of crowd from 1 to 8 m, rising away from the track; ends, back wall and roof at 12 m', () => {
  const { G } = load(); const s = { x: 0, y: 0, w: 80, h: 16, a: 0, flip: 1 }, solid = newBuf(), crowd = { pos: [], uv: [] };
  G.estStand(solid, crowd, s);
  assert.equal(crowd.pos.length, 8 * 2 * 18, 'riser and tread per tier');
  near(Math.max(...zsOf(crowd)), 8 * G.WALL_HS, 1e-9); near(Math.max(...zsOf(solid)), 12 * G.WALL_HS, 1e-9);
  const front = [], back = []; for (let i = 0; i < crowd.pos.length; i += 3) (crowd.pos[i + 2] <= 1.5 * G.WALL_HS ? front : back).push(crowd.pos[i + 1]);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(mean(front) < mean(back) - 5, 'flip 1: the front (low) is at -y, the track side');
  assert.equal(crowd.uv[2], 20, '4 m repeats of the crowd across 80 m');
});
test('estBox: a turned box with four sides and a top', () => {
  const { G } = load(); const b = newBuf();
  G.estBox(b, 10, 20, Math.PI / 2, 4, 2, 0, 3, '#ffffff', '#000000');
  const xs = []; for (let i = 0; i < b.pos.length; i += 3) xs.push(b.pos[i]);
  near(Math.max(...xs) - Math.min(...xs), 2, 1e-9, 'turned 90 degrees: the 2 m width along x'); near(Math.max(...zsOf(b)), 3 * G.WALL_HS, 1e-9);
  assert.equal(b.pos.length, 5 * 18);
});
test('estBuildings: each paddock unit is a white box with the team colour band under the roof', () => {
  const { G } = load(); const b = newBuf();
  G.estBuildings(b);
  assert.equal(b.pos.length, G.SCN.buildings.length * 2 * 5 * 18); near(Math.max(...zsOf(b)), 3.5 * G.WALL_HS, 1e-9);
});
test('estWing: garage block, office block, 22 doors in team colours and the roof up to 13 m', () => {
  const { G } = load(); const b = newBuf();
  G.estWing(b);
  near(Math.max(...zsOf(b)), 13 * G.WALL_HS, 1e-9);
  const door = G.wallRGB(G.TEAMS[0].c1); let n = 0;
  for (let i = 0; i < b.col.length; i += 18) { if (b.col[i] === door[0] && b.col[i + 1] === door[1] && b.col[i + 2] === door[2]) n++; }
  assert.ok(n >= 2, `doors of the first team: ${n}`);
});
test('estLineTexture: tree tops cut out of a strip, repeating sideways', () => {
  const { G } = load(); const t = G.estLineTexture();
  assert.equal(t.wrapS, G.THREE.RepeatWrapping); assert.ok(t.image.getContext('2d').calls.some(c => c[0] === 'fill'));
});
test('estLine: one quad with the tree line texture, not cut and not hazed', () => {
  const { G } = load(); const m = G.estLine();
  assert.equal(m.material.fog, false); assert.equal(m.material.clippingPlanes, null); assert.equal(m.geometry.attributes.position.count, 4);
});
test('estLinePlace: on the far edge of the ground, 4 m high, turning with the camera', () => {
  const { G } = tilted(); const m = G.estLine();
  G.estLinePlace(m);
  const p = m.geometry.attributes.position.array, edge = G.groundPoint(0, 0.5);
  near(p[1], edge[1], 1e-3, 'base row on the far edge'); near(p[0], -G.RW / 2, 1e-9);
  const up = Math.hypot(p[7] - p[4], p[8] - p[5]); near(up, 4 * G.WALL_HS * G.CAM.ppm, 1e-3);
  near(m.material.map.offset.x, -G.CAM.rot / G.TAU * 4, 1e-9);
  assert.ok(m.geometry.attributes.position.version > 0, 'positions sent to the GPU again');
});
test('estate3DBuild: trees, stands, buildings and the Wing in cells in the walls scene; trees giving way; the tree line', () => {
  const { G } = load(); G.walls3DInit();
  const ms = G.EST.meshes, scene = G.WALLS3D.scene;
  assert.ok(G.EST.cells.length > 10); assert.ok(ms.every(m => scene.children.includes(m) && !m.matrixAutoUpdate));
  const trees = ms.filter(m => m.isInstancedMesh).reduce((a, m) => a + m.count, 0);
  assert.equal(trees, G.SCN.trees.filter(t => !t.gone3d).length); assert.ok(trees > 1400);
  assert.ok(ms.some(m => m.geometry.attributes.uv), 'the crowd'); assert.ok(scene.children.includes(G.EST.line));
  for (const t of G.SCN.trees.filter(q => q.gone3d)) assert.ok(G.estTreeBlocked(t), 'only trees at a phase 4 object give way');
});
test('estCellOf: cells of 300 m', () => {
  const { G } = load();
  assert.equal(G.estCellOf(10, 10), '0,0'); assert.equal(G.estCellOf(310, -10), '1,-1');
});
test('estCellBox: the vertices of the meshes and the tree feet with their crowns', () => {
  const { G } = load(); const b = { pos: [], col: [] }; G.wallQuad(b, [0, 0, 0], [10, 0, 0], [10, 5, 1], [0, 5, 1], '#ffffff');
  const trees = G.estTrees(G.walls3DMaterials().solid, [{ x: 100, y: 50, r: 3, v: 0, rot: 0 }]);
  assert.deepEqual(G.estCellBox([new G.THREE.Mesh(G.wallGeometry(b)), ...trees]), [0, 0, 108, 58]);
});
test('estCell: trees, solid and crowd meshes of a cell with their box', () => {
  const { G } = load(); const solid = { pos: [], col: [] }; G.wallQuad(solid, [0, 0, 0], [10, 0, 0], [10, 5, 1], [0, 5, 1], '#ffffff');
  const c = G.estCell({ trees: [], solid, crowd: { pos: [], uv: [] } }, G.walls3DMaterials());
  assert.equal(c.meshes.length, 1); assert.deepEqual(c.box, [0, 0, 10, 5]);
});
test('estate3DPlace: the cells in view get the frame matrix of the world origin, the others are hidden; the tree line is placed', () => {
  const { G } = tilted(); G.walls3DInit();
  const F = G.walls3DFrame(), n = G.estate3DPlace(F), C = G.EST.cells;
  assert.ok(n > 0 && n < C.length, `${n} of ${C.length} cells`); assert.equal(C.filter(c => c.meshes[0].visible).length, n);
  const M = G.walls3DMatrix(F, 0, 0), e = C.find(c => c.meshes[0].visible).meshes[0].matrixWorld.elements;
  near(e[12], M[3], 1e-3); near(e[0], M[0], 1e-6);
  assert.ok(G.EST.line.geometry.attributes.position.array.some(v => v !== 0));
});
test('wallShadowSide: one side, starting again after each gap, nothing across the garage frontage', () => {
  const { G } = load(); const Path = G.wallShadowPath().constructor, T = G.T;
  const p = G.wallShadowSide(new Path(), 0), moves = p.ops.filter(o => o[0] === 'moveTo').length, kind = G.wallKinds(0);
  let starts = 0; for (let k = 0; k < T.N; k++) { if (kind[k] && kind[(k + 1) % T.N] && !(kind[(k - 1 + T.N) % T.N] && kind[k])) starts++; }
  assert.equal(moves, starts, 'one start per run of wall');
  const mid = T.idx((T.PIT.flatIn + T.PIT.flatOut) / 2), [mx, my] = T.pt(mid, T.WALL[0][mid]);
  assert.ok(!p.ops.some(o => o[0] !== 'closePath' && Math.hypot(o[1] - mx, o[2] - my) < 1), 'open at the garages');
});
test('wallShadowPath: the wall line only where 3D walls stand, made once per track', () => {
  const { G } = load();
  const p = G.wallShadowPath(); assert.equal(G.wallShadowPath(), p);
  const moves = p.ops ? p.ops.filter(o => o[0] === 'moveTo').length : null;
  if (moves !== null) assert.ok(moves >= 3, 'a new start after each gap');
  G.T.X = Float64Array.from(G.T.X); assert.notEqual(G.wallShadowPath(), p, 'new track: made again');
});
// the ground points of the estate: tree feet (instance positions) and the vertices at ground level of the solid meshes
function estateFeet(G) {
  const pts = [];
  for (const m of G.EST.meshes) {
    if (m.isInstancedMesh) { const a = m.instanceMatrix.array; for (let i = 0; i < m.count; i++) { pts.push([a[i * 16 + 12], a[i * 16 + 13], 'tree']); } continue; }
    const a = m.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { if (a[i + 2] < 0.01) pts.push([a[i], a[i + 1], 'building']); }
  }
  return pts;
}
test('estate3DBuild: over the whole estate no tree, stand or building stands on the road, run-off, gravel or pit lane', () => {
  const { G } = load(); G.walls3DInit(); const T = G.T, S = G.SURF, PIT = T.PIT, o = { i: -1 };
  const bad = estateFeet(G).filter(([x, y]) => {
    T.project(x, y, -1, o); const sf = T.surface(o.i, o.s, o.d), sr = T.rel(o.i * T.DS);
    const wing = o.d >= PIT.garage - 0.1 && sr > PIT.flatIn - 16 && sr < PIT.flatOut + 16; // the garage front stands at the pit boxes' back edge
    return sf !== S.GRASS && sf !== S.WALL && !wing;
  });
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} estate points off the grass`);
});
