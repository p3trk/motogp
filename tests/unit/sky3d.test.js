// Unit tests for src/sky3d.js (GDD 11o, phase 5): the sun fixed in the world, the shadows of the 3D scenery baked
// into the ground tiles, and the sky strip with clouds, the glow towards the sun and the hills.
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
test('skyClouds: one wrapping strip of soft puffs, drawn once', () => {
  const { G } = load(); const c = G.skyClouds();
  assert.equal(c.width, 2048); assert.equal(c.height, 96); assert.ok(c.getContext('2d').calls.filter(k => k[0] === 'fillRect').length > 3 * 16 * 5);
  assert.equal(G.skyClouds(), c);
});
test('skyU: one tree-line unit per quarter of the ground width, one ground width per full turn', () => {
  const { G } = tilted(); const k = 0.5;
  near(G.skyU(G.VW / 2 + k * G.RW / 4, k) - G.skyU(G.VW / 2, k), 1, 1e-9);
  const u0 = G.skyU(300, k); G.CAM.rot += G.TAU; const u1 = G.skyU(300, k);
  assert.ok(Math.abs(u1 - (u0 - 4)) < 1e-9, `${u1} vs ${u0 - 4}`);
});
test('skyHill: 2.5 to 4.5 m, the same after a full turn', () => {
  const { G } = load(); let lo = Infinity, hi = -Infinity;
  for (let u = 0; u < 4; u += 0.01) { const h = G.skyHill(u); lo = Math.min(lo, h); hi = Math.max(hi, h); near(G.skyHill(u + 4), h, 1e-9); }
  assert.ok(lo >= 2.5 && hi <= 4.5 && hi - lo > 1.2, `${lo} ${hi}`);
});
test('skyRow: the far edge at the horizon row, higher points further up the screen', () => {
  const { G } = tilted(); const P = G.tiltP(), a = G.tiltA();
  near(G.skyRow(0), G.VH - G.RH * Math.cos(a) * P / (P + G.RH * Math.sin(a)), 1e-9);
  assert.ok(G.skyRow(4) < G.skyRow(1));
});
test('skyDecor: glow, clouds, haze and hills inside the sky strip; the clouds drift with time', () => {
  const { G } = tilted(); const g = makeCtx({ width: 100, height: 100 });
  G.SKY.t = 0; G.CAM.rot = -G.SUN.az - Math.PI / 2; // facing the sun
  const hz = G.skyDecor(g, 300);
  assert.equal(hz, G.VH - 300);
  assert.deepEqual(g.calls.find(k => k[0] === 'rect').slice(1), [0, 0, G.VW, hz + 2], 'clipped to the sky');
  assert.ok(g.calls.some(k => k[0] === 'createRadialGradient'), 'glow');
  const imgs = () => g.calls.filter(k => k[0] === 'drawImage').map(k => k[2]);
  const x0 = imgs()[0]; assert.ok(x0 <= 0 && imgs().length >= 1);
  g.calls.length = 0; G.CAM.rot += Math.PI; G.skyDecor(g, 300);
  assert.ok(!g.calls.some(k => k[0] === 'createRadialGradient'), 'no glow with the sun behind');
  g.calls.length = 0; G.CAM.rot -= Math.PI; G.SKY.t = 60; G.skyDecor(g, 300);
  assert.notEqual(imgs()[0], x0, 'a minute later the clouds have moved');
  assert.ok(g.calls.filter(k => k[0] === 'lineTo').length > G.VW / 6, 'hills outline across the screen');
});
test('drawSky: clouds and hills only while the 3D scenery stands', () => {
  const { G } = tilted(); const g = G.mainCtx;
  g.calls.length = 0; G.TILE_WALLS.on3d = false; G.drawSky(g, 300); assert.equal(g.calls.filter(k => k[0] === 'drawImage').length, 0);
  g.calls.length = 0; G.TILE_WALLS.on3d = true; G.drawSky(g, 300); assert.ok(g.calls.filter(k => k[0] === 'drawImage').length >= 1);
});
test('skyTick: the clouds\' clock runs with the session and the playing replay, not while paused', () => {
  const { G } = tilted(); G.SKY.t = 0;
  G.UI.state = 'play'; G.W.paused = false; assert.equal(G.skyTick(0.5), 0.5);
  G.W.paused = true; assert.equal(G.skyTick(0.5), 0.5, 'paused');
  G.UI.state = 'replay'; G.RP.playing = false; assert.equal(G.skyTick(0.5), 0.5, 'replay paused');
  G.RP.playing = true; assert.equal(G.skyTick(0.25), 0.75);
});
