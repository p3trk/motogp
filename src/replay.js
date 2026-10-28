
// ---------------------------------------------------------------------------
// Session recordings, library and ghost opponents (GDD 11c)
// ---------------------------------------------------------------------------
const REC_FMT = 'silverstone-gp-session', REC_DT = 0.1, GHOST_MAX = 4;
const r2 = (x, k) => Math.round(x * k) / k;

// recorder: samples the player at 10 Hz and logs laps
const Rec = {
  cur: null, last: null,
  start() {
    const b = W.player, o = W.opts; this.prev = null;
    this.cur = {
      format: REC_FMT, version: 1, game: 'Silverstone GP', track: 'silverstone',
      id: 'r' + Date.now().toString(36) + ((Math.random() * 1296) | 0).toString(36), date: new Date().toISOString(),
      kind: W.kind, mode: W.mode, totalLaps: W.totalLaps,
      rider: { name: b.name, num: b.num, team: b.team, short: b.short }, aids: !!o.aids, auto: !!o.auto,
      laps: [], bestLap: 0, raceStart: 0, finishT: 0, position: 0, pits: 0, start: recStartOf(),
      samples: { dt: REC_DT, x: [], y: [], h: [], v: [], lean: [], s: [], p: [] }
    };
  },
  sample() { // samples land exactly on the 0.1 s grid, interpolated between the last two physics steps (1.11.2)
    const R = this.cur; if (!R) return; const S = R.samples, b = W.player;
    const c = { t: W.time, x: b.crashed && b.crash ? b.crash.bk.x : b.x, y: b.crashed && b.crash ? b.crash.bk.y : b.y, h: b.h, v: b.crashed ? 0 : b.v, lean: b.crashed ? 0 : b.lean, s: b.s, p: b.progress };
    const q = this.prev; this.prev = c;
    const tg = S.x.length * REC_DT; if (W.time < tg) return;
    let f = 1; if (q && W.time > q.t && Math.abs(c.p - q.p) < T.L / 2) f = clamp((tg - q.t) / (W.time - q.t), 0, 1);
    const m = (k) => q && f < 1 ? q[k] + (c[k] - q[k]) * f : c[k];
    S.x.push(r2(m('x'), 100)); S.y.push(r2(m('y'), 100)); S.h.push(r2(q && f < 1 ? q.h + angWrap(c.h - q.h) * f : c.h, 1000)); S.v.push(r2(m('v'), 100)); S.lean.push(r2(m('lean'), 1000)); S.s.push(r2(f < 1 ? c.s : c.s, 10)); S.p.push(r2(m('p'), 10));
  },
  lap(start, end, t, ap) { if (this.cur) this.cur.laps.push(ap ? { start: r2(start, 1000), end: r2(end, 1000), time: r2(t, 1000), ap: 1 } : { start: r2(start, 1000), end: r2(end, 1000), time: r2(t, 1000) }); },
  snapshot() { // finished copy of the session so far
    const R = this.cur; if (!R) return null; const b = W.player;
    const own = R.laps.filter(l => !l.ap), pool = own.length ? own : R.laps;
    R.bestLap = pool.length ? Math.min(...pool.map(l => l.time)) : 0;
    if (W.mode === 'race') { R.raceStart = W.raceStartT > 0 ? r2(W.raceStartT, 1000) : 0; R.start.t = R.raceStart; R.finishT = b.finished ? r2(b.finishT, 1000) : 0; R.position = b.dnf ? 0 : standings().indexOf(b) + 1; }
    R.pits = b.pits;
    return JSON.parse(JSON.stringify(R));
  },
  stop() { // end of session: keep it when it holds a timed lap or a started race
    if (!this.cur) return null; const R = this.snapshot(); this.cur = null;
    if (!R.laps.length && !R.raceStart) return null;
    this.last = R; Lib.add(R, 'auto'); return R;
  }
};

// how this session starts (GDD 10, since 1.16.0); t is set at lights out (race) or the first input (practice)
function recStartOf() {
  const b = W.player;
  if (W.mode === 'race') return { kind: 'grid', t: 0, slot: b.grid || 0 };
  if (W.train) return { kind: 'spot', t: 0, s: r2(T.wrapS(W.train.s), 10), v: r2(W.train.v, 100) };
  if (W.gridStart) return { kind: 'grid', t: 0, slot: W.gridSlot + 1 };
  return { kind: 'box', t: 0 };
}
// start of a recording; files without one (before 1.16.0): a race with lights out is a grid start, anything else the box
function recStart(R) {
  const st = R.start;
  if (st && typeof st === 'object' && ['grid', 'spot', 'box'].includes(st.kind) && isFinite(st.t) && st.t >= 0) return st;
  return R.mode === 'race' && R.raceStart > 0 ? { kind: 'grid', t: R.raceStart } : { kind: 'box', t: 0 };
}
// launch moment of a standing start: the last standing sample before the first one above 0.5 m/s, from the start on (GDD 11c)
function recLaunch(R, t0) {
  const S = R.samples, n = S.v.length;
  for (let k = Math.max(0, Math.ceil(t0 / S.dt - 1e-6)); k < n; k++) if (S.v[k] > 0.5) return Math.max(t0, (k - 1) * S.dt);
  return t0;
}
// recording time where the track distance passes s0 within lap l (line to line), between two samples (GDD 11c)
function recTimeAt(R, l, s0) {
  const S = R.samples, cum = rpDist(R), dt = S.dt, n = cum.length;
  const k0 = clamp(Math.floor(l.start / dt), 0, n - 1), f0 = clamp(l.start / dt - k0, 0, 1), k1 = Math.min(n - 1, k0 + 1);
  const c0 = cum[k0] + (cum[k1] - cum[k0]) * f0, sStart = recAt(R, l.start).p;
  const need = T.wrapS(s0 - T.wrapS(sStart)); // metres from the lap start to the spot
  for (let k = k0 + 1; k < n && k * dt <= l.end + dt; k++) {
    if (cum[k] - c0 >= need) { const a = cum[k - 1] - c0, b = cum[k] - c0, f = b > a ? clamp((need - a) / (b - a), 0, 1) : 0; return clamp((k - 1 + f) * dt, l.start, l.end); }
  }
  return l.end;
}

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

// compact storage form: channels delta-encoded as Int16 in base64; s is rebuilt from p (GDD 11c, 1.9.1)
const PACK = { x: 100, y: 100, h: 1000, v: 100, lean: 1000, p: 10 }, LS_KEY = 'sgp_sessions', LS_MAX = 10;
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function packCh(a, k) {
  const o = []; let prev = 0;
  for (const x of a) { const q = Math.round(x * k), d = q - prev; prev = q; if (d > -32768 && d < 32768) o.push(d); else o.push(-32768, q >> 16, q & 0xFFFF); }
  return b64(new Uint8Array(Int16Array.from(o).buffer));
}
function unpackCh(str, k) {
  const u = unb64(str), a = new Int16Array(u.buffer, 0, u.length >> 1), o = []; let q = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] === -32768) { q = a[i + 1] * 65536 + (a[i + 2] & 0xFFFF); i += 2; } else q += a[i]; o.push(q / k); }
  return o;
}
function packRec(R) { const S = R.samples, P = { dt: S.dt, enc: 'd16' }; for (const k in PACK) P[k] = packCh(S[k], PACK[k]); return Object.assign({}, R, { samples: P }); }
function unpackRec(R) {
  const S = R.samples, U = { dt: S.dt }; for (const k in PACK) U[k] = unpackCh(S[k], PACK[k]);
  U.s = U.p.map(p => Math.round((((p % T.L) + T.L) % T.L) * 10) / 10);
  return Object.assign({}, R, { samples: U });
}

// library: the last 10 own sessions in localStorage; imports and saved_tracks files only for this visit.
// IndexedDB keeps just the linked saved_tracks folder handle (and the pre-1.9.1 library, moved once).
const Lib = {
  db: null, meta: [], data: {}, ghosts: [], sync: '', cmp: [], dir: null, dirOK: false, status: '', onChange: null, stored: true,
  init() {
    try { this.ghosts = JSON.parse(localStorage.getItem('sgp_ghosts') || '[]').slice(0, GHOST_MAX); } catch (e) { this.ghosts = []; }
    try { this.sync = localStorage.getItem('sgp_ghost_sync') || ''; } catch (e) { this.sync = ''; }
    let had = false;
    try { const raw = localStorage.getItem(LS_KEY); had = raw !== null; for (const P of JSON.parse(raw || '[]')) { try { const R = unpackRec(P); if (recValid(R)) { this.data[R.id] = R; this.meta.push(recMeta(R, 'auto')); } } catch (e) { } } }
    catch (e) { this.stored = false; }
    this.sort(); this.loadGhosts(); this.changed();
    return new Promise(res => {
      let rq; try { rq = indexedDB.open('sgp_sessions', 1); } catch (e) { return res(); }
      rq.onupgradeneeded = () => { const db = rq.result; db.createObjectStore('meta', { keyPath: 'id' }); db.createObjectStore('data'); db.createObjectStore('kv'); };
      rq.onerror = () => res();
      rq.onsuccess = () => {
        this.db = rq.result;
        this.tx('kv').get('dir').onsuccess = e => { this.dir = e.target.result || null; this.changed(); };
        if (had || !this.stored) return res();
        this.migrate().then(res, res);
      };
    }).then(() => { this.changed(); this.fetchIndex(); });
  },
  migrate() { // one-time move of the newest 10 sessions from the 1.8.0/1.9.0 IndexedDB library
    return new Promise(res => {
      this.tx('meta').getAll().onsuccess = e => {
        const old = (e.target.result || []).sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, LS_MAX);
        if (!old.length) { this.persist(); return res(); }
        Promise.all(old.map(m => new Promise(r => { const q = this.tx('data').get(m.id); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }))).then(list => {
          for (const R of list.reverse()) if (R && recValid(R) && !this.data[R.id]) { this.data[R.id] = R; this.meta.push(recMeta(R, 'auto')); }
          this.sort(); this.persist(); this.loadGhosts();
          try { this.tx('meta', 1).clear(); this.tx('data', 1).clear(); } catch (e) { }
          res();
        });
      };
    });
  },
  tx(store, rw) { return this.db.transaction(store, rw ? 'readwrite' : 'readonly').objectStore(store); },
  sort() { this.meta.sort((a, b) => (b.date > a.date ? 1 : -1)); },
  changed() { if (this.onChange) this.onChange(); },
  get(id) { return Promise.resolve(this.data[id] || null); },
  loadGhosts() { this.ghosts = this.ghosts.filter(id => this.meta.some(m => m.id === id)); this.saveGhosts(); },
  persist() { // newest 10 own sessions; drop the oldest while the browser reports the storage full
    if (!this.stored) return;
    let own = this.meta.filter(m => m.src === 'auto');
    for (const m of own.slice(LS_MAX)) this.del(m.id, true, true);
    own = own.slice(0, LS_MAX);
    let packed = own.map(m => packRec(this.data[m.id]));
    while (true) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(packed)); break; }
      catch (e) {
        if (packed.length <= 1) { this.status = 'Browser storage is full, this session could not be kept. Export it to keep it.'; break; }
        packed.pop(); this.del(own.pop().id, true, true);
        this.status = `Browser storage is full, keeping the last ${packed.length} sessions.`;
      }
    }
  },
  add(R, src) {
    if (!recValid(R)) return false;
    const m = recMeta(R, src), old = this.meta.findIndex(x => x.id === R.id);
    if (old >= 0) { if (src === 'auto' || this.meta[old].src === 'auto') return true; this.meta.splice(old, 1); }
    this.meta.push(m); this.sort(); this.data[R.id] = R;
    if (src === 'auto') { this.persist(); this.writeDir(R); }
    this.changed(); return true;
  },
  del(id, quiet, noSave) {
    const m = this.meta.find(x => x.id === id);
    this.meta = this.meta.filter(x => x.id !== id); delete this.data[id]; this.ghosts = this.ghosts.filter(g => g !== id); this.saveGhosts();
    if (m && m.src === 'auto' && !noSave) this.persist();
    if (!quiet) this.changed();
  },
  saveGhosts() { try { localStorage.setItem('sgp_ghosts', JSON.stringify(this.ghosts)); localStorage.setItem('sgp_ghost_sync', this.sync); } catch (e) { } },
  // sync reference for spot starts (GDD 11c): the marked ghost, else the first selected one
  syncId() { return this.ghosts.includes(this.sync) ? this.sync : this.ghosts[0] || ''; },
  setSync(id) { if (!this.ghosts.includes(id)) return; this.sync = id; this.saveGhosts(); this.changed(); },
  toggleGhost(id) {
    const k = this.ghosts.indexOf(id);
    if (k >= 0) { this.ghosts.splice(k, 1); if (this.sync === id) this.sync = this.ghosts[0] || ''; } else { if (this.ghosts.length >= GHOST_MAX) { this.status = `Up to ${GHOST_MAX} ghosts at once. Switch one off first.`; this.changed(); return; } this.ghosts.push(id); }
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
function recAt(R, t) { // sample at recording time t
  // position, heading, speed and lean follow a cubic B-spline through the 10 Hz samples: straight-line
  // interpolation turned the path direction in steps every 0.1 s, which shook the replay camera (1.11.2)
  const S = R.samples, n = S.x.length, f0 = clamp(t / S.dt, 0, n - 1), k = Math.min(n - 2, Math.floor(f0)), f = n > 1 ? f0 - k : 0, j = Math.min(n - 1, k + 1);
  const i0 = Math.max(0, k - 1), i3 = Math.min(n - 1, k + 2), f2 = f * f, f3 = f2 * f;
  const w0 = (1 - f) ** 3 / 6, w1 = (3 * f3 - 6 * f2 + 4) / 6, w2 = (-3 * f3 + 3 * f2 + 3 * f + 1) / 6, w3 = f3 / 6;
  const B = a => a[i0] * w0 + a[k] * w1 + a[j] * w2 + a[i3] * w3;
  const hk = S.h[k], hB = hk + angWrap(S.h[i0] - hk) * w0 + angWrap(S.h[j] - hk) * w2 + angWrap(S.h[i3] - hk) * w3;
  const L = (a) => a[k] + (a[j] - a[k]) * f;
  const jump = Math.abs(S.p[j] - S.p[k]) > T.L / 2;
  const p = jump ? (f < 0.5 ? S.p[k] : S.p[j]) : L(S.p);
  return { x: B(S.x), y: B(S.y), h: hB, v: B(S.v), lean: B(S.lean), p, dv: S.v[j] - S.v[k] };
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
  setup(recs, syncId) { // called from setupSession
    W.ghosts = []; W.syncRef = null;
    if (W.mode === 'quali') return;
    for (const R of recs.slice(0, GHOST_MAX)) {
      const g = makeGhost(R);
      if (W.mode !== 'practice') { if (g.isRace || g.chainT > 0) W.ghosts.push(g); continue; }
      // practice (GDD 11c, 1.16.0): 'rec' plays a standing-start recording from its launch (grid start),
      // 'spot' starts on its best lap synced to the spot, 'line' waits for the player's first line crossing
      const st = recStart(R);
      if (W.gridStart && st.kind === 'grid') { g.sync = 'rec'; g.launch = recLaunch(R, st.t); g.end = (R.samples.x.length - 1) * REC_DT; }
      else if (g.best) g.sync = W.train ? 'spot' : 'line';
      else continue;
      W.ghosts.push(g);
    }
    const spot = W.ghosts.filter(g => g.sync === 'spot'); if (!spot.length) return;
    // spot start: the reference stands on the spot; the others are placed by lap time relative to it
    const s0 = T.wrapS(W.train.s), ref = spot.find(g => g.rec.id === syncId) || spot[0];
    const tSpot = recTimeAt(ref.rec, ref.best, s0), tau = tSpot - ref.best.start;
    for (const g of spot) g.t0 = g === ref ? tSpot : g.best.start + tau;
    ref.vSpot = recAt(ref.rec, tSpot).v; W.syncRef = ref;
  },
  place(g, q) { g.x = q.x; g.y = q.y; g.h = q.h; g.v = q.v; g.lean = q.lean; g.ctl.brk = q.dv < -0.6 ? 1 : 0; },
  step() {
    if (!W.ghosts.length) return;
    if (W.mode === 'practice') return this.stepPractice();
    for (const g of W.ghosts) this.stepRace(g);
  },
  stepPractice() { // ghosts start with the player, then ride the best lap from each of the player's line crossings (GDD 11c)
    const run = W.startT >= 0, el = run ? W.time - W.startT : 0;
    for (const g of W.ghosts) {
      let t = -1;
      if (g.sync === 'rec') { t = g.launch + el; if (t > g.end) t = -1; } // standing start: the whole recording, then gone
      else if (W.lineT >= 0) { const tau = W.time - W.lineT; if (tau <= g.best.time) t = g.best.start + tau; }
      else if (g.sync === 'spot' && g.t0 + el <= g.best.end) t = g.t0 + el; // sync lap from the spot
      g.show = t >= 0;
      if (!g.show) continue;
      const q = recAt(g.rec, t); this.place(g, q); g.s = ((q.p % T.L) + T.L) % T.L;
      if (!run) { g.v = 0; g.ctl.brk = 0; } // standing at its sync position until the first input
      if (g.sync === 'rec') { g.laps = []; for (const l of g.rec.laps) if (l.end <= t) g.laps.push(l.time); }
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

// ---------------------------------------------------------------------------
// Replay viewer: one or several recordings on one timeline (GDD 11e)
// ---------------------------------------------------------------------------
const RP_SPEEDS = [-8, -4, -2, -1, 0.25, 0.5, 1, 2, 4, 8], RP_MAX = 6;
function rpBestLap(R) { const own = R.laps.filter(l => !l.ap), pool = own.length ? own : R.laps; return pool.slice().sort((a, b) => a.time - b.time)[0] || null; }
function rpDist(R) { // continuous distance along the track for every sample (line crossings and invalid laps unwrapped)
  const p = R.samples.p, c = new Float64Array(p.length); for (let k = 1; k < p.length; k++) { let d = p[k] - p[k - 1]; if (d < -T.L / 2) d += T.L; else if (d > T.L / 2) d -= T.L; c[k] = c[k - 1] + d; } return c;
}
const RP = {
  items: [], align: 'best', lapN: 1, t: 0, dur: 1, speed: 1, playing: true, follow: 0, back: null, saved: null,
  open(recs, back) {
    recs = recs.filter(Boolean).slice(0, RP_MAX); if (!recs.length) return;
    this.saved = back === 'pause' ? { bikes: W.bikes, ghosts: W.ghosts, player: W.player, guide: W.guide, train: W.train } : null;
    this.back = back || 'menu';
    if (this.back === 'menu') setCamMode(UI.opts.cam); // the start-screen camera; from pause or results the one in use (GDD 11e)
    this.items = recs.map((R, k) => ({ R, cum: rpDist(R), best: rpBestLap(R), g: { id: 'rp' + k, team: R.rider.team, num: R.rider.num, short: R.rider.short, name: R.rider.name, isPlayer: k === 0, x: 0, y: 0, h: 0, v: 0, vs: 0, lean: 0, wheelie: 0, s: 0, i: 0, ctl: { thr: 0, brk: 0 }, show: true, crashed: false, dnf: false } }));
    this.align = recs.length > 1 && this.items.every(it => it.best) ? 'best' : 'start'; this.lapN = 1; this.follow = 0;
    UI.hideAll(); UI.state = 'replay'; W.paused = false; FX.clear(); W.guide = false; W.train = null;
    W.bikes = [this.items[0].g]; W.ghosts = this.items.slice(1).map(it => it.g); W.player = this.items[0].g;
    this.setAlign(this.align); this.speed = 1; this.playing = true; CAM.init = false;
    UI.rbarOpen(this);
  },
  setAlign(a) {
    this.align = a; const maxLaps = Math.max(...this.items.map(it => it.R.laps.length));
    if (a === 'lap') this.lapN = clamp(this.lapN, 1, Math.max(1, maxLaps));
    for (const it of this.items) {
      const R = it.R, end = (R.samples.x.length - 1) * REC_DT; let l = null;
      if (a === 'best') l = it.best; else if (a === 'lap') l = R.laps[this.lapN - 1] || null;
      if (a === 'start') { it.off = R.raceStart > 0 ? R.raceStart : 0; it.len = end - it.off; it.on = true; }
      else { it.on = !!l; it.off = l ? l.start : 0; it.len = l ? l.time : 0; }
      it.end = end; it.lapT = l ? l.time : 0;
      // time to reach each 10 m of aligned distance, for the gap panel
      const k0 = Math.round(it.off / REC_DT), d0 = it.cum[Math.min(k0, it.cum.length - 1)]; it.d0 = d0;
      const tr = []; for (let k = k0; k < it.cum.length; k++) { const b = Math.floor((it.cum[k] - d0) / 10); if (b >= 0 && tr[b] === undefined) for (let q = tr.length; q <= b; q++) tr[q] = k * REC_DT - it.off; }
      it.trace = tr;
    }
    if (!this.items[0].on) { const k = this.items.findIndex(it => it.on); if (k > 0) { const [x] = this.items.splice(k, 1); this.items.unshift(x); x.g.isPlayer = true; this.items.forEach((it, j) => { it.g.isPlayer = j === 0; }); W.bikes = [this.items[0].g]; W.ghosts = this.items.slice(1).map(it => it.g); } }
    this.dur = Math.max(1, ...this.items.filter(it => it.on).map(it => it.len)); this.t = 0; this.place();
  },
  laps() { // lap start marks on the timeline (reference session, Session start alignment)
    if (this.align !== 'start') return [];
    const it = this.items[0]; return it.R.laps.map((l, k) => ({ t: l.start - it.off, n: k + 1, best: l === it.best, len: l.time })).filter(m => m.t >= 0 && m.t <= this.dur);
  },
  step(dt) {
    if (!this.playing) return;
    this.t += dt * this.speed;
    if (this.t >= this.dur) { this.t = this.dur; this.playing = false; }
    if (this.t <= 0) { this.t = 0; if (this.speed < 0) this.playing = false; }
    this.place();
  },
  place() {
    for (const it of this.items) {
      const g = it.g, rt = it.off + this.t;
      g.show = it.on && rt >= 0 && rt <= it.end;
      if (!g.show) continue;
      const q = recAt(it.R, rt); Ghost.place(g, q); g.s = ((q.p % T.L) + T.L) % T.L; g.i = T.idx(g.s);
      const k = clamp(rt / REC_DT, 0, it.cum.length - 1), k0 = Math.floor(k), k1 = Math.min(it.cum.length - 1, k0 + 1);
      it.dist = it.cum[k0] + (it.cum[k1] - it.cum[k0]) * (k - k0) - it.d0;
      const R = it.R; let lap = 0; for (let j = 0; j < R.laps.length; j++) if (R.laps[j].start <= rt) lap = j;
      it.lap = R.laps.length ? (R.laps[lap].start <= rt ? lap + 1 : 0) : 0; it.lapStart = R.laps.length && it.lap ? R.laps[lap].start : 0; it.rt = rt;
    }
    W.player = this.items[this.follow] ? this.items[this.follow].g : this.items[0].g;
  },
  gap(it) { // time behind the reference at the same aligned distance
    const ref = this.items[0]; if (it === ref || !it.on || !ref.on) return null;
    const b = Math.floor(it.dist / 10), tr = ref.trace[b]; if (tr === undefined || b < 0) return null;
    const tr1 = ref.trace[b + 1] ?? tr; const f = it.dist / 10 - b; return this.t - (tr + (tr1 - tr) * f);
  },
  seek(t) { this.t = clamp(t, 0, this.dur); this.place(); },
  setSpeed(v) { this.speed = v; if (!this.playing) this.playing = true; },
  faster(dir) { const k = RP_SPEEDS.indexOf(this.speed); this.setSpeed(RP_SPEEDS[clamp((k < 0 ? 6 : k) + dir, 0, RP_SPEEDS.length - 1)]); },
  rew() { this.setSpeed(this.speed > 0 ? -1 : Math.max(-8, this.speed * 2)); },
  ff() { this.setSpeed(this.speed < 1 ? 2 : Math.min(8, Math.max(2, this.speed * 2))); },
  slow() { this.setSpeed(this.speed === 0.5 ? 0.25 : 0.5); },
  toggle() { if (this.t >= this.dur && this.speed > 0) this.t = 0; if (this.t <= 0 && this.speed < 0) this.speed = 1; this.playing = !this.playing; },
  lapJump(dir) {
    const m = this.laps(); if (!m.length) { this.seek(dir < 0 ? 0 : this.dur); return; }
    const cur = this.t; const next = dir > 0 ? m.find(x => x.t > cur + 0.05) : m.slice().reverse().find(x => x.t < cur - 1);
    this.seek(next ? next.t : dir > 0 ? this.dur : 0);
  },
  cycle() { const vis = this.items.map((it, k) => k).filter(k => this.items[k].on); const j = vis.indexOf(this.follow); this.follow = vis[(j + 1) % vis.length]; this.place(); CAM.init = false; },
  close() {
    UI.rbarClose(); FX.clear();
    if (this.back === 'pause' && this.saved) { Object.assign(W, { bikes: this.saved.bikes, ghosts: this.saved.ghosts, player: this.saved.player, guide: this.saved.guide, train: this.saved.train }); this.saved = null; UI.state = 'play'; W.paused = true; $('pause').hidden = false; UI.trainIn(W.mode === 'practice'); UI.camIn(camTilted()); CAM.init = false; return; }
    if (this.back === 'results') { attractSession(); UI.state = 'results'; $('results').hidden = false; return; }
    attractSession(); UI.toMenu();
  }
};
