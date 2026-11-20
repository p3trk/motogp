// --- real-time 3D bikes (GDD 11l-b): three.js draws the bikes on a transparent canvas, in the tilted view.
// The 3D camera uses the same projection as worldToScreen (CSS perspective(P) rotateX(a)), so a bike lands where the
// road under it is. The bikes are composited after the road warp and the speed blur, as the 2D bikes are seen.
// If WebGL or three.js is missing, or the view is not tilted, the 2D sprites are drawn as before.
const GL3D = { ok: null, canvas: null, renderer: null, scene: null, cam: null, meshes: new Map(), geo: null }; // meshes: bike -> its role meshes
function gl3DInit() {
  if (GL3D.ok !== null) return GL3D.ok;
  GL3D.ok = false;
  try {
    if (typeof THREE === 'undefined') return false;
    const canvas = document.createElement('canvas');
    // its own page layer between the world and the HUD: the browser composites it, no copy into the 2D canvas (GDD 11n)
    canvas.id = 'gl3d'; canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:none;pointer-events:none';
    cv.after(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0); renderer.autoClear = false; // gl3DDraw clears once, then draws the ground and the bikes
    GL3D.canvas = canvas; GL3D.renderer = renderer; GL3D.scene = new THREE.Scene(); GL3D.cam = new THREE.Camera();
    gl3DAddLights(GL3D.scene);
    GL3D.ok = true;
  } catch { /* no WebGL here: the 2D bikes are drawn */ }
  return GL3D.ok;
}
// the lights of the 3D scenes (bikes, walls): ambient, the sun from the viewer's side above, and a soft fill from the
// other side so the shadow side is not black; directions in the view frame (the walls scene turns them to the sun
// fixed in the world each frame, sunLightPlace); returns the sun and the fill
function gl3DAddLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(0.35, -0.5, 0.8); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(-0.6, 0.4, 0.3); scene.add(fill);
  return { sun, fill };
}
// clip = M * [u, Y, Z, 1]; ndc = clip / w. Screen x = VW/2 + u*P/w, screen y = VH + Y*P/w, w = P - Z: the worldToScreen
// projection, with the road plane at height Y (down the screen) and Z (towards the viewer). Depth: nearer is smaller.
function gl3DProjection(P) {
  return [2 * P / VW, 0, 0, 0,
    0, -2 * P / VH, 1, -P,
    0, 0, -1, 0,
    0, 0, -1, P];
}
// a ground point (x, y) in metres, lifted z metres, in the projection frame (u, Y, Z) of gl3DProjection
function gl3DPlanePoint(x, y, z) {
  const [cx, cy] = worldToCanvas(x, y);
  const u = cx - RW / 2, v = cy - RH, hpx = z * CAM.ppm, a = tiltA(), sa = Math.sin(a), ca = Math.cos(a);
  return [u, v * ca - hpx * sa, v * sa + hpx * ca];
}
// the model frame of one bike: metres in the bike's own axes (+x forward, +y left, +z up) scaled by VS, placed on the road
function gl3DBikeFrame(b) {
  const VS = PHYS.VS * CAM.boost, c = Math.cos(b.h), s = Math.sin(b.h);
  const O = gl3DPlanePoint(b.x, b.y, 0);
  const sub = p => [p[0] - O[0], p[1] - O[1], p[2] - O[2]];
  const fw = sub(gl3DPlanePoint(b.x + c, b.y + s, 0)), lf = sub(gl3DPlanePoint(b.x - s, b.y + c, 0)), up = sub(gl3DPlanePoint(b.x, b.y, 1));
  // lean: the bike rolls about its forward axis through the contact point, so the wheels stay on the road.
  // Positive lean is a right turn (core.js: curvature = G tan(lean) / v^2, which turns the heading clockwise on screen),
  // so the bike rolls to its right: the up axis moves to the right of the bike's centre line.
  const L = -(b.lean || 0), cl = Math.cos(L), sl = Math.sin(L);
  let X = fw, Y = lf.map((k, i) => k * cl + up[i] * sl), Z = up.map((k, i) => -lf[i] * sl + k * cl);
  // pitch from load transfer, about the rear axle (about 0.65 m behind the centre, estimated): nose up under acceleration
  const P = gl3DPitch(b), cp = Math.cos(P), sp = Math.sin(P);
  const Xw = X.map((k, i) => k * cp + Z[i] * sp), Zw = Z.map((k, i) => -X[i] * sp + k * cp);
  const Ow = O.map((k, i) => k + 0.65 * VS * (Xw[i] - X[i])); // keep the rear axle on its contact point while the bike pitches
  return { O: Ow, X: Xw.map(k => k * VS), Y: Y.map(k => k * VS), Z: Zw.map(k => k * VS) };
}
// a 4x4 row-major matrix whose columns are the bike's axes and whose last column is its origin
function gl3DMatrix(f) {
  return [f.X[0], f.Y[0], f.Z[0], f.O[0],
    f.X[1], f.Y[1], f.Z[1], f.O[1],
    f.X[2], f.Y[2], f.Z[2], f.O[2],
    0, 0, 0, 1];
}
// the exported model (src/bike3dmodel.js) in bike metres: decoded once, one indexed mesh per role
const GL3D_DARK = '#1b1b1b'; // the same dark as tools/render_bike_sprites.py
// pitch from load transfer (GDD 11l-b): acceleration moves weight to the rear (nose up), braking to the front (nose down).
// The chassis pitches until the suspension balances the moment: theta = m a h / K, with the pitch stiffness
// K = sum of k d^2 over the springs (k in N/m at the wheel, d the distance of that axle from the centre of mass).
// Values (GDD 11l-b, checked online 2026-11-17): fork 0.85-1.0 kg/mm per leg = 9 N/mm, so kf = 9000 N/m per leg
// (Cane Creek and VTR1000 spring-rate guides); centre of mass about 20 in = 0.5 m high and 52/48 front/rear (Tony
// Foale via Cycle World / msgroup); the rear wheel rate kr = 40000 N/m is an assumption (shock 80-160 N/mm times the
// linkage motion ratio squared), not a sourced figure.
const GL3D_PITCH = { h: 0.5, kf: 9000, df: 0.71, kr: 40000, dr: 0.76 };
function gl3DPitch(b) {
  const m = PHYS.massBike + PHYS.massRider, P = GL3D_PITCH;
  const K = 2 * P.kf * P.df * P.df + P.kr * P.dr * P.dr;
  return (b.aLong || 0) * m * P.h / K;
}
function gl3DDecode(s, Type) {
  const bin = atob(s), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) { u8[i] = bin.charCodeAt(i); }
  return new Type(u8.buffer);
}
function gl3DGeometry(role) {
  if (!GL3D.geo) GL3D.geo = {};
  if (!GL3D.geo[role]) {
    const m = BIKE3DMODEL[role], geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(gl3DDecode(m.pos, Float32Array), 3));
    geo.setIndex(new THREE.BufferAttribute(gl3DDecode(m.idx, Uint32Array), 1));
    if (m.morph) { // the rider's lean poses, baked in Blender with the hands on the grips (int16, BIKE3DMODEL.poseScale per metre)
      geo.morphAttributes.position = m.morph.map(t => new THREE.BufferAttribute(Float32Array.from(gl3DDecode(t, Int16Array), q => q / BIKE3DMODEL.poseScale), 3));
    }
    geo.computeVertexNormals();
    GL3D.geo[role] = geo;
  }
  return GL3D.geo[role];
}
// the rider's roles: skin, suit, the suit's stripes, and the helmet's shell, visor and trim. Only the player's bike has them (GDD 11l-b)
const GL3D_RIDER_ROLES = ['rider', 'suit', 'stripe', 'helmet', 'visor', 'trim'];
function gl3DColour(team, role) {
  const T = TEAMS[team];
  if (role === 'body') return T.c1;
  if (role === 'screen') return T.c2;
  if (role === 'suit') return T.suit;   // the team's suit (the team list in core.js: the design by name)
  if (role === 'stripe') return T.accent; // the suit's bands: the team's accent colour
  if (role === 'helmet') return T.helmet;
  if (role === 'trim') return T.suit;     // the helmet's stripe, sweeps and spoiler: the suit colour, so they show on the shell
  if (role === 'visor') return '#0d1116';
  if (role === 'rider') return '#d9b08c'; // skin: head, neck and hands
  return GL3D_DARK;
}
// the roles of the exported model: every entry with a mesh (not the pivot or the pose list)
function gl3DRoles() { return Object.keys(BIKE3DMODEL).filter(r => BIKE3DMODEL[r] && BIKE3DMODEL[r].pos); }
// the front wheel turns with steering about the vertical axis through its axle (the pivot in the exported model).
// Steer is positive for a right turn, and a right turn turns the front wheel to the right (negative bike y).
// Lock is 0.35 rad (20 degrees). Rotation is about the model's z axis, then the bike frame moves the result.
function gl3DWheelFrame(f, steer) {
  const th = -(steer || 0) * 0.35, c = Math.cos(th), sn = Math.sin(th), p = BIKE3DMODEL.pivot;
  const rp = [c * p[0] - sn * p[1], sn * p[0] + c * p[1], p[2]];           // the pivot after the turn, model metres
  const ax = [f.X, f.Y, f.Z];
  const X = f.X.map((_, i) => c * f.X[i] + sn * f.Y[i]);
  const Y = f.X.map((_, i) => -sn * f.X[i] + c * f.Y[i]);
  const O = f.O.map((o, i) => o + (p[0] - rp[0]) * ax[0][i] + (p[1] - rp[1]) * ax[1][i] + (p[2] - rp[2]) * ax[2][i]);
  return { O, X, Y, Z: f.Z };
}
// the finish of each role (GDD 11l-b): gloss on the bodywork and helmet, glass on the screen and visor, satin suit; the
// roles not listed (skin, tyres and dark parts) are matte
const GL3D_FINISH = {
  body: { specular: 0x9a9a9a, shininess: 70 }, screen: { specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.85 },
  helmet: { specular: 0xaaaaaa, shininess: 90 }, trim: { specular: 0xaaaaaa, shininess: 90 },
  visor: { specular: 0xffffff, shininess: 140 }, suit: { specular: 0x222222, shininess: 30 }, stripe: { specular: 0x222222, shininess: 30 }
};
function gl3DMaterial(role, colour) {
  const opts = { color: new THREE.Color(colour), side: THREE.DoubleSide }, finish = GL3D_FINISH[role];
  return finish ? new THREE.MeshPhongMaterial(Object.assign(opts, finish)) : new THREE.MeshLambertMaterial(opts);
}
function gl3DMesh(b) { // one mesh per role for each bike, kept for that bike; team colours set here. Only the player's bike has a rider
  if (GL3D.meshes.has(b)) return GL3D.meshes.get(b);
  const roles = gl3DRoles().filter(role => !GL3D_RIDER_ROLES.includes(role) || b.isPlayer);
  const list = roles.map(role => {
    const mesh = new THREE.Mesh(gl3DGeometry(role), gl3DMaterial(role, gl3DColour(b.team, role))); mesh.userData.role = role;
    mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
    GL3D.scene.add(mesh); return mesh;
  });
  // the tail light: a small box at the back of the bike, lit red while braking (gl3DDraw)
  const lightMat = new THREE.MeshLambertMaterial({ color: 0x5a0d0a, emissive: 0x000000 });
  const light = new THREE.Mesh(gl3DLightGeometry(), lightMat);
  light.userData.role = 'light'; light.frustumCulled = false; light.matrixAutoUpdate = false;
  GL3D.scene.add(light); list.push(light);
  GL3D.meshes.set(b, list);
  return list;
}
// the tail light, in bike metres: at the rear end of the tail, measured on the exported model
function gl3DLightGeometry() {
  if (!GL3D.lightGeo) { const g = new THREE.BoxGeometry(0.05, 0.14, 0.04); g.translate(-0.74, 0, 0.88); GL3D.lightGeo = g; }
  return GL3D.lightGeo;
}
// a bike drawn in 3D: 3D is on, the view is tilted, the bike is running (crashed and retired bikes stay 2D)
function gl3DOn(b) { return useBike3D() && camTilted() && !b.crashed && !b.dnf && gl3DInit(); }
// draws the bikes in list on the transparent canvas and composites it over the current frame
// bikes that have left the session (end of a race, a new session) lose their meshes; the others not drawn in 3D
// this frame (crashed, retired, out of view) are hidden, so no bike stays frozen on screen
function gl3DPrune(list) {
  const live = new Set(W.bikes);
  for (const [b, meshes] of GL3D.meshes) {
    const gone = !live.has(b);
    if (gone) { for (const m of meshes) { GL3D.scene.remove(m); m.material.dispose(); } GL3D.meshes.delete(b); continue; }
    if (!list.includes(b)) for (const m of meshes) m.visible = false;
  }
}
// the rider's pose for a lean: weights for the baked poses (BIKE3DMODEL.poseLean, radians), blending the two poses
// either side of the lean on its side of upright. The base mesh is the upright pose. The poses hang off to the inside
// of the turn with the hands on the grips and the feet on the pegs (tools/export_bike_models.py, pose_rider).
function gl3DPoseWeights(lean) {
  const P = BIKE3DMODEL.poseLean || [], w = P.map(() => 0), L = lean || 0;
  if (!P.length || L === 0) return w;
  const side = P.map((p, i) => [Math.abs(p), i]).filter(([, i]) => Math.sign(P[i]) === Math.sign(L)).sort((u, v) => u[0] - v[0]);
  const a = Math.abs(L);
  let lo = [0, -1];
  for (const hi of side) {
    if (a <= hi[0]) {
      const t = (a - lo[0]) / (hi[0] - lo[0]);
      w[hi[1]] = t;
      if (lo[1] >= 0) { w[lo[1]] = 1 - t; }
      return w;
    }
    lo = hi;
  }
  if (lo[1] >= 0) w[lo[1]] = 1; // beyond the last pose: hold it
  return w;
}
// one bike's meshes for this frame: placed on the road, the front wheel steered, the rider posed for the lean, and
// the tail light lit while braking
function gl3DPlaceBike(b) {
  const f = gl3DBikeFrame(b), mat = gl3DMatrix(f), wmat = gl3DMatrix(gl3DWheelFrame(f, b.ctl && b.ctl.steer));
  const pose = gl3DPoseWeights(b.lean);
  const braking = (b.ctl && b.ctl.brk > 0.3) && b.v > 5; // the same rule as the 2D brake glow (drawBike)
  const light = braking ? 0xff2a1a : 0x5a0d0a;
  for (const m of gl3DMesh(b)) {
    const role = m.userData.role;
    if (m.morphTargetInfluences) { pose.forEach((v, i) => { m.morphTargetInfluences[i] = v; }); }
    if (role === 'light') { m.material.color.setHex(light); m.material.emissive.setHex(braking ? light : 0x000000); }
    m.visible = true; m.matrix.set(...(role === 'wheel' ? wmat : mat)); m.matrixWorld.copy(m.matrix);
  }
}
// show or hide the 3D layer; the style is written only when it changes
function gl3DShow(on) {
  const c = GL3D.canvas;
  if (!c || !c.style || GL3D.shown === on) return;
  GL3D.shown = on; c.style.display = on ? 'block' : 'none';
}
function gl3DDraw(list) {
  if (!gl3DInit()) return false;
  gl3DPrune(list);
  const ground = ground3DOn(); // the ground is drawn on this canvas too (GDD 11o)
  gl3DShow(list.length > 0 || ground);
  if (!list.length && !ground) return false;
  const w = cv.width, h = cv.height, P = tiltP();
  // resize only when the page size changes: setSize rewrites the canvas size every call, which reallocates the canvas
  if (GL3D.w !== w || GL3D.h !== h) { GL3D.renderer.setPixelRatio(1); GL3D.renderer.setSize(w, h, false); GL3D.w = w; GL3D.h = h; }
  GL3D.cam.projectionMatrix.set(...gl3DProjection(P)); GL3D.cam.matrixWorldInverse.identity();
  let t = performance.now();
  for (const b of list) { gl3DPlaceBike(b); }
  GL3D.renderer.clear();
  if (ground) { ground3DRender(); }
  if (list.length) { GL3D.renderer.render(GL3D.scene, GL3D.cam); }
  perfAdd('gl3d', t); PERF.gl3d = list.length;
  return true;
}
