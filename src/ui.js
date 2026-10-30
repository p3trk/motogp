
// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const FD = '"Saira Condensed", "Arial Narrow", sans-serif';
const HUD = {
  m: null, tick: [], shake: 0, secFlash: [], lapFlash: null, mini: null,
  reset() { this.m = null; this.tick = []; this.secFlash = []; this.lapFlash = null; this.shake = 0; },
  msg(t, sub, col, dur, hold) { this.m = { t, sub, col, dur, age: 0, hold }; }, // hold: stays while the bike waits for the first input
  ticker(t) { this.tick.unshift({ t, age: 0 }); this.tick = this.tick.slice(0, 3); },
  sector(k, t, best) { this.secFlash[k] = { t, best, age: 0, pb: !best || t < best }; },
  lap(t, pb, rec, inv) { this.lapFlash = { t, pb, rec, inv, age: 0 }; },
  step(dt) {
    if (this.m) { this.m.age += dt; if (this.m.hold && W.player && W.player.trainHold) this.m.age = Math.min(this.m.age, 1); if (this.m.age > this.m.dur) this.m = null; }
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
// status tags: pit limiter, slipstream, cold tyres, no fuel, over-rev (GDD 11)
function drawTags(b, rx, ry, rw) {
  const tags = []; if (b.limiter) tags.push(['PIT LIMITER', '#ffcf1f']); if (b.draft > 0.25) tags.push(['SLIPSTREAM', '#4cc3ff']); if (b.dist < 2500 && W.phase === 'run') tags.push(['COLD TYRES', '#4cc3ff']); if (b.fuel <= 0) tags.push(['NO FUEL', '#e3312a']); if (b.overrev > 0) tags.push(['OVER-REV BLOCKED', '#e3312a']);
  tags.forEach(([t, c], k) => { ctx.font = `800 13px ${FD}`; const tw = ctx.measureText(t).width + 14; const x = rx + rw - tw - 0 - k * 0; const y = ry - 26 - k * 24; ctx.fillStyle = c; ctx.fillRect(rx + rw - tw, y, tw, 20); txt(t, rx + rw - 7, y + 15, 13, '#111', 800, 'right'); });
}
// fuel warning on phones, where the fuel panel is gone (GDD 11g): a centre message at 3 laps and at 1 lap left
function fuelWarn(b) {
  const left = b.fuel / Math.max(1, b.fuelPerLap), w = b.fuelWarned || (b.fuelWarned = {});
  if (left > 3.5) { w.three = false; w.one = false; return; } // fuel back above 3.5 laps (a restart)
  if (left < 1 && !w.one) { w.one = true; HUD.msg('FUEL', left.toFixed(1) + ' LAP LEFT', '#e3312a', 3); }
  else if (left < 3 && !w.three) { w.three = true; HUD.msg('FUEL', '3 LAPS LEFT', '#ffcf1f', 3); }
}
// phone HUD (GDD 11g, since 1.19.0): compact speedometer with an rpm bar and a lean bar
function drawPhoneDash(b) {
  const PAD = 16, dw = 190, dh = 84, dx = PAD, dy = VH - dh - PAD;
  drawLongLapBoard(b, dy);
  panel(dx, dy, dw, dh);
  const rpm = b.rpmVis, segs = 26, sw = (dw - 20) / segs;
  const shiftNow = rpm > 17300;
  for (let k = 0; k < segs; k++) {
    const th = 4000 + k * (14000 / segs); const on = rpm >= th;
    let col = k < segs * 0.6 ? '#3ad17a' : k < segs * 0.82 ? '#ffcf1f' : '#e3312a';
    if (shiftNow && (performance.now() / 70 | 0) % 2) col = '#4cc3ff';
    ctx.fillStyle = on ? col : 'rgba(255,255,255,.08)'; ctx.fillRect(dx + 10 + k * sw, dy + 8, sw - 2, 6);
  }
  txt(String(Math.round(b.v * 3.6)), dx + 10, dy + 50, 34, '#fff', 800, 'left', true);
  txt('KM/H', dx + 12, dy + 62, 10, '#8d9aa4', 600);
  const gx = dx + dw - 46;
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(gx, dy + 20, 36, 34);
  txt(String(b.gear), gx + 18, dy + 46, 30, b.overrev > 0 ? '#e3312a' : (b.shiftFlash > 0 ? '#ffffff' : '#ffcf1f'), 800, 'center', true);
  // lean bar: the middle is upright, the bar fills towards the side the bike leans to
  const lx = dx + 10, lw = dw - 20, ly = dy + 68, mid = lx + lw / 2, f = clamp(b.lean / PHYS.maxLean, -1, 1);
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(lx, ly, lw, 6);
  ctx.fillStyle = b.slip > 0.05 ? '#e3312a' : Math.abs(b.lean) / DEG > 55 ? '#ffcf1f' : '#e9edf0';
  ctx.fillRect(Math.min(mid, mid + f * lw / 2), ly, Math.abs(f) * lw / 2, 6);
  ctx.fillStyle = '#8d9aa4'; ctx.fillRect(mid - 0.5, ly - 2, 1, 10);
  txt(Math.round(Math.abs(b.lean) / DEG) + '°', mid, ly - 6, 11, '#c9d2d8', 700, 'center');
  if (b.slip > 0.08) txt('SLIDE', dx + dw - 10, dy + 80, 10, '#e3312a', 800, 'right');
}
// phone HUD (GDD 11g): stopwatch top left, next corner top centre with the gaps under it
function drawPhoneTop(b, st, pos) {
  const PAD = 16, x = PAD, w = 168, race = W.mode === 'race';
  panel(x, PAD, w, 58);
  txt(race ? 'P' + pos + '  LAP ' + Math.min(W.totalLaps, b.lap + 1) + '/' + W.totalLaps : b.outLap ? 'OUT LAP' : 'LAP ' + (b.laps.length + 1) + (W.mode === 'quali' ? '/3' : ''), x + 8, PAD + 15, 12, '#ffcf1f', 800, 'left', true);
  const cur = (b.outLap || b.trainHold || (race && W.phase !== 'run')) ? 0 : W.time - b.lapStartT;
  txt(b.outLap ? '–:––.–––' : fmtTime(cur), x + 8, PAD + 38, 20, b.lapInv && !race ? '#e3312a' : '#fff', 700, 'left');
  if (race && b.pen > 0) txt('PEN +' + b.pen.toFixed(1), x + w - 8, PAD + 15, 11, '#e3312a', 800, 'right'); // GDD 6a
  if (W.bestTrace && !b.outLap) { const bin = Math.floor(b.s / 10); const bt = W.bestTrace[bin], ct = W.curTrace[bin]; if (bt > 0 && ct > 0) { const dlt = ct - bt; txt((dlt >= 0 ? '+' : '−') + Math.abs(dlt).toFixed(2), x + w - 8, PAD + 38, 13, dlt <= 0 ? '#3ad17a' : '#e3312a', 800, 'right'); } }
  txt('B ' + (b.bestLap ? fmtTime(b.bestLap) : '–') + '   L ' + (b.lastLap ? fmtTime(b.lastLap) : '–'), x + 8, PAD + 52, 10, '#8d9aa4', 600);
  const cz = !b.crashed && !b.inPitLane ? cornerAhead(b) : null;
  if (cz) drawCountdown(b, cz, VW / 2 - 100, PAD, 200);
  txt(T.cornerAt(b.s).toUpperCase(), VW / 2, PAD + 58, 12, 'rgba(255,255,255,.75)', 700, 'center', true);
  if (race && W.phase === 'run') {
    const ahead = st[pos - 2], behind = st[pos], g0 = gapOf(b);
    if (ahead && !ahead.dnf) txt('▲ ' + ahead.short + ' ' + Math.max(0, g0 - gapOf(ahead)).toFixed(3), VW / 2 - 60, PAD + 74, 11, '#c9d2d8', 600, 'center');
    if (behind && !behind.dnf && !b.finished) txt('▼ ' + behind.short + ' ' + Math.max(0, gapOf(behind) - g0).toFixed(3), VW / 2 + 60, PAD + 74, 11, '#c9d2d8', 600, 'center');
  }
  if (HUD.lapFlash) { const f = HUD.lapFlash; ctx.globalAlpha = Math.max(0, Math.min(1, (5 - f.age) * 2)); txt((f.inv ? 'INVALID  ' : f.rec ? 'NEW ALL-TIME BEST  ' : f.pb ? 'SESSION BEST  ' : 'LAP  ') + fmtTime(f.t), VW / 2, PAD + 96, 20, f.inv ? '#e3312a' : f.pb ? '#b46bff' : '#fff', 800, 'center', true); ctx.globalAlpha = 1; }
}
function drawHUD(dt) {
  const b = W.player; if (!b) return;
  const L = Math.max(16, 0) + 0, PAD = 16;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textBaseline = 'alphabetic';
  const small = VW < 760;
  const ph = Touch.on, st = standings(), pos = st.indexOf(b) + 1, tiny = VW < 640, cy = PAD;
  if (ph) fuelWarn(b);
  if (ph) drawPhoneDash(b); else {
  // ---- dashboard (bottom-left)
  const dw = small ? 270 : 330, dh = 138, dx = PAD, dy = VH - dh - PAD;
  drawLongLapBoard(b, dy);
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
  }
  // ---- right status panel: fuel / damage / aids (not on phones)
  if (!ph) {
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
  drawTags(b, rx, ry, rw);
  }
  if (ph) drawTags(b, VW - PAD - 170, VH - 100, 170);
  // ---- top centre: lap / position / timing
  if (ph) drawPhoneTop(b, st, pos); else {
  const cw = small ? 300 : 380, cx = VW / 2 - cw / 2;
  panel(cx, cy, cw, 80);
  if (W.mode === 'race') {
    txt('P' + pos, cx + 16, cy + 50, 46, '#ffcf1f', 800, 'left', true);
    txt('/' + st.length, cx + 16 + ctx.measureText('P' + pos).width + 4, cy + 50, 18, '#8d9aa4', 700);
    txt('LAP', cx + cw - 16, cy + 22, 12, '#8d9aa4', 600, 'right');
    txt(Math.min(W.totalLaps, b.lap + 1) + '/' + W.totalLaps, cx + cw - 16, cy + 52, 30, '#fff', 800, 'right', true);
  } else {
    txt(W.mode === 'quali' ? 'QUALIFYING' : W.train ? 'CURVE TRAINING' : 'PRACTICE', cx + 16, cy + 26, 15, '#ffcf1f', 800, 'left', true);
    txt(b.outLap ? 'OUT LAP' : 'LAP ' + (b.laps.length + 1) + (W.mode === 'quali' ? '/3' : ''), cx + 16, cy + 54, 26, '#fff', 800, 'left', true);
  }
  const cur = (b.outLap || b.trainHold || (W.mode === 'race' && W.phase !== 'run')) ? 0 : W.time - b.lapStartT;
  const tx = cx + cw / 2 + (W.mode === 'race' ? -10 : 30);
  txt(b.outLap ? '–:––.–––' : fmtTime(cur), tx, cy + 36, 26, b.lapInv && W.mode !== 'race' ? '#e3312a' : '#fff', 700, 'center');
  if (W.mode === 'race' && b.pen > 0) txt('PEN +' + b.pen.toFixed(1) + ' s', cx + cw - 16, cy + 68, 11, '#e3312a', 800, 'right'); // GDD 6a
  // live delta to best lap
  if (W.bestTrace && !b.outLap) { const bin = Math.floor(b.s / 10); const bt = W.bestTrace[bin], ct = W.curTrace[bin]; if (bt > 0 && ct > 0) { const dlt = ct - bt; txt((dlt >= 0 ? '+' : '−') + Math.abs(dlt).toFixed(2), tx, cy + 58, 16, dlt <= 0 ? '#3ad17a' : '#e3312a', 800, 'center'); } }
  txt('LAST ' + (b.lastLap ? fmtTime(b.lastLap) : '–') + '   BEST ' + (b.bestLap ? fmtTime(b.bestLap) : '–') + (Records.d.traceT ? '   PB ' + fmtTime(Records.d.traceT) : ''), tx, cy + 74, 12, '#8d9aa4', 600, 'center');
  // sector strip
  for (let k = 0; k < 3; k++) { const f = HUD.secFlash[k]; const sx = cx + 8 + k * (cw - 16) / 3; ctx.fillStyle = f && (b.cp > k || HUD.lapFlash) ? (f.pb ? '#b46bff' : '#ffcf1f') : 'rgba(255,255,255,.1)'; if (f && f.pb && f.best && f.t < f.best) ctx.fillStyle = '#b46bff'; else if (f && f.best && f.t >= f.best) ctx.fillStyle = '#ffcf1f'; else if (f && !f.best) ctx.fillStyle = '#3ad17a'; if (!f || (b.cp <= k && !(k === 2 && HUD.lapFlash))) ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(sx, cy + 84, (cw - 16) / 3 - 4, 4); }
  // corner name
  const showGuide = W.guide && !b.crashed && !b.inPitLane && !ph; let gOff = showGuide ? 62 : 0; // no speed guide panel on phones (GDD 9, 11g)
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
  if (HUD.lapFlash) { const f = HUD.lapFlash; ctx.globalAlpha = Math.max(0, Math.min(1, (5 - f.age) * 2)); txt((f.inv ? 'INVALID  ' : f.rec ? 'NEW ALL-TIME BEST  ' : f.pb ? 'SESSION BEST  ' : 'LAP  ') + fmtTime(f.t), VW / 2, cy + 152 + gOff, 20, f.inv ? '#e3312a' : f.pb ? '#b46bff' : '#fff', 800, 'center', true); ctx.globalAlpha = 1; }
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
    txt('Press W to leave now', px + 14, py + 61, 13, '#c9d2d8', 600);
  }
  // ---- messages
  if (HUD.m) {
    const m = HUD.m; const a = Math.min(1, m.age * 6, (m.dur - m.age) * 3);
    ctx.globalAlpha = Math.max(0, a);
    txt(m.t, VW / 2, VH * 0.36, small ? 40 : 58, m.col, 800, 'center', true);
    if (m.sub) txt(m.sub, VW / 2, VH * 0.36 + 30, 17, '#e9edf0', 600, 'center');
    ctx.globalAlpha = 1;
  }
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
  if (b.trainHold) { panel(VW / 2 - 190, VH * 0.36 + 44, 380, 34, 0.85); txt('Press W, S, A or D to go · R puts you back ' + (W.gridStart ? 'on the grid' : 'here'), VW / 2, VH * 0.36 + 66, 15, '#e9edf0', 700, 'center'); }
  if (b.crashed) { txt('Recovering rider…', VW / 2, VH * 0.36 + 56, 15, '#c9d2d8', 600, 'center'); }
}

// replay HUD (GDD 11e): gap panel, followed bike's speed / lap, name tags, countdown, minimap
const RP_LBL = { practice: 'Practice', quali: 'Quali', sprint: 'Race 10', gp: 'GP' };
function drawReplayHUD() {
  const PAD = 16, b = W.player; if (!b) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.textBaseline = 'alphabetic';
  const it = RP.items[RP.follow] || RP.items[0], barH = 92;
  // gap panel
  const rows = RP.items, rowH = 21, w = 300; panel(PAD, PAD, w, rows.length * rowH + 30, 0.8);
  txt('REPLAY · ' + (RP.align === 'best' ? 'BEST LAPS' : RP.align === 'lap' ? 'LAP ' + RP.lapN : 'SESSION START'), PAD + 10, PAD + 18, 13, '#ffcf1f', 800, 'left', true);
  const bestT = Math.min(...rows.filter(r => r.on && r.lapT).map(r => r.lapT));
  rows.forEach((r, k) => {
    const y = PAD + 26 + k * rowH, d = new Date(r.R.date);
    if (r === it) { ctx.fillStyle = 'rgba(255,207,31,.16)'; ctx.fillRect(PAD + 2, y, w - 4, rowH); }
    ctx.fillStyle = TEAMS[r.g.team].c1; ctx.fillRect(PAD + 8, y + 4, 4, rowH - 8);
    ctx.globalAlpha = r.on ? 1 : 0.4;
    txt(r.g.short + ' ' + (RP_LBL[r.R.kind] || r.R.mode) + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '. ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), PAD + 18, y + 15, 13, '#fff', 700);
    if (r.lapT) txt(fmtTime(r.lapT), PAD + w - 76, y + 15, 12, r.lapT === bestT ? '#b46bff' : '#c9d2d8', 600, 'right');
    const g = RP.gap(r);
    txt(k === 0 ? 'REF' : !r.on ? 'NO LAP' : g === null ? '' : (g >= 0 ? '+' : '\u2212') + Math.abs(g).toFixed(2), PAD + w - 10, y + 15, 13, k === 0 ? '#ffcf1f' : g === null ? '#8d9aa4' : g <= 0 ? '#3ad17a' : '#e3312a', 800, 'right');
    ctx.globalAlpha = 1;
  });
  // followed bike: speed, lean, lap and lap time
  const cw = 320, cx = VW / 2 - cw / 2; panel(cx, PAD, cw, 62);
  txt('#' + b.num + ' ' + b.name.toUpperCase(), cx + 14, PAD + 22, 14, '#ffcf1f', 800, 'left', true);
  txt(it.lap ? 'LAP ' + it.lap : 'OUT LAP', cx + 14, PAD + 48, 22, '#fff', 800, 'left', true);
  txt(it.lap ? fmtTime(it.rt - it.lapStart) : '\u2013:\u2013\u2013.\u2013\u2013\u2013', cx + cw - 14, PAD + 48, 24, '#fff', 700, 'right');
  txt('BEST ' + (it.best ? fmtTime(it.best.time) : '\u2013'), cx + cw - 14, PAD + 22, 12, '#8d9aa4', 600, 'right');
  const dy = VH - barH - 90; panel(PAD, dy, 230, 76);
  txt(String(Math.round(b.v * 3.6)), PAD + 14, dy + 52, 46, '#fff', 800, 'left', true); txt('KM/H', PAD + 16, dy + 68, 12, '#8d9aa4', 600);
  const ld = Math.round(Math.abs(b.lean) / DEG); txt(ld + '\u00B0', PAD + 200, dy + 46, 24, ld > 55 ? '#ffcf1f' : '#e9edf0', 800, 'right', true); txt('LEAN', PAD + 200, dy + 64, 11, '#8d9aa4', 600, 'right');
  const cz = cornerAhead(b); if (cz) drawCountdown(b, cz, VW / 2 - 125, PAD + 70, 250);
  txt(T.cornerAt(b.s).toUpperCase(), VW / 2, PAD + (cz ? 134 : 84), 14, 'rgba(255,255,255,.75)', 700, 'center', true);
  if (VW >= 640) drawMinimap(b);
  for (const r of RP.items) {
    const o = r.g; if (!o.show || o === b) continue; const dd = Math.hypot(o.x - b.x, o.y - b.y); if (dd > 120) continue;
    const [sx, sy] = worldToScreen(o.x, o.y); if (sx < 0 || sy < 0 || sx > VW || sy > VH) continue;
    const label = o.short + ' ' + (RP_LBL[r.R.kind] || ''); ctx.font = `700 12px ${FD}`; const tw = ctx.measureText(label).width + 10;
    ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(9,13,16,.75)'; ctx.fillRect(sx - tw / 2, sy - 34, tw, 16); ctx.fillStyle = TEAMS[o.team].c1; ctx.fillRect(sx - tw / 2, sy - 34, 3, 16);
    txt(label, sx + 1, sy - 22, 12, '#fff', 700, 'center'); ctx.globalAlpha = 1;
  }
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
  const PAD = 16, rowH = Touch.on ? 15 : 19; const show = W.mode === 'race' ? st : null;
  const x = PAD, y = PAD + (Touch.on ? 66 : 0); // phones: under the stopwatch
  if (W.mode === 'race') {
    const maxRows = Math.max(6, Math.floor((VH - 200 - y - 40) / rowH));
    let rows = st; let start = 0;
    if (rows.length > maxRows) { const mi = st.indexOf(me); start = clamp(mi - Math.floor(maxRows / 2), 0, st.length - maxRows); rows = st.slice(start, start + maxRows); }
    const w = VW < 760 || Touch.on ? 150 : 190; panel(x, y, w, rows.length * rowH + 30, 0.78);
    txt(W.flag ? 'CHEQUERED' : 'LAP ' + Math.min(W.totalLaps, (st[0].lap + 1)) + '/' + W.totalLaps, x + 10, y + 18, 13, W.flag ? '#fff' : '#ffcf1f', 800, 'left', true);
    const lead = gapOf(st[0]) || 0;
    rows.forEach((o, k) => {
      const yy = y + 26 + k * rowH; const p = start + k + 1;
      if (o === me) { ctx.fillStyle = 'rgba(255,207,31,.18)'; ctx.fillRect(x + 2, yy, w - 4, rowH); }
      txt(String(p), x + 22, yy + 14, 14, o === me ? '#ffcf1f' : '#fff', 800, 'right', true);
      ctx.fillStyle = TEAMS[o.team].c1; ctx.fillRect(x + 28, yy + 3, 4, rowH - 6);
      txt(o.short, x + 38, yy + 14, 14, o.ghost ? '#9fd8ff' : '#fff', 700);
      if (o.ghost) txt('G', x + 38 + ctx.measureText(o.short).width + 4, yy + 14, 10, '#9fd8ff', 800);
      else if (o.pen > 0) txt('+' + o.pen.toFixed(0) + 's', x + 38 + ctx.measureText(o.short).width + 4, yy + 14, 10, '#e3312a', 800);
      let g = '';
      if (o.dnf) g = 'OUT'; else if (o.crashed) g = 'CRASH'; else if (o.inPitLane) g = 'PIT'; else if (o.finished) g = '🏁'.length ? 'FIN' : ''; else if (p === 1) g = 'Leader'; else { const lapsDown = st[0].lap - o.lap - (st[0].s < o.s ? 1 : 0); g = lapsDown >= 1 ? '+' + lapsDown + ' LAP' : '+' + ((gapOf(o) || 0) - lead).toFixed(1); }
      txt(g, x + w - 10, yy + 14, 13, g === 'PIT' ? '#ffcf1f' : (g === 'OUT' || g === 'CRASH') ? '#e3312a' : '#c9d2d8', 600, 'right');
    });
  } else {
    if (Touch.on && W.mode !== 'quali') return; // no lap list on phones (GDD 11g)
    let rows;
    if (W.mode === 'quali') rows = W.qualiAI.map(q => ({ short: q.name.split(' ').slice(-1)[0].toUpperCase().slice(0, 3), t: q.best, me: false, c: '#8d9aa4' })).concat([{ short: me.short, t: me.bestLap || 1e9, me: true }]).sort((a, c) => a.t - c.t);
    else { rows = me.laps.slice(-12).map((t, k, arr) => { const n = me.laps.length - arr.length + k, inv = me.lapsInv[n]; return { short: 'LAP ' + (n + 1) + (inv ? ' INV' : ''), t, me: !inv && t === me.bestLap, inv }; }); if (Records.d.traceT) rows.unshift({ short: 'ALL-TIME', t: Records.d.traceT, me: false, rec: true }); const gr = []; for (const g of W.ghosts) { gr.push({ short: 'GHOST ' + g.short, t: g.recBest || 1e9, me: false, gh: true }); if (g.sync === 'rec') g.laps.forEach((t, j) => gr.push({ short: g.short + ' LAP ' + (j + 1), t, me: false, gh: true })); } rows.splice(Records.d.traceT ? 1 : 0, 0, ...gr); }
    const maxRows = Math.max(6, Math.floor((VH - 200 - 56) / rowH)); let start = 0;
    if (rows.length > maxRows) { const mi = rows.findIndex(r => r.me); start = clamp(mi - Math.floor(maxRows / 2), 0, rows.length - maxRows); }
    const vis = rows.slice(start, start + maxRows);
    const w = VW < 760 || Touch.on ? 150 : 190; panel(x, y, w, Math.max(1, vis.length) * rowH + 30, 0.78);
    txt(W.mode === 'quali' ? 'QUALIFYING' : 'YOUR LAPS', x + 10, y + 18, 13, '#ffcf1f', 800, 'left', true);
    vis.forEach((r, k) => {
      const yy = y + 26 + k * rowH;
      if (r.me) { ctx.fillStyle = W.mode === 'quali' ? 'rgba(255,207,31,.18)' : 'rgba(180,107,255,.2)'; ctx.fillRect(x + 2, yy, w - 4, rowH); }
      if (W.mode === 'quali') txt(String(start + k + 1), x + 22, yy + 14, 14, r.me ? '#ffcf1f' : '#fff', 800, 'right', true);
      const rc = r.rec ? '#b46bff' : r.gh ? '#9fd8ff' : r.inv ? '#e3312a' : null;
      txt(r.short, x + (W.mode === 'quali' ? 30 : 10), yy + 14, 14, rc || '#fff', 700);
      txt(r.t < 1e8 ? fmtTime(r.t) : 'NO TIME', x + w - 10, yy + 14, 13, rc || '#c9d2d8', 600, 'right');
    });
  }
}
// results Pen column (GDD 6a): time penalty, Long Laps given, last lap position drop
function penCell(b) { const p = []; if (b.pen > 0) p.push('+' + b.pen.toFixed(1) + ' s'); if (b.llGiven) p.push(b.llGiven + ' LL'); if (b.dropBehind && b.dropPen > 0) p.push('−1 pos'); return p.join(' · '); }
// Long Lap board (GDD 6a): above the dashboard while a Long Lap is pending
function drawLongLapBoard(b, dashTop) {
  if (W.mode !== 'race' || !b.llPend?.length || b.finished) return;
  const x = 16, w = 190, y = dashTop - 46, left = b.llPend[0].until - b.lap;
  panel(x, y, w, 38, 0.88); ctx.fillStyle = '#e3312a'; ctx.fillRect(x, y, 4, 38);
  txt('LONG LAP' + (b.llPend.length > 1 ? ' ×' + b.llPend.length : ''), x + 12, y + 16, 14, '#ffcf1f', 800, 'left', true);
  txt(T.LL.name + ' · ' + left + ' lap' + (left > 1 ? 's' : '') + ' left', x + 12, y + 32, 12, '#e9edf0', 600);
}
function drawMinimap(me) {
  const M = HUD.mini; if (!M) return; const S = VW < 760 || Touch.on ? 140 : M.S; const x = VW - S - 16, y = 16;
  panel(x, y, S, S, 0.7); ctx.drawImage(M.c, x, y, S, S); const k = S / M.S;
  const by = T.PIT.boxS(me.box); const [bx0, by0] = M.tf(...T.pt(T.idx(by), T.PIT.boxD * 0.6));
  if ((performance.now() / 300 | 0) % 2) { ctx.strokeStyle = TEAMS[me.team].c1; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + bx0 * k, y + by0 * k, 5, 0, TAU); ctx.stroke(); }
  if (W.mode === 'race' && me.llPend?.length && (performance.now() / 300 | 0) % 2) { const [lx, ly] = M.tf(...T.pt(T.idx(T.LL.sM), T.LL.sg * T.LL.off(T.LL.sM))); ctx.strokeStyle = '#ffcf1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + lx * k, y + ly * k, 6, 0, TAU); ctx.stroke(); } // Long Lap pending (GDD 6a)
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
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') && !(UI.state === 'replay' && (e.target.id === 'rPos' || e.code === 'Escape' || e.code === 'Space'))) return;
  if (GAME_KEYS.has(e.code) && UI.state === 'play') e.preventDefault();
  Input.k[e.code] = true;
  if (e.repeat) return;
  const b = W.player;
  if (UI.state === 'play' && b && !W.paused) {
    if (e.code === 'KeyO' && !b.auto) shift(b, 1);
    if (e.code === 'KeyL' && !b.auto) shift(b, -1);
  }
  if (UI.state === 'replay') {
    const k = e.code; let used = true;
    if (k === 'Space') RP.toggle(); else if (k === 'ArrowLeft') RP.seek(RP.t - 5); else if (k === 'ArrowRight') RP.seek(RP.t + 5);
    else if (k === 'ArrowUp') RP.faster(1); else if (k === 'ArrowDown') RP.faster(-1); else if (k === 'BracketLeft') RP.lapJump(-1); else if (k === 'BracketRight') RP.lapJump(1);
    else if (k === 'Tab') RP.cycle(); else if (k === 'KeyC') camCycle(); else if (k === 'Escape') RP.close(); else used = false;
    if (used) e.preventDefault(); return;
  }
  if (e.code === 'KeyC' && UI.state === 'play') camCycle();
  if (e.code === 'KeyR' && UI.state === 'play' && W.mode === 'practice' && !W.paused) UI.launch('practice', {}); // back to the spot or the grid slot, ghosts re-synced (GDD 2a, 11d)
  if (e.code === 'Escape' && (UI.state === 'play')) UI.togglePause();
  if (e.code === 'KeyM') Sound.on = !Sound.on;
});
// C and the replay Camera button: Behind -> CLOSE -> Top-down -> Behind; also sets the start-screen option (GDD 11a)
function camCycle() {
  setCamMode(CAM_ORDER[(CAM_ORDER.indexOf(CAM.mode) + 1) % CAM_ORDER.length]);
  UI.opts.cam = CAM.mode; UI.sync();
  if (UI.state === 'play' && W.paused) UI.camIn(camTilted());
  HUD.msg('CAMERA', CAM_NAME[CAM.mode], '#4cc3ff', 1.2);
}
window.addEventListener('keyup', e => { Input.k[e.code] = false; });
// iPhone pinch gestures zoom the page; the game never needs them (GDD 3a)
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, e => e.preventDefault());
window.addEventListener('blur', () => { Input.k = {}; Touch.reset(); if (UI.state === 'play' && !W.paused) UI.togglePause(); });

// ---------------------------------------------------------------------------
// Menus / flow
// ---------------------------------------------------------------------------
// Touch and tilt controls for phones (GDD 3a, since 1.18.0): brake and throttle halves of the screen, lean from the
// phone's roll angle. Keyboard input is unchanged; world.js reads Touch.on, Touch.gas, Touch.brk and Touch.tilt.
const coarseMQ = matchMedia('(pointer: coarse)'), portraitMQ = matchMedia('(orientation: portrait)');
const Touch = {
  on: false, gas: false, brk: false, tilt: 0, tiltOk: false, listening: false,
  pts: new Map(), roll: 0, roll0: 0, rollSeen: false,
  want() { return UI.opts.controls === 'touch' || (UI.opts.controls !== 'keys' && coarseMQ.matches); },
  // the screen half that drives a control: brake on the left unless the option swaps the sides
  zone(x) { return (x < innerWidth / 2) === (UI.opts.side !== 'gas') ? 'brk' : 'gas'; },
  sens() { return { verylow: 75, low: 60, high: 35 }[UI.opts.tilt] || 60; },
  angle() { return screen.orientation ? screen.orientation.angle : 0; },
  press(e) {
    e.preventDefault();
    const sel = getSelection(); if (sel && sel.rangeCount) sel.removeAllRanges(); // a selection that slipped through is cleared (GDD 3a)
    if (UI.state === 'replay') { const f = e.clientX / innerWidth; if (f < 1 / 3) RP.seek(RP.t - 5); else if (f > 2 / 3) RP.seek(RP.t + 5); else RP.toggle(); return; }
    if (UI.state !== 'play' || W.paused) return;
    this.pts.set(e.pointerId, this.zone(e.clientX)); this.refresh();
  },
  release(e) { if (this.pts.delete(e.pointerId)) this.refresh(); },
  refresh() { const v = [...this.pts.values()]; this.gas = v.includes('gas'); this.brk = v.includes('brk'); },
  reset() { this.pts.clear(); this.refresh(); },
  // roll angle of the phone in the screen plane: 0 when the screen is upright, positive when the right side is lower
  motion(e) {
    const g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
    const a = this.angle();
    const [sx, sy] = a === 90 ? [g.y, -g.x] : a === 270 ? [-g.y, g.x] : a === 180 ? [-g.x, -g.y] : [g.x, g.y];
    const r = -Math.atan2(sx, sy);
    if (!this.rollSeen) { this.roll = this.roll0 = r; this.rollSeen = true; }
    this.roll += (r - this.roll) * 0.25;
    const d = (this.roll - this.roll0) * 180 / Math.PI;
    this.tilt = Math.sign(d) * clamp((Math.abs(d) - 12) / (this.sens() - 12), 0, 1); // 12 degree dead zone, full lean at the sensitivity angle
  },
  // iPhone asks for motion access once, from a tap; the zero point is set again at each start
  enable() {
    this.tiltOk = false;
    if (typeof DeviceMotionEvent === 'undefined') return Promise.resolve(false);
    const ask = DeviceMotionEvent.requestPermission ? DeviceMotionEvent.requestPermission() : Promise.resolve('granted');
    return ask.then(r => {
      if (r !== 'granted') return false;
      if (!this.listening) { addEventListener('devicemotion', e => this.motion(e)); this.listening = true; }
      this.rollSeen = false; this.tilt = 0; this.tiltOk = true; return true;
    }, () => false);
  },
  recentre() { this.roll0 = this.roll; this.tilt = 0; },
  // option rows, labels for the two halves (GDD 4, 3a)
  opts() {
    const t = this.want(), brkLeft = UI.opts.side !== 'gas', z = $('touch').children;
    $('optTrans').closest('.opt').hidden = t; // phones are always automatic
    $('optSideWrap').hidden = !t; $('optTiltWrap').hidden = !t;
    z[0].dataset.z = brkLeft ? 'brk' : 'gas'; z[1].dataset.z = brkLeft ? 'gas' : 'brk';
    z[0].firstElementChild.textContent = brkLeft ? 'Brake' : 'Gas'; z[1].firstElementChild.textContent = brkLeft ? 'Gas' : 'Brake';
  },
  // every frame: show the layer for play and replay, the pause button in play, the turn prompt in portrait
  sync() {
    this.on = this.want();
    const st = UI.state, show = this.on && (st === 'play' || st === 'replay'), turn = show && portraitMQ.matches;
    const set = (el, hide) => { if (el.hidden !== hide) el.hidden = hide; };
    set($('touch'), !show); set($('touchPause'), !(show && st === 'play')); set($('turn'), !turn);
    set($('btnCentre'), !(this.on && this.tiltOk));
    for (const s of $('touch').querySelectorAll('span')) set(s, st !== 'play');
    if (turn && st === 'play' && !W.paused) UI.togglePause();
    if (!show) this.reset();
  },
};
const $ = id => document.getElementById(id);
const UI = {
  state: 'menu', opts: { mode: 'sprint', trans: 'manual', controls: 'auto', side: 'brk', tilt: 'low', aids: 'on', ai: 'pro', cam: 'behind', guide: 'on', blur: 'on', fx: 'on', train: 'on', trainS: -1, trainV: -1, fuel: 100, grid: 'mid', name: 'Petr', num: 25, team: 2 },
  init() {
    try { const s = JSON.parse(localStorage.getItem('sgp_opts') || 'null'); if (s) { if (!CAM_ORDER.includes(s.cam)) delete s.cam; if (!s.trainDef) delete s.train; Object.assign(this.opts, s); } this.opts.trainDef = 1; } catch (e) { }
    const sel = $('optTeam'); TEAMS.forEach((t, k) => { const o = document.createElement('option'); o.value = k; o.textContent = t.name; sel.appendChild(o); });
    document.querySelectorAll('.mode').forEach(m => m.addEventListener('click', () => { this.opts.mode = m.dataset.mode; this.sync(); }));
    for (const [id, key] of [['optTrans', 'trans'], ['optAids', 'aids'], ['optAI', 'ai'], ['optCam', 'cam'], ['optGuide', 'guide'], ['optBlur', 'blur'], ['optFx', 'fx'], ['optTrain', 'train'], ['optCtl', 'controls'], ['optSide', 'side'], ['optTilt', 'tilt']]) $(id).querySelectorAll('button').forEach(bt => bt.addEventListener('click', () => { this.opts[key] = bt.dataset.v; this.sync(); }));
    $('optFuel').addEventListener('input', e => { this.opts.fuel = +e.target.value; this.sync(); });
    $('optGrid').addEventListener('change', e => { this.opts.grid = e.target.value; });
    $('optTeam').addEventListener('change', e => { this.opts.team = +e.target.value; });
    $('optName').addEventListener('input', e => { this.opts.name = e.target.value.trim() || 'Rider'; });
    $('optNum').addEventListener('input', e => { this.opts.num = clamp(parseInt(e.target.value) || 25, 1, 99); });
    $('btnStart').addEventListener('click', () => this.start());
    $('btnClearRec').addEventListener('click', e => { const bt = e.currentTarget; if (bt.dataset.armed) { Records.clear(); delete bt.dataset.armed; this.renderRecords(); } else { bt.dataset.armed = '1'; bt.textContent = 'Click again to delete all saved laps'; setTimeout(() => { delete bt.dataset.armed; this.renderRecords(); }, 3500); } });
    $('btnResume').addEventListener('click', () => this.togglePause());
    $('btnCentre').addEventListener('click', () => Touch.recentre());
    $('touch').addEventListener('pointerdown', e => Touch.press(e));
    // iPhone WebKit (Safari, Brave) runs its long-press selection, magnifier and double-tap / pinch zoom unless the touch
    // events themselves are cancelled; a cancelled pointerdown is not enough. Pointer events still fire (GDD 3a, 1.19.7)
    for (const t of ['touchstart', 'touchmove', 'touchend']) $('touch').addEventListener(t, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    const inGame = () => this.state === 'play' || this.state === 'replay';
    for (const t of ['selectstart', 'contextmenu']) document.addEventListener(t, e => { if (inGame() && !e.target.closest('input,textarea,select')) e.preventDefault(); });
    addEventListener('pointerup', e => Touch.release(e)); addEventListener('pointercancel', e => Touch.release(e));
    $('touchPause').addEventListener('click', () => this.togglePause());
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
      else if (bt.dataset.act === 'sync') Lib.setSync(id);
      else if (bt.dataset.act === 'replay') RP.open([Lib.data[id]], 'menu');
      else if (bt.dataset.act === 'cmp') { const k = Lib.cmp.indexOf(id); if (k >= 0) Lib.cmp.splice(k, 1); else if (Lib.cmp.length < RP_MAX) Lib.cmp.push(id); this.renderLib(); }
      else if (bt.dataset.act === 'export') Lib.get(id).then(R => Lib.export(R));
      else if (bt.dataset.act === 'del') { if (bt.dataset.armed) Lib.del(id); else { bt.dataset.armed = '1'; bt.textContent = 'Sure?'; setTimeout(() => this.renderLib(), 3000); } }
    });
    Lib.onChange = () => this.renderLib();
    $('btnReplaySel').addEventListener('click', () => RP.open(Lib.cmp.map(id => Lib.data[id]), 'menu'));
    $('btnWatch').addEventListener('click', () => { const R = Rec.snapshot(); if (R && R.samples.x.length > 5) { $('pause').hidden = true; RP.open([R], 'pause'); } });
    this.rbarInit();
    this.sync();
  },
  sync() {
    const o = this.opts;
    document.querySelectorAll('.mode').forEach(m => m.setAttribute('aria-pressed', String(m.dataset.mode === o.mode)));
    for (const [id, key] of [['optTrans', 'trans'], ['optAids', 'aids'], ['optAI', 'ai'], ['optCam', 'cam'], ['optGuide', 'guide'], ['optBlur', 'blur'], ['optFx', 'fx'], ['optTrain', 'train'], ['optCtl', 'controls'], ['optSide', 'side'], ['optTilt', 'tilt']]) $(id).querySelectorAll('button').forEach(bt => bt.setAttribute('aria-pressed', String(bt.dataset.v === o[key])));
    $('optFuel').value = o.fuel; $('optGrid').value = o.grid; $('optTeam').value = o.team; $('optName').value = o.name; $('optNum').value = o.num;
    const laps = o.mode === 'gp' ? 20 : 10; const L = PHYS.tank * o.fuel / 100; const range = L / PHYS.lapFuel;
    $('optFuelV').textContent = L.toFixed(1) + ' L';
    const minPct = Math.ceil(laps * PHYS.lapFuel / PHYS.tank * 20) * 5; $('optFuelHint').textContent = o.mode === 'practice' ? 'Practice starts with a full tank.' : `About ${range.toFixed(1)} laps on this load. A ${laps} lap race needs at least ${minPct} % of the tank, since there is no refuelling. Less fuel is lighter and faster but risks running dry.`;
    $('optFuelWrap').hidden = o.mode === 'practice'; $('optGuideWrap').hidden = o.mode !== 'practice'; $('optTrainWrap').hidden = o.mode !== 'practice'; $('trainBox').hidden = o.train !== 'on'; this.renderTraining(); this.renderRecords(); $('optGridWrap').hidden = !(o.mode === 'sprint' || (o.mode === 'practice' && o.train !== 'on')); // one setting for the race and the practice grid start (GDD 2a)
    Touch.opts();
    try { localStorage.setItem('sgp_opts', JSON.stringify(o)); } catch (e) { }
  },
  renderRecords() {
    const d = Records.d, el = $('records'); if (!el) return;
    const n = d.laps.length;
    if (!n) { el.innerHTML = '<span class="small">No laps saved yet. Every completed lap you ride is kept in this browser, and your best one becomes the target for the live delta.</span>'; $('btnClearRec').hidden = true; return; }
    const lbl = { practice: 'Practice', quali: 'Qualifying', race: 'Race' };
    const best = Object.keys(lbl).filter(k => d.best[k]).map(k => `<div class="rec"><span class="lbl">${lbl[k]} best</span><b>${fmtTime(d.best[k].t)}</b><span class="small">${new Date(d.best[k].at).toLocaleDateString()}${d.best[k].aids ? '' : ' · no aids'}${d.best[k].auto ? ' · auto' : ''}</span></div>`).join('');
    const last = d.laps.slice(-6).reverse().map(e => `<tr><td>${fmtTime(e.t)}${e.inv ? ' <span class="small">INV</span>' : ''}</td><td>${lbl[e.mode] || e.mode}</td><td class="small">${e.s && e.s.length === 3 ? e.s.map(x => x.toFixed(2)).join(' / ') : ''}</td><td class="small">${new Date(e.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td></tr>`).join('');
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
    $('btnTrainGo').addEventListener('click', () => { o.train = 'on'; this.sync(); this.launch('practice', {}); });
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
  // replay bar (GDD 11e)
  rbarInit() {
    $('rPos').addEventListener('input', e => RP.seek(+e.target.value / 1000 * RP.dur));
    $('rPos').addEventListener('change', e => e.target.blur());
    $('rPlay').addEventListener('click', () => RP.toggle());
    $('rRew').addEventListener('click', () => RP.rew());
    $('rFf').addEventListener('click', () => RP.ff());
    $('rSlow').addEventListener('click', () => RP.slow());
    const norm = document.createElement('button'); norm.className = 'chip'; norm.id = 'rNorm'; norm.title = 'Normal speed'; norm.textContent = '1\u00D7'; $('rSlow').after(norm);
    norm.addEventListener('click', () => RP.setSpeed(1));
    $('rSpeed').title = 'Click for normal speed'; $('rSpeed').style.cursor = 'pointer';
    $('rSpeed').addEventListener('click', () => RP.setSpeed(1));
    $('rPrev').addEventListener('click', () => RP.lapJump(-1));
    $('rNext').addEventListener('click', () => RP.lapJump(1));
    $('rExit').addEventListener('click', () => RP.close());
    $('rCam').addEventListener('click', () => camCycle());
    $('rFollow').addEventListener('click', () => RP.cycle());
    $('rAlign').addEventListener('change', e => { RP.setAlign(e.target.value); this.rbarTicks(); e.target.blur(); });
    $('rLapN').addEventListener('change', e => { RP.lapN = +e.target.value; RP.setAlign('lap'); this.rbarTicks(); e.target.blur(); });
    for (const id of ['rPrev', 'rRew', 'rPlay', 'rFf', 'rNext', 'rSlow', 'rNorm', 'rCam', 'rFollow', 'rExit']) $(id).addEventListener('click', e => e.currentTarget.blur());
  },
  rbarOpen(rp) {
    $('rbar').hidden = false; $('rAlign').value = rp.align;
    const n = Math.max(...rp.items.map(it => it.R.laps.length));
    $('rLapN').innerHTML = Array.from({ length: Math.max(1, n) }, (_, k) => `<option value="${k + 1}">Lap ${k + 1}</option>`).join('');
    $('rFollow').hidden = rp.items.length < 2; this.rbarTicks();
  },
  rbarClose() { $('rbar').hidden = true; },
  rbarTicks() {
    $('rAlign').value = RP.align; $('rLapN').hidden = RP.align !== 'lap'; $('rLapN').value = RP.lapN;
    $('rPrev').disabled = $('rNext').disabled = RP.align !== 'start';
    $('rTicks').innerHTML = RP.laps().map(m => `<span class="${m.best ? 'best' : ''}" style="left:${(m.t / RP.dur * 100).toFixed(3)}%">${m.n}</span>` + (m.best ? `<i style="left:${(m.t / RP.dur * 100).toFixed(3)}%;width:${(m.len / RP.dur * 100).toFixed(3)}%"></i>` : '')).join('');
  },
  rbarUpdate() {
    const pos = $('rPos'); if (document.activeElement !== pos || !this.rDrag) pos.value = (RP.t / RP.dur * 1000).toFixed(1);
    // only touch the DOM when the text changes: rewriting a button's label every frame can swallow clicks (Safari)
    const set = (id, v) => { const el = $(id); if (el.textContent !== v) el.textContent = v; };
    set('rPlay', RP.playing ? 'Pause' : 'Play');
    set('rSpeed', (RP.speed < 0 ? '\u25C0 ' + -RP.speed : RP.speed) + '\u00D7');
    set('rTime', fmtTime(RP.t).replace(/\.\d+$/, m => m.slice(0, 2)) + ' / ' + fmtTime(RP.dur).replace(/\.\d+$/, m => m.slice(0, 2)));
  },
  renderLib() {
    const el = $('recList'); if (!el) return;
    const lbl = { practice: 'Practice', quali: 'Qualifying', sprint: '10 lap race', gp: 'Grand Prix' };
    const src = { auto: '', import: 'imported', folder: 'saved_tracks' };
    $('recStatus').textContent = Lib.status || (Lib.stored ? 'Your last 10 sessions are kept in this browser. Imported and saved_tracks files are loaded for this visit only.' : 'Browser storage is blocked here, recordings are kept until the page closes.');
    $('btnReloadDir').hidden = !Lib.dir; if (Lib.dir) $('btnReloadDir').textContent = 'Reload ' + Lib.dir.name;
    $('recGhostHint').textContent = Lib.ghosts.length ? `${Lib.ghosts.length} ghost${Lib.ghosts.length === 1 ? '' : 's'} selected. They ride with you in Practice and in races (each one replaces a slow AI rider).` : 'Switch on Ghost to ride against a recording in Practice or a race (up to 4).';
    if (Lib.ghosts.length) $('recGhostHint').textContent += ' In Practice they start with you on the grid or the curve-training spot; Sync picks the ghost that stands on the spot with you.';
    Lib.cmp = Lib.cmp.filter(id => Lib.meta.some(m => m.id === id));
    $('btnReplaySel').disabled = !Lib.cmp.length; $('btnReplaySel').textContent = Lib.cmp.length > 1 ? `Replay ${Lib.cmp.length} together` : 'Replay selected';
    if (!Lib.meta.length) { el.innerHTML = '<span class="small">No recordings yet. Every session with a completed lap or a race start is recorded automatically.</span>'; return; }
    el.innerHTML = '<table><thead><tr><th>Ghost</th><th>Replay</th><th>Rider</th><th>Session</th><th>Best lap</th><th>Laps</th><th>Result</th><th>When</th><th></th></tr></thead><tbody>' + Lib.meta.map(m => {
      const on = Lib.ghosts.includes(m.id);
      const res = m.raceStart ? (m.position ? 'P' + m.position + (m.finishT ? ' · ' + fmtTime(m.finishT) : '') : 'DNF') : '';
      const cmp = Lib.cmp.includes(m.id), ref = on && Lib.syncId() === m.id;
      return `<tr><td><button class="chip" data-act="ghost" data-id="${esc(m.id)}" aria-pressed="${on}">${on ? 'Ghost on' : 'Ghost'}</button>${on ? ` <button class="chip" data-act="sync" data-id="${esc(m.id)}" aria-pressed="${ref}" title="Sync reference: stands on the curve-training spot with you">${ref ? '&#10003; Sync' : 'Sync'}</button>` : ''}</td><td><button class="chip" data-act="replay" data-id="${esc(m.id)}">Replay</button> <button class="chip" data-act="cmp" data-id="${esc(m.id)}" aria-pressed="${cmp}">${cmp ? '&#10003; Compare' : 'Compare'}</button></td><td>${sw(clamp(m.rider.team | 0, 0, TEAMS.length - 1))}#${m.rider.num | 0} ${esc(m.rider.name)}</td><td>${lbl[m.kind] || esc(m.mode)}${src[m.src] ? ' <span class="small">· ' + src[m.src] + '</span>' : ''}</td><td>${m.bestLap ? fmtTime(m.bestLap) : '–'}</td><td>${m.laps | 0}</td><td>${res}</td><td class="small">${new Date(m.date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td><button class="chip" data-act="export" data-id="${esc(m.id)}">Export</button> <button class="chip" data-act="del" data-id="${esc(m.id)}">Delete</button></td></tr>`;
    }).join('') + '</tbody></table>';
  },
  hideAll() { for (const id of ['menu', 'pause', 'results']) $(id).hidden = true; this.trainIn(false); this.camIn(false); this.syncIn(false); },
  syncIn(show) { // "Sync ghosts to" in the practice pause menu, with 2 or more ghosts (GDD 11c, 11d)
    let P = $('pauseSync');
    if (!P && show) {
      P = document.createElement('div'); P.id = 'pauseSync'; P.className = 'opts'; P.style.marginTop = '14px';
      P.innerHTML = '<div class="opt" style="grid-column:1/-1"><label for="optSync">Sync ghosts to</label><select id="optSync"></select><span class="hint">This ghost stands on the curve-training spot with you; the others are placed by lap time relative to it. Applies from the next Restart, R or Go to spot.</span></div>';
      $('pauseTrain').after(P);
      $('optSync').addEventListener('change', e => { Lib.setSync(e.target.value); e.target.blur(); });
    }
    if (!P) return;
    const recs = Lib.ghostRecs(); P.hidden = !show || recs.length < 2; if (P.hidden) return;
    $('optSync').innerHTML = recs.map(R => `<option value="${esc(R.id)}">#${R.rider.num | 0} ${esc(R.rider.name)} · ${RP_LBL[R.kind] || esc(R.mode)} · ${R.bestLap ? fmtTime(R.bestLap) : 'no lap'}</option>`).join('');
    $('optSync').value = Lib.syncId();
  },
  trainIn(pause) { // the curve-training block moves between the main menu and the practice pause menu (GDD 11d)
    const el = $('optTrainWrap'), P = $('pauseTrain');
    if (pause) { P.appendChild(el); P.hidden = false; } else if (el.parentNode === P) { $('optGridWrap').before(el); P.hidden = true; }
    $('btnTrainGo').hidden = !pause;
  },
  camIn(show) { // camera tuning panel in the pause menu (GDD 11a); built once, shown for the tilted camera in use (Behind or CLOSE)
    let P = $('pauseCam');
    if (!P && show) {
      P = document.createElement('div'); P.id = 'pauseCam'; P.className = 'opts'; P.style.marginTop = '14px';
      const head = document.createElement('div'); head.className = 'opt'; head.style.gridColumn = '1/-1';
      head.innerHTML = '<span class="lbl" id="camTitle">Camera tuning</span><span class="hint">The view behind this menu updates as you change a value. Each camera keeps its own values, saved in this browser. C switches the camera.</span>';
      P.appendChild(head);
      const refresh = {}, rows = CAM_SET.map(d => {
        const w = document.createElement('div'); w.className = 'opt';
        const id = 'cam_' + d.k, lb = document.createElement('label'); lb.htmlFor = id; lb.textContent = d.lbl + (d.unit ? ' (' + d.unit + ')' : '');
        const rg = document.createElement('input'), nb = document.createElement('input');
        rg.type = 'range'; rg.id = id; nb.type = 'number'; nb.setAttribute('aria-label', d.lbl);
        for (const el of [rg, nb]) { el.min = d.min; el.max = d.max; el.step = d.step; }
        const line = document.createElement('div'); line.style.cssText = 'display:flex;gap:10px;align-items:center';
        nb.style.width = '92px'; nb.style.flex = 'none'; line.append(rg, nb); w.append(lb, line);
        const put = (v, save) => { v = camSet(d, v, save); rg.value = v; if (document.activeElement !== nb || !save) nb.value = v; if (d.rs && save) resize(); if (save && W.paused) CAM.init = false; // paused: the camera barely moves, so snap it to the new zoom/framing
          const pk = { bv0: 'bv1', bv1: 'bv0' }[d.k]; if (save && pk) refresh[pk](); }; // blur start and full speed keep 10 km/h apart
        rg.addEventListener('input', () => put(rg.value, true));
        nb.addEventListener('input', () => { if (nb.value !== '' && isFinite(+nb.value)) put(nb.value, true); });
        nb.addEventListener('change', () => { put(nb.value, true); nb.value = camGet(d); });
        P.appendChild(w); return refresh[d.k] = () => put(camGet(d), false);
      });
      const act = document.createElement('div'); act.style.gridColumn = '1/-1';
      const rb = document.createElement('button'); rb.className = 'chip'; rb.textContent = 'Reset to defaults';
      rb.addEventListener('click', () => { camReset(); resize(); if (W.paused) CAM.init = false; this.camSync(); }); // this camera only
      act.appendChild(rb); P.appendChild(act);
      this.camSync = () => { $('camTitle').textContent = 'Camera tuning (' + CAM_NAME[TILT_CAM] + ')'; rows.forEach(r => r()); };
      $('pause').querySelector('.wrap').appendChild(P);
    }
    if (P) { P.hidden = !show; if (show) this.camSync(); }
  },
  toMenu() { Rec.stop(); this.hideAll(); this.state = 'menu'; W.paused = false; $('menu').hidden = false; this.renderRecords(); },
  start() {
    Sound.start();
    const tilt = Touch.want() ? Touch.enable() : Promise.resolve(true); // the motion request must come from this tap
    this.launch(this.opts.mode === 'gp' ? 'quali' : this.opts.mode, {});
    tilt.then(ok => { if (!ok && Touch.want()) HUD.msg('LEAN OFF', 'Motion access refused: allow it in the browser settings', '#ffcf1f', 4); });
  },
  sessionOpts(extra) {
    const o = this.opts;
    const train = o.mode === 'practice' && o.train === 'on' ? { s: o.trainS, v: o.trainV / 3.6 } : null;
    return Object.assign({ train, syncId: Lib.syncId(), name: o.name, num: o.num, team: o.team, aids: o.aids === 'on', auto: o.trans === 'auto' || Touch.want(), level: o.ai, fuelPct: o.fuel / 100, gridPos: o.grid, guide: o.guide === 'on' }, extra);
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
    $('pauseSub').textContent = W.mode === 'race' ? `Lap ${Math.min(W.totalLaps, W.player.lap + 1)} of ${W.totalLaps}` : W.mode === 'quali' ? 'Qualifying' : W.train ? 'Curve training · restart puts you back on the spot' : 'Free practice · restart puts you back on the grid';
    this.trainIn(W.paused && W.mode === 'practice');
    this.syncIn(W.paused && W.mode === 'practice');
    this.camIn(W.paused && camTilted());
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
      [['Start the race', () => this.launch('gp', { qualiGrid: grid })], ...(rec ? [['Watch replay', () => RP.open([rec], 'results'), true], ['Export session', () => Lib.export(rec), true]] : []), ['Back to menu', () => this.toMenu(), true]]);
  },
  raceResults() {
    // let the rest of the field finish (fast-forward)
    const rec = Rec.stop();
    W.player.autopilot = true;
    let guard = 0; while ((W.bikes.some(b => !b.finished && !b.dnf) || W.ghosts.some(g => !g.finished && !g.dnf)) && guard < 120 * 240) { simStep(SUB); guard++; }
    applyDrop(W.player); // last lap position drop (GDD 6a)
    const st = standings(); const win = st[0];
    const me = W.player; const myPos = st.indexOf(me) + 1;
    let fl = null; for (const b of st) if (b.bestLap && (!fl || b.bestLap < fl.bestLap)) fl = b;
    this.results('Race result', 'British Grand Prix · ' + W.totalLaps + ' laps', me.dnf ? 'You did not finish.' : `You finished P${myPos} of ${st.length}. Fastest lap: #${fl.num} ${fl.name} ${fmtTime(fl.bestLap)}`,
      ['Pos', '#', 'Rider', 'Team', 'Time / gap', 'Best lap', 'Pits', 'Pen'],
      st.map((b, k) => ({ me: b === me, cells: [b.dnf ? 'DNF' : k + 1, b.num, b.ghost ? b.name.replace(' (ghost)', '') + ' · GHOST' : b.name, sw(b.team) + TEAMS[b.team].name, b.dnf ? 'Retired' : k === 0 ? fmtTime(b.finishT + penT(b)) : (b.lap < win.lap ? '+' + (win.lap - b.lap) + ' lap' + (win.lap - b.lap > 1 ? 's' : '') : '+' + (b.finishT + penT(b) - win.finishT - penT(win)).toFixed(3)), b.bestLap ? (b === fl ? '<span class="pb">' + fmtTime(b.bestLap) + '</span>' : fmtTime(b.bestLap)) : '–', b.ghost ? '–' : b.pits, penCell(b)] })),
      [['Race again', () => this.launch(W.kind, W.kind === 'gp' ? { qualiGrid: W.opts.qualiGrid } : {})], ...(rec ? [['Watch replay', () => RP.open([rec], 'results'), true], ['Export session', () => Lib.export(rec), true]] : []), ['Back to menu', () => this.toMenu(), true]]);
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
  Touch.sync();
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // adaptive resolution: drop to 1x pixels if the machine can't keep up
  perfAvg = perfAvg * 0.97 + dt * 0.03; perfN++;
  if (perfN > 180 && perfAvg > 0.024 && DPR_CAP > 1 && UI.state === 'play') { DPR_CAP = 1; resize(); perfN = 0; }
  else if (perfN > 180 && perfAvg > 0.024 && camTilted() && TILT.q > 0.8 && UI.state === 'play') { TILT.q = 0.8; resize(); perfN = 0; }
  if (UI.state === 'play' && !W.paused) {
    acc += dt; let n = 0;
    while (acc >= SUB && n < 16) { simStep(SUB); acc -= SUB; n++; }
    if (n >= 16) acc = 0;
    HUD.step(dt);
    if (W.endTimer > 0) { W.endTimer -= dt; if (W.endTimer <= 0) { if (W.mode === 'race') UI.raceResults(); else if (W.mode === 'quali') UI.finishQuali(); } }
    if (W.mode === 'race' && W.player.dnf && !W.endTimer && !W.resultsShown) { W.resultsShown = true; W.endTimer = 3; }
  }
  if (UI.state === 'replay') { RP.step(dt); UI.rbarUpdate(); }
  if (W.player) {
    // draw riders between the last two physics steps: the frame clock and the 120 Hz physics drift
    // apart, and drawing the last step made the Behind camera stutter (1.11.2)
    const lerpPose = UI.state === 'play' && !W.paused, al = clamp(acc / SUB, 0, 1), saved = [];
    if (lerpPose) for (const b of W.bikes.concat(W.ghosts)) if (b.px !== undefined && !b.crashed) { saved.push([b, b.x, b.y, b.h]); b.x = b.px + (b.x - b.px) * al; b.y = b.py + (b.y - b.py) * al; b.h = b.ph + angWrap(b.h - b.ph) * al; }
    updateCamera((UI.state === 'play' && !W.paused) || UI.state === 'replay' ? dt : 0.0001); drawWorld();
    ctx = hudCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, hcv.width, hcv.height);
    try { drawSpeedLines(dt); if (UI.state === 'play') drawHUD(dt); else if (UI.state === 'replay') drawReplayHUD(); } finally { ctx = mainCtx; for (const [b, x, y, h] of saved) { b.x = x; b.y = y; b.h = h; } }
  }
  Sound.update(UI.state === 'play' ? W.player : null);
  requestAnimationFrame(frame);
}
function attractSession() { // attract mode behind the menu: AI field circulating
  setupSession('sprint', UI.sessionOpts({ gridPos: 'mid', train: null }));
  W.player.autopilot = true; W.phase = 'run'; for (const b of W.bikes) { b.held = false; b.lapStartT = 0; }
}
function boot() {
  resize(); window.addEventListener('resize', resize);
  buildTextures(); buildGeometry(); buildMinimap();
  UI.init(); Lib.init();
  attractSession();
  $('loading').hidden = true; $('menu').hidden = false;
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  setInterval(() => { if (UI.state === 'menu') { for (let k = 0; k < 4; k++) simStep(SUB); } }, 1000 / 30);
}
window.__sgp = { Touch, tiltProjectX: draw => { for (const Ly of LAYERS) { const g = Ly.g; g.setTransform(Ly.dpr, 0, 0, Ly.dpr, 0, 0); g.translate(-Ly.x0, -Ly.y0); draw(g, RW, RH); } projectTilted(); return { VW, VH, RW, RH }; }, worldToScreenX: (x, y) => worldToScreen(x, y), worldToCanvasX: (x, y) => worldToCanvas(x, y), frameX: t => frame(t), setCamModeX: m => setCamMode(m), CAM, RP, Rec, Lib, Ghost, W, T, PHYS, Input, FX, Records, completeLapX: b => completeLap(b), trackLimitsX: b => trackLimits(b), longLapX: b => longLap(b), applyDropX: b => applyDrop(b), limitRefX: (s0, s1) => limitRef(s0, s1), stepBikeX: (b, dt) => stepBike(b, dt, W), SURF, drawWorldX: () => drawWorld(), speedBlurX: () => speedBlur(), speedVibX: () => speedVib(), SPL, GEO, resizeX: () => resize(), drawSpeedLinesX: dt => { ctx = hudCtx; try { drawSpeedLines(dt); } finally { ctx = mainCtx; } }, camNameX: () => TILT_CAM, setupSession, simStep, standings, UI, SUB, TILT, setAIReal: v => { AI_REAL = v; } };
if (document.fonts && document.fonts.ready) { Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).then(boot).catch(e => { console.error("boot failed", e && e.stack); }); } else boot();
