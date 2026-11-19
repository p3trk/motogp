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
const ORDER = ['core.js', 'world.js', 'replay.js', 'bike_art.js', 'rig_art.js', 'vendor/three.min.js', 'bike3dmodel.js', 'render.js', 'bike3dgl.js', 'track3d.js', 'scenery3d.js', 'ui.js'];

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
      if (!fns[k]) fns[k] = (...a) => { t.calls.push([k, ...a]); return ret[k] ? ret[k](...a) : undefined; };
      return fns[k];
    },
    set(t, k, v) {
      t[k] = v;
      if (k !== 'calls') t.calls.push(['=' + k, v]);
      return true;
    }
  });
}

// ---------------------------------------------------------------------------
// fake DOM: enough of Element for the game, with simple selectors (tag, .class, #id, [attr], tag[attr], lists)
// ---------------------------------------------------------------------------
const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr', 'source']);
function listen(map, t, f) {
  if (!map[t]) map[t] = [];
  map[t].push(f);
}
// one part of a compound selector: .class, #id, [attr] or [attr=value]
function partMatches(el, p) {
  if (p[0] === '#') return el.id === p.slice(1);
  if (p[0] === '.') return el.classList.contains(p.slice(1));
  const [k, v] = p.slice(1, -1).split('='), have = el.getAttribute(k);
  return have !== null && (v === undefined || have === v.replace(/"/g, ''));
}
function matches(el, sel) {
  return sel.split(',').some(one => {
    const s = one.trim(), tag = s.match(/^[a-z0-9]*/i)[0], rest = s.slice(tag.length);
    const parts = rest ? rest.split(/(?=[.#[])/) : [];
    if (!parts.every(p => p[0] !== '[' || p.endsWith(']'))) return false; // not a simple selector
    return (!tag || el.tagName === tag.toUpperCase()) && parts.every(p => partMatches(el, p));
  });
}
const dataKey = k => k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase()); // data-foo-bar -> fooBar
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
  setAttribute(k, v) {
    v = String(v); this.attrs[k] = v;
    if (k === 'class') this.className = v;
    if (k.startsWith('data-')) this.dataset[dataKey(k)] = v;
    if (k === 'hidden') this.hidden = true;
    if (k === 'value') this.value = v;
  }
  getAttribute(k) {
    if (k === 'class') return this.className || null;
    if (k.startsWith('data-')) return this.dataset[dataKey(k)] ?? null;
    return k in this.attrs ? this.attrs[k] : null;
  }
  get firstElementChild() { return this.children[0] || null; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.children = []; this._text = ''; parseInto(this.ownerDocument, this, this._html); }
  appendChild(c) {
    if (c.parentNode) c.remove();
    c.parentNode = this; this.children.push(c); return c;
  }
  append(...cs) { cs.forEach(c => this.appendChild(c)); }
  remove() { const p = this.parentNode; if (p) { p.children = p.children.filter(x => x !== this); this.parentNode = null; } }
  insertAt(c, k) {
    const p = this.parentNode;
    if (c.parentNode) c.remove();
    c.parentNode = p; p.children.splice(p.children.indexOf(this) + k, 0, c);
  }
  after(c) { this.insertAt(c, 1); }
  before(c) { this.insertAt(c, 0); }
  *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
  querySelectorAll(sel) { return [...this.walk()].filter(e => matches(e, sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) {
    for (let e = this; e; e = e.parentNode) if (e instanceof Element && matches(e, sel)) return e;
    return null;
  }
  addEventListener(t, f) { listen(this.listeners, t, f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter(x => x !== f); }
  // fire an event: e gets target/currentTarget and preventDefault; returns the event
  fire(type, props) {
    const e = Object.assign({ type, target: this, defaultPrevented: false, cancelable: true, preventDefault() { this.defaultPrevented = true; } }, props);
    for (let el = this; el; el = el.parentNode) {
      for (const f of (el.listeners[type] || [])) { e.currentTarget = el; f(e); }
    }
    return e;
  }
  click() { return this.fire('click'); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body; }
  getContext() {
    if (!this._ctx) this._ctx = makeCtx(this);
    return this._ctx;
  }
  getBoundingClientRect() { const w = this.style.width ? parseFloat(this.style.width) : (this.width || 300), h = this.style.height ? parseFloat(this.style.height) : (this.height || 150); return { left: 0, top: 0, width: w, height: h, right: w, bottom: h }; }
  setPointerCapture() { } releasePointerCapture() { } scrollIntoView() { }
}
const unent = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// <tag attr="v" ...> -> element appended to cur; returns the element to fill next (cur for void elements)
function openTag(doc, cur, tok) {
  const tag = tok.match(/^<([a-zA-Z][\w-]*)/)[1].toLowerCase(), el = doc.createElement(tag), rest = tok.slice(tag.length + 1, -1);
  for (const a of rest.matchAll(/([^\s=/]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g)) el.setAttribute(a[1], unent(a[2] ?? a[3] ?? a[4] ?? ''));
  if (tag === 'option' && el.getAttribute('value') === null) el.value = '';
  cur.appendChild(el);
  return VOID.has(tag) || rest.endsWith('/') ? cur : el;
}
// </tag> -> the parent of the nearest open element with that tag
function closeTag(cur, root, tag) {
  for (let e = cur; e && e !== root; e = e.parentNode) if (e.tagName === tag) return e.parentNode;
  return cur;
}
// markup split into comments (dropped), tags and text
function* tokens(html) {
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) { const j = html.indexOf('-->', i); i = j < 0 ? html.length : j + 3; continue; }
    const j = html[i] === '<' ? html.indexOf('>', i) + 1 : html.indexOf('<', i), end = j <= 0 ? html.length : j;
    yield html.slice(i, end);
    i = end;
  }
}
function parseInto(doc, root, html) {
  let cur = root;
  for (const tok of tokens(html)) {
    if (tok[0] !== '<') { if (cur.tagName !== 'STYLE') cur._text += unent(tok); }
    else if (tok[1] === '/') cur = closeTag(cur, root, tok.slice(2, -1).trim().toUpperCase());
    else if (/^<[a-zA-Z]/.test(tok)) cur = openTag(doc, cur, tok);
  }
}
// an event for listeners on the window or the document; returns it, with defaultPrevented
function fireAll(list, props) {
  const e = Object.assign({ defaultPrevented: false, cancelable: true, repeat: false, preventDefault() { this.defaultPrevented = true; } }, props);
  for (const f of list || []) f(e);
  return e;
}
function makeDocument() {
  const doc = { listeners: {}, visibilityState: 'visible', fonts: undefined };
  doc.createElement = tag => new Element(doc, tag);
  doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body'); doc.documentElement.appendChild(doc.body);
  doc.activeElement = doc.body;
  doc.getElementById = id => doc.documentElement.querySelectorAll('#' + id)[0] || null;
  doc.querySelectorAll = sel => doc.documentElement.querySelectorAll(sel);
  doc.querySelector = sel => doc.documentElement.querySelector(sel);
  doc.addEventListener = (t, f) => listen(doc.listeners, t, f);
  doc.fire = (type, props) => fireAll(doc.listeners[type], Object.assign({ type, target: doc.body }, props));
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
    setItem(k, v) {
      if (this.full) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, String(v));
    },
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
  const parts = ORDER.map(read); parts[0] = parts[0].replace('__TRACK__', read('track.txt')).replace('__CHANGELOG__', JSON.stringify(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8')));
  SOURCE = parts.join('');
  return SOURCE;
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
      for (; ;) {
        const t = timers.filter(x => !x.dead && x.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!t) break;
        now = t.at;
        if (t.every) t.at += t.every; else t.dead = true;
        t.fn();
      }
      now = end;
    },
    // window events: env.fireWin('keydown', { code: 'KeyC' })
    fireWin: (type, props) => fireAll(winL[type], Object.assign({ type, target: doc.body }, props)),
    ctxOf: id => doc.getElementById(id).getContext('2d')
  };
  const math = {};
  for (const k of Object.getOwnPropertyNames(Math)) math[k] = Math[k];
  math.random = () => env.rand();
  const win = {
    innerWidth: o.width, innerHeight: o.height, devicePixelRatio: o.dpr,
    addEventListener(t, f) { listen(winL, t, f); }, removeEventListener() { },
    matchMedia: q => {
      if (!env.mq[q]) env.mq[q] = { matches: false, addEventListener() { } };
      return env.mq[q];
    },
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
    indexedDB: {
      open: (...a) => {
        if (!env.idb) throw new Error('no indexedDB');
        return env.idb.open(...a);
      }
    },
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
  // the code run here is the game's own src/, joined like tools/build.py does; eval gives the tests its top-level names
  // eslint-disable-next-line sonarjs/code-eval
  const run = new Function(...GLOBALS, '__expose', code);
  // eslint-disable-next-line sonarjs/code-eval
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
  const add = (name, file, k) => list.push({ name, file, line: k + 1 });
  for (const file of ORDER) {
    let obj = null; // the top-level object literal being read
    read(file).split('\n').forEach((ln, k) => {
      const fn = ln.match(/^(?:async )?function\*? ?([\w$]+)\s*\(/) || ln.match(/^const ([\w$]+) = (?:\([^)]*\)|[\w$]+) =>/);
      if (fn) { add(fn[1], file, k); top.add(fn[1]); }
      const open = ln.match(/^const ([\w$]+) = \{/), meth = ln.match(/^ {2}(?:async )?([\w$]+)\([^)]*\) \{/);
      if (open && !/\};?\s*(\/\/.*)?$/.test(ln)) obj = open[1];
      else if (obj && /^\};?/.test(ln)) obj = null;
      else if (obj && meth) add(obj + '.' + meth[1], file, k);
      const tr = file === 'core.js' && ln.match(/^\s+(T|PIT|LL)\.([\w$]+) = (?:function|\(|[\w$]+ =>)/);
      if (tr) add((tr[1] === 'T' ? 'T.' : 'T.' + tr[1] + '.') + tr[2], file, k);
    });
  }
  for (const ln of source().split('\n')) {
    const m = ln.match(/^(?:const|let) (.*)/);
    if (m) for (const d of m[1].matchAll(/(?:^|,\s*)([\w$]+)\s*=/g)) top.add(d[1]);
  }
  INV = { list, top };
  return INV;
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
