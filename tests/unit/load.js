// Unit test loader (GDD 13b): joins src/ like tools/build.py and runs the game without a browser.
// The page is replaced by small stand-ins: a DOM tree parsed from src/head.html, canvases whose 2D contexts record
// every call, localStorage in memory, timers and animation frames that only run when the test asks, and a seeded
// Math.random. load() returns G, a live view of every top-level name of the game (G.W, G.stepBike, G.VW = 1024, ...),
// and env, the stand-ins.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const read = n => fs.readFileSync(path.join(SRC, n), 'utf-8');
const ORDER = ['core.js', 'world.js', 'replay.js', 'render.js', 'ui.js'];

// ---------------------------------------------------------------------------
// recording 2D context: known properties are plain, every other name is a method that logs [name, ...args]
// ---------------------------------------------------------------------------
function makeCtx(canvas) {
  const state = {
    canvas, calls: [], fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1, font: '10px sans-serif',
    textAlign: 'start', textBaseline: 'alphabetic', lineCap: 'butt', lineJoin: 'miter', lineDashOffset: 0,
    globalCompositeOperation: 'source-over', imageSmoothingEnabled: true
  };
  const grad = () => ({ stops: [], addColorStop(o, c) { this.stops.push([o, c]); } });
  const ret = {
    measureText: s => ({ width: String(s).length * 7 }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: grad, createRadialGradient: grad,
    createPattern: c => ({ source: c, setTransform(m) { this.m = m; } }),
    isPointInPath: () => false
  };
  const fns = {};
  return new Proxy(state, {
    get(t, k) {
      if (k in t || typeof k === 'symbol') return t[k];
      return fns[k] || (fns[k] = (...a) => { t.calls.push([k, ...a]); return ret[k] ? ret[k](...a) : undefined; });
    },
    set(t, k, v) { t[k] = v; if (k !== 'calls') t.calls.push(['=' + k, v]); return true; }
  });
}

// ---------------------------------------------------------------------------
// fake DOM: enough of Element for the game, with simple selectors (tag, .class, #id, [attr], tag[attr], lists)
// ---------------------------------------------------------------------------
const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr', 'source']);
function matches(el, sel) {
  return sel.split(',').some(s => {
    s = s.trim(); const m = s.match(/^([a-z0-9]*)((?:[.#][\w-]+)*)((?:\[[^\]]+\])*)$/i); if (!m) return false;
    if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
    for (const p of m[2].match(/[.#][\w-]+/g) || []) { if (p[0] === '#' ? el.id !== p.slice(1) : !el.classList.contains(p.slice(1))) return false; }
    for (const a of m[3].match(/\[[^\]]+\]/g) || []) { const [k, v] = a.slice(1, -1).split('='); const have = el.getAttribute(k); if (have === null || (v !== undefined && have !== v.replace(/"/g, ''))) return false; }
    return true;
  });
}
class Element {
  constructor(doc, tag) {
    this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
    this.attrs = {}; this.dataset = {}; this.style = {}; this.listeners = {}; this._text = ''; this._html = '';
    this.hidden = false; this.value = ''; this.checked = false; this.disabled = false; this.scrollTop = 0; this.title = '';
    const cl = new Set(); this.classList = { add: (...c) => c.forEach(x => cl.add(x)), remove: (...c) => c.forEach(x => cl.delete(x)), contains: c => cl.has(c), toggle: (c, on) => ((on ?? !cl.has(c)) ? cl.add(c) : cl.delete(c), cl.has(c)), _set: cl };
    if (this.tagName === 'CANVAS') { this.width = 300; this.height = 150; }
  }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = String(v); }
  get className() { return [...this.classList._set].join(' '); }
  set className(v) { this.classList._set.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList._set.add(c)); }
  setAttribute(k, v) { v = String(v); this.attrs[k] = v; if (k === 'class') this.className = v; if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v; if (k === 'hidden') this.hidden = true; if (k === 'value') this.value = v; }
  getAttribute(k) { if (k === 'class') return this.className || null; if (k.startsWith('data-')) { const d = this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())]; return d === undefined ? null : d; } return k in this.attrs ? this.attrs[k] : null; }
  get firstElementChild() { return this.children[0] || null; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.children = []; this._text = ''; parseInto(this.ownerDocument, this, this._html); }
  appendChild(c) { if (c.parentNode) c.remove(); c.parentNode = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach(c => this.appendChild(c)); }
  remove() { const p = this.parentNode; if (p) { p.children = p.children.filter(x => x !== this); this.parentNode = null; } }
  after(c) { const p = this.parentNode; if (c.parentNode) c.remove(); c.parentNode = p; p.children.splice(p.children.indexOf(this) + 1, 0, c); }
  before(c) { const p = this.parentNode; if (c.parentNode) c.remove(); c.parentNode = p; p.children.splice(p.children.indexOf(this), 0, c); }
  *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
  querySelectorAll(sel) { return [...this.walk()].filter(e => matches(e, sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { for (let e = this; e; e = e.parentNode) if (e instanceof Element && matches(e, sel)) return e; return null; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter(x => x !== f); }
  // fire an event: e gets target/currentTarget and preventDefault; returns the event
  fire(type, props) {
    const e = Object.assign({ type, target: this, defaultPrevented: false, cancelable: true, preventDefault() { this.defaultPrevented = true; } }, props);
    for (let el = this; el; el = el.parentNode) for (const f of (el.listeners[type] || [])) { e.currentTarget = el; f(e); }
    return e;
  }
  click() { return this.fire('click'); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body; }
  getContext() { return this._ctx || (this._ctx = makeCtx(this)); }
  getBoundingClientRect() { const w = this.style.width ? parseFloat(this.style.width) : (this.width || 300), h = this.style.height ? parseFloat(this.style.height) : (this.height || 150); return { left: 0, top: 0, width: w, height: h, right: w, bottom: h }; }
  setPointerCapture() { } releasePointerCapture() { } scrollIntoView() { }
}
const unent = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function parseInto(doc, root, html) {
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let cur = root, m;
  while ((m = re.exec(html))) {
    if (m[5] !== undefined) { if (cur.tagName !== 'STYLE') cur._text += unent(m[5]); continue; }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) { for (let e = cur; e && e !== root; e = e.parentNode) if (e.tagName === tag.toUpperCase()) { cur = e.parentNode; break; } continue; }
    const el = doc.createElement(tag);
    for (const a of m[3].matchAll(/([^\s=>]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) el.setAttribute(a[1], unent(a[2] ?? a[3] ?? a[4] ?? ''));
    if (tag === 'option' && el.getAttribute('value') === null) el.value = '';
    cur.appendChild(el);
    if (!VOID.has(tag) && !m[4]) cur = el;
  }
}
function makeDocument() {
  const doc = { listeners: {}, visibilityState: 'visible', fonts: undefined };
  doc.createElement = tag => new Element(doc, tag);
  doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body'); doc.documentElement.appendChild(doc.body);
  doc.activeElement = doc.body;
  doc.getElementById = id => doc.documentElement.querySelectorAll('#' + id)[0] || null;
  doc.querySelectorAll = sel => doc.documentElement.querySelectorAll(sel);
  doc.querySelector = sel => doc.documentElement.querySelector(sel);
  doc.addEventListener = (t, f) => { (doc.listeners[t] = doc.listeners[t] || []).push(f); };
  doc.fire = (type, props) => { const e = Object.assign({ type, defaultPrevented: false, cancelable: true, target: doc.body, preventDefault() { this.defaultPrevented = true; } }, props); for (const f of doc.listeners[type] || []) f(e); return e; };
  const head = read('head.html'), body = head.slice(head.indexOf('</style>') + 8);
  parseInto(doc, doc.body, body);
  return doc;
}

// in-memory localStorage; set env.ls.full = true to make setItem throw like a full browser storage
function makeStorage(init) {
  const m = new Map(Object.entries(init || {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    map: m, full: false,
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (this.full) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } m.set(k, String(v)); },
    removeItem(k) { m.delete(k); }, clear() { m.clear(); },
    get length() { return m.size; }, key(i) { return [...m.keys()][i] ?? null; }
  };
}
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const GLOBALS = ['window', 'document', 'localStorage', 'matchMedia', 'addEventListener', 'innerWidth', 'innerHeight', 'getSelection', 'screen',
  'location', 'setTimeout', 'setInterval', 'clearTimeout', 'requestAnimationFrame', 'performance', 'URL', 'Blob', 'Path2D', 'DOMMatrix',
  'DeviceMotionEvent', 'fetch', 'indexedDB', 'btoa', 'atob', 'Math'];
let SOURCE = null;
function source() {
  if (SOURCE) return SOURCE;
  const parts = ORDER.map(read); parts[0] = parts[0].replace('__TRACK__', read('track.txt'));
  return (SOURCE = parts.join(''));
}

// opts: storage {key: value}, width, height, dpr, coarse (phone pointer), portrait, seed, boot (default true)
function load(opts = {}) {
  const o = Object.assign({ width: 1280, height: 800, dpr: 1, coarse: false, portrait: false, seed: 1, storage: {} }, opts);
  const doc = makeDocument();
  const timers = [], rafs = [], winL = {};
  let tid = 0, now = 0;
  const env = {
    doc, ls: makeStorage(o.storage), timers, rafs, winL, rand: mulberry(o.seed),
    mq: { '(pointer: coarse)': { matches: o.coarse, addEventListener() { } }, '(orientation: portrait)': { matches: o.portrait, addEventListener() { } } },
    clock: { get now() { return now; }, set now(v) { now = v; } },
    // run due timers (setTimeout once, setInterval as often as due)
    advance(ms) {
      const end = now + ms;
      for (; ;) { const t = timers.filter(x => !x.dead && x.at <= end).sort((a, b) => a.at - b.at)[0]; if (!t) break; now = t.at; if (t.every) t.at += t.every; else t.dead = true; t.fn(); }
      now = end;
    },
    // window events: env.fireWin('keydown', { code: 'KeyC' })
    fireWin(type, props) { const e = Object.assign({ type, target: doc.body, defaultPrevented: false, cancelable: true, repeat: false, preventDefault() { this.defaultPrevented = true; } }, props); for (const f of winL[type] || []) f(e); return e; },
    ctxOf: id => doc.getElementById(id).getContext('2d')
  };
  const math = {}; for (const k of Object.getOwnPropertyNames(Math)) math[k] = Math[k]; math.random = () => env.rand();
  const win = {
    innerWidth: o.width, innerHeight: o.height, devicePixelRatio: o.dpr,
    addEventListener(t, f) { (winL[t] = winL[t] || []).push(f); }, removeEventListener() { },
    matchMedia: q => env.mq[q] || (env.mq[q] = { matches: false, addEventListener() { } }),
    getSelection: () => ({ rangeCount: 0, removeAllRanges() { } }),
    screen: { orientation: { angle: 0 } }, location: { protocol: 'file:' },
    setTimeout: (fn, ms) => { timers.push({ id: ++tid, fn, at: now + (ms || 0) }); return tid; },
    setInterval: (fn, ms) => { timers.push({ id: ++tid, fn, at: now + ms, every: ms }); return tid; },
    clearTimeout: id => { const t = timers.find(x => x.id === id); if (t) t.dead = true; },
    requestAnimationFrame: fn => { rafs.push(fn); return rafs.length; },
    performance: { now: () => now },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() { } }, Blob: class { constructor(parts, o) { this.parts = parts; this.type = o && o.type; } },
    Path2D: class { constructor() { this.ops = []; } }, DOMMatrix: class { scale(k) { this.k = k; return this; } },
    DeviceMotionEvent: undefined, btoa, atob, console, Math: math,
    // late-bound: tests set env.idb / env.fetch after loading
    indexedDB: { open: (...a) => { if (!env.idb) throw new Error('no indexedDB'); return env.idb.open(...a); } },
    fetch: (...a) => env.fetch(...a),
    localStorage: env.ls, document: doc
  };
  for (const k of ['moveTo', 'lineTo', 'closePath', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'rect', 'ellipse']) win.Path2D.prototype[k] = function (...a) { this.ops.push([k, ...a]); };
  win.window = win; win.clearInterval = win.clearTimeout;
  doc.body.appendChild(doc.createElement('div')); // spare node
  env.win = win;
  Object.assign(win, opts.window || {});
  let api = null;
  const names = inventoryNames();
  // the page globals the game uses are passed in as parameters (a with-scope made every lookup 3x slower)
  const code = '(()=>{\n' + source() + '\n;__expose(n => eval(n), (__n, __v) => eval(__n + " = __v"));\n})();';
  const run = new Function(...GLOBALS, '__expose', code);
  run(...GLOBALS.map(k => win[k]), (get, set) => { api = { get, set }; });
  const G = new Proxy({}, {
    get: (t, k) => typeof k === 'symbol' ? undefined : api.get(k),
    set: (t, k, v) => { api.set(k, v); return true; },
    has: (t, k) => names.top.has(k)
  });
  env.hud = () => G.hudCtx; env.main = () => G.mainCtx;
  return { G, env };
}

// ---------------------------------------------------------------------------
// function inventory (GDD 13b): top-level functions and arrow functions, methods of top-level objects, T.* / PIT.* / LL.*
// ---------------------------------------------------------------------------
let INV = null;
function inventoryNames() {
  if (INV) return INV;
  const list = [], top = new Set();
  for (const file of ORDER) {
    const lines = read(file).split('\n'); let obj = null;
    lines.forEach((ln, k) => {
      let m;
      if ((m = ln.match(/^(?:async )?function\*? ?([\w$]+)\s*\(/))) { list.push({ name: m[1], file, line: k + 1 }); top.add(m[1]); }
      else if ((m = ln.match(/^const ([\w$]+) = (?:\([^)]*\)|[\w$]+) =>/))) { list.push({ name: m[1], file, line: k + 1 }); top.add(m[1]); }
      if ((m = ln.match(/^const ([\w$]+) = \{/)) && !/\};?\s*(\/\/.*)?$/.test(ln)) obj = m[1];
      else if (obj && /^\};?/.test(ln)) obj = null;
      else if (obj && (m = ln.match(/^  (?:async )?([\w$]+)\([^)]*\) \{/))) list.push({ name: obj + '.' + m[1], file, line: k + 1 });
      if (file === 'core.js' && (m = ln.match(/^\s+(T|PIT|LL)\.([\w$]+) = (?:function|\(|[\w$]+ =>)/))) list.push({ name: (m[1] === 'T' ? 'T.' : 'T.' + m[1] + '.') + m[2], file, line: k + 1 });
    });
  }
  for (const ln of source().split('\n')) { const m = ln.match(/^(?:const|let) (.*)/); if (m) for (const d of m[1].matchAll(/(?:^|,\s*)([\w$]+)\s*=/g)) top.add(d[1]); }
  return (INV = { list, top });
}

// helpers for tests
const plain = x => JSON.parse(JSON.stringify(x));
const ops = (ctx, name) => ctx.calls.filter(c => c[0] === name);
const texts = ctx => ops(ctx, 'fillText').map(c => String(c[1]));
// a bike placed on the centre line at track distance s (metres), standing still
function placeAt(G, b, s, d = 0) {
  const T = G.T, i = T.idx(s), [x, y] = T.pt(i, d);
  Object.assign(b, { x, y, h: T.H[i], i, s: T.wrapS(s), d, prevS: T.wrapS(s) });
  b.surf = T.surface(i, b.s, d);
  return b;
}

// a session recording made in the test (no files): the bike rides the centre line at v m/s from track distance s0
// (negative = before the line), after standing still for `stand` seconds; one lap entry per full lap from the line
function makeRec(G, o = {}) {
  const T = G.T, v = o.v || 60, nl = o.laps ?? 2, s0 = o.s0 ?? -50, stand = o.stand || 0, dt = 0.1;
  const tLine = j => stand + (j * T.L - s0) / v; // time of the j-th line crossing
  const end = o.end ?? tLine(nl) + 1;
  const S = { dt, x: [], y: [], h: [], v: [], lean: [], s: [], p: [] };
  for (let k = 0; k * dt <= end + 1e-9; k++) {
    const t = k * dt, p = s0 + v * Math.max(0, t - stand), s = T.wrapS(p), i = T.idx(s), [x, y] = T.pt(i, 0);
    S.x.push(+x.toFixed(2)); S.y.push(+y.toFixed(2)); S.h.push(+T.H[i].toFixed(3)); S.v.push(t < stand ? 0 : v); S.lean.push(0); S.s.push(+s.toFixed(1)); S.p.push(+p.toFixed(1));
  }
  const laps = [];
  for (let j = 0; j < nl; j++) laps.push({ start: +tLine(j).toFixed(3), end: +tLine(j + 1).toFixed(3), time: +(T.L / v).toFixed(3) });
  const mode = o.mode || (o.kind === 'sprint' || o.kind === 'gp' ? 'race' : o.kind || 'practice');
  return Object.assign({
    format: 'silverstone-gp-session', version: 1, game: 'Silverstone GP', track: 'silverstone',
    id: o.id || 'r' + Math.round(v * 1000) + '_' + nl, date: o.date || '2026-10-30T10:00:00.000Z',
    kind: o.kind || 'practice', mode, totalLaps: mode === 'race' ? nl : 0,
    rider: { name: o.name || 'Ghost Rider', num: 7, team: 3, short: 'GHO' }, aids: true, auto: true,
    laps, bestLap: laps.length ? laps[0].time : 0, raceStart: o.raceStart || 0, finishT: 0, position: 0, pits: 0,
    start: o.start || { kind: 'box', t: 0 }, samples: S
  }, o.extra || {});
}

module.exports = { load, inventoryNames, plain, ops, texts, placeAt, makeRec, makeCtx, ROOT };
