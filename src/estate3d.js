// --- the estate in 3D (GDD 11o, phase 3): the trees, grandstands, the Wing and the paddock buildings laid out in SCN
// (render.js buildScenery) stand up. Built once in world metres into the walls
// scene (same lights, haze and clip planes, scenery3d.js); one matrix a frame for all of it.
const EST = { meshes: [], cells: [], crowd: null, drawn: 0 };
const EST_CELL = 300; // metres: the estate is cut into square cells, and only the cells in view are drawn
const EST_COL = { trunk: '#5b4632', leaf: ['#3f7a35', '#4c8a3c', '#2f5f34', '#46803a'], conc: '#b9bcbf', back: '#eef0f2',
  roof: '#d7dbe0', edge: '#1d4fd6', garage: '#3b4148', office: '#5b7a99', wingRoof: '#e8ebee', wingEdge: '#3c6ea0',
  unit: '#e9ecef', unitRoof: '#c9cdd1' };
const EST_TREE_KIND = [0, 1, 2, 3, 0]; // tree variant (SCN.trees v, 0..4) -> round, wide, conifer, poplar

// one triangle a-b-c in one colour into a quad buffer ({ pos, col }, as wallQuad)
function estTri(buf, a, b, c, hex) {
  const rgb = wallRGB(hex);
  for (const p of [a, b, c]) { buf.pos.push(p[0], p[1], p[2]); buf.col.push(rgb[0], rgb[1], rgb[2]); }
}
// a faceted ball (icosahedron, 20 faces) centred at (cx, cy, cz) with radii rx (across) and rz (up)
function estBall(buf, cx, cy, cz, rx, rz, hex) {
  const f = (1 + Math.sqrt(5)) / 2, n = Math.hypot(1, f);
  const V = [[-1, f, 0], [1, f, 0], [-1, -f, 0], [1, -f, 0], [0, -1, f], [0, 1, f], [0, -1, -f], [0, 1, -f], [f, 0, -1], [f, 0, 1], [-f, 0, -1], [-f, 0, 1]]
    .map(([x, y, z]) => [cx + x / n * rx, cy + z / n * rx, cz + y / n * rz]);
  const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (const [a, b, c] of F) estTri(buf, V[a], V[b], V[c], hex);
}
// a cone (8 sides) from radius r at z0 to a point at z1, centred on the z axis
function estCone(buf, r, z0, z1, hex) {
  for (let k = 0; k < 8; k++) {
    const a0 = k / 8 * TAU, a1 = (k + 1) / 8 * TAU;
    estTri(buf, [r * Math.cos(a0), r * Math.sin(a0), z0], [r * Math.cos(a1), r * Math.sin(a1), z0], [0, 0, z1], hex);
  }
}
// a box from (x0, y0, z0) to (x1, y1, z1) along the axes: four sides and the top (no bottom)
function estAxisBox(buf, x0, y0, z0, x1, y1, z1, hex, top = hex) {
  const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (let i = 0; i < 4; i++) { const [a, b] = [c[i], c[(i + 1) % 4]]; wallQuad(buf, [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], hex); }
  wallQuad(buf, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], top);
}
// the four tree shapes, for a crown radius of 1 and a height of 1 (the instance scales them): trunk and crown
function estTreeGeometry(kind) {
  const buf = { pos: [], col: [] }, L = EST_COL.leaf[kind], tw = 0.08;
  if (kind === 2) { // conifer: three stacked cones
    estAxisBox(buf, -tw, -tw, 0, tw, tw, 0.2, EST_COL.trunk);
    estCone(buf, 1, 0.15, 0.55, L); estCone(buf, 0.75, 0.4, 0.8, L); estCone(buf, 0.5, 0.62, 1, L);
  } else if (kind === 1) { // wide broadleaf: two overlapping balls
    estAxisBox(buf, -tw, -tw, 0, tw, tw, 0.45, EST_COL.trunk);
    estBall(buf, -0.3, 0.08, 0.6, 0.68, 0.34, L); estBall(buf, 0.32, -0.1, 0.66, 0.64, 0.32, L);
  } else if (kind === 3) { // poplar: tall narrow crown
    estAxisBox(buf, -tw, -tw, 0, tw, tw, 0.25, EST_COL.trunk);
    estBall(buf, 0, 0, 0.6, 0.55, 0.4, L);
  } else { // round broadleaf
    estAxisBox(buf, -tw, -tw, 0, tw, tw, 0.45, EST_COL.trunk);
    estBall(buf, 0, 0, 0.62, 1, 0.38, L);
  }
  return wallGeometry(buf);
}
// a tree's height in metres from its crown radius: 1.6 r + 2 (6 to 14 m for r 2.5 to 7.5)
function estTreeHeight(r) { return 1.6 * r + 2; }
// a tree that would touch a phase 4 object (marshal post, camera tower, gantry pillar: SIDE3D.spots)
function estTreeBlocked(t) { return SIDE3D.spots.some(([x, y, r]) => Math.hypot(t.x - x, t.y - y) < t.r + r); }
// the trees in the list as one instanced mesh per kind present, turned and sized per tree, leaf shade varied per tree
function estTrees(mat, trees) {
  const byKind = [[], [], [], []];
  for (const t of trees) byKind[EST_TREE_KIND[t.v] ?? 0].push(t);
  if (!EST.treeGeo) EST.treeGeo = [0, 1, 2, 3].map(estTreeGeometry);
  const r = mulberry(7), tint = new THREE.Color(), out = [];
  byKind.forEach((list, kind) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(EST.treeGeo[kind], mat, list.length), a = m.instanceMatrix.array;
    list.forEach((t, i) => {
      const c = Math.cos(t.rot) * t.r, s = Math.sin(t.rot) * t.r, h = estTreeHeight(t.r) * WALL_HS;
      a.set([c, s, 0, 0, -s, c, 0, 0, 0, 0, h, 0, t.x, t.y, 0, 1], i * 16);
      const k = 0.85 + 0.25 * r(); m.setColorAt(i, tint.setRGB(k, k, k));
    });
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    out.push(m);
  });
  return out;
}

// the crowd on the stands: coloured dots on dark seats, 4 m of stand per repeat, drawn once
function estCrowd() {
  if (EST.crowd) { return EST.crowd; }
  const c = mkCanvas(256, 64), g = c.getContext('2d'), r = mulberry(5);
  g.fillStyle = '#2a2e35'; g.fillRect(0, 0, 256, 64);
  const cols = ['#f2f0ec', '#d42a24', '#1d4fd6', '#f2c200', '#2ba84a', '#e8731c', '#111', '#8a5a3c', '#c9a27e'];
  for (let k = 0; k < 900; k++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect((r() * 256) | 0, (r() * 64) | 0, 4, 5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  EST.crowd = t;
  return t;
}
// one grandstand of SCN.stands: 8 tiers rising from 1 m at the front (track side) to 8 m, the crowd on the treads and
// risers (crowd buffer, u in 4 m repeats), concrete ends, a white back wall, a walkway, and a roof on pillars at 12 m
function estStand(solid, crowd, s) {
  const ca = Math.cos(s.a), sa = Math.sin(s.a), f = s.flip;
  const P = (lx, ly, z) => [s.x + ca * lx - sa * ly, s.y + sa * lx + ca * ly, z * WALL_HS];
  const dy = q => -f * s.h / 2 + f * q, w2 = s.w / 2, deep = s.h - 4, n = 8, rep = s.w / 4; // q: depth from the front
  const card = (a, b, c, d) => { for (const [p, u, v] of [[a, 0, 0], [b, rep, 0], [c, rep, 1], [a, 0, 0], [c, rep, 1], [d, 0, 1]]) { crowd.pos.push(...p); crowd.uv.push(u, v); } };
  for (let k = 0; k < n; k++) {
    const q0 = deep * k / n, q1 = deep * (k + 1) / n, z0 = k ? 1 + 7 * k / n : 0, z1 = 1 + 7 * (k + 1) / n;
    card(P(-w2, dy(q0), z0), P(w2, dy(q0), z0), P(w2, dy(q0), z1), P(-w2, dy(q0), z1)); // riser
    card(P(-w2, dy(q0), z1), P(w2, dy(q0), z1), P(w2, dy(q1), z1), P(-w2, dy(q1), z1)); // tread
    for (const x of [-w2, w2]) wallQuad(solid, P(x, dy(q0), 0), P(x, dy(q1), 0), P(x, dy(q1), z1), P(x, dy(q0), z1), EST_COL.conc);
  }
  wallQuad(solid, P(-w2, dy(deep), 8), P(w2, dy(deep), 8), P(w2, dy(s.h), 8), P(-w2, dy(s.h), 8), EST_COL.roof); // walkway
  for (const x of [-w2, w2]) wallQuad(solid, P(x, dy(deep), 0), P(x, dy(s.h), 0), P(x, dy(s.h), 8), P(x, dy(deep), 8), EST_COL.conc);
  wallQuad(solid, P(-w2, dy(s.h), 0), P(w2, dy(s.h), 0), P(w2, dy(s.h), 12), P(-w2, dy(s.h), 12), EST_COL.back); // back wall up to the roof
  wallQuad(solid, P(-w2, dy(2), 12), P(w2, dy(2), 12), P(w2, dy(s.h), 12), P(-w2, dy(s.h), 12), EST_COL.roof); // roof
  wallQuad(solid, P(-w2, dy(2), 11.4), P(w2, dy(2), 11.4), P(w2, dy(2), 12), P(-w2, dy(2), 12), EST_COL.edge); // its front edge
  for (let x = -w2; x <= w2 + 0.1; x += s.w / Math.max(1, Math.round(s.w / 20))) { // pillars at the front of the roof, on the top tier
    const a = P(x - 0.2, dy(deep - 0.6), 8), b = P(x + 0.2, dy(deep - 0.6), 8), c = P(x + 0.2, dy(deep - 0.6), 12), d = P(x - 0.2, dy(deep - 0.6), 12);
    wallQuad(solid, a, b, c, d, EST_COL.roof);
  }
}
// a box turned by angle a about its centre (cx, cy): L long, W wide, z0 to z1; sides in col, top in top
function estBox(buf, cx, cy, a, L, W, z0, z1, col, top) {
  const c = Math.cos(a), s = Math.sin(a), P = (lx, ly, z) => [cx + c * lx - s * ly, cy + s * lx + c * ly, z * WALL_HS];
  const q = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];
  for (let i = 0; i < 4; i++) { const p0 = q[i], p1 = q[(i + 1) % 4]; wallQuad(buf, P(...p0, z0), P(...p1, z0), P(...p1, z1), P(...p0, z1), col); }
  wallQuad(buf, P(...q[0], z1), P(...q[1], z1), P(...q[2], z1), P(...q[3], z1), top);
}
// the paddock buildings in the list (all of SCN.buildings by default): white, 3.5 m high, with the team colour band under the roof
function estBuildings(solid, list = SCN.buildings) {
  for (const b of list) {
    estBox(solid, b.x, b.y, b.a, b.w, b.h, 0, 2.9, EST_COL.unit, EST_COL.unitRoof);
    estBox(solid, b.x, b.y, b.a, b.w + 0.02, b.h + 0.02, 2.9, 3.5, b.col, EST_COL.unitRoof);
  }
}
// the Wing along the flat pit lane: the garage block (6 m, with the 22 garage doors in team colours, 4 m high), the
// office block behind it (11 m, glass front) and the white roof rising from 11.5 to 13 m, with a blue front edge
function estWing(solid) {
  const PIT = T.PIT, G = PIT.garage, sa = PIT.flatIn - 8, sb = PIT.flatOut + 8;
  const at = (sr, d, z) => [...T.pt(T.idx(sr), d), z * WALL_HS];
  const run = (d0, d1, z0, z1, front, top) => {
    for (let sr = sa; sr < sb; sr += 4) {
      const e = Math.min(sb, sr + 4);
      wallQuad(solid, at(sr, d0, z0), at(e, d0, z0), at(e, d0, z1), at(sr, d0, z1), front);
      wallQuad(solid, at(sr, d0, z1), at(e, d0, z1), at(e, d1, z1), at(sr, d1, z1), top);
      wallQuad(solid, at(sr, d1, 0), at(e, d1, 0), at(e, d1, z1), at(sr, d1, z1), EST_COL.garage);
    }
    for (const sr of [sa, sb]) wallQuad(solid, at(sr, d0, 0), at(sr, d1, 0), at(sr, d1, z1), at(sr, d0, z1), EST_COL.garage);
  };
  run(G, G + 16, 0, 6, EST_COL.garage, EST_COL.conc);
  run(G + 16, G + 34, 6, 11, EST_COL.office, EST_COL.conc);
  for (let k = 0; k < 22; k++) { // the doors, just in front of the garage face
    const sr = PIT.boxS(k), d0 = sr - PIT.boxGap / 2 + 1, d1 = sr + PIT.boxGap / 2 - 1, col = TEAMS[(k >> 1) % TEAMS.length].c1;
    wallQuad(solid, at(d0, G - 0.05, 0), at(d1, G - 0.05, 0), at(d1, G - 0.05, 4), at(d0, G - 0.05, 4), col);
  }
  for (let sr = sa - 6; sr < sb + 6; sr += 4) { // the roof slab and its front edge
    const e = sr + 4;
    wallQuad(solid, at(sr, G + 3, 11.5), at(e, G + 3, 11.5), at(e, G + 34, 13), at(sr, G + 34, 13), EST_COL.wingRoof);
    wallQuad(solid, at(sr, G + 3, 11.1), at(e, G + 3, 11.1), at(e, G + 3, 11.5), at(sr, G + 3, 11.5), EST_COL.wingEdge);
  }
}
// the cell of a ground point (cells of EST_CELL metres)
function estCellOf(x, y) { return Math.floor(x / EST_CELL) + ',' + Math.floor(y / EST_CELL); }
// the ground box [x0, y0, x1, y1] of a cell's meshes: their vertices, and the tree feet with their crowns
function estCellBox(meshes) {
  const b = [Infinity, Infinity, -Infinity, -Infinity], add = (x, y, r) => { b[0] = Math.min(b[0], x - r); b[1] = Math.min(b[1], y - r); b[2] = Math.max(b[2], x + r); b[3] = Math.max(b[3], y + r); };
  for (const m of meshes) {
    if (m.isInstancedMesh) { const e = m.instanceMatrix.array; for (let i = 0; i < m.count; i++) { add(e[i * 16 + 12], e[i * 16 + 13], 8); } continue; }
    const p = m.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 3) { add(p[i], p[i + 1], 0); }
  }
  return b;
}
// the meshes of one cell (trees, solid shapes, crowd) and their box
function estCell(c, M) {
  const meshes = estTrees(M.tree, c.trees);
  if (c.solid.pos.length) meshes.push(new THREE.Mesh(wallGeometry(c.solid), M.solid));
  if (c.crowd.pos.length) meshes.push(new THREE.Mesh(wallGeometry(c.crowd), M.crowd));
  return { box: estCellBox(meshes), meshes };
}
// everything of phase 3 into the walls scene, cell by cell: trees, stands, buildings and the Wing in world metres
// (placed each frame by estate3DPlace with one matrix, cells out of view hidden)
function estate3DBuild(scene) {
  const M = walls3DMaterials(), cells = new Map(), PIT = T.PIT;
  if (!M.tree) { M.tree = walls3DFog(new THREE.MeshLambertMaterial({ vertexColors: true, clippingPlanes: WALLS3D.clip })); M.crowd = walls3DFog(new THREE.MeshLambertMaterial({ map: estCrowd(), side: THREE.DoubleSide, clippingPlanes: WALLS3D.clip })); }
  const cell = (x, y) => {
    const k = estCellOf(x, y);
    if (!cells.has(k)) cells.set(k, { trees: [], solid: { pos: [], col: [] }, crowd: { pos: [], uv: [] } });
    return cells.get(k);
  };
  for (const t of SCN.trees) { t.gone3d = estTreeBlocked(t); if (!t.gone3d) cell(t.x, t.y).trees.push(t); } // gone3d: no tree, no shadow
  for (const s of SCN.stands) { const c = cell(s.x, s.y); estStand(c.solid, c.crowd, s); }
  for (const b of SCN.buildings) estBuildings(cell(b.x, b.y).solid, [b]);
  const mid = T.idx((PIT.flatIn + PIT.flatOut) / 2); estWing(cell(T.X[mid], T.Y[mid]).solid);
  EST.cells = [...cells.values()].map(c => estCell(c, M));
  EST.meshes = EST.cells.flatMap(c => c.meshes);
  for (const m of EST.meshes) { m.frustumCulled = false; m.matrixAutoUpdate = false; scene.add(m); }
  return EST.meshes;
}
// this frame's place of the estate (frame F of walls3DFrame)
// (only the cells in view are shown); returns the cells drawn
function estate3DPlace(F) {
  const M = walls3DMatrix(F, 0, 0);
  let n = 0;
  for (const c of EST.cells) {
    const on = walls3DVisible(c); if (on) n++;
    for (const m of c.meshes) { m.visible = on; if (on) { m.matrix.set(...M); m.matrixWorld.copy(m.matrix); } }
  }
  EST.drawn = n;
  return n;
}
