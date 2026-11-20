// --- the Chase camera (GDD 11o, phase 6): a low follow shot, about 4.5 m behind the bike and 1.6 m up, looking 6
// degrees down along a lagged heading, with the horizon level, like the low follow shots on TV. The world is drawn in
// 3D in world metres from a real perspective camera: the cached ground tiles (GDD 13) as textured squares, the 3D walls,
// trackside objects and estate (GDD 11o phases 2 to 4) and the bikes with their riders at real size. The ground pieces
// come from the Onboard branch (GDD 11p, not used; Petr 2026-11-20: "feel free to use the code"). Frame: X = game x,
// Y = -game y, Z = up: right-handed, so the three.js perspective camera draws the world the right way round (the game's
// y runs down the top-down screen). Inside the code the camera is 'low': 'chase' is the Top-down camera's id.
const LOW = { ready: false, scene: null, cam: null, fog: null, base: null, pool: [], tex: new Map(), shadows: [], shadowTex: null, eye: null, yaw: 0, yawL: null, at: null, hz: [0, 0], tiles: 0, aniso: 1, near: { m: 20, map: new Map(), cap: 64 }, on3d: null, keep: null };
// fixed settings: range: the ground drawn up to this distance (m), fading into the haze from 40 % of it; split: tiles
// nearer than these distances (m) are drawn as four finer tiles (160 -> 80 -> 40 -> 20 m); near: the camera's near plane
// (m); texCap: ground textures kept on the GPU; pitch: share of the bike's pitch the camera follows; widen: at full
// Widen at speed, the camera drops back this far (m) and the field of view opens this much (deg) above 200 km/h
const LOW_FIX = { range: 600, split: [60, 150, 300], near: 0.1, texCap: 180, pitch: 0.3, widen: [1, 10] };
// tuning (GDD 11a, the pause-menu panel), in display units, saved in localStorage 'sgp_cam_low'
const LOW_SET = [
  { k: 'dist', lbl: 'Distance', unit: 'm', min: 3, max: 8, step: 0.1 },
  { k: 'height', lbl: 'Height', unit: 'm', min: 0.8, max: 3, step: 0.1 },
  { k: 'down', lbl: 'Look down', unit: '°', min: 0, max: 15, step: 0.5 },
  { k: 'fov', lbl: 'Field of view', unit: '°', min: 50, max: 80, step: 1 },
  { k: 'lag', lbl: 'Follow lag', unit: 's', min: 0, max: 0.6, step: 0.05 },
  { k: 'wd', lbl: 'Widen at speed', unit: '%', min: 0, max: 100, step: 5 },
];
const LOW_DEF = Object.freeze({ dist: 4.5, height: 1.6, down: 6, fov: 60, lag: 0.25, wd: 100 });
const LOW_VAL = Object.assign({}, LOW_DEF);
const LOW_KEY = 'sgp_cam_low';
const LOW_FOG = 0xc9d8de; // the haze colour of the tilted cameras (drawSky)
const LOW_V = new THREE.Vector3();
try {
  const s = JSON.parse(localStorage.getItem(LOW_KEY) || 'null');
  if (s && typeof s === 'object') for (const d of LOW_SET) { const v = +s[d.k]; if (d.k in s && isFinite(v)) LOW_VAL[d.k] = clamp(v, d.min, d.max); }
} catch { /* saved values unreadable or storage blocked: the defaults stay */ }

// sets one tuning value (display units), clamped, and saves it when asked; returns the value kept
function lowSet(d, v, save) {
  v = +v; if (!isFinite(v)) { v = LOW_DEF[d.k]; }
  v = clamp(v, d.min, d.max); LOW_VAL[d.k] = v;
  if (save) { try { localStorage.setItem(LOW_KEY, JSON.stringify(LOW_VAL)); } catch { /* storage blocked: not saved */ } }
  return v;
}
// back to the defaults, saved
function lowReset() { Object.assign(LOW_VAL, LOW_DEF); try { localStorage.setItem(LOW_KEY, JSON.stringify(LOW_VAL)); } catch { /* storage blocked: not saved */ } }
// Chase can be used: 3D graphics, not a phone (until it shows 60 fps on one), WebGL running
function lowAvail() { return useBike3D() && !coarseMQ.matches && gl3DInit(); }
// the Chase camera is in use
function lowOn() { return CAM.mode === 'low' && lowAvail(); }
// a game point (metres, y down the top-down screen, z up) in the Chase frame
function lowMap(x, y, z) { return [x, -y, z]; }

// the camera's lagged heading: it eases towards the bike's heading over the Follow lag, so in a corner the camera swings
// a little to the outside and the bike shows some of its side; it snaps on a new start or a jump (reset, new session)
function lowFollow(b, dt) {
  const far = LOW.at && Math.hypot(b.x - LOW.at[0], b.y - LOW.at[1]) > 30;
  if (LOW.yawL === null || !CAM.init || far) { LOW.yawL = b.h; }
  else if (!(b.crashed && b.crash)) { const lag = LOW_VAL.lag; LOW.yawL += angWrap(b.h - LOW.yawL) * (lag > 0 ? 1 - Math.exp(-dt / lag) : 1); }
  LOW.at = [b.x, b.y];
  return LOW.yawL;
}
// where the camera is and where it looks for bike b, in the Chase frame: behind the bike along the lagged heading,
// further back and wider at speed (CAM.w, Widen at speed), the look down the set angle plus a share of the bike's pitch
// (braking dips the view); shake (sx, sy in metres) moves the eye. While the rider is down the camera stays and watches.
function lowEye(b, sx = 0, sy = 0) {
  const w = CAM.w * LOW_VAL.wd / 100;
  if (b.crashed && b.crash && LOW.eye) {
    const e = LOW.eye, r = b.crash.rd;
    return { eye: e, dir: [r.x - e[0], -r.y - e[1], 0.5 - e[2]], fov: LOW_VAL.fov + w * LOW_FIX.widen[1] };
  }
  const yaw = LOW.yawL === null ? b.h : LOW.yawL, c = Math.cos(yaw), s = Math.sin(yaw), back = LOW_VAL.dist + w * LOW_FIX.widen[0];
  const down = LOW_VAL.down * Math.PI / 180 - LOW_FIX.pitch * gl3DPitch(b), cd = Math.cos(down), sd = Math.sin(down);
  const eye = lowMap(b.x - c * back - s * sx, b.y - s * back + c * sx, LOW_VAL.height + sy);
  return { eye, dir: [c * cd, -s * cd, -sd], fov: LOW_VAL.fov + w * LOW_FIX.widen[1] };
}
// places the three.js camera for bike b (lowEye), horizon level; also the view's heading (for the tiles) and the
// horizon point straight ahead (for the sky and the speed lines)
function lowCamera(b, sx, sy) {
  if (!LOW.cam) { LOW.cam = new THREE.PerspectiveCamera(LOW_VAL.fov, 1, LOW_FIX.near, LOW_FIX.range * 1.5); }
  const cam = LOW.cam, { eye, dir, fov } = lowEye(b, sx, sy), n = Math.hypot(...dir) || 1;
  cam.fov = fov; cam.aspect = VW / VH; cam.updateProjectionMatrix();
  cam.position.set(...eye); cam.up.set(0, 0, 1); cam.lookAt(eye[0] + dir[0] / n, eye[1] + dir[1] / n, eye[2] + dir[2] / n); cam.updateMatrixWorld();
  LOW.eye = eye; LOW.yaw = Math.atan2(-dir[1], dir[0]); // the view's heading in game terms
  const far = 5000;
  LOW.hz = lowProjectPt(eye[0] + far * Math.cos(LOW.yaw), eye[1] - far * Math.sin(LOW.yaw), eye[2]) || [VW / 2, 0];
  return cam;
}
// a point of the Chase frame on screen (css px), or null when it is behind the camera
function lowProjectPt(X, Y, Z) {
  const cam = LOW.cam; if (!cam) { return null; }
  LOW_V.set(X, Y, Z).applyMatrix4(cam.matrixWorldInverse); if (LOW_V.z > -cam.near) { return null; }
  LOW_V.applyMatrix4(cam.projectionMatrix);
  return [(LOW_V.x + 1) / 2 * VW, (1 - LOW_V.y) / 2 * VH];
}
// worldToScreen for Chase: a ground point on screen, far off screen when it is behind the camera
function lowProject(x, y) { return lowProjectPt(x, -y, 0) || [-1e4, -1e4]; }

// the tile levels, finest first: 20 m (Chase's own, 25.6 px a metre), then the 40, 80 and 160 m levels of TLV; the
// fine level is cleared when the tiles start or stop leaving out the flat walls (tileWallsSync clears TLV)
function lowLevels() {
  if (LOW.on3d !== TILE_WALLS.on3d) { LOW.near.map.clear(); LOW.on3d = TILE_WALLS.on3d; }
  return [LOW.near, TLV[0], TLV[1], TLV[2]];
}
// the ground tiles in view from the eye (ex, ey in game metres) looking along yaw, as a quadtree: the 160 m tiles
// within the range and inside the view's width, each split into four while it is nearer than LOW_FIX.split
function lowTiles(ex, ey, yaw, fov) {
  const LV = lowLevels(), R = LOW_FIX.range, out = [];
  const half = Math.atan(Math.tan(fov * Math.PI / 360) * VW / VH) + 0.1; // half the view's width, plus a margin
  const visit = (k, tx, ty) => {
    const M = LV[k].m, x0 = tx * M, y0 = ty * M;
    const near = Math.hypot(Math.max(x0 - ex, 0, ex - x0 - M), Math.max(y0 - ey, 0, ey - y0 - M));
    if (near > R) { return; }
    const cx = x0 + M / 2 - ex, cy = y0 + M / 2 - ey, d = Math.hypot(cx, cy), r = M * Math.SQRT1_2;
    if (d > r && Math.abs(angWrap(Math.atan2(cy, cx) - yaw)) > half + Math.asin(r / d)) { return; }
    if (k > 0 && near < LOW_FIX.split[k - 1]) { for (let i = 0; i < 4; i++) { visit(k - 1, tx * 2 + (i & 1), ty * 2 + (i >> 1)); } return; }
    out.push({ k, tx, ty, near });
  };
  const M = LV[3].m;
  for (let tx = Math.floor((ex - R) / M); tx <= Math.floor((ex + R) / M); tx++) {
    for (let ty = Math.floor((ey - R) / M); ty <= Math.floor((ey + R) / M); ty++) { visit(3, tx, ty); }
  }
  return out;
}
// the picture for tile (tx, ty) of level k: its own cached canvas, rendered now while budget.n lasts, otherwise the
// part of a coarser cached tile that covers it ({ c, u0, v0, u1, v1 }, v = 1 at the canvas top), or null
function lowTileImage(k, tx, ty, budget) {
  const LV = lowLevels();
  let c = getTile(LV[k], tx, ty, false);
  if (!c && budget.n > 0) { budget.n--; c = getTile(LV[k], tx, ty, true); }
  if (c) { return { c, u0: 0, v0: 0, u1: 1, v1: 1 }; }
  for (let p = k + 1, r = 2; p < LV.length; p++, r *= 2) {
    const px = Math.floor(tx / r), py = Math.floor(ty / r), pc = getTile(LV[p], px, py, false);
    if (pc) { const i = tx - px * r, j = ty - py * r; return { c: pc, u0: i / r, u1: (i + 1) / r, v0: 1 - (j + 1) / r, v1: 1 - j / r }; }
  }
  return null;
}
// a tile canvas as a texture with mipmaps and anisotropic filtering, so the road seen at a low angle does not shimmer
function lowTexture(c) {
  let t = LOW.tex.get(c);
  if (!t) {
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = LOW.aniso;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; LOW.tex.set(c, t);
  }
  t.userData.used = tileFrame;
  return t;
}
// frees the textures not used for longest once there are more than LOW_FIX.texCap (about 1.3 MB of GPU memory each)
function lowTexPrune() {
  if (LOW.tex.size <= LOW_FIX.texCap) { return 0; }
  const old = [...LOW.tex].filter(([, t]) => t.userData.used < tileFrame).sort((a, b) => a[1].userData.used - b[1].userData.used);
  const drop = old.slice(0, LOW.tex.size - LOW_FIX.texCap);
  for (const [c, t] of drop) { t.dispose(); LOW.tex.delete(c); }
  return drop.length;
}
// mesh n of the tile pool, made on first use with texture t
function lowQuad(n, t) {
  while (LOW.pool.length <= n) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, depthTest: false, depthWrite: false }));
    m.frustumCulled = false; m.renderOrder = 1; LOW.scene.add(m); LOW.pool.push(m);
  }
  return LOW.pool[n];
}
// the soft dark patch under a bike (the tilted cameras draw a 2D shadow under each bike), drawn once
function lowShadowTexture() {
  if (LOW.shadowTex) { return LOW.shadowTex; }
  const c = mkCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  LOW.shadowTex = new THREE.CanvasTexture(c);
  return LOW.shadowTex;
}
// the shadow patches under the bikes in list: 2.2 m long, 0.9 m wide, along each bike's heading, over the tiles
function lowShadows(list) {
  while (LOW.shadows.length < list.length) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: lowShadowTexture(), transparent: true, depthTest: false, depthWrite: false }));
    m.frustumCulled = false; m.renderOrder = 2; LOW.scene.add(m); LOW.shadows.push(m);
  }
  LOW.shadows.forEach((m, i) => {
    const b = list[i]; m.visible = !!b; if (!b) { return; }
    m.position.set(b.x, -b.y, 0); m.rotation.set(0, 0, -b.h); m.scale.set(2.2, 0.9, 1);
  });
  return list.length;
}
// the ground scene: a grass plane under everything and the haze (fog), built once
function lowInit() {
  if (LOW.ready) { return; }
  LOW.scene = new THREE.Scene(); LOW.fog = new THREE.Fog(LOW_FOG, LOW_FIX.range * 0.4, LOW_FIX.range); LOW.scene.fog = LOW.fog;
  LOW.base = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3d6e30, depthTest: false, depthWrite: false }));
  LOW.base.frustumCulled = false; LOW.base.renderOrder = 0; LOW.scene.add(LOW.base);
  const caps = GL3D.renderer && GL3D.renderer.capabilities;
  LOW.aniso = caps && caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 1;
  LOW.ready = true;
}
// lays the ground tiles in view around the eye (ex, ey in game metres), nearest first, and returns how many
function lowGround(ex, ey, fov) {
  const LV = lowLevels(), list = lowTiles(ex, ey, LOW.yaw, fov).sort((a, b) => a.near - b.near);
  const budget = { n: LOW.near.map.size + TLV[0].map.size < 6 ? 30 : 2 }; // tiles rendered this frame; many at the start
  let n = 0;
  for (const q of list) {
    const im = lowTileImage(q.k, q.tx, q.ty, budget); if (!im) { continue; }
    const M = LV[q.k].m, t = lowTexture(im.c), m = lowQuad(n++, t);
    m.material.map = t;
    const uv = m.geometry.attributes.uv; uv.array.set([im.u0, im.v1, im.u1, im.v1, im.u0, im.v0, im.u1, im.v0]); uv.needsUpdate = true;
    m.position.set(q.tx * M + M / 2, -(q.ty * M + M / 2), 0); m.scale.set(M, M, 1); m.visible = true;
  }
  for (let k = n; k < LOW.pool.length; k++) { LOW.pool[k].visible = false; }
  LOW.base.position.set(ex, -ey, 0); LOW.base.scale.set(2 * LOW_FIX.range, 2 * LOW_FIX.range, 1);
  lowTexPrune();
  return n;
}
// the sky on the 2D game canvas under the 3D layer: blue at the top to the haze at the horizon, haze below it (Chase
// only, until the sky is designed again: GDD 11o phase 6, question 3)
function lowSky(g) {
  const hy = clamp(LOW.hz[1], 1, VH);
  g.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, hy); sky.addColorStop(0, '#6fa3d2'); sky.addColorStop(1, '#c9d8de');
  g.fillStyle = sky; g.fillRect(0, 0, VW, hy + 1);
  g.fillStyle = '#c9d8de'; g.fillRect(0, hy, VW, VH - hy);
}
// the lights in the Chase frame: the walls scene gets the sun fixed in the world (GDD 11o phase 5), the bikes keep
// their own light, from the viewer's side above, turned with the camera (as in the tilted cameras); keep holds the
// bikes' view-frame light directions, put back by lowLightsBack
function lowLights(cam) {
  const ws = (az, el) => [Math.cos(az) * Math.cos(el), -Math.sin(az) * Math.cos(el), Math.sin(el)];
  if (WALLS3D.lights) { WALLS3D.lights.sun.position.set(...ws(SUN.az, SUN.el)); WALLS3D.lights.fill.position.set(...ws(SUN.az + Math.PI, 30 * Math.PI / 180)); }
  const L = GL3D.lights; if (!L) { return null; }
  if (!LOW.keep) { LOW.keep = [L.sun.position.clone(), L.fill.position.clone()]; }
  // the tilted view frame is the screen's: u right, Y down the screen, Z towards the viewer; the same axes of the
  // Chase camera are the columns of its world matrix (x right, y up the screen, z towards the viewer)
  const e = cam.matrixWorld.elements, ax = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]];
  const put = (p, k) => p.set(...[0, 1, 2].map(i => k.x * ax[0][i] - k.y * ax[1][i] + k.z * ax[2][i]));
  put(L.sun.position, LOW.keep[0]); put(L.fill.position, LOW.keep[1]);
  return L.sun.position;
}
// puts the bikes' lights back in the tilted view frame
function lowLightsBack() {
  const L = GL3D.lights; if (!L || !LOW.keep) { return false; }
  L.sun.position.copy(LOW.keep[0]); L.fill.position.copy(LOW.keep[1]);
  return true;
}
// a walls-scene piece (box [x0, y0, x1, y1] in game metres) within the range of the eye (ex, ey)
function lowNear(box, ex, ey) {
  const [x0, y0, x1, y1] = box;
  return Math.hypot(Math.max(x0 - ex, 0, ex - x1), Math.max(y0 - ey, 0, ey - y1)) < LOW_FIX.range;
}
// places the walls-scene pieces and estate cells within the range of the eye (ex, ey in game metres) in world metres
// at real height (they are built WALL_HS tall for the tilted cameras) and hides the others; returns the pieces shown
function lowPlace(ex, ey) {
  const at = (ox, oy) => gl3DMatrix({ X: [1, 0, 0], Y: [0, -1, 0], Z: [0, 0, 1 / WALL_HS], O: [ox, -oy, 0] });
  const show = (box, meshes, M) => {
    const on = lowNear(box, ex, ey);
    for (const m of meshes) { m.visible = on; if (on) { m.matrix.set(...M()); m.matrixWorld.copy(m.matrix); } }
    return on ? 1 : 0;
  };
  let n = 0;
  for (const p of WALLS3D.pieces) { n += show(p.box, p.meshes, () => at(p.ox, p.oy)); }
  const T0 = at(0, 0);
  for (const c of EST.cells) { n += show(c.box, c.meshes, () => T0); }
  return n;
}
// the 3D walls, trackside objects and estate (GDD 11o phases 2 to 4) in Chase: placed by lowPlace, with the haze by
// distance from the eye and no clipping; returns the pieces drawn
function lowScenery(r, ex, ey) {
  if (PERF.noWalls) { return 0; }
  walls3DInit();
  const n = lowPlace(ex, ey), M = WALLS3D.mats, fog = WALLS3D.scene.fog;
  fog.near = LOW.fog.near; fog.far = LOW.fog.far;
  WALLS3D.fogU.fogCa.value = 0; WALLS3D.fogU.fogSa.value = 1; // walls3DFog: the haze by depth from the eye
  // the y flip turns the faces round: one-sided materials are drawn from both sides here, as they were
  const mats = [M.post, M.tree, M.crowd].filter(Boolean), sides = mats.map(m => m.side);
  for (const m of mats) { m.side = THREE.DoubleSide; }
  r.localClippingEnabled = false; r.render(WALLS3D.scene, LOW.cam);
  mats.forEach((m, i) => { m.side = sides[i]; });
  WALLS3D.drawn = n;
  return n;
}
// draws the Chase view: the sky on the game canvas, then the ground with the bikes' shadows, the scenery and the bikes
// in list on the 3D canvas, the camera shaken like the tilted cameras' ground (HUD.shake, speedVib). The tiles leave out
// the flat walls, which are drawn in 3D.
function lowDraw(list) {
  const b = W.player;
  if (!b || !gl3DInit()) { gl3DShow(false); return false; }
  lowInit(); gl3DPrune(list); gl3DShow(true); gl3DSize(); tileWallsSync(!PERF.noWalls);
  let sx = 0, sy = 0; if (HUD.shake > 0.01) { sx = (Math.random() - 0.5) * 8 * HUD.shake; sy = (Math.random() - 0.5) * 8 * HUD.shake; }
  const A = speedVib(); if (A > 0) { sx += (Math.random() - 0.5) * 2 * A; sy += (Math.random() - 0.5) * 2 * A; }
  const cam = lowCamera(b, sx * 0.004, sy * 0.004); // px of the tilted cameras' shake as a few millimetres
  let t = performance.now();
  for (const k of list) { gl3DPlaceBike(k, lowMap, 1); }
  const r = GL3D.renderer; r.clear();
  lowSky(mainCtx);
  LOW.tiles = lowGround(LOW.eye[0], -LOW.eye[1], cam.fov); lowShadows(list);
  r.render(LOW.scene, cam);
  perfAdd('lowg', t); t = performance.now();
  lowLights(cam);
  lowScenery(r, LOW.eye[0], -LOW.eye[1]);
  perfAdd('walls', t); t = performance.now();
  if (list.length) { GL3D.scene.fog = LOW.fog; r.render(GL3D.scene, cam); GL3D.scene.fog = null; }
  lowLightsBack();
  perfAdd('gl3d', t); PERF.gl3d = list.length;
  return true;
}
