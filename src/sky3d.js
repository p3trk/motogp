// --- depth of the world (GDD 11o, phase 5): one sun fixed in the world, the shadows of the 3D scenery baked into the
// ground tiles, and the sky strip with drifting clouds, a glow towards the sun and low hills on the horizon. All of it
// stands and falls with the 3D scenery (TILE_WALLS.on3d; test switch 7).
const SKY = { clouds: null, shadows: null, src: null, t: 0 }; // t: the clouds' clock in seconds, running only while the game or the replay runs (skyTick)
// the sun: towards the north-west of the map (-x, -y; the 2D shadows of bikes and trees fall to +x, +y), 40 degrees up
const SUN = { az: Math.atan2(-1, -1), el: 40 * Math.PI / 180 };
const SKY_COL = { glow: '255,236,204', haze: '201,216,222', hills: '#aebfc3', cloud: '255,255,255' };
const SKY_DRIFT = 2 / 600; // clouds: tree-line units (a quarter of the ground width) per second, one cloud strip in 10 minutes

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

// the cloud strip, drawn once: 16 clouds of soft overlapping puffs, wide and flat, on a strip that wraps round
function skyClouds() {
  if (SKY.clouds) { return SKY.clouds; }
  const W = 2048, H = 96, c = mkCanvas(W, H), g = c.getContext('2d'), r = mulberry(17);
  for (let k = 0; k < 16; k++) {
    const cx = (k + 0.3 * r()) * W / 16, cy = 22 + r() * 30, n = 5 + ((r() * 5) | 0);
    for (let j = 0; j < n; j++) {
      const x = cx + (r() - 0.5) * 140, y = cy + (r() - 0.5) * 14, rad = 26 + r() * 30;
      for (const ox of [-W, 0, W]) { // across the seam
        const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, rad);
        gr.addColorStop(0, `rgba(${SKY_COL.cloud},0.4)`); gr.addColorStop(1, `rgba(${SKY_COL.cloud},0)`);
        g.save(); g.translate(x + ox, y); g.scale(1.8, 0.55); g.translate(-x - ox, -y);
        g.fillStyle = gr; g.fillRect(x + ox - rad, y - rad, 2 * rad, 2 * rad); g.restore();
      }
    }
  }
  SKY.clouds = c;
  return c;
}
// the clouds' clock: dt seconds on while the session runs or the replay plays; still while paused, so a paused frame
// does not change
function skyTick(dt) {
  if ((UI.state === 'play' && !W.paused) || (UI.state === 'replay' && RP.playing)) SKY.t += dt;
  return SKY.t;
}
// the horizon coordinate of screen column x, in tree-line units (estLinePlace: the tree line texture repeats 4 times
// across the ground width and moves one ground width per full turn of the camera), so the sky slides with it
function skyU(x, k) { return 4 * ((x - VW / 2) / (k * RW) + 0.5) - 4 * CAM.rot / TAU; }
// the height of the hills in metres at horizon coordinate U: 2.5 to 4.5 m at the far edge (the tree line is 4 m, its
// tops 1 to 3.6 m), the same every full turn
function skyHill(U) {
  const a = U * TAU / 4;
  const n = 0.45 * Math.sin(a + 0.7) + 0.3 * Math.sin(2 * a + 2.1) + 0.2 * Math.sin(5 * a + 0.3) + 0.12 * Math.sin(11 * a + 1.9);
  return 3.5 + n / 1.07;
}
// the screen row of a point h metres up (scaled) on the ground's far edge
function skyRow(h) {
  const a = tiltA(), sa = Math.sin(a), ca = Math.cos(a), P = tiltP(), z = h * WALL_HS * CAM.ppm;
  const Y = -RH * ca - z * sa, Z = -RH * sa + z * ca;
  return VH + Y * P / (P - Z);
}
// the sky strip over the gradient of drawSky, while the 3D scenery stands: the glow towards the sun, the clouds, haze
// near the horizon and the hills; returns the horizon row
function skyDecor(g, uTop) {
  const hz = VH - uTop, sa = Math.sin(tiltA()), P = tiltP(), k = P / (P + RH * sa), RWk = RW * k;
  g.save(); g.beginPath(); g.rect(0, 0, VW, hz + 2); g.clip();
  // glow: the sun's bearing from straight ahead (canvas angle of its direction + 90 degrees), placed as the tree line
  const b = Math.atan2(Math.sin(SUN.az + CAM.rot + Math.PI / 2), Math.cos(SUN.az + CAM.rot + Math.PI / 2)), s = Math.max(0, Math.cos(b));
  if (s > 0.01) {
    const gx = VW / 2 + RWk * b / TAU, gr = g.createRadialGradient(gx, hz, 0, gx, hz, 0.4 * VW);
    gr.addColorStop(0, `rgba(${SKY_COL.glow},${0.5 * s})`); gr.addColorStop(1, `rgba(${SKY_COL.glow},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, VW, hz + 2);
  }
  // clouds: the strip spans 2 tree-line units, slides with the camera's turn and drifts on its own
  const C = skyClouds(), cw = RWk / 2, drift = SKY.t * SKY_DRIFT;
  let x0 = VW / 2 + RWk * ((drift + 4 * CAM.rot / TAU) / 4 - 0.5);
  x0 = ((x0 % cw) + cw) % cw - cw;
  g.globalAlpha = 0.9;
  for (let x = x0; x < VW; x += cw) { g.drawImage(C, x, 0, cw, hz * 0.8); }
  g.globalAlpha = 1;
  const hg = g.createLinearGradient(0, hz * 0.55, 0, hz); // haze near the horizon over the clouds
  hg.addColorStop(0, `rgba(${SKY_COL.haze},0)`); hg.addColorStop(1, `rgba(${SKY_COL.haze},0.9)`);
  g.fillStyle = hg; g.fillRect(0, hz * 0.55, VW, hz * 0.45 + 2);
  // hills behind the tree line, sliding with it
  const m = hz - skyRow(1); g.fillStyle = SKY_COL.hills; g.beginPath(); g.moveTo(0, hz + 2);
  for (let x = 0; x <= VW + 6; x += 6) g.lineTo(x, hz - m * skyHill(skyU(x, k)));
  g.lineTo(VW + 6, hz + 2); g.closePath(); g.fill();
  g.restore();
  return hz;
}
