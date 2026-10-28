
// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const FD = '"Saira Condensed", "Arial Narrow", sans-serif';
const HUD = {
  m: null, tick: [], shake: 0, secFlash: [], lapFlash: null, mini: null,
  reset() { this.m = null; this.tick = []; this.secFlash = []; this.lapFlash = null; this.shake = 0; },
  msg(t, sub, col, dur) { this.m = { t, sub, col, dur, age: 0 }; },
  ticker(t) { this.tick.unshift({ t, age: 0 }); this.tick = this.tick.slice(0, 3); },
  sector(k, t, best) { this.secFlash[k] = { t, best, age: 0, pb: !best || t < best }; },
  lap(t, pb, rec) { this.lapFlash = { t, pb, rec, age: 0 }; },
  step(dt) {
    if (this.m) { this.m.age += dt; if (this.m.age > this.m.dur) this.m = null; }
    for (const q of this.tick) q.age += dt; this.tick = this.tick.filter(q => q.age < 6);
    if (this.lapFlash) { this.lapFlash.age += dt; if (this.lapFlash.age > 5) this.lapFlash = null; }
    this.shake = Math.max(0, this.shake - dt * 3);
  }
};
function panel(x, y, w, h, a) { ctx.fillStyle = `rgba(9,13,16,${a ?? 0.8})`; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 6) : ctx.rect(x, y, w, h); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.stroke(); }
function txt(s, x, y, size, col, weight, align, italic) { ctx.font = `${italic ? 'italic ' : ''}${weight || 700} ${size}px ${FD}`; ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.fillText(s, x, y); }
function buildMinimap() {
  const S = 190, bb = T.bbox, w = bb.maxx - bb.minx, h = bb.maxy - bb.miny, sc = (S - 20) / Math.max(w, h);
  const c = mkCanvas(S * 2, S * 2), g = c.getContext('2d'); g.scale(2, 2);
  const tf = (x, y) => [10 + (x - bb.minx) * sc + (S - 20 - w * sc) / 2, 10 + (y - bb.miny) * sc + (S - 20 - h * sc) / 2];
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 7; g.beginPath(); for (let i = 0; i <= T.N; i++) { const k = i % T.N; const [x, y] = tf(T.X[k], T.Y[k]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.strokeStyle = '#e9edf0'; g.lineWidth = 3.2; g.stroke();
  g.strokeStyle = 'rgba(255,207,31,.8)'; g.lineWidth = 1.6; g.beginPath(); let f = true; for (let sr = T.PIT.sIn; sr <= T.PIT.sOut; sr += 4) { const k = T.idx(sr); const [x, y] = tf(...T.pt(k, T.PIT.center(sr) * 0.6)); f ? g.moveTo(x, y) : g.lineTo(x, y); f = false; } g.stroke();
  const [sx, sy] = tf(T.X[0], T.Y[0]); g.fillStyle = '#111'; g.fillRect(sx - 4, sy - 4, 8, 8); g.fillStyle = '#fff'; g.fillRect(sx - 4, sy - 4, 4, 4); g.fillRect(sx, sy, 4, 4);
  HUD.mini = { c, S, tf };
}
function drawHUD(dt) {
  const b = W.player; if (!b) return;
  const L = Math.max(16, 0) + 0, PAD = 16;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textBaseline = 'alphabetic';
  const small = VW < 760;
  // ---- dashboard (bottom-left)
  const dw = small ? 270 : 330, dh = 138, dx = PAD, dy = VH - dh - PAD;
  panel(dx, dy, dw, dh);
  const rpm = b.rpmVis, segs = 26, sw = (dw - 28) / segs;
  const shiftNow = rpm > 17300;
  for (let k = 0; k < segs; k++) {
    const th = 4000 + k * (14000 / segs); const on = rpm >= th;
    let col = k < segs * 0.6 ? '#3ad17a' : k < segs * 0.82 ? '#ffcf1f' : '#e3312a';
    if (shiftNow && (performance.now() / 70 | 0) % 2) col = '#4cc3ff';
    ctx.fillStyle = on ? col : 'rgba(255,255,255,.08)'; ctx.fillRect(dx + 14 + k * sw, dy + 12, sw - 2, 10);
  }
  txt(String(Math.round(b.v * 3.6)), dx + 16, dy + 86, 62, '#fff', 800, 'left', true);
  txt('KM/H', dx + 18, dy + 104, 13, '#8d9aa4', 600);
  const gx = dx + dw - 104;
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(gx, dy + 32, 60, 74);
  txt(String(b.gear), gx + 30, dy + 92, 66, b.overrev > 0 ? '#e3312a' : (b.shiftFlash > 0 ? '#ffffff' : '#ffcf1f'), 800, 'center', true);
  txt(b.auto ? 'AUTO' : 'GEAR', gx + 30, dy + 120, 12, '#8d9aa4', 600, 'center');
  // throttle / brake bars
  const bx = dx + dw - 32; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(bx, dy + 32, 7, 82); ctx.fillRect(bx + 11, dy + 32, 7, 82);
  ctx.fillStyle = '#3ad17a'; ctx.fillRect(bx, dy + 32 + 82 * (1 - b.ctl.thr), 7, 82 * b.ctl.thr);
  ctx.fillStyle = '#e3312a'; ctx.fillRect(bx + 11, dy + 32 + 82 * (1 - b.ctl.brk), 7, 82 * b.ctl.brk);
  // lean gauge
  const ld = Math.round(Math.abs(b.lean) / DEG);
  const lx = dx + (small ? 120 : 150), ly = dy + 110, lr = 26;
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(lx, ly, lr, Math.PI, TAU); ctx.stroke();
  ctx.strokeStyle = b.slip > 0.05 ? '#e3312a' : ld > 55 ? '#ffcf1f' : '#e9edf0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.sin(b.lean) * lr, ly - Math.cos(b.lean) * lr); ctx.stroke();
  txt(ld + '°', lx, ly + 2 - 30 - 4, 15, '#e9edf0', 700, 'center');
  txt('LEAN', lx + lr + 8, ly, 11, '#8d9aa4', 600);
  if (b.slip > 0.08) txt('SLIDE', lx, ly + 18, 13, '#e3312a', 800, 'center');
  // ---- right status panel: fuel / damage / aids
  const tiny = VW < 640;
  const rw = small ? 200 : 236, rh = 138, rx = tiny ? PAD : VW - rw - PAD, ry = tiny ? dy - rh - 8 : VH - rh - PAD;
  panel(rx, ry, rw, rh);
  txt('FUEL', rx + 14, ry + 24, 13, '#8d9aa4', 600);
  const fr = b.fuel / PHYS.tank; const lapsLeft = b.fuel / Math.max(1, b.fuelPerLap);
  const need = W.mode === 'race' ? Math.max(0, (W.totalLaps - b.lap) - (b.s / T.L)) : 0;
  const fcol = W.mode === 'race' && lapsLeft < need && lapsLeft < 1.3 ? '#e3312a' : lapsLeft < 1.2 ? '#ffcf1f' : '#3ad17a';
  txt(b.fuel.toFixed(1) + ' L', rx + rw - 14, ry + 24, 17, '#fff', 700, 'right');
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(rx + 14, ry + 32, rw - 28, 8); ctx.fillStyle = fcol; ctx.fillRect(rx + 14, ry + 32, (rw - 28) * fr, 8);
  if (W.mode === 'race' && need > 0) { const nx = rx + 14 + (rw - 28) * Math.min(1, need * b.fuelPerLap / PHYS.tank); ctx.fillStyle = '#fff'; ctx.fillRect(nx - 1, ry + 29, 2, 14); }
  txt('≈ ' + lapsLeft.toFixed(1) + ' laps' + (W.mode === 'race' ? ' · need ' + need.toFixed(1) : ''), rx + 14, ry + 58, 13, '#c9d2d8', 600);
  const dm = [['ENGINE', b.dmg.e], ['AERO', b.dmg.a], ['CHASSIS', b.dmg.c]];
  dm.forEach(([n, v], k) => { const y = ry + 80 + k * 17; txt(n, rx + 14, y + 4, 11, '#8d9aa4', 600); const x0 = rx + 76, ww = rw - 90; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x0, y - 4, ww, 7); ctx.fillStyle = v > 0.6 ? '#e3312a' : v > 0.25 ? '#ffcf1f' : '#3ad17a'; ctx.fillRect(x0, y - 4, ww * Math.max(0.02, 1 - v), 7); });
  const tags = []; if (b.limiter) tags.push(['PIT LIMITER', '#ffcf1f']); if (b.draft > 0.25) tags.push(['SLIPSTREAM', '#4cc3ff']); if (b.dist < 2500 && W.phase === 'run') tags.push(['COLD TYRES', '#4cc3ff']); if (b.fuel <= 0) tags.push(['NO FUEL', '#e3312a']); if (b.overrev > 0) tags.push(['OVER-REV BLOCKED', '#e3312a']);
  tags.forEach(([t, c], k) => { ctx.font = `800 13px ${FD}`; const tw = ctx.measureText(t).width + 14; const x = rx + rw - tw - 0 - k * 0; const y = ry - 26 - k * 24; ctx.fillStyle = c; ctx.fillRect(rx + rw - tw, y, tw, 20); txt(t, rx + rw - 7, y + 15, 13, '#111', 800, 'right'); });
  // ---- top centre: lap / position / timing
  const cw = small ? 300 : 380, cx = VW / 2 - cw / 2, cy = PAD;
  panel(cx, cy, cw, 80);
  const st = standings(); const pos = st.indexOf(b) + 1;
  if (W.mode === 'race') {
    txt('P' + pos, cx + 16, cy + 50, 46, '#ffcf1f', 800, 'left', true);
    txt('/' + st.length, cx + 16 + ctx.measureText('P' + pos).width + 4, cy + 50, 18, '#8d9aa4', 700);
    txt('LAP', cx + cw - 16, cy + 22, 12, '#8d9aa4', 600, 'right');
    txt(Math.min(W.totalLaps, b.lap + 1) + '/' + W.totalLaps, cx + cw - 16, cy + 52, 30, '#fff', 800, 'right', true);
  } else {
    txt(W.mode === 'quali' ? 'QUALIFYING' : W.train ? 'CURVE TRAINING' : 'PRACTICE', cx + 16, cy + 26, 15, '#ffcf1f', 800, 'left', true);
    txt(b.outLap ? 'OUT LAP' : 'LAP ' + (b.laps.length + 1) + (W.mode === 'quali' ? '/3' : ''), cx + 16, cy + 54, 26, '#fff', 800, 'left', true);
  }
  const cur = (b.outLap || (W.mode === 'race' && W.phase !== 'run')) ? 0 : W.time - b.lapStartT;
  const tx = cx + cw / 2 + (W.mode === 'race' ? -10 : 30);
  txt(b.outLap ? '–:––.–––' : fmtTime(cur), tx, cy + 36, 26, '#fff', 700, 'center');
  // live delta to best lap
  if (W.bestTrace && !b.outLap) { const bin = Math.floor(b.s / 10); const bt = W.bestTrace[bin], ct = W.curTrace[bin]; if (bt > 0 && ct > 0) { const dlt = ct - bt; txt((dlt >= 0 ? '+' : '−') + Math.abs(dlt).toFixed(2), tx, cy + 58, 16, dlt <= 0 ? '#3ad17a' : '#e3312a', 800, 'center'); } }
  txt('LAST ' + (b.lastLap ? fmtTime(b.lastLap) : '–') + '   BEST ' + (b.bestLap ? fmtTime(b.bestLap) : '–') + (Records.d.traceT ? '   PB ' + fmtTime(Records.d.traceT) : ''), tx, cy + 74, 12, '#8d9aa4', 600, 'center');
  // sector strip
  for (let k = 0; k < 3; k++) { const f = HUD.secFlash[k]; const sx = cx + 8 + k * (cw - 16) / 3; ctx.fillStyle = f && (b.cp > k || HUD.lapFlash) ? (f.pb ? '#b46bff' : '#ffcf1f') : 'rgba(255,255,255,.1)'; if (f && f.pb && f.best && f.t < f.best) ctx.fillStyle = '#b46bff'; else if (f && f.best && f.t >= f.best) ctx.fillStyle = '#ffcf1f'; else if (f && !f.best) ctx.fillStyle = '#3ad17a'; if (!f || (b.cp <= k && !(k === 2 && HUD.lapFlash))) ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(sx, cy + 84, (cw - 16) / 3 - 4, 4); }
  // corner name
  const showGuide = W.guide && !b.crashed && !b.inPitLane; let gOff = showGuide ? 62 : 0;
  if (showGuide) drawGuide(b, cx, cy + 96, cw);
  const cz = !b.crashed && !b.inPitLane ? cornerAhead(b) : null;
  if (cz) { drawCountdown(b, cz, VW / 2 - 125, cy + 96 + gOff, 250); gOff += 52; }
  txt(T.cornerAt(b.s).toUpperCase(), VW / 2, cy + 108 + gOff, 14, 'rgba(255,255,255,.75)', 700, 'center', true);
  // race gaps ahead / behind
  if (W.mode === 'race' && W.phase === 'run') {
    const ahead = st[pos - 2], behind = st[pos];
    const g0 = gapOf(b);
    if (ahead && !ahead.dnf) txt('▲ ' + ahead.short + ' ' + Math.max(0, g0 - gapOf(ahead)).toFixed(3), VW / 2 - 70, cy + 128 + gOff, 13, '#c9d2d8', 600, 'center');
    if (behind && !behind.dnf && !b.finished) txt('▼ ' + behind.short + ' ' + Math.max(0, gapOf(behind) - g0).toFixed(3), VW / 2 + 70, cy + 128 + gOff, 13, '#c9d2d8', 600, 'center');
  }
  // ---- timing tower (left)
  if (!tiny) { drawTower(st, b); drawMinimap(b); }
  // ---- start lights
  if (W.mode === 'race' && (W.phase === 'lights' || W.phase === 'grid')) {
    const lw = 5 * 46 + 20, lx0 = VW / 2 - lw / 2, ly0 = 170;
    panel(lx0, ly0, lw, 66, 0.9);
    for (let k = 0; k < 5; k++) { const on = W.phase === 'lights' && W.lights > k; ctx.fillStyle = on ? '#ff2a1f' : '#2a1513'; ctx.beginPath(); ctx.arc(lx0 + 33 + k * 46, ly0 + 33, 17, 0, TAU); ctx.fill(); if (on) { ctx.fillStyle = 'rgba(255,90,70,.35)'; ctx.beginPath(); ctx.arc(lx0 + 33 + k * 46, ly0 + 33, 22, 0, TAU); ctx.fill(); } }
    txt(W.phase === 'grid' ? W.totalLaps + ' LAPS · BRITISH GRAND PRIX' : 'HOLD W TO REV, GO WHEN THE LIGHTS GO OUT', VW / 2, ly0 + 90, 15, '#e9edf0', 700, 'center');
  }
  // ---- pit service panel
  if (b.service) {
    const pw = 340, px = VW / 2 - pw / 2, py = VH - 200 - PAD;
    panel(px, py, pw, 70, 0.9);
    txt('PIT STOP', px + 14, py + 24, 16, '#ffcf1f', 800, 'left', true);
    txt(b.serviceT.toFixed(1) + ' s', px + pw - 14, py + 24, 16, '#fff', 700, 'right');
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(px + 14, py + 34, pw - 28, 9); ctx.fillStyle = '#3ad17a'; ctx.fillRect(px + 14, py + 34, (pw - 28) * b.fuel / PHYS.tank, 9);
    const full = b.fuel >= PHYS.tank - 0.01;
    txt(full ? 'Tank full. Press W to go.' : `Refuelling ${b.fuel.toFixed(1)} / ${PHYS.tank} L · press W to leave now`, px + 14, py + 61, 13, '#c9d2d8', 600);
  }
  // ---- messages
  if (HUD.m) {
    const m = HUD.m; const a = Math.min(1, m.age * 6, (m.dur - m.age) * 3);
    ctx.globalAlpha = Math.max(0, a);
    txt(m.t, VW / 2, VH * 0.36, small ? 40 : 58, m.col, 800, 'center', true);
    if (m.sub) txt(m.sub, VW / 2, VH * 0.36 + 30, 17, '#e9edf0', 600, 'center');
    ctx.globalAlpha = 1;
  }
  if (HUD.lapFlash) { const f = HUD.lapFlash; ctx.globalAlpha = Math.max(0, Math.min(1, (5 - f.age) * 2)); txt((f.rec ? 'NEW ALL-TIME BEST  ' : f.pb ? 'SESSION BEST  ' : 'LAP  ') + fmtTime(f.t), VW / 2, cy + 152 + gOff, 20, f.pb ? '#b46bff' : '#fff', 800, 'center', true); ctx.globalAlpha = 1; }
  HUD.tick.forEach((q, k) => { ctx.globalAlpha = Math.min(1, (6 - q.age) * 2); txt(q.t, VW / 2, VH - 172 - PAD - k * 20, 14, '#e9edf0', 600, 'center'); }); ctx.globalAlpha = 1;
  // wrong way
  const hd = Math.abs(angWrap(b.h - T.H[b.i]));
  b.wrongT = hd > 2.2 && b.v > 3 ? (b.wrongT || 0) + dt : 0;
  if (b.wrongT > 1) txt('WRONG WAY', VW / 2, VH * 0.5, 40, '#e3312a', 800, 'center', true);
  // name tags for nearby riders
  for (const o of W.bikes) {
    if (o === b || o.dnf || o.crashed) continue; const dd = Math.hypot(o.x - b.x, o.y - b.y); if (dd > 70) continue;
    const [sx, sy] = worldToScreen(o.x, o.y); if (sx < 0 || sy < 0 || sx > VW || sy > VH) continue;
    ctx.globalAlpha = clamp((70 - dd) / 20, 0, 0.9);
    const label = '#' + o.num + ' ' + o.short; ctx.font = `700 12px ${FD}`; const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(9,13,16,.75)'; ctx.fillRect(sx - tw / 2, sy - 34, tw, 16); ctx.fillStyle = TEAMS[o.team].c1; ctx.fillRect(sx - tw / 2, sy - 34, 3, 16);
    txt(label, sx + 1, sy - 22, 12, '#fff', 700, 'center'); ctx.globalAlpha = 1;
  }
  for (const o of W.ghosts) {
    if (!o.show) continue; const dd = Math.hypot(o.x - b.x, o.y - b.y); if (dd > 90) continue;
    const [sx, sy] = worldToScreen(o.x, o.y); if (sx < 0 || sy < 0 || sx > VW || sy > VH) continue;
    ctx.globalAlpha = clamp((90 - dd) / 20, 0, 0.85);
    const label = '#' + o.num + ' ' + o.short + ' GHOST'; ctx.font = `700 12px ${FD}`; const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(30,60,90,.75)'; ctx.fillRect(sx - tw / 2, sy - 34, tw, 16); ctx.fillStyle = TEAMS[o.team].c1; ctx.fillRect(sx - tw / 2, sy - 34, 3, 16);
    txt(label, sx + 1, sy - 22, 12, '#bfe4ff', 700, 'center'); ctx.globalAlpha = 1;
  }
  if (b.trainHold) { panel(VW / 2 - 190, VH * 0.36 + 44, 380, 34, 0.85); txt('Press W, S, A or D to go · R puts you back here', VW / 2, VH * 0.36 + 66, 15, '#e9edf0', 700, 'center'); }
  if (b.crashed) { txt('Recovering rider…', VW / 2, VH * 0.36 + 56, 15, '#c9d2d8', 600, 'center'); }
}

// practice speed guide: recommended speed here, and the next braking point
const GUIDE_K = 0.96;
function guideSpeed(i) { return T.VP[i] * GUIDE_K; }
function nextBrake(b) {
  const N = T.N; let i = b.i, best = null;
  for (let o = 2; o < 260; o++) {
    const k = (i + o) % N, p = (k - 1 + N) % N, n = (k + 1) % N;
    if (T.VP[k] <= T.VP[p] && T.VP[k] < T.VP[n] && guideSpeed(k) < b.v - 3) { best = { k, dist: o * T.DS, v: guideSpeed(k) }; break; }
  }
  return best;
}
// ---- corner countdown: 300/200/100/50 marks + corner pictogram (GDD 11b)
const CD_MARKS = [300, 200, 100, 50];
function cornerAhead(b) {
  let best = null, bd = 1e9;
  for (const z of T.zones) {
    let d = z.zi * T.DS - b.s; if (d < -T.L / 2) d += T.L; if (d > T.L / 2) d -= T.L;
    if (d > -30 && d < 400 && d < bd) { bd = d; best = z; }
  }
  return best ? { z: best, d: bd } : null;
}
function cornerShape(z) { // centreline from the approach to the exit, rotated so the approach points up
  if (z.shape) return z.shape;
  const N = T.N, i0 = (z.zi - Math.round(70 / T.DS) + N) % N, n = Math.round(250 / T.DS);
  const h = T.H[i0], c = Math.cos(-h - Math.PI / 2), sn = Math.sin(-h - Math.PI / 2);
  const tf = (x, y) => { const dx = x - T.X[i0], dy = y - T.Y[i0]; return [dx * c - dy * sn, dx * sn + dy * c]; };
  const pts = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let o = 0; o <= n; o += 2) { const i = (i0 + o) % N, q = tf(T.X[i], T.Y[i]); pts.push(q); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  z.shape = { pts, tf, x0, y0, x1, y1, i0, n, name: T.cornerAt(z.k * T.DS) };
  return z.shape;
}
function drawCountdown(b, cz, dx, dy, dw) {
  const { z, d } = cz, S = cornerShape(z);
  ctx.globalAlpha = clamp((400 - d) / 40, 0, 1) * clamp((d + 30) / 25, 0, 1);
  const H = 44; panel(dx, dy, dw, H, 0.85);
  // pictogram
  const pw = 36, ph = 36, px = dx + 4, py = dy + 4;
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(px, py, pw, ph);
  const sc = Math.min((pw - 8) / Math.max(1, S.x1 - S.x0), (ph - 8) / Math.max(1, S.y1 - S.y0));
  const ox = px + pw / 2 - (S.x0 + S.x1) / 2 * sc, oy = py + ph / 2 - (S.y0 + S.y1) / 2 * sc;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 5; ctx.beginPath(); S.pts.forEach((q, k) => k ? ctx.lineTo(ox + q[0] * sc, oy + q[1] * sc) : ctx.moveTo(ox + q[0] * sc, oy + q[1] * sc)); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  const e1 = S.pts[S.pts.length - 1], e0 = S.pts[S.pts.length - 4], ang = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]);
  ctx.save(); ctx.translate(ox + e1[0] * sc, oy + e1[1] * sc); ctx.rotate(ang); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-3, -3.5); ctx.lineTo(-3, 3.5); ctx.closePath(); ctx.fill(); ctx.restore();
  let rel = b.i - S.i0; if (rel < 0) rel += T.N;
  if (rel <= S.n) { const q = S.tf(b.x, b.y); ctx.fillStyle = '#ffcf1f'; ctx.beginPath(); ctx.arc(ox + q[0] * sc, oy + q[1] * sc, 2.8, 0, TAU); ctx.fill(); }
  // name + marks
  const mx = px + pw + 6, mw = dx + dw - 6 - mx;
  txt(S.name.toUpperCase(), mx, dy + 13, 11, '#e9edf0', 800, 'left', true);
  txt(d > 0 ? Math.round(d) + ' m' : 'TURN IN', dx + dw - 6, dy + 13, 11, d > 50 ? '#8d9aa4' : '#ffcf1f', 700, 'right');
  const gap = 4, tw = (mw - gap * 3) / 4, ty = dy + 18, th = 20;
  const next = CD_MARKS.find(m => d > m);
  CD_MARKS.forEach((m, k) => {
    const x = mx + k * (tw + gap), passed = d <= m, isNext = m === next;
    let grow = 0; if (isNext) { const prev = k ? CD_MARKS[k - 1] : 400; grow = clamp(1 - (d - m) / (prev - m), 0, 1) * 2; }
    ctx.fillStyle = passed ? '#262e34' : isNext ? '#ffcf1f' : '#f4f4f2';
    ctx.fillRect(x - grow, ty - grow, tw + 2 * grow, th + 2 * grow);
    if (!passed) { ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, ty + 1.5, tw - 3, th - 3); }
    txt(String(m), x + tw / 2, ty + th / 2 + 5, 14, passed ? '#56636d' : '#111', 800, 'center', true);
  });
  // countdown bar
  const f = clamp(d / 300, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(mx, dy + H - 4, mw, 2);
  ctx.fillStyle = d < 50 ? '#e3312a' : '#ffcf1f'; ctx.fillRect(mx, dy + H - 4, mw * f, 2);
  ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
}
function drawGuide(b, dx, dy, dw) {
  const rec = guideSpeed(b.i); const kmh = b.v * 3.6, rk = rec * 3.6;
  const over = kmh > rk + 6, under = kmh < rk - 15;
  const gx = dx, gy = dy, gw = dw;
  panel(gx, gy, gw, 54, 0.85);
  txt('RECOMMENDED', gx + 14, gy + 20, 11, '#8d9aa4', 600);
  txt(String(Math.round(rk)), gx + 14, gy + 46, 26, over ? '#e3312a' : under ? '#4cc3ff' : '#3ad17a', 800, 'left', true);
  txt('km/h', gx + 16 + ctx.measureText(String(Math.round(rk))).width + 4, gy + 46, 12, '#8d9aa4', 600);
  const nb = nextBrake(b);
  if (nb) {
    const corner = T.cornerAt(nb.k * T.DS);
    const brakeDist = Math.max(0, (b.v * b.v - nb.v * nb.v) / (2 * PHYS.brakeMax * 0.85));
    const toBrake = nb.dist - brakeDist;
    const urgent = toBrake < 15;
    txt((urgent ? 'BRAKE NOW · ' : 'Brake in ' + Math.round(toBrake) + ' m · ') + corner + ' ' + Math.round(nb.v * 3.6), gx + gw - 14, gy + 24, 14, urgent ? '#e3312a' : '#e9edf0', 700, 'right');
    txt(urgent ? 'Down to ' + Math.round(nb.v * 3.6) + ' km/h' : Math.round(nb.dist) + ' m to apex', gx + gw - 14, gy + 44, 12, '#8d9aa4', 600, 'right');
  } else txt('Full throttle', gx + gw - 14, gy + 32, 14, '#3ad17a', 700, 'right');
}
function drawTower(st, me) {
  const PAD = 16, rowH = 19; const show = W.mode === 'race' ? st : null;
  const x = PAD, y = PAD;
  if (W.mode === 'race') {
    const maxRows = Math.max(6, Math.floor((VH - 200 - y - 40) / rowH));
    let rows = st; let start = 0;
    if (rows.length > maxRows) { const mi = st.indexOf(me); start = clamp(mi - Math.floor(maxRows / 2), 0, st.length - maxRows); rows = st.slice(start, start + maxRows); }
    const w = VW < 760 ? 150 : 190; panel(x, y, w, rows.length * rowH + 30, 0.78);
    txt(W.flag ? 'CHEQUERED' : 'LAP ' + Math.min(W.totalLaps, (st[0].lap + 1)) + '/' + W.totalLaps, x + 10, y + 18, 13, W.flag ? '#fff' : '#ffcf1f', 800, 'left', true);
    const lead = gapOf(st[0]) || 0;
    rows.forEach((o, k) => {
      const yy = y + 26 + k * rowH; const p = start + k + 1;
      if (o === me) { ctx.fillStyle = 'rgba(255,207,31,.18)'; ctx.fillRect(x + 2, yy, w - 4, rowH); }
      txt(String(p), x + 22, yy + 14, 14, o === me ? '#ffcf1f' : '#fff', 800, 'right', true);
      ctx.fillStyle = TEAMS[o.team].c1; ctx.fillRect(x + 28, yy + 3, 4, rowH - 6);
      txt(o.short, x + 38, yy + 14, 14, o.ghost ? '#9fd8ff' : '#fff', 700);
      if (o.ghost) txt('G', x + 38 + ctx.measureText(o.short).width + 4, yy + 14, 10, '#9fd8ff', 800);
      let g = '';
      if (o.dnf) g = 'OUT'; else if (o.crashed) g = 'CRASH'; else if (o.inPitLane) g = 'PIT'; else if (o.finished) g = '🏁'.length ? 'FIN' : ''; else if (p === 1) g = 'Leader'; else { const lapsDown = st[0].lap - o.lap - (st[0].s < o.s ? 1 : 0); g = lapsDown >= 1 ? '+' + lapsDown + ' LAP' : '+' + ((gapOf(o) || 0) - lead).toFixed(1); }
      txt(g, x + w - 10, yy + 14, 13, g === 'PIT' ? '#ffcf1f' : (g === 'OUT' || g === 'CRASH') ? '#e3312a' : '#c9d2d8', 600, 'right');
    });
  } else {
    let rows;
    if (W.mode === 'quali') rows = W.qualiAI.map(q => ({ short: q.name.split(' ').slice(-1)[0].toUpperCase().slice(0, 3), t: q.best, me: false, c: '#8d9aa4' })).concat([{ short: me.short, t: me.bestLap || 1e9, me: true }]).sort((a, c) => a.t - c.t);
    else { rows = me.laps.slice(-12).map((t, k, arr) => ({ short: 'LAP ' + (me.laps.length - arr.length + k + 1), t, me: t === me.bestLap })); if (Records.d.traceT) rows.unshift({ short: 'ALL-TIME', t: Records.d.traceT, me: false, rec: true }); W.ghosts.forEach((g, k) => rows.splice(k + (Records.d.traceT ? 1 : 0), 0, { short: 'GHOST ' + g.short, t: g.recBest, me: false, gh: true })); }
    const maxRows = Math.max(6, Math.floor((VH - 200 - 56) / rowH)); let start = 0;
    if (rows.length > maxRows) { const mi = rows.findIndex(r => r.me); start = clamp(mi - Math.floor(maxRows / 2), 0, rows.length - maxRows); }
    const vis = rows.slice(start, start + maxRows);
    const w = VW < 760 ? 150 : 190; panel(x, y, w, Math.max(1, vis.length) * rowH + 30, 0.78);
    txt(W.mode === 'quali' ? 'QUALIFYING' : 'YOUR LAPS', x + 10, y + 18, 13, '#ffcf1f', 800, 'left', true);
    vis.forEach((r, k) => {
      const yy = y + 26 + k * rowH;
      if (r.me) { ctx.fillStyle = W.mode === 'quali' ? 'rgba(255,207,31,.18)' : 'rgba(180,107,255,.2)'; ctx.fillRect(x + 2, yy, w - 4, rowH); }
      if (W.mode === 'quali') txt(String(start + k + 1), x + 22, yy + 14, 14, r.me ? '#ffcf1f' : '#fff', 800, 'right', true);
      const rc = r.rec ? '#b46bff' : r.gh ? '#9fd8ff' : null;
      txt(r.short, x + (W.mode === 'quali' ? 30 : 10), yy + 14, 14, rc || '#fff', 700);
      txt(r.t < 1e8 ? fmtTime(r.t) : 'NO TIME', x + w - 10, yy + 14, 13, rc || '#c9d2d8', 600, 'right');
    });
  }
}
function drawMinimap(me) {
  const M = HUD.mini; if (!M) return; const S = VW < 760 ? 140 : M.S; const x = VW - S - 16, y = 16;
  panel(x, y, S, S, 0.7); ctx.drawImage(M.c, x, y, S, S); const k = S / M.S;
  const by = T.PIT.boxS(me.box); const [bx0, by0] = M.tf(...T.pt(T.idx(by), T.PIT.boxD * 0.6));
  if ((performance.now() / 300 | 0) % 2) { ctx.strokeStyle = TEAMS[me.team].c1; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + bx0 * k, y + by0 * k, 5, 0, TAU); ctx.stroke(); }
  for (const o of W.bikes) {
    if (o.dnf) continue; const px = o.crashed && o.crash ? o.crash.bk.x : o.x, py = o.crashed && o.crash ? o.crash.bk.y : o.y;
    const [mx, my] = M.tf(px, py); ctx.fillStyle = o === me ? '#ffcf1f' : TEAMS[o.team].c1; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x + mx * k, y + my * k, o === me ? 5 : 3.2, 0, TAU); ctx.fill(); ctx.stroke();
  }
  for (const o of W.ghosts) { if (!o.show) continue; const [mx, my] = M.tf(o.x, o.y); ctx.strokeStyle = '#bfe4ff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x + mx * k, y + my * k, 3.4, 0, TAU); ctx.stroke(); }
}

// ---------------------------------------------------------------------------
// Sound (WebAudio synth engine; starts after a click)
// ---------------------------------------------------------------------------
const Sound = {
  ac: null, on: true,
  start() {
    if (this.ac) { this.ac.resume(); return; }
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)(); this.ac = ac;
      const master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); this.master = master;
      const mk = (type, g) => { const o = ac.createOscillator(); o.type = type; const gn = ac.createGain(); gn.gain.value = g; o.connect(gn); o.start(); return [o, gn]; };
      const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 1200; filt.Q.value = 2; const eg = ac.createGain(); eg.gain.value = 0; filt.connect(eg); eg.connect(master);
      const [o1, g1] = mk('sawtooth', 0.5), [o2, g2] = mk('square', 0.25), [o3, g3] = mk('sawtooth', 0.2);
      g1.connect(filt); g2.connect(filt); g3.connect(filt);
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const nz = ac.createBufferSource(); nz.buffer = buf; nz.loop = true; const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; const ng = ac.createGain(); ng.gain.value = 0; nz.connect(nf); nf.connect(ng); ng.connect(master); nz.start();
      const [a1, ag] = mk('sawtooth', 0); const af = ac.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 900; ag.connect(af); af.connect(master);
      this.n = { o1, o2, o3, filt, eg, ng, nf, a1, ag };
    } catch (e) { this.ac = null; }
  },
  update(b) {
    if (!this.ac || !this.n) return; const n = this.n, t = this.ac.currentTime;
    const vol = this.on && !W.paused && document.visibilityState === 'visible' ? 1 : 0;
    this.master.gain.setTargetAtTime(0.45 * vol, t, 0.05);
    if (!b) return;
    const rpm = b.crashed ? 2500 : b.rpmVis; const f = rpm / 60 * 2;
    n.o1.frequency.setTargetAtTime(f, t, 0.02); n.o2.frequency.setTargetAtTime(f / 2, t, 0.02); n.o3.frequency.setTargetAtTime(f * 1.5, t, 0.02);
    n.filt.frequency.setTargetAtTime(500 + b.ctl.thr * 2800 + rpm / 10, t, 0.03);
    n.eg.gain.setTargetAtTime(b.crashed || b.dnf ? 0.0 : 0.05 + b.ctl.thr * 0.11, t, 0.03);
    n.ng.gain.setTargetAtTime(Math.min(0.12, (b.v / 95) ** 2 * 0.1) + (b.skid ? 0.05 : 0) + ((b.surf === SURF.GRAVEL || b.surf === SURF.GRASS) && b.v > 3 ? 0.08 : 0), t, 0.05);
    n.nf.frequency.setTargetAtTime(b.surf === SURF.GRAVEL ? 2400 : 700 + b.v * 8, t, 0.1);
    // nearest rival
    let best = null, bd = 1e9; for (const o of W.bikes) { if (o === b || o.dnf || o.crashed) continue; const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < bd) { bd = d; best = o; } }
    if (best && bd < 120) { n.a1.frequency.setTargetAtTime(best.rpmVis / 60 * 2 * (1 + clamp((best.v - b.v) / 340, -0.2, 0.2)), t, 0.03); n.ag.gain.setTargetAtTime(0.09 * (1 - bd / 120) ** 2, t, 0.05); } else n.ag.gain.setTargetAtTime(0, t, 0.1);
  },
  hit(v) { if (!this.ac || !this.on) return; const ac = this.ac, t = ac.currentTime; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = 90; g.gain.setValueAtTime(Math.min(0.4, 0.1 + v * 0.2), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.3); },
  pit() { if (!this.ac || !this.on) return; const ac = this.ac, t = ac.currentTime; for (let k = 0; k < 2; k++) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.12, t + k * 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.15 + 0.12); o.connect(g); g.connect(this.master); o.start(t + k * 0.15); o.stop(t + k * 0.15 + 0.14); } }
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const Input = { k: {} };
const GAME_KEYS = new Set(['KeyR', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyO', 'KeyL', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (GAME_KEYS.has(e.code) && UI.state === 'play') e.preventDefault();
  Input.k[e.code] = true;
  if (e.repeat) return;
  const b = W.player;
  if (UI.state === 'play' && b && !W.paused) {
    if (e.code === 'KeyO' && !b.auto) shift(b, 1);
    if (e.code === 'KeyL' && !b.auto) shift(b, -1);
  }
  if (e.code === 'KeyC' && UI.state === 'play') { setCamMode(CAM.mode === 'behind' ? 'chase' : 'behind'); UI.opts.cam = CAM.mode; UI.sync(); HUD.msg('CAMERA', CAM.mode === 'behind' ? 'Behind' : 'Top-down', '#4cc3ff', 1.2); }
  if (e.code === 'KeyR' && UI.state === 'play' && W.train && !W.paused) UI.launch('practice', {});
  if (e.code === 'Escape' && (UI.state === 'play')) UI.togglePause();
  if (e.code === 'KeyM') Sound.on = !Sound.on;
});
window.addEventListener('keyup', e => { Input.k[e.code] = false; });
window.addEventListener('blur', () => { Input.k = {}; if (UI.state === 'play' && !W.paused) UI.togglePause(); });

// ---------------------------------------------------------------------------
// Menus / flow
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const UI = {
  state: 'menu', opts: { mode: 'sprint', trans: 'manual', aids: 'on', ai: 'pro', cam: 'behind', guide: 'on', train: 'off', trainS: -1, trainV: -1, fuel: 100, grid: 'mid', name: 'Petr', num: 25, team: 2 },
  init() {
    try { const s = JSON.parse(localStorage.getItem('sgp_opts') || 'null'); if (s) { if (s.cam !== 'chase') delete s.cam; Object.assign(this.opts, s); } } catch (e) { }
    const sel = $('optTeam'); TEAMS.forEach((t, k) => { const o = document.createElement('option'); o.value = k; o.textContent = t.name; sel.appendChild(o); });
    document.querySelectorAll('.mode').forEach(m => m.addEventListener('click', () => { this.opts.mode = m.dataset.mode; this.sync(); }));
    for (const [id, key] of [['optTrans', 'trans'], ['optAids', 'aids'], ['optAI', 'ai'], ['optCam', 'cam'], ['optGuide', 'guide'], ['optTrain', 'train']]) $(id).querySelectorAll('button').forEach(bt => bt.addEventListener('click', () => { this.opts[key] = bt.dataset.v; this.sync(); }));
    $('optFuel').addEventListener('input', e => { this.opts.fuel = +e.target.value; this.sync(); });
    $('optGrid').addEventListener('change', e => { this.opts.grid = e.target.value; });
    $('optTeam').addEventListener('change', e => { this.opts.team = +e.target.value; });
    $('optName').addEventListener('input', e => { this.opts.name = e.target.value.trim() || 'Rider'; });
    $('optNum').addEventListener('input', e => { this.opts.num = clamp(parseInt(e.target.value) || 25, 1, 99); });
    $('btnStart').addEventListener('click', () => this.start());
    $('btnClearRec').addEventListener('click', e => { const bt = e.currentTarget; if (bt.dataset.armed) { Records.clear(); delete bt.dataset.armed; this.renderRecords(); } else { bt.dataset.armed = '1'; bt.textContent = 'Click again to delete all saved laps'; setTimeout(() => { delete bt.dataset.armed; this.renderRecords(); }, 3500); } });
    $('btnResume').addEventListener('click', () => this.togglePause());
    $('btnRestart').addEventListener('click', () => { this.hideAll(); this.launch(W.kind === 'quali' ? 'quali' : this.opts.mode, W.kind === 'gp' ? { qualiGrid: W.opts.qualiGrid } : {}); });
    $('btnQuit').addEventListener('click', () => this.toMenu());
    $('btnEndQ').addEventListener('click', () => { this.hideAll(); this.finishQuali(); });
    this.initTraining();
    $('btnExport').addEventListener('click', () => Lib.export(Rec.snapshot()));
    $('btnImport').addEventListener('click', () => $('fileImport').click());
    $('fileImport').addEventListener('change', e => { Lib.importFiles([...e.target.files], 'import'); e.target.value = ''; });
    $('btnFolder').addEventListener('click', () => { if (Lib.canPickDir()) Lib.pickDir(); else $('dirImport').click(); });
    $('dirImport').addEventListener('change', e => { Lib.importFiles([...e.target.files], 'folder'); e.target.value = ''; });
    $('btnReloadDir').addEventListener('click', () => Lib.reloadDir());
    $('recList').addEventListener('click', e => {
      const bt = e.target.closest('button[data-act]'); if (!bt) return; const id = bt.dataset.id;
      if (bt.dataset.act === 'ghost') Lib.toggleGhost(id);
      else if (bt.dataset.act === 'export') Lib.get(id).then(R => Lib.export(R));
      else if (bt.dataset.act === 'del') { if (bt.dataset.armed) Lib.del(id); else { bt.dataset.armed = '1'; bt.textContent = 'Sure?'; setTimeout(() => this.renderLib(), 3000); } }
    });
    Lib.onChange = () => this.renderLib();
    this.sync();
  },
  sync() {
    const o = this.opts;
    document.querySelectorAll('.mode').forEach(m => m.setAttribute('aria-pressed', String(m.dataset.mode === o.mode)));
    for (const [id, key] of [['optTrans', 'trans'], ['optAids', 'aids'], ['optAI', 'ai'], ['optCam', 'cam'], ['optGuide', 'guide'], ['optTrain', 'train']]) $(id).querySelectorAll('button').forEach(bt => bt.setAttribute('aria-pressed', String(bt.dataset.v === o[key])));
    $('optFuel').value = o.fuel; $('optGrid').value = o.grid; $('optTeam').value = o.team; $('optName').value = o.name; $('optNum').value = o.num;
    const laps = o.mode === 'gp' ? 20 : 10; const L = PHYS.tank * o.fuel / 100; const range = L / 2.65;
    $('optFuelV').textContent = L.toFixed(1) + ' L';
    const stops = Math.max(0, Math.ceil(laps * 2.65 / PHYS.tank - 0.001) - 1); $('optFuelHint').textContent = o.mode === 'practice' ? 'Practice starts with a full tank.' : `About ${range.toFixed(1)} laps on this load. A ${laps} lap race needs at least ${stops} stop${stops === 1 ? '' : 's'} on a full tank. Less fuel is lighter and faster but means more stops.`;
    $('optFuelWrap').hidden = o.mode === 'practice'; $('optGuideWrap').hidden = o.mode !== 'practice'; $('optTrainWrap').hidden = o.mode !== 'practice'; $('trainBox').hidden = o.train !== 'on'; this.renderTraining(); this.renderRecords(); $('optGridWrap').hidden = o.mode !== 'sprint';
    try { localStorage.setItem('sgp_opts', JSON.stringify(o)); } catch (e) { }
  },
  renderRecords() {
    const d = Records.d, el = $('records'); if (!el) return;
    const n = d.laps.length;
    if (!n) { el.innerHTML = '<span class="small">No laps saved yet. Every completed lap you ride is kept in this browser, and your best one becomes the target for the live delta.</span>'; $('btnClearRec').hidden = true; return; }
    const lbl = { practice: 'Practice', quali: 'Qualifying', race: 'Race' };
    const best = Object.keys(lbl).filter(k => d.best[k]).map(k => `<div class="rec"><span class="lbl">${lbl[k]} best</span><b>${fmtTime(d.best[k].t)}</b><span class="small">${new Date(d.best[k].at).toLocaleDateString()}${d.best[k].aids ? '' : ' · no aids'}${d.best[k].auto ? ' · auto' : ''}</span></div>`).join('');
    const last = d.laps.slice(-6).reverse().map(e => `<tr><td>${fmtTime(e.t)}</td><td>${lbl[e.mode] || e.mode}</td><td class="small">${e.s && e.s.length === 3 ? e.s.map(x => x.toFixed(2)).join(' / ') : ''}</td><td class="small">${new Date(e.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td></tr>`).join('');
    el.innerHTML = `<div class="recs">${best}<div class="rec"><span class="lbl">Laps logged</span><b>${n}</b></div></div><div class="tablewrap"><table><thead><tr><th>Lap</th><th>Session</th><th>Sectors</th><th>When</th></tr></thead><tbody>${last}</tbody></table></div>`;
    $('btnClearRec').hidden = false; $('btnClearRec').textContent = 'Clear saved laps';
  },
  // curve training picker (GDD 11d)
  trainSpot(z) { return T.wrapS(z.zi * T.DS - 350); },
  initTraining() {
    const o = this.opts, sel = $('optTrainCorner'), cv = $('trainMap');
    const names = {}; T.zones.forEach((z, k) => { const n = T.cornerAt(z.k * T.DS); names[n] = (names[n] || 0) + 1; const op = document.createElement('option'); op.value = k; op.textContent = n + (names[n] > 1 ? ' ' + names[n] : ''); sel.appendChild(op); });
    const custom = document.createElement('option'); custom.value = 'x'; custom.textContent = 'Picked on the map'; sel.appendChild(custom);
    const guideV = s => Math.round(guideSpeed(T.idx(s)) * 3.6 / 5) * 5;
    if (!(o.trainS >= 0)) o.trainS = this.trainSpot(T.zones[0]);
    if (!(o.trainV >= 0)) o.trainV = clamp(guideV(o.trainS), 0, 300);
    sel.addEventListener('change', () => { if (sel.value === 'x') return; o.trainS = this.trainSpot(T.zones[+sel.value]); o.trainV = clamp(guideV(o.trainS), 0, 300); this.sync(); });
    $('optTrainV').addEventListener('input', e => { o.trainV = +e.target.value; this.sync(); });
    $('btnTrainGuide').addEventListener('click', () => { o.trainV = clamp(guideV(o.trainS), 0, 300); this.sync(); });
    // map: fit the centreline, pick the nearest point on click / drag
    const S = 2, W0 = 300, H0 = 220; cv.width = W0 * S; cv.height = H0 * S;
    const bb = T.bbox, sc = Math.min((W0 - 24) / (bb.maxx - bb.minx), (H0 - 24) / (bb.maxy - bb.miny));
    const ox = (W0 - (bb.maxx - bb.minx) * sc) / 2 - bb.minx * sc, oy = (H0 - (bb.maxy - bb.miny) * sc) / 2 - bb.miny * sc;
    this.tmap = { S, W0, H0, sc, ox, oy };
    const pick = e => {
      const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * W0 / r.width, my = (e.clientY - r.top) * H0 / r.height;
      const wx = (mx - ox) / sc, wy = (my - oy) / sc; let bi = 0, bd = 1e18;
      for (let i = 0; i < T.N; i++) { const d = (T.X[i] - wx) ** 2 + (T.Y[i] - wy) ** 2; if (d < bd) { bd = d; bi = i; } }
      o.trainS = Math.round(bi * T.DS); this.sync();
    };
    let down = false;
    cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); pick(e); });
    cv.addEventListener('pointermove', e => { if (down) pick(e); });
    cv.addEventListener('pointerup', () => { down = false; o.trainV = clamp(guideV(o.trainS), 0, 300); this.sync(); });
  },
  renderTraining() {
    const M = this.tmap; if (!M) return; const o = this.opts, cv = $('trainMap'), g = cv.getContext('2d');
    g.setTransform(M.S, 0, 0, M.S, 0, 0); g.clearRect(0, 0, M.W0, M.H0);
    const tf = i => [M.ox + T.X[i] * M.sc, M.oy + T.Y[i] * M.sc];
    g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= T.N; i += 2) { const [x, y] = tf(i % T.N); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath();
    g.strokeStyle = '#000'; g.lineWidth = 7; g.stroke(); g.strokeStyle = '#d8dde1'; g.lineWidth = 3.5; g.stroke();
    for (const z of T.zones) { const [x, y] = tf(z.k); g.fillStyle = '#56636d'; g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill(); }
    const [sx, sy] = tf(0); g.fillStyle = '#fff'; g.fillRect(sx - 3, sy - 3, 6, 6);
    const i = T.idx(o.trainS), [x, y] = tf(i), h = T.H[i];
    g.save(); g.translate(x, y); g.rotate(h); g.fillStyle = '#ffcf1f'; g.strokeStyle = '#111'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-6, -7); g.lineTo(-2, 0); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
    // corner list follows the spot; the info line names it
    const zk = T.zones.findIndex(z => Math.abs(this.trainSpot(z) - T.wrapS(o.trainS)) < 1);
    $('optTrainCorner').value = zk >= 0 ? zk : 'x';
    let nz = null, nd = 1e9; for (const z of T.zones) { let d = z.k * T.DS - o.trainS; if (d < 0) d += T.L; if (d < nd) { nd = d; nz = z; } }
    $('optTrainV').value = o.trainV; $('optTrainVV').textContent = o.trainV + ' km/h';
    $('trainInfo').textContent = `Start at ${T.cornerAt(o.trainS)}, centre of the road. ${nz ? 'Next corner ' + T.cornerAt(nz.k * T.DS) + ' in ' + Math.round(nd) + ' m.' : ''} Guide speed here ${Math.round(guideSpeed(i) * 3.6)} km/h.`;
  },
  renderLib() {
    const el = $('recList'); if (!el) return;
    const lbl = { practice: 'Practice', quali: 'Qualifying', sprint: '10 lap race', gp: 'Grand Prix' };
    const src = { auto: '', import: 'imported', folder: 'saved_tracks' };
    $('recStatus').textContent = Lib.status || (Lib.db ? '' : 'Browser storage is blocked here, recordings are kept until the page closes.');
    $('btnReloadDir').hidden = !Lib.dir; if (Lib.dir) $('btnReloadDir').textContent = 'Reload ' + Lib.dir.name;
    $('recGhostHint').textContent = Lib.ghosts.length ? `${Lib.ghosts.length} ghost${Lib.ghosts.length === 1 ? '' : 's'} selected. They ride with you in Practice and in races (each one replaces a slow AI rider).` : 'Switch on Ghost to ride against a recording in Practice or a race (up to 4).';
    if (!Lib.meta.length) { el.innerHTML = '<span class="small">No recordings yet. Every session with a completed lap or a race start is recorded automatically.</span>'; return; }
    el.innerHTML = '<table><thead><tr><th>Ghost</th><th>Rider</th><th>Session</th><th>Best lap</th><th>Laps</th><th>Result</th><th>When</th><th></th></tr></thead><tbody>' + Lib.meta.map(m => {
      const on = Lib.ghosts.includes(m.id);
      const res = m.raceStart ? (m.position ? 'P' + m.position + (m.finishT ? ' · ' + fmtTime(m.finishT) : '') : 'DNF') : '';
      return `<tr><td><button class="chip" data-act="ghost" data-id="${esc(m.id)}" aria-pressed="${on}">${on ? 'Ghost on' : 'Ghost'}</button></td><td>${sw(clamp(m.rider.team | 0, 0, TEAMS.length - 1))}#${m.rider.num | 0} ${esc(m.rider.name)}</td><td>${lbl[m.kind] || esc(m.mode)}${src[m.src] ? ' <span class="small">· ' + src[m.src] + '</span>' : ''}</td><td>${m.bestLap ? fmtTime(m.bestLap) : '–'}</td><td>${m.laps | 0}</td><td>${res}</td><td class="small">${new Date(m.date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td><button class="chip" data-act="export" data-id="${esc(m.id)}">Export</button> <button class="chip" data-act="del" data-id="${esc(m.id)}">Delete</button></td></tr>`;
    }).join('') + '</tbody></table>';
  },
  hideAll() { for (const id of ['menu', 'pause', 'results']) $(id).hidden = true; },
  toMenu() { Rec.stop(); this.hideAll(); this.state = 'menu'; W.paused = false; $('menu').hidden = false; this.renderRecords(); },
  start() { Sound.start(); this.launch(this.opts.mode === 'gp' ? 'quali' : this.opts.mode, {}); },
  sessionOpts(extra) {
    const o = this.opts;
    const train = o.mode === 'practice' && o.train === 'on' ? { s: o.trainS, v: o.trainV / 3.6 } : null;
    return Object.assign({ train, name: o.name, num: o.num, team: o.team, aids: o.aids === 'on', auto: o.trans === 'auto', level: o.ai, fuelPct: o.fuel / 100, gridPos: o.grid, guide: o.guide === 'on' }, extra);
  },
  launch(kind, extra) {
    Rec.stop(); this.hideAll(); this.state = 'play'; setCamMode(this.opts.cam); CAM.init = false;
    setupSession(kind, this.sessionOpts(Object.assign({ ghosts: Lib.ghostRecs() }, extra)));
    Rec.start();
    if (kind === 'gp' || kind === 'sprint') W.kind = kind;
    $('btnEndQ').hidden = kind !== 'quali';
  },
  togglePause() {
    if (this.state !== 'play') return;
    W.paused = !W.paused; $('pause').hidden = !W.paused;
    $('pauseSub').textContent = W.mode === 'race' ? `Lap ${Math.min(W.totalLaps, W.player.lap + 1)} of ${W.totalLaps}` : W.mode === 'quali' ? 'Qualifying' : W.train ? 'Curve training · restart puts you back on the spot' : 'Free practice';
    if (W.paused) $('btnResume').focus();
  },
  finishQuali() {
    const rec = Rec.stop();
    const me = W.player; const rows = W.qualiAI.map(q => ({ id: q.id, name: q.name, num: q.num, t: q.best, me: false })).concat([{ id: 0, name: me.name, num: me.num, t: me.bestLap || 1e9, me: true }]).sort((a, b) => a.t - b.t);
    const grid = rows.map(r => r.id);
    const pole = rows[0].t;
    this.results('Qualifying', 'Grid for the 20 lap British Grand Prix', `Your best: ${me.bestLap ? fmtTime(me.bestLap) : 'no time set'} · P${rows.findIndex(r => r.me) + 1}`,
      ['Pos', '#', 'Rider', 'Team', 'Best lap', 'Gap'],
      rows.map((r, k) => { const team = r.me ? me.team : W.bikes.length ? teamForId(r.id, me.team) : 0; return { me: r.me, cells: [k + 1, r.num, r.name, sw(team) + TEAMS[team].name, r.t < 1e8 ? fmtTime(r.t) : 'No time', k ? (r.t < 1e8 ? '+' + (r.t - pole).toFixed(3) : '') : 'Pole'] }; }),
      [['Start the race', () => this.launch('gp', { qualiGrid: grid })], ...(rec ? [['Export session', () => Lib.export(rec), true]] : []), ['Back to menu', () => this.toMenu(), true]]);
  },
  raceResults() {
    // let the rest of the field finish (fast-forward)
    const rec = Rec.stop();
    W.player.autopilot = true;
    let guard = 0; while ((W.bikes.some(b => !b.finished && !b.dnf) || W.ghosts.some(g => !g.finished && !g.dnf)) && guard < 120 * 240) { simStep(SUB); guard++; }
    const st = standings(); const win = st[0];
    const me = W.player; const myPos = st.indexOf(me) + 1;
    let fl = null; for (const b of st) if (b.bestLap && (!fl || b.bestLap < fl.bestLap)) fl = b;
    this.results('Race result', 'British Grand Prix · ' + W.totalLaps + ' laps', me.dnf ? 'You did not finish.' : `You finished P${myPos} of ${st.length}. Fastest lap: #${fl.num} ${fl.name} ${fmtTime(fl.bestLap)}`,
      ['Pos', '#', 'Rider', 'Team', 'Time / gap', 'Best lap', 'Pits'],
      st.map((b, k) => ({ me: b === me, cells: [b.dnf ? 'DNF' : k + 1, b.num, b.ghost ? b.name.replace(' (ghost)', '') + ' · GHOST' : b.name, sw(b.team) + TEAMS[b.team].name, b.dnf ? 'Retired' : k === 0 ? fmtTime(b.finishT) : (b.lap < win.lap ? '+' + (win.lap - b.lap) + ' lap' + (win.lap - b.lap > 1 ? 's' : '') : '+' + (b.finishT - win.finishT).toFixed(3)), b.bestLap ? (b === fl ? '<span class="pb">' + fmtTime(b.bestLap) + '</span>' : fmtTime(b.bestLap)) : '–', b.ghost ? '–' : b.pits] })),
      [['Race again', () => this.launch(W.kind, W.kind === 'gp' ? { qualiGrid: W.opts.qualiGrid } : {})], ...(rec ? [['Export session', () => Lib.export(rec), true]] : []), ['Back to menu', () => this.toMenu(), true]]);
  },
  results(eyebrow, title, sub, head, rows, actions) {
    this.state = 'results'; this.hideAll();
    $('resEyebrow').textContent = eyebrow; $('resTitle').textContent = title; $('resSub').textContent = sub;
    $('resTable').innerHTML = '<thead><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>' + rows.map(r => `<tr class="${r.me ? 'me' : ''}">` + r.cells.map((c, k) => `<td class="${k === 0 ? 'pos' : k === 1 ? 'num' : ''}">${typeof c === 'string' && k !== 3 && k !== 5 && k !== 4 ? esc(c) : c}</td>`).join('') + '</tr>').join('') + '</tbody>';
    const A = $('resActions'); A.innerHTML = '';
    actions.forEach(([label, fn, ghost]) => { const bt = document.createElement('button'); bt.className = 'btn' + (ghost ? ' ghost' : ''); bt.textContent = label; bt.addEventListener('click', fn); A.appendChild(bt); });
    $('results').hidden = false; $('results').scrollTop = 0;
  }
};
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function sw(team) { return `<span class="sw" style="background:${TEAMS[team].c1}"></span>`; }
function teamForId(id, playerTeam) { const seats = []; for (let t = 0; t < TEAMS.length; t++) seats.push(t, t); seats.splice(seats.indexOf(playerTeam), 1); return seats[id - 1]; }

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now(), acc = 0, perfAvg = 1 / 60, perfN = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // adaptive resolution: drop to 1x pixels if the machine can't keep up
  perfAvg = perfAvg * 0.97 + dt * 0.03; perfN++;
  if (perfN > 180 && perfAvg > 0.024 && DPR_CAP > 1 && UI.state === 'play') { DPR_CAP = 1; resize(); perfN = 0; }
  else if (perfN > 180 && perfAvg > 0.024 && CAM.mode === 'behind' && TILT.q > 0.8 && UI.state === 'play') { TILT.q = 0.8; resize(); perfN = 0; }
  if (UI.state === 'play' && !W.paused) {
    acc += dt; let n = 0;
    while (acc >= SUB && n < 16) { simStep(SUB); acc -= SUB; n++; }
    if (n >= 16) acc = 0;
    HUD.step(dt);
    if (W.endTimer > 0) { W.endTimer -= dt; if (W.endTimer <= 0) { if (W.mode === 'race') UI.raceResults(); else if (W.mode === 'quali') UI.finishQuali(); } }
    if (W.mode === 'race' && W.player.dnf && !W.endTimer && !W.resultsShown) { W.resultsShown = true; W.endTimer = 3; }
  }
  if (W.player) {
    updateCamera(UI.state === 'play' && !W.paused ? dt : 0.0001); drawWorld();
    ctx = hudCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, hcv.width, hcv.height);
    try { if (UI.state === 'play') drawHUD(dt); } finally { ctx = mainCtx; }
  }
  Sound.update(UI.state === 'play' ? W.player : null);
  requestAnimationFrame(frame);
}
function boot() {
  resize(); window.addEventListener('resize', resize);
  buildTextures(); buildGeometry(); buildMinimap();
  UI.init(); Lib.init();
  // attract mode behind the menu: AI field circulating
  setupSession('sprint', UI.sessionOpts({ gridPos: 'mid' }));
  W.player.autopilot = true; W.phase = 'run'; for (const b of W.bikes) { b.held = false; b.lapStartT = 0; }
  $('loading').hidden = true; $('menu').hidden = false;
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  setInterval(() => { if (UI.state === 'menu') { for (let k = 0; k < 4; k++) simStep(SUB); } }, 1000 / 30);
}
window.__sgp = { Rec, Lib, Ghost, W, T, PHYS, Input, FX, Records, completeLapX: b => completeLap(b), drawWorldX: () => drawWorld(), setupSession, simStep, standings, UI, SUB, setAIReal: v => { AI_REAL = v; } };
if (document.fonts && document.fonts.ready) { Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).then(boot).catch(e => { console.error("boot failed", e && e.stack); }); } else boot();
