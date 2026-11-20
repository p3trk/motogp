// --- 3D walls, barriers and fences (GDD 11o, phase 2): concrete walls, Armco, tyre walls and debris fences standing
// on the wall line, in the 3D view over the 3D ground. Built once in world metres when the track is loaded, in pieces
// of about 250 m; each frame a piece gets one matrix from world metres to the camera frame (gl3DPlanePoint is an
// affine map), so the cost per frame does not grow with the number of posts. Heights are scaled like the bikes.
const WALLS3D = { ready: false, src: null, scene: null, pieces: [], clip: [], mats: null, postGeo: null, drawn: 0, shake: [0, 0] };
const WALL_HS = PHYS.VS; // the bikes are drawn 1.35x real size, so the heights are too (the footprint stays real)
const WALL_PIECE = 125; // track points per piece (about 250 m)
const WALL_KIND = { NONE: 0, CONCRETE: 1, ARMCO: 2, TYRE: 3 };
const WALL_TYRE_CORNERS = ['Copse', 'Maggotts', 'Stowe', 'Club', 'Abbey']; // tyre walls on the outside, 60 m either side
const WALL_COL = { face: '#9a9c98', top: '#c4c5c0', back: '#7f817c', blue: '#1d4fd6', white: '#f0f0f0', steel: '#b9bec2',
  tyre: ['#1b1b1b', '#2a2a2a'], red: '#d42a24', belt: '#f2f0ec', rail: '#5d6367', post: '#7d8388', mesh: '#1e2326' };
const WALL_TH = 0.5, WALL_FENCE = 3.0, WALL_POST_STEP = 4; // concrete thickness, fence top and post spacing in metres

// the walls are drawn in 3D with the 3D ground, unless test switch 7 has turned them off
function walls3DOn() { return ground3DOn() && !PERF.noWalls; }

// runs of one kind shorter than minRun points take the kind before them, so the barrier type does not flicker
function wallSmooth(kind, minRun) {
  for (let k = 0; k < kind.length;) {
    let m = k; while (m < kind.length && kind[m] === kind[k]) m++;
    if (kind[k] && k > 0 && kind[k - 1] && m - k < minRun) kind.fill(kind[k - 1], k, m);
    k = m;
  }
  return kind;
}

// the barrier along one side (0 right, 1 left) at each track point: none at the garage frontage (as the flat walls),
// Armco where the wall stands more than 20 m back, tyre walls on the outside of the fastest corners, concrete elsewhere,
// and gaps where it would stand in another part of the circuit's run-off
function wallKinds(s) {
  const N = T.N, PIT = T.PIT, E = T.EDGE[s], Wl = T.WALL[s], kind = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const sr = T.rel(k * T.DS);
    if (s === 0 && sr > PIT.sIn - 2 && sr < PIT.sOut + 2) continue;
    kind[k] = Wl[k] - E[k] > 20 ? WALL_KIND.ARMCO : WALL_KIND.CONCRETE;
  }
  wallSmooth(kind, 20);
  wallTyres(kind, s);
  return wallGaps(kind, s);
}
// tyre walls on the outside of the corners in WALL_TYRE_CORNERS, 30 track points (60 m) either side, where there is a barrier
function wallTyres(kind, s) {
  const N = kind.length;
  for (const name of WALL_TYRE_CORNERS) {
    const c = T.corners.find(q => q.name === name); if (!c || (T.KS[c.i] > 0 ? 1 : 0) !== s) continue;
    for (let o = -30; o <= 30; o++) { const k = (c.i + o + N) % N; if (kind[k]) kind[k] = WALL_KIND.TYRE; }
  }
  return kind;
}
// a gap where the barrier's front or back would stand in another part of the circuit's run-off or gravel (where two
// parts come close)
function wallGaps(kind, s) {
  const sg = s ? -1 : 1, Wl = T.WALL[s];
  for (let k = 0; k < kind.length; k++) {
    if (!kind[k]) continue;
    const deep = kind[k] === WALL_KIND.TYRE ? 1 + WALL_TH : WALL_TH;
    if (!wallClear(...T.pt(k, sg * Wl[k])) || !wallClear(...T.pt(k, sg * (Wl[k] + deep)))) kind[k] = WALL_KIND.NONE;
  }
  return kind;
}
// a ground point where a barrier may stand: on the grass or behind the wall line of the nearest part of the circuit
const WALL_AT = { i: -1, s: 0, d: 0 };
function wallClear(x, y) {
  T.project(x, y, -1, WALL_AT);
  const sf = T.surface(WALL_AT.i, WALL_AT.s, WALL_AT.d);
  return sf === SURF.GRASS || sf === SURF.WALL;
}

// a colour as linear RGB for vertex colours (three.js works in linear light), kept per colour
const WALL_RGB = new Map();
function wallRGB(hex) {
  if (!WALL_RGB.has(hex)) { const c = new THREE.Color(hex); WALL_RGB.set(hex, [c.r, c.g, c.b]); }
  return WALL_RGB.get(hex);
}
// one flat quad a-b-c-d (points [x, y, z]) in one colour, as two triangles
function wallQuad(buf, a, b, c, d, hex) {
  const rgb = wallRGB(hex);
  for (const p of [a, b, c, a, c, d]) { buf.pos.push(p[0], p[1], p[2]); buf.col.push(rgb[0], rgb[1], rgb[2]); }
}

// at(q, d, z): the point d metres out from the centre line at track point q, z metres up (scaled), piece-relative.
// A segment runs from track point k (face distance fk) to j (fj).
// Concrete: 1 m high, WALL_TH thick, painted in 6 m blue and white blocks on the top of the track face
function wallConcrete(buf, at, k, j, fk, fj, paint) {
  const c = WALL_COL, A = (d, z) => at(k, fk + d, z), B = (d, z) => at(j, fj + d, z);
  let band = c.face; if (paint) band = Math.floor(k * T.DS / 6) % 2 ? c.white : c.blue;
  wallQuad(buf, A(0, 0), B(0, 0), B(0, 0.65), A(0, 0.65), c.face);
  wallQuad(buf, A(0, 0.65), B(0, 0.65), B(0, 1), A(0, 1), band);
  wallQuad(buf, A(0, 1), B(0, 1), B(WALL_TH, 1), A(WALL_TH, 1), c.top);
  wallQuad(buf, A(WALL_TH, 1), B(WALL_TH, 1), B(WALL_TH, 0), A(WALL_TH, 0), c.back);
}
// Armco: two steel rails on the wall line
function wallArmco(buf, at, k, j, fk, fj) {
  for (const [z0, z1] of [[0.4, 0.52], [0.68, 0.8]]) wallQuad(buf, at(k, fk, z0), at(j, fj, z0), at(j, fj, z1), at(k, fk, z1), WALL_COL.steel);
}
// tyre wall: 1 m deep and high, three rows of tyres under a belt in red and white 2 m blocks, in front of the concrete
function wallTyre(buf, at, k, j, fk, fj) {
  const c = WALL_COL, A = (d, z) => at(k, fk + d, z), B = (d, z) => at(j, fj + d, z);
  for (let r = 0; r < 3; r++) wallQuad(buf, A(0, r * 0.7 / 3), B(0, r * 0.7 / 3), B(0, (r + 1) * 0.7 / 3), A(0, (r + 1) * 0.7 / 3), c.tyre[r % 2]);
  wallQuad(buf, A(0, 0.7), B(0, 0.7), B(0, 1), A(0, 1), k % 2 ? c.red : c.belt);
  wallQuad(buf, A(0, 1), B(0, 1), B(1, 1), A(1, 1), c.tyre[0]);
}
// debris fence on top of a wall at distance fk..fj: a see-through panel (panel buffer) and a top rail (solid buffer)
function wallFence(buf, panel, at, k, j, fk, fj) {
  wallQuad(panel, at(k, fk, 1), at(j, fj, 1), at(j, fj, WALL_FENCE), at(k, fk, WALL_FENCE), WALL_COL.mesh);
  wallQuad(buf, at(k, fk, WALL_FENCE - 0.08), at(j, fj, WALL_FENCE - 0.08), at(j, fj, WALL_FENCE), at(k, fk, WALL_FENCE), WALL_COL.rail);
}

// one segment of barrier from track point k to j into piece p: the wall of its kind, its fence and its posts (every
// WALL_POST_STEP metres), an end face where a concrete run starts or ends, and with ad an advert on the fence (phase 4)
function wallSegment(p, kind, k, j, sg, fk, fj, paint = true, ad = false) {
  const at = (q, d, z) => {
    const x = T.X[q] + T.NX[q] * sg * d, y = T.Y[q] + T.NY[q] * sg * d, b = p.box;
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    return [x - p.ox, y - p.oy, z * WALL_HS];
  };
  const kk = kind[k], post = Math.floor(k * T.DS / WALL_POST_STEP) !== Math.floor((k - 1) * T.DS / WALL_POST_STEP);
  if (kk === WALL_KIND.ARMCO) {
    wallArmco(p.buf, at, k, j, fk, fj);
    if (post) { const q = at(k, fk + 0.15, 0); p.posts.push([q[0], q[1], 0.8]); }
    return;
  }
  const off = kk === WALL_KIND.TYRE ? 1 : 0, N = kind.length;
  if (off) wallTyre(p.buf, at, k, j, fk, fj);
  wallConcrete(p.buf, at, k, j, fk + off, fj + off, paint);
  // the neighbouring segment is of another kind, or not built (it needs both its points)
  for (const [q, f, open] of [[k, fk, kind[(k - 1 + N) % N] !== kk], [j, fj, kind[j] !== kk || !kind[(j + 1) % N]]]) {
    if (open) wallQuad(p.buf, at(q, f, 0), at(q, f + off + WALL_TH, 0), at(q, f + off + WALL_TH, 1), at(q, f, 1), WALL_COL.back);
  }
  const fd = fk + off + WALL_TH - 0.15, fdj = fj + off + WALL_TH - 0.15;
  wallFence(p.buf, p.panel, at, k, j, fd, fdj);
  if (ad) wallAd(p, at, k, j, fd - 0.04, fdj - 0.04, sg);
  if (post) { const q = at(k, fd, 0); p.posts.push([q[0], q[1], WALL_FENCE]); }
}

// a buffer of quads as a geometry with flat normals: vertex colours (buf.col) or texture coordinates (buf.uv)
function wallGeometry(buf) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf.pos), 3));
  if (buf.col) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(buf.col), 3));
  if (buf.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buf.uv), 2));
  g.computeVertexNormals();
  return g;
}
// the posts of a piece as one instanced box: [x, y, height, width (0.12 m), colour (fence post grey), base height (0)]
// in metres
const WALL_TINT = new THREE.Color();
function wallPosts(list, mat) {
  if (!WALLS3D.postGeo) { WALLS3D.postGeo = new THREE.BoxGeometry(1, 1, 1); WALLS3D.postGeo.translate(0, 0, 0.5); }
  const m = new THREE.InstancedMesh(WALLS3D.postGeo, mat, list.length), a = m.instanceMatrix.array;
  list.forEach(([x, y, h, w = 0.12, hex = WALL_COL.post, z0 = 0], i) => {
    a.set([w, 0, 0, 0, 0, w, 0, 0, 0, 0, h * WALL_HS, 0, x, y, z0 * WALL_HS, 1], i * 16);
    m.setColorAt(i, WALL_TINT.set(hex));
  });
  m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  return m;
}
// the materials, shared by all pieces and cut by the clip planes: walls (vertex colours), posts (coloured per post),
// fence mesh, and the boards and adverts (phase 4, one texture)
function walls3DMaterials() {
  if (!WALLS3D.mats) {
    const clippingPlanes = WALLS3D.clip, side = THREE.DoubleSide;
    WALLS3D.mats = {
      solid: new THREE.MeshLambertMaterial({ vertexColors: true, side, clippingPlanes }),
      post: new THREE.MeshLambertMaterial({ color: new THREE.Color('#ffffff'), clippingPlanes }),
      tex: new THREE.MeshLambertMaterial({ map: sideAtlas().tex, side, clippingPlanes }),
      panel: new THREE.MeshBasicMaterial({ color: new THREE.Color(WALL_COL.mesh), transparent: true, opacity: 0.25, depthWrite: false, side, clippingPlanes })
    };
  }
  return WALLS3D.mats;
}
// the meshes of one piece, added to the walls scene; their matrices are set each frame by walls3DPlace
function walls3DPiece(p) {
  const M = walls3DMaterials(), meshes = [new THREE.Mesh(wallGeometry(p.buf), M.solid)];
  if (p.posts.length) meshes.push(wallPosts(p.posts, M.post));
  if (p.tex.pos.length) meshes.push(new THREE.Mesh(wallGeometry(p.tex), M.tex));
  if (p.panel.pos.length) { const m = new THREE.Mesh(wallGeometry(p.panel), M.panel); m.renderOrder = 1; meshes.push(m); }
  for (const m of meshes) { m.frustumCulled = false; m.matrixAutoUpdate = false; WALLS3D.scene.add(m); }
  return { ox: p.ox, oy: p.oy, box: p.box, meshes };
}
// all barriers of the track (both sides of the wall line and the pit wall) and the trackside objects, in pieces of
// WALL_PIECE track points
function walls3DBuild() {
  const N = T.N, byIdx = new Map();
  const piece = k => {
    const n = Math.floor(k / WALL_PIECE);
    if (!byIdx.has(n)) {
      const m = Math.min(N - 1, n * WALL_PIECE + (WALL_PIECE >> 1));
      byIdx.set(n, { ox: T.X[m], oy: T.Y[m], buf: { pos: [], col: [] }, panel: { pos: [], col: [] }, posts: [], tex: { pos: [], uv: [] }, box: [Infinity, Infinity, -Infinity, -Infinity] });
    }
    return byIdx.get(n);
  };
  for (let s = 0; s < 2; s++) {
    const kind = wallKinds(s), ads = sideAdZones(s), sg = s ? -1 : 1, Wl = T.WALL[s];
    for (let k = 0; k < N; k++) { const j = (k + 1) % N; if (kind[k] && kind[j]) wallSegment(piece(k), kind, k, j, sg, Wl[k], Wl[j], true, ads[k] === 1); }
  }
  // the pit wall beside the flat pit lane (as the flat GEO.pitWall), 0.5 m thick about PIT.wallD, unpainted
  const pk = wallPitKinds(), f = T.PIT.wallD - WALL_TH / 2;
  for (let k = 0; k < N; k++) { const j = (k + 1) % N; if (pk[k] && pk[j]) wallSegment(piece(k), pk, k, j, 1, f, f, false, true); }
  sideBuild(piece); // the trackside objects of phase 4 (trackside3d.js)
  return [...byIdx.values()].map(walls3DPiece);
}
// the pit wall: concrete beside the flat pit lane and 6 m beyond it (as the flat GEO.pitWall)
function wallPitKinds() {
  const N = T.N, PIT = T.PIT, pk = new Uint8Array(N);
  for (let k = 0; k < N; k++) { const sr = T.rel(k * T.DS); if (sr >= PIT.flatIn - 6 && sr <= PIT.flatOut + 6) pk[k] = WALL_KIND.CONCRETE; }
  return pk;
}
// the wall line under the 3D walls only (the gaps of wallKinds left out), for their contact shadow in the ground tiles;
// made once per track
function wallShadowPath() {
  if (WALLS3D.shadow && WALLS3D.shadow.src === T.X) { return WALLS3D.shadow.path; }
  const path = new Path2D();
  for (let s = 0; s < 2; s++) wallShadowSide(path, s);
  WALLS3D.shadow = { src: T.X, path };
  return path;
}
// one side's wall line into path: a segment is drawn where both its points carry a barrier, a new start after a gap
function wallShadowSide(path, s) {
  const N = T.N, kind = wallKinds(s), sg = s ? -1 : 1; let pen = false;
  for (let k = 0; k <= N; k++) {
    const q = k % N, on = kind[q] && kind[(q + 1) % N];
    if (!on && !pen) continue;
    const [x, y] = T.pt(q, sg * T.WALL[s][q]);
    if (pen) path.lineTo(x, y); else path.moveTo(x, y);
    pen = on;
  }
  return path;
}
// the scene, its lights, haze, clip planes and pieces; built again if the track changes
function walls3DInit() {
  if (WALLS3D.ready && WALLS3D.src === T.X) { return; }
  if (WALLS3D.scene) { for (const m of WALLS3D.pieces.flatMap(p => p.meshes).concat(EST.meshes)) { if (m.geometry !== WALLS3D.postGeo) m.geometry.dispose(); } }
  WALLS3D.scene = new THREE.Scene(); WALLS3D.lights = gl3DAddLights(WALLS3D.scene);
  WALLS3D.scene.fog = new THREE.Fog(0xc9d8de, 1, 2);
  if (!WALLS3D.clip.length) WALLS3D.clip.push(new THREE.Plane(), new THREE.Plane(), new THREE.Plane());
  WALLS3D.pieces = walls3DBuild(); estate3DBuild(WALLS3D.scene); WALLS3D.src = T.X; WALLS3D.ready = true; // the estate: phase 3 (estate3d.js)
}
// the camera frame of this frame as an affine map of world metres: origin O (the camera point on the ground) and the
// axes for one metre east, north and up; moved by the camera shake like the ground layers (drawWorldLayer)
function walls3DFrame() {
  const x = CAM.x, y = CAM.y, O = gl3DPlanePoint(x, y, 0), sub = p => p.map((v, i) => v - O[i]);
  const ex = sub(gl3DPlanePoint(x + 1, y, 0)), ey = sub(gl3DPlanePoint(x, y + 1, 0)), ez = sub(gl3DPlanePoint(x, y, 1));
  const [sx, sy] = WALLS3D.shake, a = tiltA();
  O[0] += sx; O[1] += sy * Math.cos(a); O[2] += sy * Math.sin(a);
  return { O, ex, ey, ez };
}
// the matrix of a piece whose geometry is relative to (ox, oy), in the frame F (row-major, for Matrix4.set)
function walls3DMatrix(F, ox, oy) {
  const t = F.O.map((v, i) => v + (ox - CAM.x) * F.ex[i] + (oy - CAM.y) * F.ey[i]);
  return gl3DMatrix({ X: F.ex, Y: F.ey, Z: F.ez, O: t });
}
// a piece is drawn when its box reaches into the ground area: across the ground canvas, from its far edge to a little
// behind the screen's bottom edge (tall things just behind it still show)
function walls3DVisible(p) {
  const [x0, y0, x1, y1] = p.box, yMax = RH + 0.5 * tiltP() / Math.sin(tiltA());
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
    const [cx, cy] = worldToCanvas(x, y); a = Math.min(a, cx); b = Math.min(b, cy); c = Math.max(c, cx); d = Math.max(d, cy);
  }
  return c > -0.2 * RW && a < 1.2 * RW && d > -0.05 * RH && b < yMax;
}
// this frame's matrices and visible pieces, the haze and the cut at the horizon and the ground's sides; returns the
// pieces drawn
function walls3DPlace() {
  walls3DInit();
  const F = walls3DFrame(), a = tiltA(), sa = Math.sin(a), ca = Math.cos(a);
  let n = 0;
  for (const p of WALLS3D.pieces) {
    const on = walls3DVisible(p);
    if (on) { n++; const M = walls3DMatrix(F, p.ox, p.oy); for (const m of p.meshes) { m.matrix.set(...M); m.matrixWorld.copy(m.matrix); } }
    for (const m of p.meshes) m.visible = on;
  }
  // haze as the 2D far band (drawWorldLayer: haze over the top 22 % of the ground canvas); fog depth is -Z = -v sin a
  WALLS3D.scene.fog.near = 0.78 * RH * sa; WALLS3D.scene.fog.far = RH * sa;
  // cut at the horizon line: the plane through the eye (0, 0, P) and the ground's far edge (row -RH), so nothing stands
  // in the sky above the far edge (tall far trees showed there as pale ghosts, GDD 11o phase 3; the tree line covers
  // the cut); and at the ground's sides (|u| <= RW/2)
  const [far, left, right] = WALLS3D.clip, P = tiltP(), ny = RH * sa + P, nz = -RH * ca, nl = Math.hypot(ny, nz);
  far.normal.set(0, ny / nl, nz / nl); far.constant = RH * ca * P / nl;
  left.normal.set(1, 0, 0); left.constant = RW / 2;
  right.normal.set(-1, 0, 0); right.constant = RW / 2;
  estate3DPlace(F); // trees, stands, buildings and the tree line (phase 3)
  sunLightPlace(F, WALLS3D.lights); // the sun fixed in the world (phase 5)
  WALLS3D.drawn = n;
  return n;
}
// draws the walls on the 3D canvas after the ground (into the depth buffer, so the bikes pass behind them)
function walls3DRender(r) {
  const t = performance.now();
  walls3DPlace(); r.localClippingEnabled = true;
  r.render(WALLS3D.scene, GL3D.cam);
  perfAdd('walls', t);
}
