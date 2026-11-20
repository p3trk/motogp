// Unit tests for src/chase3d.js (GDD 11o, phase 6): the Chase camera, a low follow shot behind the bike with the
// horizon level, drawing the world in 3D from world-metre ground tiles, the 3D scenery and the bikes at real size.
// There is no WebGL here: the renderer is a stand-in that records what is drawn; three.js itself runs (maths, meshes).
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, placeAt } = require('./load');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const DEG = Math.PI / 180;
// a renderer stand-in: records render calls; WebGL counts as working
function stubRenderer(G) {
  const log = [];
  const r = { render: scene => log.push(['render', scene]), clear: () => log.push(['clear']), setClearColor() { }, setPixelRatio: p => log.push(['ratio', p]), setSize: (w, h) => log.push(['size', w, h]), capabilities: { getMaxAnisotropy: () => 8 }, localClippingEnabled: true };
  Object.assign(G.GL3D, { ok: true, renderer: r, cam: new G.THREE.Camera(), scene: new G.THREE.Scene(), canvas: { style: {} } });
  G.GL3D.lights = G.gl3DAddLights(G.GL3D.scene);
  return log;
}
// practice on the Hangar Straight with the Chase camera, WebGL stubbed, the camera settled
function chase(kmh = 100) {
  const g = load(); const { G } = g;
  const log = stubRenderer(G);
  G.UI.launch('practice', {}); G.setCamMode('low');
  const b = G.W.player, hs = G.T.corners.find(c => c.name === 'Hangar Straight');
  placeAt(G, b, hs.s + 100, 0); b.trainHold = false; b.v = kmh / 3.6; b.lean = 0; b.aLong = 0;
  G.CAM.init = false; G.updateCamera(1 / 60);
  return Object.assign(g, { b, log });
}

test('lowAvail, lowOn: Chase needs 3D graphics, WebGL and a pointer that is not a phone touch', () => {
  const { G, env } = chase();
  assert.equal(G.lowAvail(), true); assert.equal(G.lowOn(), true); assert.equal(G.CAM.mode, 'low');
  G.UI.opts.gfx = 'classic'; assert.equal(G.lowAvail(), false, 'Classic graphics'); assert.equal(G.lowOn(), false); G.UI.opts.gfx = '3d';
  env.mq['(pointer: coarse)'].matches = true; assert.equal(G.lowAvail(), false, 'phone');
  env.mq['(pointer: coarse)'].matches = false; G.GL3D.ok = false; assert.equal(G.lowAvail(), false, 'no WebGL');
  G.GL3D.ok = true; G.setCamMode('close'); assert.equal(G.lowOn(), false, 'another camera');
});
test('setCamMode: Chase falls back to Behind where it cannot be used; it is not a tilted camera', () => {
  const { G } = load(); G.setCamMode('close'); G.setCamMode('low'); assert.equal(G.CAM.mode, 'behind', 'no WebGL here');
  stubRenderer(G); G.setCamMode('low'); assert.equal(G.CAM.mode, 'low'); assert.equal(G.camTilted(), false);
  assert.deepEqual(G.CAM_ORDER, ['behind', 'close', 'low', 'chase']); assert.equal(G.CAM_NAME.low, 'Chase');
});
test('camTuned: Behind, CLOSE and Chase have a tuning panel, Top-down not', () => {
  const { G } = load(); stubRenderer(G);
  for (const [m, on] of [['behind', true], ['close', true], ['low', true], ['chase', false]]) { G.setCamMode(m); assert.equal(G.camTuned(), on, m); }
});
test('lowSet: clamped, kept and saved in the browser', () => {
  const { G, env } = load();
  const d = G.LOW_SET.find(k => k.k === 'dist');
  assert.equal(G.lowSet(d, 99, true), 8); assert.equal(G.LOW_VAL.dist, 8); assert.equal(JSON.parse(env.ls.getItem('sgp_cam_low')).dist, 8);
  assert.equal(G.lowSet(d, 'x', false), G.LOW_DEF.dist, 'not a number: the default');
});
test('lowReset: back to the defaults, saved', () => {
  const { G, env } = load(); G.lowSet(G.LOW_SET[0], 7, true); G.lowReset();
  assert.deepEqual({ ...G.LOW_VAL }, { ...G.LOW_DEF }); assert.equal(JSON.parse(env.ls.getItem('sgp_cam_low')).dist, G.LOW_DEF.dist);
  assert.deepEqual({ ...G.LOW_DEF }, { dist: 4.5, height: 1.6, down: 6, fov: 60, lag: 0.25, wd: 100 }, 'Petr: as recommended');
});
test('lowMap: the game\'s y turned round, height up', () => {
  const { G } = load(); assert.deepEqual(G.lowMap(3, 4, 5), [3, -4, 5]);
});
test('lowFollow: the heading eases towards the bike\'s over the lag; a new start or a jump snaps it', () => {
  const { G, b } = chase(); const h0 = b.h;
  assert.equal(G.LOW.yawL, h0, 'snapped at the start');
  b.h = h0 + 0.5; const y = G.lowFollow(b, 1 / 60);
  near(y - h0, 0.5 * (1 - Math.exp(-1 / 60 / 0.25)), 1e-9, 'one frame of the 0.25 s lag');
  G.LOW_VAL.lag = 0; near(G.lowFollow(b, 1 / 60), b.h, 1e-12, 'no lag'); G.LOW_VAL.lag = 0.25;
  b.h = h0; b.x += 50; near(G.lowFollow(b, 1 / 60), h0, 1e-12, 'a jump of 50 m: snapped');
});
test('lowEye: 4.5 m behind and 1.6 m up, 6 degrees down; back and wider at speed; watching a crash', () => {
  const { G, b } = chase(); G.CAM.w = 0;
  const e = G.lowEye(b), p = G.lowMap(b.x, b.y, 0);
  near(Math.hypot(e.eye[0] - p[0], e.eye[1] - p[1]), 4.5, 1e-9); near(e.eye[2], 1.6, 1e-9);
  const fw = G.lowMap(Math.cos(b.h), Math.sin(b.h), 0); assert.ok((p[0] - e.eye[0]) * fw[0] + (p[1] - e.eye[1]) * fw[1] > 4.4, 'behind the bike');
  near(Math.asin(-e.dir[2] / Math.hypot(...e.dir)), 6 * DEG, 1e-9); assert.equal(e.fov, 60);
  G.CAM.w = 1; const f = G.lowEye(b); near(Math.hypot(f.eye[0] - p[0], f.eye[1] - p[1]), 5.5, 1e-9); assert.equal(f.fov, 70);
  G.LOW_VAL.wd = 0; assert.equal(G.lowEye(b).fov, 60, 'Widen at speed 0'); G.LOW_VAL.wd = 100;
  b.aLong = -12; assert.ok(-G.lowEye(b).dir[2] > -f.dir[2], 'braking dips the view');
  G.LOW.eye = [1, 2, 3]; b.crashed = true; b.crash = { rd: { x: 11, y: -22 } };
  const c = G.lowEye(b); assert.deepEqual(c.eye, [1, 2, 3]); assert.deepEqual(c.dir, [10, 20, -2.5], 'looks at the rider');
});
test('lowCamera: placed at the eye with the horizon level, also at 40 degrees of lean; the horizon above the middle', () => {
  const { G, b } = chase();
  for (const lean of [0, 40 * DEG, -40 * DEG]) {
    b.lean = lean; const cam = G.lowCamera(b, 0, 0), e = G.LOW.eye;
    near(cam.position.x, e[0], 1e-9); near(cam.position.z, 1.6, 1e-9);
    const c = Math.cos(G.LOW.yaw), s = Math.sin(G.LOW.yaw), far = 3000;
    const L = G.lowProjectPt(e[0] + far * c - 400 * s, e[1] - far * s - 400 * c, e[2]), R = G.lowProjectPt(e[0] + far * c + 400 * s, e[1] - far * s + 400 * c, e[2]);
    near(L[1], R[1], 1e-6, 'level horizon'); assert.ok(Math.abs(L[0] - R[0]) > 100, 'far apart across the screen');
  }
  assert.ok(G.LOW.hz[1] < G.VH / 2 && G.LOW.hz[1] > G.VH * 0.3, `horizon at ${G.LOW.hz[1]} of ${G.VH}`); near(G.LOW.hz[0], G.VW / 2, 1);
});
test('lowProjectPt: points ahead on screen, behind the camera none', () => {
  const { G, b } = chase(); G.lowCamera(b, 0, 0); const e = G.LOW.eye, c = Math.cos(G.LOW.yaw), s = Math.sin(G.LOW.yaw);
  assert.equal(G.lowProjectPt(e[0] - 10 * c, e[1] + 10 * s, e[2]), null);
  const p = G.lowProjectPt(e[0] + 4000 * c, e[1] - 4000 * s, e[2]); near(p[1], G.LOW.hz[1], 0.5);
});
test('lowProject: the bike\'s foot in the lower middle of the screen; behind the camera far off screen', () => {
  const { G, b } = chase(); G.lowCamera(b, 0, 0);
  const [x, y] = G.lowProject(b.x, b.y); near(x, G.VW / 2, 2); assert.ok(y > G.VH * 0.6 && y < G.VH, `${y}`);
  assert.deepEqual(G.lowProject(b.x - Math.cos(b.h) * 30, b.y - Math.sin(b.h) * 30), [-1e4, -1e4]);
  assert.deepEqual(G.worldToScreen(b.x, b.y), [x, y], 'worldToScreen in Chase');
});
test('lowLevels: 20, 40, 80 and 160 m; the fine level cleared when the flat walls come and go', () => {
  const { G } = load(); assert.deepEqual(G.lowLevels().map(L => L.m), [20, 40, 80, 160]);
  G.LOW.near.map.set(1, {}); G.TILE_WALLS.on3d = !G.TILE_WALLS.on3d; G.lowLevels(); assert.equal(G.LOW.near.map.size, 0);
});
test('lowTiles: fine tiles near the eye, coarse far away, all within the range and ahead', () => {
  const { G, b } = chase(); G.lowCamera(b, 0, 0); const ex = G.LOW.eye[0], ey = -G.LOW.eye[1];
  const T = G.lowTiles(ex, ey, G.LOW.yaw, 60), LV = G.lowLevels();
  assert.ok(T.some(q => q.k === 0) && T.some(q => q.k === 3), 'levels 20 m and 160 m');
  for (const q of T) {
    assert.ok(q.near <= G.LOW_FIX.range);
    if (q.k === 0) assert.ok(q.near < G.LOW_FIX.split[0] + 40, 'inside a 40 m tile nearer than 60 m');
    const M = LV[q.k].m, cx = q.tx * M + M / 2 - ex, cy = q.ty * M + M / 2 - ey, d = Math.hypot(cx, cy);
    if (d > M) assert.ok(Math.abs(G.angWrap(Math.atan2(cy, cx) - G.LOW.yaw)) < Math.PI / 2 + 0.1 + Math.asin(Math.min(1, M * Math.SQRT1_2 / d)), 'not behind');
  }
});
test('lowTileImage: its own tile when the budget allows, else part of a coarser one, else nothing', () => {
  const { G } = chase(); const LV = G.lowLevels();
  assert.equal(G.lowTileImage(0, 10, 10, { n: 0 }), null);
  G.getTile(LV[1], 5, 5, true);
  const im = G.lowTileImage(0, 11, 10, { n: 0 }); assert.deepEqual([im.u0, im.u1, im.v0, im.v1], [0.5, 1, 0.5, 1]);
  const bu = { n: 1 }, own = G.lowTileImage(0, 11, 10, bu); assert.equal(bu.n, 0); assert.deepEqual([own.u0, own.u1], [0, 1]);
});
test('lowTexture: one texture per tile canvas, with mipmaps', () => {
  const { G } = chase(); G.lowInit(); const c = G.mkCanvas(8, 8), t = G.lowTexture(c);
  assert.equal(G.lowTexture(c), t); assert.equal(t.minFilter, G.THREE.LinearMipmapLinearFilter); assert.equal(t.anisotropy, 8);
});
test('lowTexPrune: the textures unused longest go once there are too many', () => {
  const { G } = chase(); G.lowInit();
  const cs = []; for (let k = 0; k < G.LOW_FIX.texCap + 5; k++) { G.tileFrame = k; cs.push(G.mkCanvas(2, 2)); G.LOW.tex.set(cs[k], Object.assign(new G.THREE.CanvasTexture(cs[k]), { userData: { used: k } })); }
  assert.equal(G.lowTexPrune(), 5); assert.equal(G.LOW.tex.size, G.LOW_FIX.texCap); assert.ok(!G.LOW.tex.has(cs[0]) && G.LOW.tex.has(cs.at(-1)));
});
test('lowQuad: the tile pool grows as needed and keeps its meshes', () => {
  const { G } = chase(); G.lowInit(); const m = G.lowQuad(3, null);
  assert.equal(G.LOW.pool.length, 4); assert.equal(G.lowQuad(3, null), m); assert.ok(G.LOW.scene.children.includes(m));
});
test('lowShadowTexture: a soft round patch, drawn once', () => {
  const { G } = load(); const t = G.lowShadowTexture(); assert.equal(G.lowShadowTexture(), t);
  assert.ok(t.image.getContext('2d').calls.some(k => k[0] === 'createRadialGradient'));
});
test('lowShadows: one patch under each bike, along its heading; spare ones hidden', () => {
  const { G } = chase(); G.lowInit(); const bk = [10, 20, 30].map(x => ({ x, y: x / 2, h: x / 40 }));
  assert.equal(G.lowShadows(bk), 3); const m = G.LOW.shadows[1];
  near(m.position.x, bk[1].x, 1e-9); near(m.position.y, -bk[1].y, 1e-9); near(m.rotation.z, -bk[1].h, 1e-9); assert.deepEqual([m.scale.x, m.scale.y], [2.2, 0.9]);
  G.lowShadows(bk.slice(0, 1)); assert.equal(G.LOW.shadows[2].visible, false);
});
test('lowInit: the ground scene with grass under everything and the haze, built once', () => {
  const { G } = chase(); G.lowInit(); const sc = G.LOW.scene;
  assert.ok(sc.fog); near(sc.fog.far, G.LOW_FIX.range, 1e-9); assert.ok(sc.children.includes(G.LOW.base)); G.lowInit(); assert.equal(G.LOW.scene, sc);
});
test('lowGround: tiles laid nearest first around the eye, the grass plane under them', () => {
  const { G, b } = chase(); G.lowInit(); G.lowCamera(b, 0, 0);
  const n = G.lowGround(G.LOW.eye[0], -G.LOW.eye[1], 60);
  assert.ok(n > 10, `${n} tiles`); assert.equal(G.LOW.pool.filter(m => m.visible).length, n);
  near(G.LOW.base.position.x, G.LOW.eye[0], 1e-9); assert.equal(G.LOW.base.scale.x, 2 * G.LOW_FIX.range);
});
test('lowSky: blue to the haze down to the horizon, haze below it', () => {
  const { G, b } = chase(); G.lowCamera(b, 0, 0); const g = G.mainCtx; g.calls.length = 0;
  G.lowSky(g); const r = g.calls.filter(k => k[0] === 'fillRect');
  assert.equal(r.length, 2); near(r[0][4], G.LOW.hz[1] + 1, 1e-9); near(r[1][2], G.LOW.hz[1], 1e-9);
  assert.equal(g.calls.find(k => k[0] === 'createLinearGradient')[4], G.LOW.hz[1]);
});
test('lowLights, lowLightsBack: the scenery lit by the world sun, the bikes by their own light turned with the camera', () => {
  const { G, b } = chase(); G.walls3DInit(); const cam = G.lowCamera(b, 0, 0), L = G.GL3D.lights, keep = L.sun.position.clone();
  G.lowLights(cam);
  const s = G.WALLS3D.lights.sun.position; near(s.x, Math.cos(G.SUN.az) * Math.cos(G.SUN.el), 1e-9); near(s.y, -Math.sin(G.SUN.az) * Math.cos(G.SUN.el), 1e-9);
  const e = cam.matrixWorld.elements, p = L.sun.position;
  near(p.x * e[0] + p.y * e[1] + p.z * e[2], keep.x, 1e-6, 'right'); near(p.x * e[4] + p.y * e[5] + p.z * e[6], -keep.y, 1e-6, 'up the screen'); near(p.x * e[8] + p.y * e[9] + p.z * e[10], keep.z, 1e-6, 'towards the viewer');
  assert.equal(G.lowLightsBack(), true); assert.deepEqual(L.sun.position.toArray(), keep.toArray());
});
test('lowNear: a piece within the range of the eye', () => {
  const { G } = load(); const R = G.LOW_FIX.range;
  assert.equal(G.lowNear([0, 0, 10, 10], 5, 5), true); assert.equal(G.lowNear([0, 0, 10, 10], 10 + R + 1, 5), false);
});
test('lowPlace: pieces and cells near the eye placed at real height, the others hidden', () => {
  const { G, b } = chase(); G.walls3DInit(); const n = G.lowPlace(b.x, b.y);
  const shown = G.WALLS3D.pieces.filter(p => p.meshes[0].visible).length + G.EST.cells.filter(c => c.meshes[0] && c.meshes[0].visible).length;
  assert.ok(n > 0 && n < G.WALLS3D.pieces.length + G.EST.cells.length); assert.equal(n, shown);
  const c = G.EST.cells.find(q => q.meshes[0].visible); near(c.meshes[0].matrixWorld.elements[10], 1 / G.WALL_HS, 1e-12);
});
test('lowScenery: the walls scene in world metres at real height, haze from the eye, no clipping, sides put back', () => {
  const { G, b, log } = chase(); G.lowInit(); G.lowCamera(b, 0, 0);
  const n = G.lowScenery(G.GL3D.renderer, G.LOW.eye[0], -G.LOW.eye[1]);
  assert.ok(n > 0); assert.equal(log.at(-1)[1], G.WALLS3D.scene); assert.equal(G.GL3D.renderer.localClippingEnabled, false);
  assert.equal(G.WALLS3D.fogU.fogCa.value, 0); assert.equal(G.WALLS3D.fogU.fogSa.value, 1);
  assert.notEqual(G.WALLS3D.mats.post.side, G.THREE.DoubleSide, 'side put back');
  const p = G.WALLS3D.pieces.find(q => q.meshes[0].visible), e = p.meshes[0].matrixWorld.elements;
  near(e[10], 1 / G.WALL_HS, 1e-12, 'real height'); near(e[12], p.ox, 1e-9); near(e[13], -p.oy, 1e-9);
  G.PERF.noWalls = true; assert.equal(G.lowScenery(G.GL3D.renderer, 0, 0), 0, 'test switch 7');
});
test('lowDraw: sky, then the ground, the scenery and the bikes on the 3D layer; the bike lights put back', () => {
  const { G, b, log } = chase(); log.length = 0;
  assert.equal(G.lowDraw([b]), true);
  const scenes = log.filter(k => k[0] === 'render').map(k => k[1]);
  assert.deepEqual(scenes, [G.LOW.scene, G.WALLS3D.scene, G.GL3D.scene]); assert.ok(G.LOW.tiles > 0);
  assert.equal(G.GL3D.scene.fog, null); assert.ok(G.mainCtx.calls.some(k => k[0] === 'createLinearGradient'), 'the sky');
  const m = G.GL3D.meshes.get(b)[0].matrixWorld.elements; near(m[12], b.x, 0.7); near(m[13], -b.y, 0.7);
});
test('drawWorld: Chase draws its 3D view and no tilted ground layers', () => {
  const { G, log } = chase(); log.length = 0; G.drawWorld();
  assert.ok(log.some(k => k[0] === 'render' && k[1] === G.LOW.scene)); assert.equal(G.GL3D.shown, true);
});
test('UI.camRows: the tilted camera\'s sliders or Chase\'s; Chase\'s set its values', () => {
  const { G, env } = chase(); const $ = id => env.doc.getElementById(id); G.W.paused = true;
  G.UI.camIn(true); assert.equal($('camTitle').textContent, 'Camera tuning (Chase)');
  assert.equal(G.UI.camRows(true).length, G.LOW_SET.length); assert.equal(G.UI.camRows(false).length, G.CAM_SET.length);
  const rg = $('camlow_height'); rg.value = '2.2'; rg.fire('input'); assert.equal(G.LOW_VAL.height, 2.2);
  $('pauseCam').querySelectorAll('button').at(-1).click(); assert.equal(G.LOW_VAL.height, 1.6, 'Reset to defaults');
  G.setCamMode('close'); G.UI.camIn(true); assert.equal($('camTitle').textContent, 'Camera tuning (CLOSE)'); assert.equal($('camlow_height'), null);
});
