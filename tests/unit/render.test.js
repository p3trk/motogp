// Unit tests for src/render.js (GDD 13b): camera tuning, layers, textures, geometry, scenery, camera, projection,
// speed blur and speed effects, and the drawing functions (checked on recording canvases).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, makeCtx, ops, texts, placeAt } = require('./load');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const DEG = Math.PI / 180;
const def = (G, k) => G.CAM_SET.find(d => d.k === k);
// the player riding on the Hangar Straight at a set speed, camera settled
function riding(kmh, cam = 'behind', lo) {
  const g = load(lo); const { G } = g;
  G.UI.opts.cam = cam; G.UI.launch('practice', {});
  const b = G.W.player, hs = G.T.corners.find(c => c.name === 'Hangar Straight');
  placeAt(G, b, hs.s + 100, 0); b.trainHold = false; b.v = kmh / 3.6;
  G.CAM.init = false; G.updateCamera(1 / 60); for (let k = 0; k < 120; k++) G.updateCamera(1 / 60);
  return Object.assign(g, { b });
}
const rec = G => { const c = makeCtx({ width: 1280, height: 800 }); G.ctx = c; return c; };
const all = () => true, none = () => false;

// --- camera tuning (GDD 11a) -----------------------------------------------
test('camGet: TILT value in display units', () => {
  const { G } = load(); assert.equal(G.camGet(def(G, 'a')), 40); assert.equal(G.camGet(def(G, 'bike')), 20); assert.equal(G.camGet(def(G, 'zK')), 0.5);
});
test('camSet: clamps, applies, keeps blur speeds 10 km/h apart, saves on request', () => {
  const { G, env } = load();
  assert.equal(G.camSet(def(G, 'a'), 99, false), 70); near(G.TILT.a, 70 * DEG, 1e-12); assert.equal(env.ls.getItem('sgp_cam'), null);
  assert.equal(G.camSet(def(G, 'a'), 'x', true), 40, 'not a number: the default'); assert.equal(JSON.parse(env.ls.getItem('sgp_cam')).a, 40);
  G.camSet(def(G, 'bv0'), 330, false); assert.equal(G.TILT.bv1, 340);
  G.camSet(def(G, 'bv1'), 200, false); assert.equal(G.TILT.bv0, 190);
});
test('camSave: the values of one camera in its own key', () => {
  const { G, env } = load(); G.CAM_VAL.close.zMax = 22; G.camSave('close');
  assert.equal(JSON.parse(env.ls.getItem('sgp_cam_close')).zMax, 22); assert.equal(env.ls.getItem('sgp_cam'), null);
});
test('camLoad: TILT takes the values of the chosen camera', () => {
  const { G } = load(); G.camLoad('close');
  assert.equal(G.TILT_CAM, 'close'); near(G.TILT.a, 55 * DEG, 1e-12); assert.equal(G.TILT.hk, 6);
  G.camLoad('behind'); near(G.TILT.a, 40 * DEG, 1e-12); assert.equal(G.TILT.hk, 2.9);
});
test('camReset: defaults for the camera in use only', () => {
  const { G, env } = load(); G.camLoad('close'); G.camSet(def(G, 'zMax'), 12, true); G.camLoad('behind'); G.camSet(def(G, 'zMax'), 11, true);
  G.camReset(); assert.equal(G.CAM_VAL.behind.zMax, 20); assert.equal(G.CAM_VAL.close.zMax, 12); assert.equal(JSON.parse(env.ls.getItem('sgp_cam')).zMax, 20);
});
test('camera storage on load: saved values kept, old defaults moved, the 1.13 Close profile dropped', () => {
  const a = load({ storage: { sgp_cam: { zMax: 25, zK: 1, hk: 2.6 }, sgp_cam_close: { zK: 0.4, a: 60 } } }).G;
  assert.equal(a.CAM_VAL.behind.zMax, 25); assert.equal(a.CAM_VAL.behind.zK, 0.5); assert.equal(a.CAM_VAL.behind.hk, 2.9);
  assert.equal(a.CAM_VAL.close.zK, 0.3); assert.equal(a.CAM_VAL.close.a, 60);
  const old = { profile: 'close', a: 55, p: 1.8, bike: 8, zMax: 30, zBase: 12, zK: 0.4, wk: 3.5, hk: 6, nearQ: 1.5, farQ: 0.7, fade: 30, minLen: 40 };
  const b = load({ storage: { sgp_cam: old } }); assert.equal(b.G.CAM_VAL.behind.a, 40, 'Behind starts from its defaults');
  assert.equal(JSON.parse(b.env.ls.getItem('sgp_cam')).profile, undefined, 'profile field no longer written');
});

// --- layers, textures, geometry, scenery ------------------------------------
test('tiltP: camera distance, shorter when the view widens at speed', () => {
  const { G } = load(); G.CAM.w = 0; assert.equal(G.tiltP(), G.TILT.p * G.VH);
  G.CAM.w = 1; near(G.tiltP(), G.TILT.p * G.VH * (1 - G.TILT.wd), 1e-9);
});
test('tiltA: the tilt is lowered with the distance, so the horizon stays put', () => {
  const { G } = load(); G.CAM.w = 0; assert.equal(G.tiltA(), G.TILT.a);
  G.CAM.w = 1; const a = G.tiltA(); assert.ok(a < G.TILT.a);
  near(G.tiltP() / Math.tan(a), G.TILT.p * G.VH / Math.tan(G.TILT.a), 1e-6, 'horizon at P cot(a)');
});
test('tiltBikeH: the bike row on the ground canvas, below the horizon', () => {
  const { G } = load(); G.CAM.w = 0; const h = G.tiltBikeH();
  assert.ok(h > G.TILT.bike * G.VH && h < G.RH);
  const P = G.tiltP(), a = G.tiltA(); near(h * Math.cos(a) * P / (P + h * Math.sin(a)), G.TILT.bike * G.VH, 1e-6, 'projects to the bike height');
});
test('resize: one layer top-down, near and far bands tilted', () => {
  const { G, env } = load({ width: 1000, height: 600, dpr: 2 });
  G.setCamMode('chase'); assert.equal(G.LAYERS.length, 1); assert.equal(G.RW, 1000); assert.equal(G.cv.width, 1500, 'DPR capped at 1.5');
  G.setCamMode('behind'); assert.equal(G.LAYERS.length, 2); assert.equal(G.RW, Math.round(1000 * G.TILT.wk)); assert.equal(G.RH, Math.round(600 * G.TILT.hk));
  assert.equal(G.LAYERS[1].h, 600); assert.ok(G.LAYERS[0].hB > 0); assert.equal(G.hcv.width, 1500);
  env.win.innerWidth = 800; G.resize(); assert.equal(G.VW, 800);
});
test('mkCanvas: a canvas of the given size', () => {
  const { G } = load(); const c = G.mkCanvas(12, 34); assert.equal(c.tagName, 'CANVAS'); assert.equal(c.width, 12); assert.equal(c.height, 34);
});
test('noiseTex: a noise texture, with extra drawing', () => {
  const { G } = load(); let ex = 0; const c = G.noiseTex(8, [10, 20, 30], 0, 1, () => ex++);
  const put = ops(c.getContext('2d'), 'putImageData')[0]; assert.ok(put); assert.equal(ex, 1);
  assert.deepEqual(Array.from(put[1].data.slice(0, 4)), [10, 20, 30, 255]);
});
test('buildTextures: textures and patterns for every surface', () => {
  const { G } = load();
  for (const k of ['pAsph', 'pGrass', 'pGravel', 'pRun', 'pPit', 'pCrowd', 'pRoof', 'pConc', 'shadow']) assert.ok(G.TEX[k], k);
  assert.equal(G.TEX.trees.length, 5); assert.equal(G.TEX.pAsph.m.k, 9 / 256, 'asphalt pattern repeats every 9 m');
});
test('buildGeometry: track, kerbs, run-off, pit lane, boxes, posts', () => {
  const { G } = load(); const GEO = G.GEO, T = G.T;
  assert.equal(GEO.track.ops.filter(o => o[0] === 'closePath').length, 2, 'both edges');
  assert.equal(GEO.boxes.length, 22); assert.equal(GEO.gravel.length, 2); assert.equal(GEO.runoff.length, 4);
  assert.ok(GEO.kerbR.ops.length > 100 && GEO.pit.ops.length > 50 && GEO.grid.ops.length > 22);
  assert.ok(GEO.posts.length > 10); for (const p of GEO.posts) { const o = {}; T.project(p.x, p.y, -1, o); assert.equal(T.surface(o.i, o.s, o.d), G.SURF.GRASS); }
});
test('trackClear: false near the track, true out in the fields', () => {
  const { G } = load(); const T = G.T;
  assert.equal(G.trackClear(T.X[300], T.Y[300], 4), false); assert.equal(G.trackClear(T.bbox.maxx + 500, T.bbox.maxy + 500, 4), true);
});
test('inPitCompound: the paddock behind the pit lane', () => {
  const { G } = load(); const T = G.T, P = T.PIT, [x, y] = T.pt(T.idx((P.flatIn + P.flatOut) / 2), P.garage + 40);
  assert.equal(G.inPitCompound(x, y), true); assert.equal(G.inPitCompound(...T.pt(T.idx(T.L / 2), 50)), false);
});
test('buildScenery: grandstands, paddock buildings and trees off the track', () => {
  const { G } = load(); const S = G.SCN;
  assert.ok(S.stands.length >= 8); assert.equal(S.buildings.length, 56); assert.ok(S.trees.length > 300); assert.ok(S.wing.garage.length > 10);
  for (const t of S.trees.slice(0, 200)) assert.ok(G.trackClear(t.x, t.y, t.r), 'tree off the track');
});
test('shade: darker and lighter tints of a colour', () => {
  const { G } = load(); assert.equal(G.shade('#808080', -0.5), 'rgb(64,64,64)'); assert.equal(G.shade('#808080', 0.5), 'rgb(191,191,191)'); assert.equal(G.shade('#ff0000', 0), 'rgb(255,0,0)');
});
test('bikeSprite: chassis and rider sprites per team, number and camera drawing, cached', () => {
  const { G } = load(); const s = G.bikeSprite(3, 77);
  assert.equal(s.c.width, G.SPW); assert.equal(s.r.height, G.SPH); assert.equal(G.bikeSprite(3, 77), s); assert.notEqual(G.bikeSprite(4, 77), s);
  assert.ok(texts(s.c.getContext('2d')).includes('77'), 'tail number');
  const b = G.bikeSprite(3, 77, 'behind'), c = G.bikeSprite(3, 77, 'close');
  assert.equal(G.bikeSprite(3, 77, 'top'), s, 'top is the default'); assert.notEqual(b, s); assert.notEqual(c, b); assert.equal(G.bikeSprite(3, 77, 'close'), c);
  assert.ok(texts(c.c.getContext('2d')).includes('77'), 'tail number in the rear view too');
});
test('spriteRect: a rounded rectangle path', () => {
  const { G } = load(); const c = makeCtx({}); G.spriteRect(c, 1, 2, 3, 4, 0.5);
  assert.deepEqual(c.calls.map(o => o.slice(0, 1)[0]), ['beginPath', 'roundRect']); assert.deepEqual(ops(c, 'roundRect')[0].slice(1), [1, 2, 3, 4, 0.5]);
});
test('acrossGrad: dark at both sides of the bike, light in the middle', () => {
  const { G } = load(); const c = makeCtx({}); const gr = G.acrossGrad(c, 0.3, '#000', '#fff');
  assert.deepEqual(ops(c, 'createLinearGradient')[0].slice(1), [0, -0.3, 0, 0.3]); assert.deepEqual(gr.stops, [[0, '#000'], [0.5, '#fff'], [1, '#000']]);
});
test('drawRefBike: the reference picture in the team colours, background left out', () => {
  const { G } = load(); const c = makeCtx({}); G.drawRefBike(c, G.TEAMS[0]);
  const fills = ops(c, 'fillRect'); assert.ok(fills.length > 300, 'many runs'); assert.ok(c.calls.some(o => o[0] === '=fillStyle' && o[1] === G.TEAMS[0].c1), 'red in team colour');
  assert.ok(!c.calls.some(o => o[0] === '=fillStyle' && o[1] === '.'), 'no background colour');
});
test('drawArtParts: each polygon in its colour, red and white in the team colours', () => {
  const { G } = load(); const c = makeCtx({}); G.drawArtParts(c, G.TEAMS[2], [['r', [0, 0, 10, 0, 10, 10]], ['w', [0, 0, 5, 5, 5, 0]], ['k', [1, 1, 2, 2, 3, 3]], ['r', [2, 2, 3, 2, 3, 3]]]);
  assert.equal(ops(c, 'fill').length, 3, 'one fill per colour'); assert.deepEqual(ops(c, 'fill').map(o => o[1]), ['evenodd', 'evenodd', 'evenodd']); assert.equal(ops(c, 'closePath').length, 4);
  assert.ok(c.calls.some(o => o[0] === '=fillStyle' && o[1] === G.TEAMS[2].c1), 'red'); assert.ok(c.calls.some(o => o[0] === '=fillStyle' && o[1] === G.TEAMS[2].c2), 'white');
  assert.ok(ops(c, 'lineTo').some(o => Math.abs(o[1] - 0.1) < 1e-9 && Math.abs(o[2]) < 1e-9), 'coordinates in sprite units');
});
test('approachFrame: moves towards the target at 110 frames a second, both ways, and stops there', () => {
  const { G } = load();
  near(G.approachFrame(0, 32, 0.1), 11, 1e-9, 'up, 0.1 s'); near(G.approachFrame(32, 0, 0.1), 21, 1e-9, 'down, 0.1 s');
  assert.equal(G.approachFrame(30, 32, 1), 32, 'no overshoot'); assert.equal(G.approachFrame(5, 5, 0.1), 5, 'at the target');
});
test('drawArtParts: the dark base is drawn first, under the colours', () => {
  const { G } = load(); const c = makeCtx({}); G.drawArtParts(c, G.TEAMS[0], [['r', [0, 0, 1, 0, 1, 1]], ['b', [0, 0, 2, 0, 2, 2]]]);
  const fills = c.calls.filter(o => o[0] === '=fillStyle').map(o => o[1]);
  assert.equal(fills[0], '#202428', 'base first'); assert.equal(fills[1], G.TEAMS[0].c1, 'red after');
});
test('artSprite: one picture per team and key, cached, the parts drawn in team colours', () => {
  const { G } = load(); const a = G.artSprite(0, 'bike', G.BIKE_ART.bike);
  assert.equal(G.artSprite(0, 'bike', G.BIKE_ART.bike), a, 'cached'); assert.notEqual(G.artSprite(0, 'rider5', G.BIKE_ART.rider[5]), a, 'another key'); assert.notEqual(G.artSprite(1, 'bike', G.BIKE_ART.bike), a, 'another team');
  assert.equal(a.r, null); assert.equal(a.c.width, G.SPW);
});
test('riderFrameIndex: upright at rest, under braking and under throttle; corner at 40 deg, limit at 60 deg', () => {
  const { G } = load(); const d = Math.PI / 180, at = (lean, brk, thr, v = 30) => G.riderFrameIndex({ lean, v, ctl: { brk, thr } });
  assert.equal(at(0, 0, 0), 32); assert.equal(at(0, 0, 1), 32, 'throttle keeps the upright picture'); assert.equal(at(0, 0.5, 1), 32, 'braking');
  assert.equal(at(40 * d, 0, 0), 64); assert.equal(at(-40 * d, 0, 0), 64); assert.equal(at(60 * d, 0, 0), 96);
  assert.ok(Math.abs(at(20 * d, 0, 0) - 48) < 1e-9, 'half way from upright to corner');
});
test('riderOffsetPx: upright on the centre line, 50 px at 10 deg, 70 px from 45 deg, the same to either side', () => {
  const { G } = load(); const d = Math.PI / 180;
  assert.equal(G.riderOffsetPx(0), 0); near(G.riderOffsetPx(5 * d), 25, 1e-9, 'half way'); near(G.riderOffsetPx(10 * d), 50, 1e-9);
  near(G.riderOffsetPx(27.5 * d), 60, 1e-9, 'between 10 and 45'); near(G.riderOffsetPx(45 * d), 70, 1e-9); assert.equal(G.riderOffsetPx(60 * d), 70, 'held through the corner');
  assert.equal(G.riderOffsetPx(-20 * d), G.riderOffsetPx(20 * d), 'the same to either side');
});
test('drawRiderBands: three bands, the boots (rear) move least, the upper body moves as one block and tilts with the lean', () => {
  const { G } = load(); const c = makeCtx({}); G.ctx = c; const sp = G.artSprite(0, 'rider32', G.BIKE_ART.rider[32]).c;
  G.drawRiderBands(sp, 2.5, 2.5, 60, 0.6);
  assert.equal(ops(c, 'drawImage').length, 3, 'one draw per band'); assert.equal(ops(c, 'clip').length, 3, 'each band clipped');
  assert.ok(ops(c, 'rotate').some(o => o[1] < 0), 'upper bands tilt against the lean');
  const ys = ops(c, 'translate').map(o => o[2]).filter(v => v > 0); assert.ok(Math.max(...ys) > Math.min(...ys), 'the boots move less than the upper body');
});
test('rigSegWeight, rigWeight: thighs go from 0.4 at the hip to 0.1 at the knee, shins from 0.1 to 0, boots stay on the pegs', () => {
  const { G } = load(); const a = [0, 0], b = [10, 0];
  near(G.rigSegWeight(0, 0, a, b, 0.4, 0.1), 0.4, 1e-12); near(G.rigSegWeight(10, 0, a, b, 0.4, 0.1), 0.1, 1e-12); near(G.rigSegWeight(5, 3, a, b, 0.4, 0.1), 0.25, 1e-12, 'half way, off the line');
  assert.equal(G.rigWeight('boot_L', 0, 0), 0); assert.equal(G.rigWeight('torso', 0, 0), 0.4); assert.equal(G.rigWeight('glove_R', 0, 0), 0, 'gloves stay on the bars');
  const sh = G.RIG_JOINTS.shoulder_R, wr = G.RIG_JOINTS.wrist_R;
  near(G.rigWeight('upper_arm_R', sh[0], sh[1]), 0.5, 1e-12, 'upper arm moves at the shoulder'); near(G.rigWeight('forearm_R', wr[0], wr[1]), 0, 1e-12, 'forearm stays at the wrist');
});
test('drawRigRider: each part in its class colour, moved across the bike by its weight at the lean', () => {
  const { G } = load(); const c = makeCtx({}); G.drawRigRider(c, G.TEAMS[1], 0);
  assert.equal(ops(c, 'closePath').length, Object.keys(G.RIG_ART).length, 'one outline per part');
  assert.ok(c.calls.some(o => o[0] === '=fillStyle' && o[1] === G.TEAMS[1].c1), 'team colour');
  const d = makeCtx({}); G.drawRigRider(d, G.TEAMS[1], 40);
  assert.notDeepEqual(ops(d, 'moveTo')[0], ops(c, 'moveTo')[0], 'moves at a lean');
  const e = makeCtx({}), f = makeCtx({}); G.drawRigRider(e, G.TEAMS[1], 40); G.drawRigRider(f, G.TEAMS[1], -40);
  assert.deepEqual(ops(e, 'moveTo'), ops(f, 'moveTo'), 'the same shift to either side: the bike flip sets the direction');
});
test('drawArtBike: the bike and the pose for the lean, mirrored for a left bend, the race number on the tail', () => {
  const { G, b } = riding(100); G.BIKE_STYLE = G.BIKE_STYLES.findIndex(st => st && st.name === 'Traced');
  b.lean = 0.5; let c = rec(G); G.drawBike(b, all);
  const bike = G.artSprite(b.team, 'bike', G.BIKE_ART.bike), i0 = Math.floor(G.riderFrameIndex(b)), frame = G.artSprite(b.team, 'rider' + i0, G.BIKE_ART.rider[i0]);
  const imgs = ops(c, 'drawImage').map(o => o[1]);
  assert.ok(imgs.includes(bike.c) && imgs.includes(frame.c), 'bike and the rider frame for the lean');
  assert.ok(c.calls.some(o => o[0] === 'scale' && o[2] > 0), 'right bend: no mirror');
  c = rec(G); b.lean = -0.5; G.drawBike(b, all); assert.ok(c.calls.some(o => o[0] === 'scale' && o[2] < 0), 'left bend: mirrored');
  assert.ok(texts(c).includes(String(b.num)), 'race number'); G.BIKE_STYLE = 0;
});
test('artStyle: the style in use when it has art, else none', () => {
  const { G } = load(); G.BIKE_STYLE = 0; assert.equal(G.artStyle(), null); G.BIKE_STYLE = G.BIKE_STYLES.findIndex(st => st && st.name === 'Traced'); assert.ok(G.artStyle().art); G.BIKE_STYLE = 0;
});
test('styleTyre: a tyre, with a rim in the spoked styles only', () => {
  const { G } = load(); const plain = makeCtx({}); G.styleTyre(plain, -1, -0.4, 0.1, { spokes: false });
  assert.equal(ops(plain, 'ellipse').length, 0, 'no rim'); assert.equal(ops(plain, 'roundRect').length, 1, 'tyre');
  const rim = makeCtx({}); G.styleTyre(rim, -1, -0.4, 0.1, { spokes: true }); assert.equal(ops(rim, 'ellipse').length, 1, 'rim');
});
test('styleExhaust: a silver can with a dark end cap', () => {
  const { G } = load(); const c = makeCtx({}); G.styleExhaust(c, { exh: 0.04 }, -0.95, 0.13);
  assert.equal(ops(c, 'roundRect').length, 1); assert.equal(ops(c, 'ellipse').length, 1); assert.ok(c.calls.some(o => o[0] === '=fillStyle' && o[1] === '#16181a'), 'dark cap');
});
test('styleLivery: no stripe, one, two pinstriped, three bands', () => {
  const { G } = load(); const n = st => { const c = makeCtx({}); G.styleLivery(c, G.TEAMS[0], st, [-1, 2]); return ops(c, 'fillRect').length; };
  assert.equal(n({ stripes: 0 }), 0); assert.equal(n({ stripes: 1 }), 1); assert.equal(n({ stripes: 2 }), 3); assert.equal(n({ stripes: 3 }), 3);
});
test('styleMirrors: a stalk and a mirror head on each side', () => {
  const { G } = load(); const c = makeCtx({}); G.styleMirrors(c, 0.3, -0.36);
  assert.equal(ops(c, 'moveTo').length, 1); assert.equal(ops(c, 'ellipse').length, 1); assert.deepEqual(ops(c, 'moveTo')[0].slice(1), [0.3, -0.1]);
});
test('drawTopStyled: the fairing, mirrors and tail lights of a style, carbon in dark colours', () => {
  const { G } = load(); const st = G.BIKE_STYLES[1]; const c = makeCtx({}); G.drawTopStyled(c, G.TEAMS[0], 25, st);
  assert.ok(ops(c, 'fill').length > 8, 'fairing and parts'); assert.deepEqual(texts(c), ['25']);
  const k = makeCtx({}); G.drawTopStyled(k, G.TEAMS[0], 25, G.BIKE_STYLES[4]); assert.ok(k.calls.some(o => o[0] === '=fillStyle' && o[1] === '#17191b'), 'carbon fairing');
  const m = makeCtx({}); G.drawTopStyled(m, G.TEAMS[0], 25, G.BIKE_STYLES[3]); assert.ok(ops(m, 'ellipse').length > 4, 'mirrors');
});
test('drawRearStyled: the rear view of a style, with the number on the tail', () => {
  const { G } = load(); const c = makeCtx({}); G.drawRearStyled(c, G.TEAMS[0], 7, 1, G.BIKE_STYLES[2]);
  assert.ok(ops(c, 'roundRect').length >= 2, 'tyres'); assert.deepEqual(texts(c), ['7']);
  const d = makeCtx({}); G.drawRearStyled(d, G.TEAMS[0], 7, 0.5, G.BIKE_STYLES[4]); assert.ok(d.calls.some(o => o[0] === '=fillStyle' && o[1] === '#2a0606'), 'carbon tail');
});
test('drawChassisTop, tailNumber: frame without tyres (drawn each frame), fairing in team colours, the number on the tail', () => {
  const { G } = load(); const c = makeCtx({}); G.drawChassisTop(c, G.TEAMS[2], 25);
  assert.equal(ops(c, 'roundRect').length, 2, 'frame and seat only: the tyres are drawn by drawTyresTop (GDD 11j)'); assert.ok(c.calls.some(o => o[0] === '=fillStyle' && o[1] === G.TEAMS[2].c2), 'stripe');
  assert.deepEqual(texts(c), ['25']); const t = makeCtx({}); G.tailNumber(t, 9, -0.7); assert.deepEqual(ops(t, 'translate')[0].slice(1), [-0.7, 0]); assert.deepEqual(texts(t), ['9']);
});
test('steerAngle: zero on a straight, sign follows the heading rate, a degree or two at 300 km/h, capped at 25 degrees', () => {
  const { G } = load();
  assert.equal(G.steerAngle(0, 50), 0); assert.ok(G.steerAngle(0.5, 50) > 0 && G.steerAngle(-0.5, 50) < 0, 'steers into the turn');
  near(G.steerAngle(0.2, 83), Math.atan(1.45 * 0.2 / 83), 1e-12, 'the wheelbase times the rate over the speed');
  assert.ok(Math.abs(G.steerAngle(0.2, 83)) < 2 * DEG, 'small at speed'); near(G.steerAngle(10, 1), 25 * DEG, 1e-12, 'capped at 25 degrees');
});
test('suspensionTargets: fork on braking, squat on throttle above 0.7 and not while braking, none at rest', () => {
  const { G } = load();
  assert.deepEqual(G.suspensionTargets(0, 0), { fork: 0, squat: 0 });
  near(G.suspensionTargets(1, 0).fork, 0.08, 1e-12, 'fork at full brake'); near(G.suspensionTargets(2, 0).fork, 0.08, 1e-12, 'brake clamped to 1');
  near(G.suspensionTargets(0, 1).squat, 0.06, 1e-12, 'squat at full throttle'); near(G.suspensionTargets(1, 1).squat, 0, 1e-12, 'no squat while braking');
  near(G.suspensionTargets(0, 0.7).squat, 0, 1e-12, 'no squat below 0.7'); assert.ok(G.suspensionTargets(0, 0.85).squat > 0 && G.suspensionTargets(0, 0.85).squat < 0.06, 'squat grows past 0.7');
});
test('smoothToward: moves towards the target without overshoot, reaches it after long times', () => {
  const { G } = load();
  near(G.smoothToward(0, 1, 0.1, 0.1), 1 - Math.exp(-1), 1e-12, 'one time constant, 63 %'); assert.ok(G.smoothToward(0, 1, 5, 0.1) <= 1, 'no overshoot');
  near(G.smoothToward(0, 1, 100, 0.1), 1, 1e-9, 'settles'); near(G.smoothToward(2, 2, 0.5, 0.1), 2, 1e-12, 'holds at the target');
});
test('updateBikeMotion: first call sets the state, later calls follow the heading rate and the controls, a jump is no turn', () => {
  const { G, b } = riding(100); delete b.motT;
  b.h = 0; G.updateBikeMotion(b, 1000); assert.deepEqual([b.steer, b.fork, b.squat], [0, 0, 0], 'first call: at rest');
  b.h = 0.02; b.v = 50; b.ctl.brk = 1; b.ctl.thr = 0; G.updateBikeMotion(b, 1100);
  assert.ok(b.steer > 0 && b.steer < G.steerAngle(0.2, 50), 'steers towards the rate, not past it'); assert.ok(b.fork > 0 && b.fork < 0.08, 'fork moves on the brake'); assert.equal(b.squat, 0);
  const before = [b.steer, b.fork]; G.updateBikeMotion(b, 1100); assert.deepEqual([b.steer, b.fork], before, 'no time passed, no change');
  b.h += 3; b.ctl.brk = 0; G.updateBikeMotion(b, 1200); assert.ok(Math.abs(b.steer) < Math.abs(before[0]), 'a jump of the heading is not a turn: steering eases off');
});
test('tyreTop: a rounded tyre with a tread line down the middle', () => {
  const { G } = load(); const c = makeCtx({}); G.tyreTop(c, 0.6, 0.1);
  assert.equal(ops(c, 'roundRect').length, 1); assert.equal(ops(c, 'fillRect').length, 1, 'the tread');
});
test('drawTyresTop: two tyres each frame, the front turned by the steer and moved by the fork, the rear moved by the squat', () => {
  const { G } = load(); const c = makeCtx({}); G.drawTyresTop(c, 0.1, 0.05, 0.03);
  assert.equal(ops(c, 'roundRect').length, 2, 'two tyres'); assert.deepEqual(ops(c, 'translate').map(o => o.slice(1)), [[-0.71 + 0.03, 0], [0.73 - 0.05, 0]]);
  assert.deepEqual(ops(c, 'rotate').map(o => o[1]), [0.1], 'only the front wheel turns');
});
test('topTyresLive: the top view of the default, reference and art drawings, not the styled presets', () => {
  const { G } = load(); G.BIKE_STYLE = 0; assert.equal(G.topTyresLive('top'), true); assert.equal(G.topTyresLive('behind'), false);
  G.BIKE_STYLE = G.BIKE_STYLES.findIndex(st => st && st.name === 'Race'); assert.equal(G.topTyresLive('top'), false, 'the preset keeps its tyres');
  G.BIKE_STYLE = G.BIKE_STYLES.findIndex(st => st && st.name === 'Reference'); assert.equal(G.topTyresLive('top'), true); G.BIKE_STYLE = 0;
});
test('drawRiderTop, drawHelmet: legs, arms, back and helmet with visor from above, none from behind', () => {
  const { G } = load(); const c = makeCtx({}); G.drawRiderTop(c, G.TEAMS[0]);
  assert.equal(ops(c, 'stroke').length, 6, 'two thighs, two shins, two arms'); assert.equal(ops(c, 'closePath').length, 1, 'visor');
  assert.deepEqual(ops(c, 'translate')[0].slice(1), [0.2, 0], 'the rider moved forward');
  assert.deepEqual(ops(c, 'arc').at(-1).slice(1, 4), [0.26, 0, 0.145], 'helmet at rest, in the rider frame');
  const r = makeCtx({}); G.drawHelmet(r, G.TEAMS[0], 0.3, 0.1, 0.17, 0); assert.equal(ops(r, 'closePath').length, 0, 'no visor from behind'); assert.deepEqual(ops(r, 'arc')[0].slice(1, 4), [0.3, 0.1, 0.17]);
});
test('riderPose: hang-off grows from hips to shoulders to helmet, braking sits up, full throttle tucks in', () => {
  const { G } = load(); const pose = (lean, brk, thr) => G.riderPose({ lean, ctl: { brk, thr } });
  assert.deepEqual(pose(0, 0, 0), { ...G.RIDER_REST, q: 1, sg: 0 });
  const p = pose(0.8, 0, 0), sl = Math.sin(0.8);
  near(p.hip, 0.12 * sl, 1e-12); near(p.sh, 0.3 * sl, 1e-12); near(p.hel, 0.4 * sl, 1e-12); near(p.base, 0.16 * sl, 1e-12); near(p.hf, 0.05 * sl, 1e-12); assert.equal(p.sg, 1);
  assert.equal(pose(-0.8, 0, 0).sg, -1); near(pose(-0.8, 0, 0).hel, -p.hel, 1e-12);
  assert.equal(pose(0.3, 0, 0).knee, 0, 'knee in up to 0.3 rad'); near(pose(0.55, 0, 0).knee, 0.095, 1e-12); near(pose(-0.9, 0, 0).knee, 0.19, 1e-12, 'fully out from 0.8 rad');
  near(pose(0, 1, 0).fwd, -0.08, 1e-12); near(pose(0, 0, 1).fwd, 0.06, 1e-12); near(pose(0, 0, 0.7).fwd, 0, 1e-12); near(pose(0, 1, 1).fwd, -0.08, 1e-12, 'braking wins');
});
test('riderBend, riderAt: hips and shoulders move by their shifts, the shoulders forward by fwd', () => {
  const { G } = load(); const p = { ...G.RIDER_REST, base: 0.05, hip: 0.1, sh: 0.3, fwd: 0.06 };
  const at = (x, y) => G.riderAt(p, -0.4, 0.15, x, y);
  near(at(-0.4, 0)[0], -0.4, 1e-12); near(at(-0.4, 0)[1], 0.15, 1e-12, 'hips: base + hip');
  near(at(0.15, 0)[0], 0.21, 1e-12); near(at(0.15, 0)[1], 0.35, 1e-12, 'shoulders: base + shoulder shift');
  const c = makeCtx({}); G.riderBend(c, p, -0.4, 0.15); assert.equal(ops(c, 'transform').length, 1); const [, a, b, , d, e, f] = ops(c, 'transform')[0];
  near(a * 0.15 + e, at(0.15, 0)[0], 1e-12); near(b * 0.15 + d * 0 + f, at(0.15, 0)[1], 1e-12, 'the same as riderAt');
});
test('drawArm: from the shoulder to the grip, the elbow pushed out, a glove on the grip', () => {
  const { G } = load(); const c = makeCtx({}); G.drawArm(c, G.TEAMS[0], [0, 0.2], [0.4, 0.3], 0.08);
  assert.deepEqual(ops(c, 'moveTo')[0].slice(1), [0, 0.2]); const q = ops(c, 'quadraticCurveTo')[0]; near(q[2], 0.25 + 0.04 + 0.08, 1e-12); assert.deepEqual(q.slice(3), [0.4, 0.3]);
  assert.deepEqual(ops(c, 'arc')[0].slice(1, 3), [0.4, 0.3]);
});
test('drawLeg: thigh and shin meet at the knee, the inside knee goes out with the slider on it', () => {
  const { G } = load(); const leg = (p, sg) => { const c = makeCtx({}); G.drawLeg(c, G.TEAMS[0], p, sg, [-0.4, 0.15], [-0.1, 0.28], [-0.3, 0.29], 0.12); return c; };
  const p = G.riderPose({ lean: 0.9, ctl: { brk: 0, thr: 0 } });
  let c = leg(p, 1); const [shin, thigh] = [ops(c, 'moveTo')[0], ops(c, 'lineTo')[1]];
  assert.deepEqual(shin.slice(1), thigh.slice(1), 'one piece: the shin starts where the thigh ends'); near(thigh[2], 0.28 + p.knee, 1e-12, 'knee out');
  assert.ok(c.calls.some(o => o[0] === '=fillStyle' && o[1] === '#e8e8e8'), 'slider'); const [cap, sl] = ops(c, 'arc'); assert.deepEqual(cap.slice(1, 3), thigh.slice(1), 'knee cap on the knee'); near(sl[2] - cap[2], 0.036, 1e-12, 'slider on the cap');
  c = leg(p, -1); near(ops(c, 'lineTo')[1][2], 0.28, 1e-12, 'outside knee stays'); assert.equal(ops(c, 'arc').length, 0, 'no slider outside');
  c = leg(G.RIDER_REST, 1); assert.equal(ops(c, 'arc').length, 0, 'no slider upright');
});
test('drawChassisRear: more rear tyre and less fairing the lower the camera, tail light, number', () => {
  const { G } = load(); const tyre = k => { const c = makeCtx({}); G.drawChassisRear(c, G.TEAMS[0], 7, k); return [ops(c, 'roundRect')[0], c]; };
  const [b] = tyre(0.5), [cl, c] = tyre(1);
  assert.ok(cl[3] > b[3], 'longer rear tyre in CLOSE'); assert.ok(cl[4] > b[4], 'wider rear tyre in CLOSE');
  assert.ok(c.calls.some(o => o[0] === '=fillStyle' && o[1] === '#5a0c0c'), 'tail light'); assert.deepEqual(texts(c), ['7']);
});
test('drawRiderRear: boots on the pegs, back bent to the inside, helmet further inside, bigger in CLOSE', () => {
  const { G } = load(); const draw = (k, p) => { const c = makeCtx({}); G.drawRiderRear(c, G.TEAMS[0], k, p); return c; };
  const hb = ops(draw(0.5), 'arc').at(-1), c = draw(1), hc = ops(c, 'arc').at(-1);
  assert.ok(hc[1] > hb[1], 'further forward'); assert.ok(hc[3] > hb[3], 'bigger'); assert.equal(ops(c, 'stroke').length, 6, 'two thighs, two shins, two arms');
  const p = G.riderPose({ lean: 0.8, ctl: { brk: 0, thr: 0 } }), l = draw(1, p);
  near(ops(l, 'arc').at(-1)[2], p.base + p.hel, 1e-12, 'helmet inside'); assert.ok(ops(l, 'transform').length === 1, 'the back bent');
  assert.deepEqual(ops(draw(0.5), 'translate')[0].slice(1), [0.2, 0], 'the rider moved forward');
  const boots = cc => ops(cc, 'roundRect').map(o => o[2]); near(boots(l)[0] - boots(c)[0], p.base + 0.29 * (1 - p.q), 1e-12, 'boots stay on the pegs of the leaning bike');
});
test('bikeView: the drawing for the camera in use', () => {
  const { G } = load(); for (const [m, v] of [['chase', 'top'], ['behind', 'behind'], ['close', 'close']]) { G.CAM.mode = m; assert.equal(G.bikeView(), v); }
});
test('bikeStretch: none in Top-down, 1 / (cos(tilt) x row scale) in Behind and CLOSE, more further up, at most 2.5', () => {
  const { G, b } = riding(0, 'chase'); assert.equal(G.bikeStretch(b.x, b.y), 1);
  const row = (x, y) => { const P = G.tiltP(), yy = G.worldToCanvas(x, y)[1] - G.RH; return P / (P - yy * Math.sin(G.tiltA())); };
  for (const cam of ['behind', 'close']) {
    G.setCamMode(cam); G.CAM.w = 0; G.CAM.init = false; G.updateCamera(1 / 60);
    near(G.bikeStretch(b.x, b.y), 1 / (Math.cos(G.tiltA()) * row(b.x, b.y)), 1e-9, cam);
    const [ax, ay] = [b.x + Math.cos(b.h) * 60, b.y + Math.sin(b.h) * 60]; assert.ok(G.bikeStretch(ax, ay) > G.bikeStretch(b.x, b.y), cam + ': more for a bike further ahead');
    assert.equal(G.bikeStretch(b.x + Math.cos(b.h) * 5000, b.y + Math.sin(b.h) * 5000), 2.5, cam + ': capped');
  }
  G.setCamMode('close'); const s0 = G.bikeStretch(b.x, b.y); G.CAM.w = 1; assert.ok(G.bikeStretch(b.x, b.y) < s0, 'lower tilt at speed');
});
test('stretchAt: nothing in Top-down, a stretch along the camera direction around the point in the tilted cameras', () => {
  const { G } = load(); G.setCamMode('chase'); let c = rec(G); G.stretchAt(5, 6); assert.equal(c.calls.length, 0);
  G.setCamMode('close'); G.CAM.w = 0; G.CAM.rot = 0.4; G.CAM.x = 5; G.CAM.y = 6; c = rec(G); G.stretchAt(5, 6);
  assert.deepEqual(c.calls.map(o => o[0]), ['translate', 'rotate', 'scale', 'rotate', 'translate']);
  assert.deepEqual(ops(c, 'rotate').map(o => o[1]), [-0.4, 0.4]); near(ops(c, 'scale')[0][2], G.bikeStretch(5, 6), 1e-12); assert.ok(ops(c, 'scale')[0][2] > 1.7); assert.deepEqual(ops(c, 'translate')[1].slice(1), [-5, -6]);
});

// --- camera and projection --------------------------------------------------
test('camTilted: every camera but Top-down', () => {
  const { G } = load(); G.CAM.mode = 'close'; assert.equal(G.camTilted(), true); G.CAM.mode = 'chase'; assert.equal(G.camTilted(), false);
});
test('setCamMode: switches camera, its tuning and the layers', () => {
  const { G } = load(); G.setCamMode('close');
  assert.equal(G.CAM.mode, 'close'); assert.equal(G.TILT_CAM, 'close'); assert.equal(G.CAM.init, false); assert.equal(G.RH, Math.round(G.VH * 6));
  G.setCamMode('chase'); assert.equal(G.TILT_CAM, 'close', 'Top-down keeps the last tilted values'); G.setCamMode('nonsense'); assert.equal(G.CAM.mode, 'chase');
});
test('updateCamera: follows the bike, zooms out with speed, widens above 200 km/h', () => {
  const slow = riding(100), fast = riding(340);
  near(fast.G.CAM.x, fast.b.x, 1e-9); assert.ok(fast.G.CAM.ppm < slow.G.CAM.ppm);
  assert.equal(slow.G.CAM.w, 0); assert.ok(fast.G.CAM.w > 0.95);
  const off = riding(340); off.G.UI.opts.fx = 'off';
  for (let k = 0; k < 200; k++) off.G.updateCamera(1 / 60);
  assert.ok(off.G.CAM.w < 0.01);
  const top = riding(200, 'chase'); assert.ok(Math.hypot(top.G.CAM.x - top.b.x, top.G.CAM.y - top.b.y) > 10, 'Top-down looks ahead');
  const { G } = riding(200); G.W.player.v = 0; G.updateCamera(0.1); assert.ok(G.CAM.dec > 5, 'deceleration tracked');
});
test('worldToCanvas, canvasToWorld: inverse transforms around the camera', () => {
  const { G } = riding(150); const C = G.CAM;
  assert.deepEqual(G.worldToCanvas(C.x, C.y), [G.RW * C.ax, G.RH * C.ay]);
  const [wx, wy] = G.canvasToWorld(...G.worldToCanvas(C.x + 13, C.y - 7)); near(wx, C.x + 13, 1e-9); near(wy, C.y - 7, 1e-9);
});
test('worldToScreen: the perspective of the tilted view; plain in Top-down', () => {
  const { G, b } = riding(150); const T = G.T;
  const [sx, sy] = G.worldToScreen(b.x, b.y); near(sx, G.VW / 2, 1); near(G.VH - sy, G.TILT.bike * G.VH, 1, 'bike at its height on screen');
  const ahead = T.pt((b.i + 25) % T.N, 0); assert.ok(G.worldToScreen(...ahead)[1] < sy, 'further ahead is higher');
  G.setCamMode('chase'); G.updateCamera(0.01); assert.deepEqual(G.worldToScreen(b.x, b.y), G.worldToCanvas(b.x, b.y));
});

// --- tiles and the world ----------------------------------------------------
test('drawStatic: grass, track, kerbs, lines, walls, posts within view', () => {
  const { G } = load(); const c = rec(G);
  G.drawStatic(all, 0, 0, 40, 40);
  assert.ok(ops(c, 'fill').some(o => o[1] === G.GEO.track && o[2] === 'evenodd'));
  assert.ok(ops(c, 'stroke').some(o => o[1] === G.GEO.walls)); assert.equal(ops(c, 'fillRect')[0][3], 40);
  const posts = ops(c, 'translate').length; const d = rec(G); G.drawStatic(none, 0, 0, 40, 40);
  assert.ok(ops(d, 'translate').length < posts, 'posts out of view are skipped');
});
test('renderTile: a 512 px tile of the static world, ctx restored', () => {
  const { G } = load(); const L = G.TLV[0]; const c = G.renderTile(L, 3, -2);
  assert.equal(c.width, 512); const g = c.getContext('2d');
  assert.deepEqual(ops(g, 'scale')[0].slice(1), [512 / 40, 512 / 40]); assert.deepEqual(ops(g, 'translate')[0].slice(1), [-120, 80]);
  assert.equal(G.ctx, G.mainCtx);
});
test('getTile: rendered on demand, cached, least recently used dropped', () => {
  const { G } = load(); const L = { m: 40, map: new Map(), cap: 3 };
  assert.equal(G.getTile(L, 0, 0, false), null);
  const a = G.getTile(L, 0, 0, true); assert.equal(G.getTile(L, 0, 0, false), a);
  G.tileFrame = 10; G.getTile(L, 1, 0, true); G.getTile(L, 2, 0, true); G.tileFrame = 11; G.getTile(L, 0, 0, false); G.getTile(L, 3, 0, true);
  assert.equal(L.map.size, 3); assert.equal(G.getTile(L, 1, 0, false), null, 'oldest gone'); assert.equal(G.getTile(L, 0, 0, false), a);
});
test('drawWorld: every layer drawn, then projected and blurred when tilted', () => {
  const { G } = riding(150); const f = G.tileFrame, m = G.mainCtx; m.calls.length = 0;
  for (const Ly of G.LAYERS) Ly.g.calls.length = 0;
  G.drawWorld();
  assert.equal(G.tileFrame, f + 1); assert.ok(G.LAYERS.every(Ly => ops(Ly.g, 'drawImage').length > 0));
  assert.ok(ops(m, 'drawImage').length > 100, 'projected row by row'); assert.equal(G.ctx, m);
});
test('drawWorldLayer: tiles, bikes, ghosts faded, speed guide in practice', () => {
  const { G, b } = riding(150); const Ly = G.LAYERS[1], c = rec(G); G.W.guide = true;
  G.drawWorldLayer(Ly, 0, 0);
  const spr = G.bikeSprite(b.team, b.num, 'behind'); assert.ok(ops(c, 'drawImage').some(o => o[1] === spr.c), 'the player bike, Behind drawing');
  assert.ok(ops(c, 'stroke').length > 100, 'speed guide segments');
  assert.ok(c.calls.some(o => o[0] === '=globalAlpha' && Math.abs(o[1] - 0.42) < 1e-12), 'ghost alpha');
});
test('drawTrackPaint: start line, pit markings, braking boards, Long Lap and corner names', () => {
  const { G } = load(); const c = rec(G); G.drawTrackPaint(all);
  const t = texts(c); for (const s of ['PIT 60', 'END', '300', '50', 'LONG LAP', 'STOWE', 'COPSE']) assert.ok(t.includes(s), s);
  assert.ok(!t.includes('HANGAR STRAIGHT'), 'no names on the straights');
  const d = rec(G); G.drawTrackPaint(none); assert.equal(texts(d).length, 0); assert.ok(ops(d, 'fill').length >= 28, 'the start line is always drawn');
});
test('llPath: both edges of the Long Lap lane', () => {
  const { G } = load(); const p = G.llPath(); assert.equal(p.ops.filter(o => o[0] === 'moveTo').length, 2);
  const n = Math.floor((G.T.LL.sB + 0.01 - G.T.LL.sA) / 2) + 1; assert.equal(p.ops.length, 2 * n);
});
test('groundText: painted text along the track direction', () => {
  const { G } = load(); const c = rec(G); G.groundText('HELLO', 5, 6, 0, 4, '#fff');
  assert.deepEqual(c.calls.filter(o => !o[0].startsWith('=')).map(o => o[0]), ['save', 'translate', 'rotate', 'scale', 'fillText', 'restore']);
  assert.deepEqual(ops(c, 'scale')[0].slice(1), [0.1, 0.1]);
});
test('drawPitBoxes: box lines on the tiles, live team colours and numbers', () => {
  const { G } = load(); G.setupSession('sprint', G.UI.sessionOpts({ train: null }));
  const s = rec(G); G.drawPitBoxes(all, true); assert.equal(ops(s, 'stroke').length, 44); assert.equal(texts(s).length, 0);
  const l = rec(G); G.drawPitBoxes(all, false); assert.equal(texts(l).filter(x => x.startsWith('#')).length, 22);
  const n = rec(G); G.drawPitBoxes(none, false); assert.equal(n.calls.length, 0);
});
test('polyFill: a closed path through the points', () => {
  const { G } = load(); const c = rec(G); G.polyFill([[0, 0], [1, 0], [1, 1]]);
  assert.deepEqual(c.calls.map(o => o[0]), ['beginPath', 'moveTo', 'lineTo', 'lineTo', 'closePath']);
});
test('drawBuildings: the Wing, paddock and grandstands, only on the tiles', () => {
  const { G } = load(); const c = rec(G); G.drawBuildings(all, true);
  assert.ok(texts(c).includes('SILVERSTONE')); assert.ok(ops(c, 'fillRect').length > 56 * 4);
  const d = rec(G); G.drawBuildings(all, false); assert.equal(d.calls.length, 0);
});
test('drawTrees: shadow and crown for each tree in view', () => {
  const { G } = load(); const c = rec(G); G.SCN.trees = G.SCN.trees.slice(0, 3); G.drawTrees(all);
  assert.equal(ops(c, 'drawImage').length, 6); const d = rec(G); G.drawTrees(none); assert.equal(d.calls.length, 0);
});
test('drawBikeShadow: one shadow with tyre contact patches, two after a crash, none when retired', () => {
  const { G, b } = riding(100); const sh = G.TEX.shadow, n = c => ops(c, 'drawImage').filter(o => o[1] === sh).length;
  let c = rec(G); G.drawBikeShadow(b, all); assert.equal(n(c), 1); assert.equal(ops(c, 'ellipse').length, 2, 'tyre contact patches');
  G.crashBike(b, G.W, 'lowside'); c = rec(G); G.drawBikeShadow(b, all); assert.equal(n(c), 2);
  b.crashed = false; b.dnf = true; c = rec(G); G.drawBikeShadow(b, all); assert.equal(n(c), 0);
});
test('drawBike: the drawing of the camera in use, stretched, brake light, the rider posed live, knee out, crashed bike and rider apart', () => {
  const { G, b } = riding(100); const spr = G.bikeSprite(b.team, b.num, 'behind');
  let c = rec(G); b.ctl.brk = 1; G.drawBike(b, all);
  assert.deepEqual(ops(c, 'drawImage').map(o => o[1]), [spr.c], 'the chassis image, the rider drawn live'); assert.ok(ops(c, 'arc').length >= 3, 'brake light, gloves, helmet');
  near(ops(c, 'scale')[0][2], G.bikeStretch(b.x, b.y), 1e-9, 'stretched first'); b.ctl.brk = 0;
  const helmet = cc => ops(cc, 'arc').at(-1);
  b.lean = 0.8; c = rec(G); G.drawBike(b, all); const p = G.riderPose(b);
  near(helmet(c)[2], p.base + p.hel, 1e-12, 'helmet to the inside'); assert.ok(c.calls.some(o => o[0] === '=fillStyle' && o[1] === '#e8e8e8'), 'knee slider out');
  b.lean = 0; c = rec(G); G.drawBike(b, all); assert.ok(!c.calls.some(o => o[0] === '=fillStyle' && o[1] === '#e8e8e8'), 'no knee upright');
  G.setCamMode('chase'); c = rec(G); G.drawBike(b, all); assert.equal(ops(c, 'drawImage')[0][1], G.bikeSprite(b.team, b.num, 'top').c, 'top view, no stretch'); G.setCamMode('behind');
  G.crashBike(b, G.W, 'lowside'); c = rec(G); G.drawBike(b, all); assert.equal(ops(c, 'drawImage').length, 2);
  c = rec(G); G.drawBike(b, none); assert.equal(c.calls.length, 0);
});
test('drawParticles: sparks, smoke, dust and grass', () => {
  const { G } = load(); G.FX.clear();
  for (const t of ['spark', 'smoke', 'dust', 'grass']) G.FX.add({ t, x: 0, y: 0, vx: 1, vy: 1, age: 0, life: 1, r: 0.5, a: 0.3 });
  const c = rec(G); G.drawParticles(all);
  assert.equal(ops(c, 'stroke').length, 1); assert.equal(ops(c, 'arc').length, 2); assert.equal(ops(c, 'fillRect').length, 1);
});

// --- speed blur and speed effects (GDD 11f, 11h) ----------------------------
test('blurStrength: none below the start speed, full above the full speed', () => {
  const { G } = riding(340); G.CAM.v = 340 / 3.6; assert.equal(G.blurStrength(), 1);
  G.CAM.v = 250 / 3.6; assert.equal(G.blurStrength(), 0); G.CAM.v = 295 / 3.6; assert.ok(G.blurStrength() > 0.3 && G.blurStrength() < 0.7);
  G.CAM.v = 340 / 3.6; G.UI.opts.blur = 'off'; assert.equal(G.blurStrength(), 0); G.UI.opts.blur = 'on';
  G.TILT.q = 0.8; assert.equal(G.blurStrength(), 0, 'slow machine'); G.TILT.q = 1;
  G.setCamMode('chase'); assert.equal(G.blurStrength(), 0);
});
test('speedBlur: a quarter-size zoom blur over the screen at top speed', () => {
  const { G } = riding(340); const m = G.mainCtx; m.calls.length = 0;
  G.speedBlur(); assert.equal(G.BLUR.a.width, Math.ceil(G.VW / 4)); assert.ok(ops(m, 'drawImage').some(o => o[1] === G.BLUR.b));
  assert.ok(G.BLUR.gb.calls.some(o => o[0] === '=globalCompositeOperation' && o[1] === 'destination-out'), 'road cut out');
  const s = riding(200); s.G.mainCtx.calls.length = 0; s.G.speedBlur(); assert.equal(ops(s.G.mainCtx, 'drawImage').length, 0);
});
test('blurRoadRuns: the road on screen as closed polygons', () => {
  const { G } = riding(340); const runs = G.blurRoadRuns();
  assert.ok(runs.length >= 1); assert.ok(runs.every(r => r.length % 2 === 0 && r.length >= 8));
  const [bx, by] = G.worldToScreen(G.W.player.x, G.W.player.y);
  assert.ok(runs.some(r => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let k = 0; k < r.length; k += 2) { x0 = Math.min(x0, r[k]); x1 = Math.max(x1, r[k]); y0 = Math.min(y0, r[k + 1]); y1 = Math.max(y1, r[k + 1]); } return bx > x0 && bx < x1 && by > y0 && by < y1; }), 'covers the bike position');
});
test('blurBikeSpots: an ellipse around each bike, two for a crash', () => {
  const { G, b } = riding(340); assert.equal(G.blurBikeSpots().length, 1);
  const [x, y] = G.blurBikeSpots()[0], [sx, sy] = G.worldToScreen(b.x, b.y); near(x, sx, 2); near(y, sy, 30);
  G.crashBike(b, G.W, 'lowside'); assert.equal(G.blurBikeSpots().length, 2);
});
test('fxLive: only while the session or the replay runs, with Speed effects On', () => {
  const { G } = riding(100); assert.equal(G.fxLive(), true);
  G.W.paused = true; assert.equal(G.fxLive(), false); G.W.paused = false;
  G.UI.opts.fx = 'off'; assert.equal(G.fxLive(), false); G.UI.opts.fx = 'on';
  G.UI.state = 'replay'; G.RP.playing = false; assert.equal(G.fxLive(), false); G.RP.playing = true; assert.equal(G.fxLive(), true);
  G.UI.state = 'menu'; assert.equal(G.fxLive(), false);
});
test('speedVib: none at rest, grows with speed, more on kerbs, at most 2 x vib', () => {
  const r = riding(0); assert.equal(r.G.speedVib(), 0);
  const f = riding(340); const a = f.G.speedVib(); assert.ok(a > 0 && a <= 2 * f.G.TILT.vib);
  f.G.W.paused = true; assert.equal(f.G.speedVib(), 0);
  const k = riding(340); const c = k.G.T.corners.find(q => q.name === 'Copse'), side = k.G.T.KERB[0][c.i] > 0 ? 1 : -1;
  placeAt(k.G, k.b, c.i * k.G.T.DS, side * (k.G.T.EDGE[side > 0 ? 0 : 1][c.i] + 0.5)); near(k.G.speedVib(), k.G.TILT.vib * (k.G.sstep((340 - 180) / 165) + 1), 1e-9, 'kerb adds a full vib');
});
test('speedOrigin: the horizon point ahead, or ahead of the bike in Top-down', () => {
  const { G } = riding(300); const [x, y] = G.speedOrigin(); assert.equal(x, G.VW / 2); assert.ok(y >= 0 && y < G.VH / 2);
  G.setCamMode('chase'); assert.deepEqual(G.speedOrigin(), [G.VW / 2, G.VH * 0.25]);
});
test('drawSpeedLines: lines at top speed in the outer screen, none below 280 km/h', () => {
  const { G } = riding(340); const c = rec(G); G.SPL.lines = []; G.SPL.acc = 0;
  for (let k = 0; k < 10; k++) G.drawSpeedLines(1 / 60);
  assert.ok(G.SPL.lines.length > 3); assert.ok(ops(c, 'stroke').length > 10);
  assert.ok(G.SPL.lines.every(q => q.x < 0.3 * G.VW || q.x > 0.7 * G.VW));
  G.CAM.v = 250 / 3.6; G.drawSpeedLines(1 / 60); assert.equal(G.SPL.lines.length, 0);
});
test('projectTilted: sky, haze and one strip per screen row', () => {
  const { G } = riding(150); const m = G.mainCtx; m.calls.length = 0; G.projectTilted();
  assert.ok(ops(m, 'createLinearGradient').length === 1); assert.equal(ops(m, 'fillRect').length, 2);
  const rows = ops(m, 'drawImage'); assert.ok(rows.length > G.VH / 2, 'rows ' + rows.length);
  assert.ok(rows.every(o => o[1] === G.LAYERS[0].c || o[1] === G.LAYERS[1].c));
});

test('gravelStone: four stone colours by a random number', () => {
  const { G } = load();
  assert.equal(G.gravelStone(0.1), '#8f8a80'); assert.equal(G.gravelStone(0.3), '#e3d6b8'); assert.equal(G.gravelStone(0.6), '#a8916a'); assert.equal(G.gravelStone(0.8), '#d8cdb6');
});
