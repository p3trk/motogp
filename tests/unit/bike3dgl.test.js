// Unit tests for src/bike3dgl.js (GDD 11i-b): the three.js bikes. The projection must reproduce worldToScreen, the
// bike frame must sit on the road, and without WebGL the 2D bikes are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, placeAt } = require('./load');

// the player riding on the Hangar Straight with the Behind camera settled (the camera is tilted)
function tiltedRider() {
  const g = load(); const { G } = g;
  G.UI.opts.cam = 'behind'; G.UI.launch('practice', {});
  const b = G.W.player, hs = G.T.corners.find(c => c.name === 'Hangar Straight');
  placeAt(G, b, hs.s + 100, 0); b.trainHold = false; b.v = 30;
  G.CAM.init = false; G.updateCamera(1 / 60); for (let k = 0; k < 60; k++) G.updateCamera(1 / 60);
  return Object.assign(g, { b });
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
// clip = M * [u, Y, Z, 1], then the screen position as the browser puts it
function clipToScreen(M, p, VW, VH) {
  const [u, Y, Z] = p, row = r => M[r * 4] * u + M[r * 4 + 1] * Y + M[r * 4 + 2] * Z + M[r * 4 + 3];
  const w = row(3), nx = row(0) / w, ny = row(1) / w;
  return [(nx + 1) / 2 * VW, (1 - ny) / 2 * VH];
}

test('gl3DInit: no WebGL or no three.js is not an error: the 2D bikes are drawn', () => {
  const { G } = load();
  assert.equal(G.gl3DInit(), false); assert.equal(G.GL3D.ok, false);
  assert.equal(G.gl3DInit(), false, 'the answer is kept');
});
test('gl3DProjection: the 3D camera puts a road point where worldToScreen does', () => {
  const { G, b } = tiltedRider();
  const M = G.gl3DProjection(G.tiltP());
  assert.equal(M.length, 16);
  for (const [dx, dy] of [[0, 0], [30, 0], [-40, 3], [120, -2]]) {
    const x = b.x + dx, y = b.y + dy;
    const want = G.worldToScreen(x, y), got = clipToScreen(M, G.gl3DPlanePoint(x, y, 0), G.VW, G.VH);
    near(got[0], want[0], 0.01, 'x'); near(got[1], want[1], 0.01, 'y');
  }
});
test('gl3DPlanePoint: a point lifted off the road moves up the screen', () => {
  const { G, b } = tiltedRider();
  const ground = G.gl3DPlanePoint(b.x, b.y, 0), up = G.gl3DPlanePoint(b.x, b.y, 1);
  const M = G.gl3DProjection(G.tiltP());
  const s0 = clipToScreen(M, ground, G.VW, G.VH), s1 = clipToScreen(M, up, G.VW, G.VH);
  assert.ok(s1[1] < s0[1], 'one metre up is higher on screen');
});
test('gl3DBikeFrame: the bike frame starts on the road and scales by the bike size', () => {
  const { G, b } = tiltedRider();
  const f = G.gl3DBikeFrame(b), O = G.gl3DPlanePoint(b.x, b.y, 0);
  assert.equal(f.O.length, 3, 'a 3D origin');
  f.O.forEach((k, i) => near(k, O[i], 1e-9, 'origin'));
  const fwd = G.gl3DPlanePoint(b.x + Math.cos(b.h), b.y + Math.sin(b.h), 0);
  const VS = G.PHYS.VS * G.CAM.boost;
  for (let i = 0; i < 3; i++) near(f.X[i], (fwd[i] - O[i]) * VS, 1e-6, 'forward axis');
});
test('gl3DMatrix: columns are the bike axes, the last column its origin', () => {
  const f = { O: [1, 2, 3], X: [4, 5, 6], Y: [7, 8, 9], Z: [10, 11, 12] };
  assert.deepEqual(new Set(G_gl3DMatrix(f).slice(12)), new Set([0, 0, 0, 1]));
  const M = G_gl3DMatrix(f);
  assert.equal(M[0], 4); assert.equal(M[1], 7); assert.equal(M[2], 10); assert.equal(M[3], 1);
  assert.equal(M[7], 2); assert.equal(M[11], 3);
});
function G_gl3DMatrix(f) { return load().G.gl3DMatrix(f); }
test('gl3DDecode: base64 arrays read back as typed arrays', () => {
  const { G } = load();
  const f = G.gl3DDecode(Buffer.from(new Float32Array([1.5, -2, 3]).buffer).toString('base64'), Float32Array);
  assert.deepEqual([...f], [1.5, -2, 3]);
  const u = G.gl3DDecode(Buffer.from(new Uint32Array([7, 70000]).buffer).toString('base64'), Uint32Array);
  assert.deepEqual([...u], [7, 70000]);
});
test('gl3DGeometry: each role is an indexed mesh from the exported model, built once', () => {
  const { G } = load();
  const geo = G.gl3DGeometry('body');
  assert.ok(geo.getAttribute('position').count > 0); assert.ok(geo.index.count % 3 === 0, 'whole triangles');
  assert.equal(G.gl3DGeometry('body'), geo);
  assert.ok(geo.getAttribute('normal'), 'normals computed');
});
test('gl3DColour: bodywork takes team colour 1, screen colour 2, the suit and the rest are fixed', () => {
  const { G } = load();
  assert.equal(G.gl3DColour(2, 'body'), G.TEAMS[2].c1); assert.equal(G.gl3DColour(2, 'screen'), G.TEAMS[2].c2);
  assert.equal(G.gl3DColour(2, 'suit'), G.TEAMS[2].suit); assert.equal(G.gl3DColour(2, 'stripe'), G.TEAMS[2].accent); assert.equal(G.gl3DColour(2, 'trim'), G.TEAMS[2].suit); assert.equal(G.gl3DColour(2, 'helmet'), G.TEAMS[2].helmet); assert.equal(G.gl3DColour(2, 'dark'), '#1b1b1b');
});
test('gl3DMesh: one mesh per model role for each bike, the rider on the player only, kept for that bike', () => {
  const { G, b } = tiltedRider();
  G.GL3D.scene = new G.THREE.Scene();
  const list = G.gl3DMesh(b);
  assert.equal(list.length, G.gl3DRoles().length + 1, 'the player has every role, the rider included, and the tail light');
  assert.equal(G.gl3DMesh(b), list, 'the same bike keeps its meshes');
  assert.equal(G.GL3D.scene.children.length, list.length);
  for (const m of list) { assert.equal(m.matrixAutoUpdate, false); assert.equal(m.frustumCulled, false); }
  const other = { team: 1, isPlayer: false, x: 0, y: 0, h: 0, lean: 0, v: 0 };
  assert.equal(G.gl3DMesh(other).length, list.length - 6, 'other bikes have no rider, suit, stripe, helmet, visor or trim (tail light stays)');
});
test('gl3DOn: a running bike in the tilted view, when 3D is on and WebGL works', () => {
  const { G, b } = tiltedRider();
  assert.equal(G.gl3DOn(b), false, 'no WebGL here');
  G.GL3D.ok = true;
  assert.equal(G.gl3DOn(b), true, 'running bike');
  b.crashed = true; assert.equal(G.gl3DOn(b), false, 'crashed bikes stay 2D'); b.crashed = false;
  b.dnf = true; assert.equal(G.gl3DOn(b), false, 'retired bikes stay 2D'); b.dnf = false;
  G.UI.opts.gfx = 'classic'; assert.equal(G.gl3DOn(b), false, 'Classic is 2D');
});
test('gl3DDraw: nothing to draw, or no WebGL, draws nothing', () => {
  const { G, b } = tiltedRider();
  assert.equal(G.gl3DDraw([]), false);
  assert.equal(G.gl3DDraw([b]), false, 'no WebGL here');
});
test('gl3DPrune: meshes of bikes that left the session are removed, others not drawn this frame are hidden', () => {
  const { G, b } = tiltedRider();
  G.GL3D.scene = new G.THREE.Scene();
  const gone = { team: 3, isPlayer: false, x: 0, y: 0, h: 0, lean: 0, v: 0 };
  const goneMeshes = G.gl3DMesh(gone), mine = G.gl3DMesh(b);
  G.gl3DPrune([b]);
  assert.equal(G.GL3D.meshes.has(gone), false, 'a bike that is not in the session any more loses its meshes');
  assert.equal(G.GL3D.scene.children.includes(goneMeshes[0]), false, 'and leaves the scene');
  assert.equal(G.GL3D.meshes.has(b), true, 'a bike in the session keeps its meshes');
  G.gl3DPrune([]);
  assert.ok(mine.every(m => m.visible === false), 'a bike not drawn this frame is hidden');
});
test('gl3DBikeFrame: lean rolls the bike about its forward axis, keeping the contact point and the forward axis', () => {
  const { G, b } = tiltedRider();
  b.lean = 0; const upright = G.gl3DBikeFrame(b);
  b.lean = 0.4; const leaned = G.gl3DBikeFrame(b);
  b.lean = 0;
  leaned.X.forEach((k, i) => near(k, upright.X[i], 1e-9, 'forward axis unchanged'));
  leaned.O.forEach((k, i) => near(k, upright.O[i], 1e-9, 'contact point unchanged'));
  const len = v => Math.hypot(...v);
  near(len(leaned.Z), len(upright.Z), 1e-9, 'up axis keeps its length');
  assert.ok(Math.abs(leaned.Z[1] - upright.Z[1]) > 1e-6, 'the up axis turns');
});
test('gl3DPitch: acceleration lifts the nose, braking dips it, from load transfer; about 3 degrees at 1 g', () => {
  const { G } = load(); const b = { aLong: 0 };
  near(G.gl3DPitch(b), 0, 1e-12, 'no acceleration, no pitch');
  b.aLong = 9.81; const up = G.gl3DPitch(b);
  b.aLong = -9.81; const down = G.gl3DPitch(b);
  assert.ok(up > 0, 'acceleration: nose up'); assert.ok(down < 0, 'braking: nose down');
  near(up, -down, 1e-12, 'symmetric');
  near(up * 180 / Math.PI, 2.0, 0.2, 'about 2 degrees at 1 g (from the sourced fork and centre-of-mass figures)');
});
test('gl3DBikeFrame: pitch raises the nose on acceleration and lowers it on braking', () => {
  const { G, b } = tiltedRider();
  b.aLong = 0; const flat = G.gl3DBikeFrame(b);
  b.aLong = 9.81; const up = G.gl3DBikeFrame(b);
  b.aLong = -9.81; const down = G.gl3DBikeFrame(b);
  b.aLong = 0;
  assert.ok(up.X[2] > flat.X[2] + 1e-6, 'acceleration: the forward axis tilts up');
  assert.ok(down.X[2] < flat.X[2] - 1e-6, 'braking: the forward axis tilts down');
});
test('gl3DWheelFrame: no steering leaves the front wheel where the bike frame puts it; steering turns it about its axle', () => {
  const { G, b } = tiltedRider();
  const f = G.gl3DBikeFrame(b);
  const same = G.gl3DWheelFrame(f, 0);
  same.X.forEach((k, i) => near(k, f.X[i], 1e-9, 'forward axis unchanged'));
  same.O.forEach((k, i) => near(k, f.O[i], 1e-9, 'origin unchanged'));
  const turned = G.gl3DWheelFrame(f, 1);
  const len = v => Math.hypot(...v);
  near(len(turned.X), len(f.X), 1e-9, 'a turn keeps the axis length');
  assert.ok(Math.abs(G.gl3DWheelFrame(f, 1).X[1] - f.X[1]) > 1e-6, 'steering turns the forward axis');
  near(turned.Z[0], f.Z[0], 1e-9, 'the up axis is kept');
  const axle = G.gl3DPlanePoint(b.x, b.y, 0);
  assert.ok(turned.O.every(Number.isFinite), 'finite origin');
  near(axle[0], f.O[0], 1e-9, 'sanity: the bike origin is the road point');
});
test('gl3DRoles: every role but the pivot, and the wheel is a role', () => {
  const { G } = load();
  const roles = G.gl3DRoles();
  assert.ok(!roles.includes('pivot')); assert.ok(roles.includes('wheel')); assert.ok(roles.includes('body'));
});
test('gl3DMesh: the tail light is lit red while braking, dark otherwise', () => {
  const { G, b } = tiltedRider();
  G.GL3D.scene = new G.THREE.Scene();
  G.gl3DDraw([]); // no draw: just the meshes
  const list = G.gl3DMesh(b), light = list.find(m => m.userData.role === 'light');
  assert.ok(light, 'the tail light exists');
  const stub = { setPixelRatio() {}, setSize() {}, clear() {}, render() {} };
  Object.assign(G.GL3D, { ok: true, renderer: stub, canvas: {}, cam: { projectionMatrix: { set() {} }, matrixWorldInverse: { identity() {} } } });
  b.v = 30; b.ctl.brk = 0.9; G.gl3DDraw([b]);
  assert.equal(light.material.emissive.getHex(), 0xff2a1a, 'braking: lit');
  b.ctl.brk = 0; G.gl3DDraw([b]);
  assert.equal(light.material.emissive.getHex(), 0x000000, 'off: dark');
  G.GL3D.ok = false;
});
test('gl3DLightGeometry: one box, at the rear end of the tail, built once', () => {
  const { G } = load();
  const g = G.gl3DLightGeometry();
  assert.equal(G.gl3DLightGeometry(), g, 'built once');
  g.computeBoundingBox();
  assert.ok(g.boundingBox.min.x > -0.9 && g.boundingBox.max.x < -0.7, 'at the rear end of the tail (x between -0.9 and -0.7 m)');
  assert.ok(g.boundingBox.min.z > 0.8 && g.boundingBox.max.z < 0.95, 'at the height of the tail (0.8 to 0.95 m)');
});
test('gl3DPoseWeights: upright has no pose; a lean blends the two baked poses either side of it, on its side', () => {
  const { G } = load(); const P = G.BIKE3DMODEL.poseLean;
  assert.ok(P.length >= 2 && P.some(p => p > 0) && P.some(p => p < 0), 'poses on both sides');
  assert.ok(G.gl3DPoseWeights(0).every(v => v === 0), 'upright: the base mesh');
  const k = P.indexOf(Math.max(...P.filter(p => p > 0)));
  const at = G.gl3DPoseWeights(P[k]); near(at[k], 1, 1e-9, 'on a pose: that pose only'); near(at.reduce((s, v) => s + v, 0), 1, 1e-9, 'weights sum to 1');
  const small = P.filter(p => p > 0).sort((u, v) => u - v)[0], half = G.gl3DPoseWeights(small / 2);
  near(half[P.indexOf(small)], 0.5, 1e-9, 'half way to the first pose: half of it, the rest upright');
  const left = G.gl3DPoseWeights(-small);
  P.forEach((p, i) => { if (p > 0) assert.equal(left[i], 0, 'a left lean uses no right pose'); });
  const beyond = G.gl3DPoseWeights(2 * Math.max(...P)); near(beyond[k], 1, 1e-9, 'beyond the last pose: hold it');
});
test('gl3DGeometry: the rider roles carry one morph target per baked pose, the bike roles none', () => {
  const { G } = load(); const n = G.BIKE3DMODEL.poseLean.length;
  for (const r of ['rider', 'suit', 'stripe', 'helmet', 'visor', 'trim']) {
    const geo = G.gl3DGeometry(r);
    assert.equal(geo.morphAttributes.position.length, n, r);
    assert.equal(geo.morphAttributes.position[0].count, geo.getAttribute('position').count, r + ': same vertices as the base');
  }
  assert.equal(G.gl3DGeometry('body').morphAttributes.position, undefined, 'the bike has no poses');
});
test('gl3DMaterial: glossy roles take a Phong material with their finish, the others a matte Lambert material', () => {
  const { G } = load();
  const body = G.gl3DMaterial('body', '#c8102e');
  assert.equal(body.type, 'MeshPhongMaterial'); assert.equal(body.shininess, 70); assert.equal(body.color.getHexString(), 'c8102e');
  const screen = G.gl3DMaterial('screen', '#ffffff');
  assert.equal(screen.transparent, true); assert.equal(screen.opacity, 0.85);
  assert.equal(G.gl3DMaterial('dark', '#1b1b1b').type, 'MeshLambertMaterial');
  assert.equal(G.gl3DMaterial('rider', '#d9b08c').type, 'MeshLambertMaterial', 'skin is matte');
});
test('gl3DPlaceBike: every mesh of the bike is shown and placed; the tail light lights only while braking', () => {
  const { G, b } = tiltedRider();
  G.GL3D.scene = new G.THREE.Scene();
  b.v = 30; b.ctl.brk = 0; G.gl3DPlaceBike(b);
  const list = G.gl3DMesh(b), light = list.find(m => m.userData.role === 'light');
  assert.ok(list.every(m => m.visible), 'all shown');
  assert.equal(light.material.emissive.getHex(), 0, 'not braking: dark');
  b.ctl.brk = 0.9; G.gl3DPlaceBike(b);
  assert.equal(light.material.emissive.getHex(), 0xff2a1a, 'braking: lit');
  const body = list.find(m => m.userData.role === 'body');
  assert.notDeepEqual([...body.matrix.elements], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 'placed on the road');
});
