
// ---------------------------------------------------------------------------
// Session recordings, library and ghost opponents (GDD 11c)
// ---------------------------------------------------------------------------
const REC_FMT = 'silverstone-gp-session', REC_DT = 0.1, GHOST_MAX = 4;
const r2 = (x, k) => Math.round(x * k) / k;

// recorder: samples the player at 10 Hz and logs laps
const Rec = {
  cur: null, last: null,
  start() {
    const b = W.player, o = W.opts;
    this.cur = {
      format: REC_FMT, version: 1, game: 'Silverstone GP', track: 'silverstone',
      id: 'r' + Date.now().toString(36) + ((Math.random() * 1296) | 0).toString(36), date: new Date().toISOString(),
      kind: W.kind, mode: W.mode, totalLaps: W.totalLaps,
      rider: { name: b.name, num: b.num, team: b.team, short: b.short }, aids: !!o.aids, auto: !!o.auto,
      laps: [], bestLap: 0, raceStart: 0, finishT: 0, position: 0, pits: 0,
      samples: { dt: REC_DT, x: [], y: [], h: [], v: [], lean: [], s: [], p: [] }
    };
  },
  sample() {
    const R = this.cur; if (!R) return; const S = R.samples, b = W.player;
    if (W.time < S.x.length * REC_DT) return;
    const x = b.crashed && b.crash ? b.crash.bk.x : b.x, y = b.crashed && b.crash ? b.crash.bk.y : b.y;
    S.x.push(r2(x, 100)); S.y.push(r2(y, 100)); S.h.push(r2(b.h, 1000)); S.v.push(r2(b.crashed ? 0 : b.v, 100)); S.lean.push(r2(b.crashed ? 0 : b.lean, 1000)); S.s.push(r2(b.s, 10)); S.p.push(r2(b.progress, 10));
  },
  lap(start, end, t, ap) { if (this.cur) this.cur.laps.push(ap ? { start: r2(start, 1000), end: r2(end, 1000), time: r2(t, 1000), ap: 1 } : { start: r2(start, 1000), end: r2(end, 1000), time: r2(t, 1000) }); },
  snapshot() { // finished copy of the session so far
    const R = this.cur; if (!R) return null; const b = W.player;
    const own = R.laps.filter(l => !l.ap), pool = own.length ? own : R.laps;
    R.bestLap = pool.length ? Math.min(...pool.map(l => l.time)) : 0;
    if (W.mode === 'race') { R.raceStart = W.raceStartT > 0 ? r2(W.raceStartT, 1000) : 0; R.finishT = b.finished ? r2(b.finishT, 1000) : 0; R.position = b.dnf ? 0 : standings().indexOf(b) + 1; }
    R.pits = b.pits;
    return JSON.parse(JSON.stringify(R));
  },
  stop() { // end of session: keep it when it holds a timed lap or a started race
    if (!this.cur) return null; const R = this.snapshot(); this.cur = null;
    if (!R.laps.length && !R.raceStart) return null;
    this.last = R; Lib.add(R, 'auto'); return R;
  }
};

function recFileName(R) {
  const d = new Date(R.date), z = n => String(n).padStart(2, '0');
  const best = R.bestLap ? fmtTime(R.bestLap).replace(/[:.]/g, '-') : 'nolap';
  const who = String(R.rider.name || 'rider').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 20) || 'rider';
  return `silverstone_${R.kind === 'gp' || R.kind === 'sprint' ? R.kind : R.mode}_${who}_${best}_${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}.json`;
}
function recValid(R) {
  if (!R || R.format !== REC_FMT || R.track !== 'silverstone' || typeof R.id !== 'string' || !R.samples || !R.rider) return false;
  const S = R.samples, n = S.x && S.x.length;
  if (!n || ['y', 'h', 'v', 'lean', 's', 'p'].some(k => !Array.isArray(S[k]) || S[k].length !== n)) return false;
  if (!Array.isArray(R.laps)) return false;
  R.rider.team = clamp(R.rider.team | 0, 0, TEAMS.length - 1); R.rider.num = clamp(R.rider.num | 0, 0, 99);
  R.rider.name = String(R.rider.name || 'Ghost').slice(0, 20); R.rider.short = String(R.rider.short || R.rider.name).toUpperCase().slice(0, 3);
  return true;
}
function recMeta(R, src) {
  return { id: R.id, src, date: R.date, kind: R.kind, mode: R.mode, totalLaps: R.totalLaps, rider: R.rider, bestLap: R.bestLap, laps: R.laps.length, raceStart: R.raceStart, finishT: R.finishT, position: R.position, aids: R.aids, auto: R.auto, file: recFileName(R) };
}

// library: IndexedDB (meta + data stores), memory fallback when storage is blocked
const Lib = {
  db: null, meta: [], data: {}, ghosts: [], dir: null, dirOK: false, status: '', onChange: null,
  init() {
    try { this.ghosts = JSON.parse(localStorage.getItem('sgp_ghosts') || '[]').slice(0, GHOST_MAX); } catch (e) { this.ghosts = []; }
    return new Promise(res => {
      let rq; try { rq = indexedDB.open('sgp_sessions', 1); } catch (e) { return res(); }
      rq.onupgradeneeded = () => { const db = rq.result; db.createObjectStore('meta', { keyPath: 'id' }); db.createObjectStore('data'); db.createObjectStore('kv'); };
      rq.onerror = () => res();
      rq.onsuccess = () => {
        this.db = rq.result;
        this.tx('meta').getAll().onsuccess = e => { this.meta = e.target.result || []; this.sort(); this.loadGhosts().then(res); };
        this.tx('kv').get('dir').onsuccess = e => { this.dir = e.target.result || null; this.changed(); };
      };
    }).then(() => { this.changed(); this.fetchIndex(); });
  },
  tx(store, rw) { return this.db.transaction(store, rw ? 'readwrite' : 'readonly').objectStore(store); },
  sort() { this.meta.sort((a, b) => (b.date > a.date ? 1 : -1)); },
  changed() { if (this.onChange) this.onChange(); },
  get(id) { // full recording, cached in memory
    if (this.data[id]) return Promise.resolve(this.data[id]);
    if (!this.db) return Promise.resolve(null);
    return new Promise(res => { const r = this.tx('data').get(id); r.onsuccess = () => { if (r.result) this.data[id] = r.result; res(r.result || null); }; r.onerror = () => res(null); });
  },
  loadGhosts() { this.ghosts = this.ghosts.filter(id => this.meta.some(m => m.id === id)); return Promise.all(this.ghosts.map(id => this.get(id))); },
  add(R, src) {
    if (!recValid(R)) return false;
    const m = recMeta(R, src), old = this.meta.findIndex(x => x.id === R.id);
    if (old >= 0) { if (src === 'auto') return true; m.src = this.meta[old].src; this.meta.splice(old, 1); }
    this.meta.push(m); this.sort(); this.data[R.id] = R;
    if (this.db) try { this.tx('meta', 1).put(m); this.tx('data', 1).put(R, R.id); } catch (e) { }
    if (src === 'auto') { this.prune(); this.writeDir(R); }
    this.changed(); return true;
  },
  prune() { const auto = this.meta.filter(m => m.src === 'auto'); for (const m of auto.slice(30)) this.del(m.id, true); },
  del(id, quiet) {
    this.meta = this.meta.filter(m => m.id !== id); delete this.data[id]; this.ghosts = this.ghosts.filter(g => g !== id); this.saveGhosts();
    if (this.db) try { this.tx('meta', 1).delete(id); this.tx('data', 1).delete(id); } catch (e) { }
    if (!quiet) this.changed();
  },
  saveGhosts() { try { localStorage.setItem('sgp_ghosts', JSON.stringify(this.ghosts)); } catch (e) { } },
  toggleGhost(id) {
    const k = this.ghosts.indexOf(id);
    if (k >= 0) this.ghosts.splice(k, 1); else { if (this.ghosts.length >= GHOST_MAX) { this.status = `Up to ${GHOST_MAX} ghosts at once. Switch one off first.`; this.changed(); return; } this.ghosts.push(id); this.get(id).then(() => this.changed()); }
    this.saveGhosts(); this.changed();
  },
  ghostRecs() { return this.ghosts.map(id => this.data[id]).filter(Boolean); },
  importText(text, src) { try { const R = JSON.parse(text); return this.add(R, src) ? 1 : 0; } catch (e) { return 0; } },
  async importFiles(files, src) {
    let ok = 0, bad = 0;
    for (const f of files) { if (!/\.json$/i.test(f.name) || /(^|\/)index\.json$/i.test(f.webkitRelativePath || f.name)) continue; (this.importText(await f.text(), src) ? ok++ : bad++); }
    this.status = `Loaded ${ok} recording${ok === 1 ? '' : 's'}` + (bad ? `, skipped ${bad} file${bad === 1 ? '' : 's'} that are not Silverstone GP sessions.` : '.'); this.changed();
  },
  // saved_tracks folder: Chrome/Edge folder picker with write access, remembered between visits
  canPickDir() { return typeof window.showDirectoryPicker === 'function'; },
  async pickDir() {
    try { const h = await window.showDirectoryPicker({ id: 'saved_tracks', mode: 'readwrite' }); this.dir = h; this.dirOK = true; if (this.db) this.tx('kv', 1).put(h, 'dir'); await this.readDir(); }
    catch (e) { if (e && e.name !== 'AbortError') { this.status = 'Could not open the folder: ' + e.message; this.changed(); } }
  },
  async reloadDir() {
    if (!this.dir) return this.pickDir();
    try { this.dirOK = (await this.dir.requestPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { this.dirOK = false; }
    if (this.dirOK) await this.readDir(); else { this.status = 'Folder access was not granted.'; this.changed(); }
  },
  async readDir() {
    const files = []; for await (const [name, h] of this.dir.entries()) if (h.kind === 'file' && /\.json$/i.test(name) && name !== 'index.json') files.push(await h.getFile());
    await this.importFiles(files, 'folder'); this.status = `${this.dir.name}: ` + this.status;
    this.changed();
  },
  async writeDir(R) {
    if (!this.dir) return false;
    try {
      if (!this.dirOK) this.dirOK = (await this.dir.queryPermission({ mode: 'readwrite' })) === 'granted';
      if (!this.dirOK) return false;
      const fh = await this.dir.getFileHandle(recFileName(R), { create: true }); const w = await fh.createWritable(); await w.write(JSON.stringify(R)); await w.close();
      return true;
    } catch (e) { return false; }
  },
  async fetchIndex() { // served over http(s): saved_tracks/index.json lists the files to load
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      const r = await fetch('saved_tracks/index.json', { cache: 'no-store' }); if (!r.ok) return;
      const list = await r.json(); let ok = 0;
      for (const name of (Array.isArray(list) ? list : list.files || [])) { try { const f = await fetch('saved_tracks/' + encodeURIComponent(name), { cache: 'no-store' }); if (f.ok && this.importText(await f.text(), 'folder')) ok++; } catch (e) { } }
      if (ok) { this.status = `saved_tracks: loaded ${ok} recording${ok === 1 ? '' : 's'}.`; this.changed(); }
    } catch (e) { }
  },
  async export(R) {
    if (!R) return;
    if (await this.writeDir(R)) { this.status = `Saved ${recFileName(R)} to ${this.dir.name}.`; this.changed(); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(R)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = recFileName(R); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
};

// ghosts: replay recorded positions; never physical, AI does not see them
function recAt(R, t) { // interpolated sample at recording time t
  const S = R.samples, n = S.x.length, f0 = clamp(t / S.dt, 0, n - 1), k = Math.min(n - 2, Math.floor(f0)), f = n > 1 ? f0 - k : 0, j = Math.min(n - 1, k + 1);
  const L = (a) => a[k] + (a[j] - a[k]) * f;
  const jump = Math.abs(S.p[j] - S.p[k]) > T.L / 2;
  const p = jump ? (f < 0.5 ? S.p[k] : S.p[j]) : L(S.p);
  return { x: L(S.x), y: L(S.y), h: S.h[k] + angWrap(S.h[j] - S.h[k]) * f, v: L(S.v), lean: L(S.lean), p, dv: S.v[j] - S.v[k] };
}
function makeGhost(R) {
  const rd = R.rider; const own = R.laps.filter(l => !l.ap); const pool = own.length ? own : R.laps;
  const best = pool.slice().sort((a, b) => a.time - b.time)[0] || null;
  const chain = R.laps.filter(l => l.time > 0 && l.end > l.start);
  return {
    ghost: true, rec: R, isRace: !!R.raceStart && R.mode === 'race', best, chain, chainT: chain.reduce((a, l) => a + l.time, 0),
    id: 'g' + R.id, name: rd.name + ' (ghost)', short: rd.short, num: rd.num, team: rd.team,
    x: 0, y: 0, h: 0, v: 0, vs: 0, lean: 0, wheelie: 0, s: 0, p: 0, progress: 0, lap: 0, ctl: { thr: 0, brk: 0 },
    show: false, t0: -1, lapStartT: 0, bestLap: 0, laps: [], finished: false, finishT: 0, dnf: false, crashed: false, pits: 0, inPitLane: false,
    recBest: best ? best.time : 0
  };
}
const Ghost = {
  setup(recs) { // called from setupSession
    W.ghosts = [];
    if (W.mode === 'quali') return;
    for (const R of recs.slice(0, GHOST_MAX)) {
      const g = makeGhost(R);
      if (W.mode === 'practice' ? g.best : (g.isRace || g.chainT > 0)) W.ghosts.push(g);
    }
  },
  place(g, q) { g.x = q.x; g.y = q.y; g.h = q.h; g.v = q.v; g.lean = q.lean; g.ctl.brk = q.dv < -0.6 ? 1 : 0; },
  step() {
    if (!W.ghosts.length) return;
    if (W.mode === 'practice') return this.stepPractice();
    for (const g of W.ghosts) this.stepRace(g);
  },
  stepPractice() { // replay the best lap from each of the player's timed-lap starts
    const b = W.player;
    for (const g of W.ghosts) {
      if (!b.outLap && b.lapStartT !== g.t0) g.t0 = b.lapStartT;
      const tau = W.time - g.t0;
      g.show = g.t0 >= 0 && !b.outLap && tau <= g.best.time;
      if (g.show) { const q = recAt(g.rec, g.best.start + tau); this.place(g, q); g.s = ((q.p % T.L) + T.L) % T.L; }
    }
  },
  stepRace(g) {
    const run = W.phase === 'run' && W.raceStartT > 0, tau = run ? W.time - W.raceStartT : 0;
    if (g.dnf) { g.show = false; return; }
    const q = this.raceSample(g, tau);
    if (!q) { g.show = false; if (!g.finished) { g.dnf = true; HUD.ticker(`#${g.num} ${g.short} (ghost) is out of recording`); } return; }
    this.place(g, q); g.show = !g.finished || tau - g.finishT < 6;
    if (g.finished) return;
    const p = q.p; g.p = p; g.progress = p; g.s = ((p % T.L) + T.L) % T.L;
    if (!run) return;
    if (!g.lapStartT) g.lapStartT = W.time;
    const lap = Math.max(0, Math.floor(p / T.L));
    if (lap > g.lap) { const lt = W.time - g.lapStartT; g.laps.push(lt); if (!g.bestLap || lt < g.bestLap) g.bestLap = lt; g.lap = lap; g.lapStartT = W.time; }
    const bin = Math.floor(p / 10) + 150;
    if (bin >= 0 && bin < W.passT.length && W.passT[bin] < 0) W.passT[bin] = W.time;
    if (p >= W.totalLaps * T.L) {
      g.finished = true; g.lap = W.totalLaps; g.finishT = tau; W.finishOrder.push(g);
      if (!W.flag) { W.flag = true; HUD.ticker(`#${g.num} ${g.short} (ghost) takes the chequered flag`); }
    }
  },
  raceSample(g, tau) {
    const R = g.rec;
    if (g.isRace) { const t = R.raceStart + tau; if (t > (R.samples.x.length - 1) * REC_DT) return null; const q = recAt(R, t); return q; }
    // practice / qualifying recording: chain its completed laps from the line, looping
    let rem = tau % g.chainT, n = Math.floor(tau / g.chainT) * g.chain.length, k = 0;
    while (k < g.chain.length - 1 && rem > g.chain[k].time) { rem -= g.chain[k].time; k++; n++; }
    const l = g.chain[k]; const q = recAt(R, l.start + Math.min(rem, l.time));
    const base = Math.round(recAt(R, l.start + 0.05).p / T.L) * T.L;
    let lp = q.p - base; if (lp < -T.L / 2) lp += T.L;
    q.p = n * T.L + clamp(lp, 0, T.L); return q;
  }
};
