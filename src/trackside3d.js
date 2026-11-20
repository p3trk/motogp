// --- trackside rhythm in 3D (GDD 11o, phase 4): braking boards, distance posts, marshal posts, advertising on the
// fences, TV camera towers and gantries over the road. Built into the same 250 m pieces as the walls (scenery3d.js):
// solid shapes in the vertex-colour buffer, posts as instances, and the boards and adverts as cards on one texture.
const SIDE3D = { atlas: null };
// made-up brands for the adverts (GDD: fictional only): name, background, lettering
const SIDE_BRANDS = [['KESTRAN', '#0b3d91', '#ffffff'], ['VOLTANO', '#f2c200', '#111111'], ['NOVAPEAK', '#ffffff', '#d1121b'],
  ['ZEFIRA', '#00897b', '#ffffff'], ['RIVALTO', '#c62828', '#ffffff'], ['OKTARA', '#111111', '#ff8f00'],
  ['BRAKEMOR', '#5e35b1', '#ffffff'], ['HELIXON', '#e0e0e0', '#0b3d91']];
const SIDE_COL = { hut: '#eeeeea', roof: '#e8731c', pole: '#d8d8d8', yellow: '#ffd21f', green: '#2ba84a', leg: '#8a8f94',
  deck: '#6d7175', camera: '#1a1a1a', steel: '#2c2f33', lamp: '#a3161a', board: '#9a9c98', white: '#f4f4f2', band: '#151515' };
const SIDE_TOWERS = ['Abbey', 'Village', 'Brooklands', 'Luffield', 'Copse', 'Becketts', 'Chapel', 'Stowe', 'Vale', 'Club'];
const SIDE_BRIDGES = ['Wellington Straight', 'Hangar Straight'];
const SIDE_MARSHAL_STEP = 275; // metres between marshal posts

// the texture of the boards and adverts, drawn once: four braking boards (300, 200, 100, 50) along the top and the
// eight brands below in two columns; uv rectangles [u0, v0, u1, v1] (v = 1 at the top of the image)
function sideAtlas() {
  if (SIDE3D.atlas) { return SIDE3D.atlas; }
  const W = 2048, H = 512, c = mkCanvas(W, H), g = c.getContext('2d'), uv = { board: {}, brand: [] };
  const rect = (x, y, w, h) => [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  [300, 200, 100, 50].forEach((n, i) => {
    const x = i * 256;
    g.fillStyle = '#f7f7f7'; g.fillRect(x, 0, 256, 128); g.strokeStyle = '#1a1a1a'; g.lineWidth = 8; g.strokeRect(x + 4, 4, 248, 120);
    g.fillStyle = '#111'; g.font = '800 92px "Saira Condensed", Arial Narrow, sans-serif'; g.fillText(String(n), x + 128, 68);
    uv.board[n] = rect(x, 0, 256, 128);
  });
  SIDE_BRANDS.forEach(([name, bg, fg], i) => {
    const x = (i % 2) * 1024, y = 128 + Math.floor(i / 2) * 96;
    g.fillStyle = bg; g.fillRect(x, y, 1024, 96); g.fillStyle = fg; g.fillRect(x, y + 84, 1024, 6);
    g.font = 'italic 800 74px "Saira Condensed", Arial Narrow, sans-serif'; g.fillText(name, x + 512, y + 46);
    uv.brand.push(rect(x, y, 1024, 96));
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  SIDE3D.atlas = { canvas: c, tex, uv };
  return SIDE3D.atlas;
}

// a world point (metres) z metres up (scaled) in the piece's own coordinates; grows the piece's box
function sidePt(p, x, y, z) {
  const b = p.box;
  b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  return [x - p.ox, y - p.oy, z * WALL_HS];
}
// the world point d metres out from the centre line at track point q, a metres along the track
function sideAt(q, d, a = 0) { return [T.X[q] + T.NX[q] * d + T.TX[q] * a, T.Y[q] + T.NY[q] * d + T.TY[q] * a]; }
// a box lined up with the track at point q: centre d out and a along, L long (along), w wide (across), from z0 to z1;
// four sides in col and the top in top (no bottom)
function sideBox(p, q, d, a, L, w, z0, z1, col, top = col) {
  const pt = (da, dd, z) => sidePt(p, ...sideAt(q, d + dd, a + da), z), l = L / 2, h = w / 2;
  const c = [[-l, -h], [l, -h], [l, h], [-l, h]];
  for (let i = 0; i < 4; i++) { const [a0, d0] = c[i], [a1, d1] = c[(i + 1) % 4]; wallQuad(p.buf, pt(a0, d0, z0), pt(a1, d1, z0), pt(a1, d1, z1), pt(a0, d0, z1), col); }
  wallQuad(p.buf, pt(-l, -h, z1), pt(l, -h, z1), pt(l, h, z1), pt(-l, h, z1), top);
}
// a textured card a-b-c-d (bottom left, bottom right, top right, top left as seen from the front) showing uv rectangle r
function sideCard(p, a, b, c, d, r) {
  const [u0, v0, u1, v1] = r;
  for (const [q, u, v] of [[a, u0, v0], [b, u1, v0], [c, u1, v1], [a, u0, v0], [c, u1, v1], [d, u0, v1]]) { p.tex.pos.push(...q); p.tex.uv.push(u, v); }
}
// a place where something may stand at track point q, d out, within r metres: grass or behind a wall all round, not
// in the pit compound and not on a grandstand
function sideSpot(q, d, r) {
  const [x, y] = sideAt(q, d);
  for (const [dd, da] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { if (!wallClear(...sideAt(q, d + dd, da))) return false; }
  if (inPitCompound(x, y)) return false;
  return !SCN.stands.some(s => Math.hypot(s.x - x, s.y - y) < s.w / 2 + 6);
}

// the braking boards (T.boards) where the flat ones lie: 2.2 x 1.1 m, 0.4 m up on two legs, facing the oncoming rider
function sideBoards(piece) {
  const uv = sideAtlas().uv.board;
  for (const bd of T.boards) {
    const q = bd.i, e = bd.side > 0 ? T.WR[q] : T.WL[q], d = bd.side * (e + 3.2), p = piece(q);
    for (const s of [-0.8, 0.8]) sideBox(p, q, d + s, 0, 0.08, 0.08, 0, 0.4, SIDE_COL.leg);
    sideBox(p, q, d, 0.05, 0.06, 2.3, 0.4, 1.5, SIDE_COL.board);
    const at = (dd, z) => sidePt(p, ...sideAt(q, d + dd, -0.01), z);
    sideCard(p, at(-1.1, 0.4), at(1.1, 0.4), at(1.1, 1.5), at(-1.1, 1.5), uv[bd.dist]);
  }
}
// the distance posts every 25 m on the straights (GEO.posts, GDD 11h): 1 m white posts with a black band
function sidePosts(piece) {
  for (const q of GEO.posts) {
    const p = piece(q.i), [x, y] = sidePt(p, q.x, q.y, 0);
    p.posts.push([x, y, 1, 0.25, SIDE_COL.white], [x, y, 0.2, 0.27, SIDE_COL.band, 0.6]);
  }
}
// marshal posts every SIDE_MARSHAL_STEP metres on alternating sides, behind the wall: hut, roof, pole and two flags
function sideMarshals(piece) {
  const N = T.N, step = Math.round(SIDE_MARSHAL_STEP / T.DS);
  for (let n = 0; n * step < N; n++) {
    const s = n % 2, sg = s ? -1 : 1;
    const q = [0, 5, -5, 10, -10].map(o => (n * step + o + N) % N).find(k => sideSpot(k, sg * (T.WALL[s][k] + 3), 1.2));
    if (q === undefined) continue;
    const d = sg * (T.WALL[s][q] + 3), p = piece(q);
    sideBox(p, q, d, 0, 1.6, 1.6, 0, 2.4, SIDE_COL.hut);
    sideBox(p, q, d, 0, 1.9, 1.9, 2.4, 2.6, SIDE_COL.roof);
    sideBox(p, q, d - sg * 1.0, 0.8, 0.06, 0.06, 0, 4, SIDE_COL.pole);
    const f = (a, z0, z1, col) => { const at = (aa, z) => sidePt(p, ...sideAt(q, d - sg * 1.0, aa), z); wallQuad(p.buf, at(a, z0), at(a + 0.9, z0), at(a + 0.9, z1), at(a, z1), col); };
    f(0.83, 3.3, 3.9, SIDE_COL.yellow); f(0.83, 2.6, 3.2, SIDE_COL.green);
  }
}
// TV camera towers on the outside of the corners in SIDE_TOWERS: four legs, a deck at 5 m and the camera
function sideTowers(piece) {
  for (const name of SIDE_TOWERS) {
    const c = T.corners.find(k => k.name === name); if (!c) continue;
    const s = T.KS[c.i] > 0 ? 1 : 0, sg = s ? -1 : 1, N = T.N;
    const q = [0, 6, -6, 12, -12].map(o => (c.i + o + N) % N).find(k => sideSpot(k, sg * (T.WALL[s][k] + 4), 1.5));
    if (q === undefined) continue;
    const d = sg * (T.WALL[s][q] + 4), p = piece(q);
    for (const [da, dd] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) sideBox(p, q, d + dd, da, 0.15, 0.15, 0, 5, SIDE_COL.leg);
    sideBox(p, q, d, 0, 2.4, 2.4, 5, 5.2, SIDE_COL.deck);
    sideBox(p, q, d - sg * 0.5, 0, 0.6, 0.4, 5.2, 5.6, SIDE_COL.camera);
  }
}
// a gantry over the road at track point q: pillars at dL and dR (across), a beam from z0 to z1 (metres), L long; with
// lights: five red start lights over the track centre; with brand: advert cards of 6 m on the face towards the rider
function sideGantry(p, q, dL, dR, z0, z1, L, lights, brand) {
  for (const d of [dL, dR]) sideBox(p, q, d, 0, 0.8, 0.8, 0, z1, SIDE_COL.steel);
  const mid = (dL + dR) / 2, span = dR - dL;
  sideBox(p, q, mid, 0, L, span + 0.8, z0, z1, SIDE_COL.steel);
  if (lights) { for (let k = -2; k <= 2; k++) sideBox(p, q, k * 1.2, 0, 0.3, 0.6, z0 - 0.7, z0 - 0.05, SIDE_COL.lamp); }
  if (brand === undefined) { return; }
  const uv = sideAtlas().uv.brand, n = Math.floor(span / 6), at = (dd, z) => sidePt(p, ...sideAt(q, dd, -L / 2 - 0.03), z);
  for (let k = 0; k < n; k++) {
    const d0 = mid - n * 3 + k * 6;
    sideCard(p, at(d0, z0 + 0.15), at(d0 + 6, z0 + 0.15), at(d0 + 6, z1 - 0.15), at(d0, z1 - 0.15), uv[(brand + k) % uv.length]);
  }
}
// the start gantry over the grid (left wall to the pit wall) and the sponsor bridges on SIDE_BRIDGES
function sideGantries(piece) {
  sideGantry(piece(0), 0, -(T.WALL[1][0] + 1.0), T.PIT.wallD, 7, 8, 1.2, true);
  SIDE_BRIDGES.forEach((name, i) => {
    const c = T.corners.find(k => k.name === name); if (!c) return;
    const q = T.idx(c.s + 60);
    sideGantry(piece(q), q, -(T.WALL[1][q] + 1.2), T.WALL[0][q] + 1.2, 7, 9.2, 3, false, i * 3);
  });
}
// where the fences carry adverts on side s: the outside of every corner, 50 track points (100 m) either side, and both
// sides of the start/finish straight (250 m either side of the line)
function sideAdZones(s) {
  const N = T.N, z = new Uint8Array(N);
  for (const c of T.corners) {
    if (/Straight/.test(c.name) || (T.KS[c.i] > 0 ? 1 : 0) !== s) continue;
    for (let o = -50; o <= 50; o++) z[(c.i + o + N) % N] = 1;
  }
  for (let k = 0; k < N; k++) { if (Math.abs(T.rel(k * T.DS)) < 250) z[k] = 1; }
  return z;
}
// an advert on the track face of a fence from track point k to j (distance fk, fj; side sign sg), 1.0 to 1.9 m up:
// panels of three segments (about 6 m), the brands in turn, lettering reading left to right from the track
function wallAd(p, at, k, j, fk, fj, sg) {
  const r = sideAtlas().uv.brand[Math.floor(k / 3) % SIDE_BRANDS.length], part = k % 3, w = r[2] - r[0];
  const u = f => r[0] + w * (sg > 0 ? 1 - f : f), ua = u(part / 3), ub = u((part + 1) / 3);
  const lo = Math.min(ua, ub), hi = Math.max(ua, ub), flip = ua > ub;
  const A = at(k, fk, 1.0), B = at(j, fj, 1.0), C = at(j, fj, 1.9), D = at(k, fk, 1.9);
  if (flip) sideCard(p, B, A, D, C, [lo, r[1], hi, r[3]]); else sideCard(p, A, B, C, D, [lo, r[1], hi, r[3]]);
}
// everything of phase 4, into the pieces of walls3DBuild
function sideBuild(piece) {
  sideBoards(piece); sidePosts(piece); sideMarshals(piece); sideTowers(piece); sideGantries(piece);
}
