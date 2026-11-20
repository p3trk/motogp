// Unit tests for src/sky3d.js (GDD 11o, phase 5): the sun fixed in the world, the shadows of the 3D scenery baked
// into the ground tiles.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, makeCtx, placeAt } = require('./load');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const all = () => true, none = () => false;
function tilted() {
  const g = load(); const { G } = g;
  G.UI.opts.cam = 'close'; G.UI.launch('practice', {});
  const b = G.W.player, hs = G.T.corners.find(c => c.name === 'Hangar Straight');
  placeAt(G, b, hs.s + 100, 0); b.v = 30; G.CAM.init = false; for (let k = 0; k < 60; k++) G.updateCamera(1 / 60);
  return g;
}
// the area of a polygon [[x, y], ...]
const area = p => Math.abs(p.reduce((s, [x, y], i) => { const [u, v] = p[(i + 1) % p.length]; return s + x * v - u * y; }, 0)) / 2;

test('sunShadowDir: away from the sun (to +x, +y), 1.19 times the drawn height per metre', () => {
  const { G } = load(); const [dx, dy] = G.sunShadowDir();
  assert.ok(dx > 0 && dy > 0); near(dx, dy, 1e-9, 'north-west sun: diagonal');
  near(Math.hypot(dx, dy), G.WALL_HS / Math.tan(40 * Math.PI / 180), 1e-9);
});
test('sunHull: the convex hull, inner points dropped', () => {
  const { G } = load();
  const h = G.sunHull([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [1, 0.5]]);
  assert.equal(h.length, 4); near(area(h), 4, 1e-9);
  assert.deepEqual(G.sunHull([[0, 0], [1, 1]]), [[0, 0], [1, 1]], 'two points stay as they are');
});
test('sunShadowOf: a box casts its ground plan plus its top moved along the sun; grow widens it', () => {
  const { G } = load(); const [dx, dy] = G.sunShadowDir();
  const box = []; for (const [x, y] of [[0, 0], [1, 0], [1, 1], [0, 1]]) box.push([x, y, 0], [x, y, 2]);
  const s = G.sunShadowOf(box);
  assert.ok(s.some(([x, y]) => Math.abs(x - (1 + 2 * dx)) < 1e-9 && Math.abs(y - (1 + 2 * dy)) < 1e-9), 'top corner moved');
  assert.ok(s.some(([x, y]) => x === 0 && y === 0), 'foot corner stays');
  assert.ok(area(G.sunShadowOf(box, 0.6)) > area(s) + 1, 'soft edge larger');
  const floating = G.sunShadowOf([[0, 0, 7], [1, 0, 7], [0, 1, 8], [1, 1, 8]]);
  assert.ok(floating.every(([x]) => x > 7 * dx - 1e-9), 'a beam up high casts away from its foot');
});
test('sunStandCasters: one caster per stand, from the ground to the roof at 12 m', () => {
  const { G } = load(); const c = G.sunStandCasters();
  assert.equal(c.length, G.SCN.stands.length);
  for (const pts of c) { const z = pts.map(p => p[2]); assert.equal(Math.min(...z), 0); assert.equal(Math.max(...z), 12); }
  const s = G.SCN.stands[0], xs = c[0].map(p => p[0]), ys = c[0].map(p => p[1]);
  assert.ok(Math.hypot((Math.min(...xs) + Math.max(...xs)) / 2 - s.x, (Math.min(...ys) + Math.max(...ys)) / 2 - s.y) < 1, 'about the stand centre');
});
test('sunBuildingCasters: each paddock building at 3.5 m, the Wing in slices up to 13 m', () => {
  const { G } = load(); const c = G.sunBuildingCasters(), n = G.SCN.buildings.length;
  assert.ok(c.length > n + 10);
  assert.ok(c.slice(0, n).every(p => p.length === 8 && Math.max(...p.map(q => q[2])) === 3.5));
  assert.ok(c.slice(n).every(p => Math.max(...p.map(q => q[2])) === 13));
});
test('sunShadows: every caster once, kept until the walls are built again', () => {
  const { G } = load(); G.walls3DInit();
  const S = G.sunShadows(), n = G.SIDE3D.casts.length + G.SCN.stands.length + G.sunBuildingCasters().length;
  assert.equal(S.length, n); assert.ok(G.SIDE3D.casts.length > 400, 'boards, posts, huts, towers, gantries');
  assert.equal(G.sunShadows(), S);
  for (const s of S.slice(0, 50)) { assert.ok(s.core.length >= 3 && s.r > 0); assert.ok(Math.hypot(s.core[0][0] - s.x, s.core[0][1] - s.y) <= s.r + 1e-9); }
});
test('drawSunShadows: soft edges then cores as one path each; none outside the tile', () => {
  const { G } = load(); G.walls3DInit(); const c = makeCtx({ width: 100, height: 100 }); G.ctx = c;
  const n = G.drawSunShadows(all);
  assert.equal(n, G.sunShadows().length);
  assert.equal(c.calls.filter(k => k[0] === 'fill').length, 2); assert.equal(c.calls.filter(k => k[0] === 'beginPath').length, 2);
  assert.deepEqual(c.calls.filter(k => k[0] === '=fillStyle').map(k => k[1]), ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.2)']);
  const d = makeCtx({ width: 100, height: 100 }); G.ctx = d; assert.equal(G.drawSunShadows(none), 0); assert.equal(d.calls.length, 0);
});
test('drawTreeShadow: the crown shadow along the sun, away from the trunk, and a trunk line', () => {
  const { G } = load(); const c = makeCtx({ width: 100, height: 100 }); G.ctx = c;
  G.drawTreeShadow({ x: 10, y: 20, r: 5 });
  const rot = c.calls.find(k => k[0] === 'rotate'); near(rot[1], Math.PI / 4, 1e-9, 'towards +x, +y');
  const img = c.calls.find(k => k[0] === 'drawImage'); assert.ok(img[2] > 0, 'starts beyond the trunk');
  assert.ok(img[4] > 2.3 * 5, 'stretched along the sun'); near(img[5], 2.3 * 5, 1e-9, 'crown wide across');
  assert.equal(c.calls.filter(k => k[0] === 'stroke').length, 1);
});
test('drawTrees: with the 3D scenery, one sun shadow per tree and no flat crown', () => {
  const { G } = load(); G.walls3DInit(); G.TILE_WALLS.on3d = true; G.SCN.trees = G.SCN.trees.slice(0, 3).map(t => ({ ...t, gone3d: false }));
  const c = makeCtx({ width: 100, height: 100 }); G.ctx = c; G.drawTrees(all);
  assert.equal(c.calls.filter(k => k[0] === 'drawImage').length, 3); assert.equal(c.calls.filter(k => k[0] === 'rotate').length, 3);
});
test('sunLightPlace: the sun stays put in the world when the camera turns', () => {
  const { G } = tilted(); G.walls3DInit(); const L = G.WALLS3D.lights;
  // a face looking at the sun's side (north-west) lit the same before and after a 90 degree turn of the camera
  const lit = () => {
    const F = G.walls3DFrame(); G.sunLightPlace(F, L);
    const nrm = F.ex.map((e, i) => -(e + F.ey[i])), n = Math.hypot(...nrm), p = L.sun.position;
    return (nrm[0] * p.x + nrm[1] * p.y + nrm[2] * p.z) / n;
  };
  const a = lit(); G.CAM.rot += Math.PI / 2; const b = lit();
  near(a, b, 1e-6); assert.ok(a > 0.5, 'facing the sun'); near(L.sun.position.length(), 1, 1e-9);
  const f = L.fill.position; assert.ok(f.x * L.sun.position.x + f.y * L.sun.position.y + f.z * L.sun.position.z < 0, 'fill from the other side');
});
