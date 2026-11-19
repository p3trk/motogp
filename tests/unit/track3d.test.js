// Unit tests for src/track3d.js (GDD 11o, phase 1): the ground drawn by the GPU. A ground point must land where
// worldToScreen puts it, the near and far bands must cross-fade as in projectTilted, and the speed blur must run only
// at speed. There is no WebGL here: the renderer is a stand-in that records what is drawn.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, placeAt } = require('./load');

// the player on the Hangar Straight with the CLOSE camera settled (tilted), resized so the ground bands exist
function tilted() {
  const g = load(); const { G } = g;
  G.UI.opts.cam = 'close'; G.UI.launch('practice', {});
  const b = G.W.player, hs = G.T.corners.find(c => c.name === 'Hangar Straight');
  placeAt(G, b, hs.s + 100, 0); b.trainHold = false; b.v = 30;
  G.CAM.init = false; for (let k = 0; k < 60; k++) G.updateCamera(1 / 60);
  return Object.assign(g, { b });
}
// a renderer stand-in: records render calls and render targets
function stubRenderer(G) {
  const log = [];
  const r = { render: (scene) => log.push(['render', scene]), setRenderTarget: t => log.push(['target', t]), clear: () => log.push(['clear']), setClearColor() {} };
  Object.assign(G.GL3D, { ok: true, renderer: r, cam: new G.THREE.Camera() });
  return log;
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
function clipToScreen(M, [u, Y, Z], VW, VH) {
  const row = r => M[r * 4] * u + M[r * 4 + 1] * Y + M[r * 4 + 2] * Z + M[r * 4 + 3];
  const w = row(3); return [(row(0) / w + 1) / 2 * VW, (1 - row(1) / w) / 2 * VH];
}

test('ground3DOn: only with 3D graphics, a tilted camera and WebGL', () => {
  const { G } = tilted();
  assert.equal(G.ground3DOn(), false, 'no WebGL here');
  G.GL3D.ok = true; assert.equal(G.ground3DOn(), true);
  G.UI.opts.gfx = 'classic'; assert.equal(G.ground3DOn(), false, 'Classic keeps the 2D ground'); G.UI.opts.gfx = '3d';
  G.setCamMode('chase'); assert.equal(G.ground3DOn(), false, 'Top-down keeps the 2D ground');
});
test('groundPoint: a ground point lands where worldToScreen puts it, through the 3D camera', () => {
  const { G, b } = tilted();
  const M = G.gl3DProjection(G.tiltP());
  assert.equal(G.groundPoint(G.RW / 2, G.RH)[0], 0, 'bottom centre of the ground is the frame origin');
  for (const [dx, dy] of [[0, 0], [40, 5], [120, -30], [10, 25]]) {
    const x = b.x + dx * Math.cos(b.h) - dy * Math.sin(b.h), y = b.y + dx * Math.sin(b.h) + dy * Math.cos(b.h);
    const [cx, cy] = G.worldToCanvas(x, y), [sx, sy] = G.worldToScreen(x, y);
    const [px, py] = clipToScreen(M, G.groundPoint(cx, cy), G.VW, G.VH);
    near(px, sx, 0.01, 'x'); near(py, sy, 0.01, 'y');
  }
});
test('groundQuad: corners, texture rows and alpha go to the geometry', () => {
  const { G } = tilted();
  G.ground3DInit(); const q = G.GROUND.quads[1];
  G.groundQuad(q, 10, 20, 30, 40, 0.8, 0.2, 1, 0);
  const pos = q.geometry.attributes.position.array, uv = q.geometry.attributes.uv.array, col = q.geometry.attributes.color.array;
  assert.deepEqual([...pos.slice(0, 3)].map(v => +v.toFixed(3)), G.groundPoint(10, 20).map(v => +Math.fround(v).toFixed(3)));
  assert.deepEqual([...uv].map(v => +v.toFixed(3)), [0, 0.8, 1, 0.8, 1, 0.2, 0, 0.2]);
  assert.deepEqual([col[3], col[7], col[11], col[15]], [1, 1, 0, 0], 'opaque at the top, clear at the bottom');
  assert.equal(q.visible, true);
});
test('groundTexture: one texture per canvas, renewed when the canvas changes size', () => {
  const { G } = load();
  const c = G.mkCanvas(64, 32), t = G.groundTexture(c);
  assert.equal(G.groundTexture(c), t, 'kept while the size is the same');
  assert.equal(t.colorSpace, G.THREE.SRGBColorSpace); assert.equal(t.generateMipmaps, false);
  c.width = 128; const t2 = G.groundTexture(c);
  assert.notEqual(t2, t, 'new size: new texture'); assert.equal(t2.userData.w, 128);
});
test('ground3DInit: three ground quads drawn in order, the middle one fading, built once', () => {
  const { G } = load();
  G.ground3DInit(); const qs = G.GROUND.quads, scene = G.GROUND.scene;
  assert.equal(qs.length, 3); assert.deepEqual(qs.map(q => q.renderOrder), [0, 1, 2]);
  assert.deepEqual(qs.map(q => q.material.transparent), [false, true, false]);
  assert.ok(qs.every(q => !q.material.depthWrite), 'the bikes are drawn over the ground');
  G.ground3DInit(); assert.equal(G.GROUND.scene, scene); assert.equal(G.GROUND.quads.length, 3);
});
test('glslType: float, vec2 or sampler2D from the uniform value', () => {
  const { G } = load();
  assert.deepEqual([G.glslType(1), G.glslType([0, 0]), G.glslType(null)], ['float', 'vec2', 'sampler2D']);
});
test('ground3DPass: a full-screen quad with the uniforms declared in its shader', () => {
  const { G } = load();
  const { mesh, scene } = G.ground3DPass({ src: { value: null }, s: { value: 0 }, hz: { value: [0, 0] } }, 'gl_FragColor = vec4(s);', true);
  assert.ok(scene.children.includes(mesh)); assert.equal(mesh.frustumCulled, false); assert.equal(mesh.material.transparent, true);
  const f = mesh.material.fragmentShader;
  assert.ok(f.includes('uniform sampler2D src;') && f.includes('uniform float s;') && f.includes('uniform vec2 hz;'), f);
});
test('ground3DBlurMesh: a zoom pass in 8 steps (into an image) and a show pass laid over the screen', () => {
  const { G } = load();
  const { zoom, show } = G.ground3DBlurMesh();
  assert.deepEqual(Object.keys(zoom.mesh.material.uniforms).sort(), ['hz', 'k', 'mask', 'src']);
  assert.ok(zoom.mesh.material.fragmentShader.includes('i < 8'), '8 steps of zoom'); assert.equal(zoom.mesh.material.transparent, false);
  assert.deepEqual(Object.keys(show.mesh.material.uniforms).sort(), ['s', 'src']); assert.equal(show.mesh.material.transparent, true);
});
test('ground3DTarget: kept while the size is the same, made again when it changes', () => {
  const { G } = load();
  const a = G.ground3DTarget(null, 100, 50); assert.equal(a.width, 100);
  assert.equal(G.ground3DTarget(a, 100, 50), a);
  const b = G.ground3DTarget(a, 120, 50); assert.notEqual(b, a); assert.equal(b.width, 120);
});
test('ground3DPlace: near band at the bottom, far band above, cross-faded where they overlap (as projectTilted)', () => {
  const { G } = tilted();
  G.ground3DInit(); G.ground3DPlace();
  const [qN, qFade, qFar] = G.GROUND.quads, far = G.LAYERS[0], nearL = G.LAYERS[1];
  const yOf = q => { const p = q.geometry.attributes.position.array; return [p[1], p[7]]; }; // plane rows of the top and bottom edges
  const rowOf = cy => G.groundPoint(0, cy)[1];
  near(yOf(qN)[0], rowOf(nearL.y0), 0.01, 'near top'); near(yOf(qN)[1], rowOf(nearL.y0 + nearL.h), 0.01, 'near bottom');
  near(yOf(qFar)[0], rowOf(0), 0.01, 'far top'); near(yOf(qFar)[1], rowOf(G.RH - nearL.h), 0.01, 'far meets the near top');
  near(yOf(qFade)[1], rowOf(G.RH - nearL.h + far.hB), 0.01, 'fade ends hB into the near band');
  assert.equal(qN.material.map.image, nearL.c); assert.equal(qFar.material.map.image, far.c); assert.equal(qFade.material.map, qFar.material.map);
});
test('ground3DMask: the road and the bikes in white on a clear 1/4 canvas, as a texture', () => {
  const { G } = tilted();
  const t = G.ground3DMask(0.25, 256, 200);
  assert.equal(G.GROUND.mask.width, 256); assert.equal(t.image, G.GROUND.mask);
  const calls = G.GROUND.maskCtx.calls.map(c => c[0]);
  assert.ok(calls.includes('clearRect')); assert.ok(calls.includes('fill')); assert.ok(calls.includes('ellipse'), 'bike spots');
  assert.equal(G.ground3DMask(0.25, 256, 200), t, 'same size: same texture');
});
test('ground3DBlur: nothing at low speed; at top speed the ground goes to a 1/2 image, zoomed into a 1/4 one, then shown', () => {
  const { G } = tilted();
  const log = stubRenderer(G); G.ground3DInit(); G.ground3DPlace();
  G.CAM.v = 100 / 3.6; assert.equal(G.ground3DBlur(G.GL3D.renderer), false); assert.equal(log.length, 0);
  G.CAM.v = 330 / 3.6; assert.equal(G.ground3DBlur(G.GL3D.renderer), true);
  assert.equal(G.GROUND.rt.width, 2 * Math.ceil(G.VW * 0.25)); assert.equal(G.GROUND.rtZ.width, Math.ceil(G.VW * 0.25));
  const renders = log.filter(e => e[0] === 'render').map(e => e[1]);
  assert.deepEqual(renders, [G.GROUND.scene, G.GROUND.blur.zoom.scene, G.GROUND.blur.show.scene]);
  assert.deepEqual(log.filter(e => e[0] === 'target').map(e => e[1]), [G.GROUND.rt, G.GROUND.rtZ, null], 'back to the screen');
  const u = G.GROUND.blur.zoom.mesh.material.uniforms; assert.ok(u.k.value > 0); assert.ok(u.hz.value[1] > 0.5, 'horizon in the upper half');
  assert.ok(G.GROUND.blur.show.mesh.material.uniforms.s.value > 0.9);
});
test('ground3DRender: the ground is drawn, then the walls (GDD 11o phase 2), then the blur when fast', () => {
  const { G } = tilted();
  const log = stubRenderer(G); G.CAM.v = 50 / 3.6;
  G.ground3DRender();
  assert.deepEqual(log.map(e => e[1]), [G.GROUND.scene, G.WALLS3D.scene]);
  log.length = 0; G.PERF.noWalls = true; G.ground3DRender();
  assert.deepEqual(log.map(e => e[1]), [G.GROUND.scene], 'test switch 7: no walls');
});
test('drawSky: gradient down to the far edge of the ground, haze below it', () => {
  const { G } = tilted();
  const g = G.mainCtx; g.calls.length = 0;
  G.drawSky(g, 300);
  const rects = g.calls.filter(c => c[0] === 'fillRect');
  assert.equal(rects.length, 2);
  assert.deepEqual(rects[0].slice(1), [0, 0, G.VW, G.VH - 300 + 2]); assert.deepEqual(rects[1].slice(1), [0, G.VH - 300, G.VW, 300]);
});
