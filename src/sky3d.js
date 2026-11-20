// --- depth of the world (GDD 11o, phase 5): one sun fixed in the world, the shadows of the 3D scenery baked into the
// ground tiles (the sky strip with clouds was taken out again: no sky for now, Petr 2026-11-20). All of it
// stands and falls with the 3D scenery (TILE_WALLS.on3d; test switch 7).
const SKY = { shadows: null, src: null };
// the sun: towards the north-west of the map (-x, -y; the 2D shadows of bikes and trees fall to +x, +y), 40 degrees up
const SUN = { az: Math.atan2(-1, -1), el: 40 * Math.PI / 180 };

// the ground offset of a shadow per metre of height (heights scaled by WALL_HS, as drawn): away from the sun,
// 1 / tan(elevation) = 1.19 times the height
function sunShadowDir() {
  const k = WALL_HS / Math.tan(SUN.el);
  return [-Math.cos(SUN.az) * k, -Math.sin(SUN.az) * k];
}
// the convex hull of points [x, y] (monotone chain), anticlockwise in the y-down map
function sunHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) { return p; }
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => {
    const h = [];
    for (const q of list) {
      while (h.length >= 2 && cross(h.at(-2), h.at(-1), q) <= 0) { h.pop(); }
      h.push(q);
    }
    h.pop();
    return h;
  };
  return half(p).concat(half(p.slice().reverse()));
}
// the shadow of a convex caster (points [x, y, z], z in metres before scaling) on the ground: the hull of the points
// moved along the sun; with grow, each point also spread by that many metres (the soft outer edge)
function sunShadowOf(pts, grow = 0) {
  const [dx, dy] = sunShadowDir(), out = [];
  for (const [x, y, z] of pts) {
    const sx = x + z * dx, sy = y + z * dy;
    if (grow) { for (let k = 0; k < 8; k++) out.push([sx + grow * Math.cos(k * TAU / 8), sy + grow * Math.sin(k * TAU / 8)]); } else out.push([sx, sy]);
  }
  return sunHull(out);
}
// the casters of the stands: the stand's ground plan, 1 m at the front, the roof at 12 m from 2 m behind the front to
// the back (estStand)
function sunStandCasters() {
  return SCN.stands.map(s => {
    const ca = Math.cos(s.a), sa = Math.sin(s.a), f = s.flip, w2 = s.w / 2;
    const P = (lx, q, z) => { const ly = -f * s.h / 2 + f * q; return [s.x + ca * lx - sa * ly, s.y + sa * lx + ca * ly, z]; };
    const out = [];
    for (const x of [-w2, w2]) out.push(P(x, 0, 0), P(x, s.h, 0), P(x, 0, 1), P(x, 2, 12), P(x, s.h, 12));
    return out;
  });
}
// the casters of the paddock buildings (estBuildings: 3.5 m) and of the Wing (estWing: the block from the garage face
// to 34 m behind it, the roof from 11.5 m at the front to 13 m at the back), the Wing in 4 m slices along the pit lane
function sunBuildingCasters() {
  const out = SCN.buildings.map(b => {
    const c = Math.cos(b.a), s = Math.sin(b.a), pts = [];
    for (const [lx, ly] of [[-b.w / 2, -b.h / 2], [b.w / 2, -b.h / 2], [b.w / 2, b.h / 2], [-b.w / 2, b.h / 2]]) { for (const z of [0, 3.5]) pts.push([b.x + c * lx - s * ly, b.y + s * lx + c * ly, z]); }
    return pts;
  });
  const PIT = T.PIT, G = PIT.garage, at = (sr, d, z) => [...T.pt(T.idx(sr), d), z];
  for (let sr = PIT.flatIn - 14; sr < PIT.flatOut + 14; sr += 4) {
    const e = sr + 4;
    out.push([at(sr, G, 0), at(e, G, 0), at(sr, G + 34, 0), at(e, G + 34, 0), at(sr, G + 3, 11.5), at(e, G + 3, 11.5), at(sr, G + 34, 13), at(e, G + 34, 13)]);
  }
  return out;
}
// every shadow of the 3D scenery, worked out once per build of the walls (the casters of trackside3d.js are filled
// while the walls are built): { core, soft, x, y, r } with the centre and radius for the tile test
function sunShadows() {
  if (SKY.shadows && SKY.src === SIDE3D.casts) { return SKY.shadows; }
  const casters = SIDE3D.casts.concat(sunStandCasters(), sunBuildingCasters());
  SKY.shadows = casters.map(pts => {
    const core = sunShadowOf(pts), soft = sunShadowOf(pts, 0.6);
    let x = 0, y = 0; for (const [px, py] of soft) { x += px; y += py; }
    x /= soft.length; y /= soft.length;
    return { core, soft, x, y, r: Math.max(...soft.map(([px, py]) => Math.hypot(px - x, py - y))) };
  });
  SKY.src = SIDE3D.casts;
  return SKY.shadows;
}
// the shadows in view on the ground tile being drawn: all soft outlines as one path (no darker overlaps), then all
// cores; together about 30 % black, as the 2D shadows
function drawSunShadows(vis) {
  const list = sunShadows().filter(s => vis(s.x, s.y, s.r));
  if (!list.length) { return 0; }
  for (const [key, a] of [['soft', 0.12], ['core', 0.2]]) {
    ctx.beginPath();
    for (const s of list) { const p = s[key]; ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) { ctx.lineTo(p[i][0], p[i][1]); } ctx.closePath(); }
    ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fill();
  }
  return list.length;
}
// a tree's shadow on the ground tile (drawTrees, while the 3D scenery stands): the crown's shadow along the sun, 1.19
// times its height away and stretched by its depth, and a thin trunk line to it
function drawTreeShadow(t) {
  const [dx, dy] = sunShadowDir(), H = estTreeHeight(t.r), k = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  const d = 0.62 * H * k, half = Math.hypot(t.r, 0.38 * H * k); // crown centre at 0.62 H, crown 0.38 H deep (estTreeGeometry)
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(ang);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(d - half * 0.6, 0); ctx.stroke();
  ctx.globalAlpha = 0.45; ctx.drawImage(TEX.shadow, d - half * 1.15, -t.r * 1.15, half * 2.3, t.r * 2.3); ctx.globalAlpha = 1;
  ctx.restore();
}

// the lights of the walls scene from the sun fixed in the world (frame F of walls3DFrame): the sun and, opposite it and
// lower, the fill; the bikes keep their own lights (GDD 11o phase 5, question 1)
function sunLightPlace(F, lights) {
  const scale = Math.hypot(...F.ex) / Math.hypot(...F.ez); // the axes are pixels per metre: up as long as east
  const up = F.ez.map(c => c * scale), ax = (az, el) => {
    const h = Math.cos(el), v = F.ex.map((e, i) => (e * Math.cos(az) + F.ey[i] * Math.sin(az)) * h + up[i] * Math.sin(el));
    const n = Math.hypot(...v); return v.map(c => c / n);
  };
  lights.sun.position.set(...ax(SUN.az, SUN.el));
  lights.fill.position.set(...ax(SUN.az + Math.PI, 30 * Math.PI / 180));
  return lights.sun.position;
}
