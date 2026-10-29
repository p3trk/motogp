#!/usr/bin/env node
// Mobile controls test (GDD 3a, since 1.18.0): on a phone-sized touch screen the game uses the two screen halves
// (left brakes, right throttles), the automatic gearbox and the tilt lean; brake wins over throttle; the halves can be
// swapped; a phone held upright pauses the race with the turn prompt. Tilt is faked with devicemotion events, since
// the headless browser has no motion sensors. Keyboard play is covered by the other tests.
// Usage: node tests/mobile_controls.test.js [path/to/index.html]   (needs Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const fails = [];
  const check = (name, ok, info) => { console.log((ok ? 'ok    ' : 'FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if (!ok) fails.push(name); };

  // ---- phone in landscape, touch screen
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  // iPhone asks for motion access from the Go tap; here the browser is told to allow it
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } if (window.DeviceMotionEvent) DeviceMotionEvent.requestPermission = () => Promise.resolve('granted'); });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);

  const menu = await page.evaluate(() => ({
    touch: window.__sgp.Touch.want(),
    transHidden: document.getElementById('optTrans').closest('.opt').hidden,
    sideShown: !document.getElementById('optSideWrap').hidden,
    tiltShown: !document.getElementById('optTiltWrap').hidden,
  }));
  check('phone: touch controls on by default', menu.touch, menu);
  check('phone: manual gearbox row hidden', menu.transHidden);
  check('phone: side and tilt rows shown', menu.sideShown && menu.tiltShown);

  const zoom = await page.evaluate(() => ({ meta: document.querySelector('meta[name=viewport]').content, game: getComputedStyle(document.getElementById('game')).touchAction }));
  check('phone: pinch and double-tap zoom off', /user-scalable=no/.test(zoom.meta) && zoom.game === 'none', zoom);

  // menus (GDD 3a, since 1.19.5): double-tap zoom is off on the overlays, and text cannot be selected on the page
  // (form fields keep their selection). iPhone Brave uses the same WebKit rules, checked on a phone.
  const menuRules = await page.evaluate(() => ({ overlay: getComputedStyle(document.getElementById('menu')).touchAction, body: getComputedStyle(document.body).userSelect, field: getComputedStyle(document.querySelector('input,textarea,select') || document.body).userSelect }));
  check('phone: menus block double-tap zoom and text selection', menuRules.overlay === 'manipulation' && menuRules.body === 'none', menuRules);

  // practice, no curve training: the bike waits on the grid until the first input
  await page.evaluate(() => {
    document.querySelector('.mode[data-mode="practice"]').click();
    document.querySelector('#optTrain button[data-v="off"]').click();
    document.getElementById('btnStart').click();
  });
  await page.waitForFunction(() => window.__sgp.UI.state === 'play');
  const sensor = await page.evaluate(() => ({ listening: window.__sgp.Touch.listening, tiltOk: window.__sgp.Touch.tiltOk }));
  check('motion: sensor access granted and listening', sensor.listening && sensor.tiltOk, sensor);

  const step = n => page.evaluate(n => { const S = window.__sgp; for (let k = 0; k < n; k++) S.simStep(S.SUB); }, n);
  const press = (id, x) => page.evaluate(([id, x]) => document.getElementById('touch').dispatchEvent(
    new PointerEvent('pointerdown', { clientX: x, clientY: 200, pointerId: id, bubbles: true })), [id, x]);
  const release = id => page.evaluate(id => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, bubbles: true })), id);
  const ctl = () => page.evaluate(() => { const b = window.__sgp.W.player; return { thr: b.ctl.thr, brk: b.ctl.brk, auto: b.auto, lean: b.ctl.leanT }; });
  const motion = (x, y) => page.evaluate(([x, y]) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y, z: 0 } })), [x, y]);

  const start = await ctl();
  check('phone: bike uses the automatic gearbox', start.auto === true, start);

  // left half brakes
  await press(1, 100); await step(60);
  let c = await ctl();
  check('left half: brake pressed', c.brk > 0.5 && c.thr < 0.01, c);
  await release(1); await step(60);

  // during play (GDD 3a, since 1.19.7): the touch layer cancels the touch events themselves, which is what stops iPhone
  // WebKit's long-press selection and double-tap / pinch zoom; text selection and the long-press menu are blocked
  const play = await page.evaluate(() => {
    const el = document.getElementById('touch'), r = {};
    for (const t of ['touchstart', 'touchmove', 'touchend']) {
      const tc = new Touch({ identifier: 9, target: el, clientX: 600, clientY: 200 });
      const ev = new TouchEvent(t, { cancelable: true, bubbles: true, touches: t === 'touchend' ? [] : [tc], changedTouches: [tc] });
      el.dispatchEvent(ev); r[t] = ev.defaultPrevented;
    }
    const sel = new Event('selectstart', { cancelable: true, bubbles: true }); el.dispatchEvent(sel); r.selectstart = sel.defaultPrevented;
    const cm = new MouseEvent('contextmenu', { cancelable: true, bubbles: true }); el.dispatchEvent(cm); r.contextmenu = cm.defaultPrevented;
    r.callout = getComputedStyle(document.body).webkitTouchCallout;
    return r;
  });
  check('play: touch events cancelled (no iPhone selection or zoom)', play.touchstart && play.touchmove && play.touchend, play);
  check('play: text selection and long-press menu blocked', play.selectstart && play.contextmenu, play);
  await press(1, 100); await step(30); c = await ctl();
  check('play: brake still works with touch events cancelled', c.brk > 0.5, c);
  await release(1); await step(60);

  // right half throttles
  await press(2, 700); await step(60);
  c = await ctl();
  check('right half: throttle pressed', c.thr > 0.5 && c.brk < 0.01, c);

  // both halves: brake wins, throttle falls away (throttle was full just before)
  const thrGas = (await ctl()).thr;
  await press(3, 100); await step(5);
  c = await ctl();
  check('both halves: brake wins, throttle falls away', thrGas > 0.9 && c.thr < 0.7 && c.brk > 0.1, { thrGas, ...c });
  await step(60); c = await ctl();
  check('both halves: throttle stays off while both are held', c.thr < 0.01 && c.brk > 0.5, c);
  await release(2); await release(3); await step(60);

  // swap the halves (the option is chosen on the start screen; here it is set and synced the same way)
  await page.evaluate(() => { window.__sgp.UI.opts.side = 'gas'; window.__sgp.UI.sync(); });
  const swapped = await page.evaluate(() => [...document.getElementById('touch').children].map(z => z.dataset.z));
  check('swap: left half is throttle', swapped[0] === 'gas' && swapped[1] === 'brk', swapped);
  await press(4, 100); await step(60);
  c = await ctl();
  check('swap: left half throttles', c.thr > 0.5 && c.brk < 0.01, c);
  await release(4); await step(60);
  await page.evaluate(() => { window.__sgp.UI.opts.side = 'brk'; window.__sgp.UI.sync(); });

  // tilt: the first sample sets the zero point, a small turn is inside the dead zone, a turn of 30 degrees leans right
  await page.evaluate(() => { window.__sgp.Touch.angle = () => 0; });
  for (let k = 0; k < 5; k++) await motion(0, 9.8);
  for (let k = 0; k < 40; k++) await motion(-0.4, 9.8); // about 2.3 degrees: dead zone
  let t = await page.evaluate(() => window.__sgp.Touch.tilt);
  check('tilt: dead zone holds the bike straight', Math.abs(t) < 0.001, t);
  for (let k = 0; k < 60; k++) await motion(-6.93, 6.93); // 45 degrees, right side low
  await step(5);
  t = await page.evaluate(() => window.__sgp.Touch.tilt);
  c = await ctl();
  check('tilt: 45 degrees right leans right', t > 0.5 && c.lean > 0, { tilt: t, leanT: c.lean }); // Low: (45 - 12) / (60 - 12)
  await page.evaluate(() => window.__sgp.Touch.recentre());
  await motion(-4.92, 8.49); await step(5);
  t = await page.evaluate(() => window.__sgp.Touch.tilt);
  check('re-centre: the current angle becomes straight', Math.abs(t) < 0.001, t);

  // portrait: the turn prompt pauses the race and goes away again in landscape
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const portrait = await page.evaluate(() => ({ turn: !document.getElementById('turn').hidden, paused: window.__sgp.W.paused }));
  check('portrait: turn prompt shown and race paused', portrait.turn && portrait.paused, portrait);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => document.getElementById('turn').hidden);
  check('landscape: turn prompt hidden again', back === true);

  await ctx.close();

  // ---- desktop, no touch: nothing of the phone layout, the gearbox choice stays
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dpage = await dctx.newPage();
  await dpage.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  await dpage.goto(FILE);
  await dpage.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);
  const desk = await dpage.evaluate(() => ({
    touch: window.__sgp.Touch.want(),
    transShown: !document.getElementById('optTrans').closest('.opt').hidden,
    sideHidden: document.getElementById('optSideWrap').hidden,
  }));
  check('desktop: touch controls off, gearbox choice shown', !desk.touch && desk.transShown && desk.sideHidden, desk);
  await dctx.close();

  await browser.close();
  if (fails.length) { console.error('\nmobile controls: ' + fails.length + ' check(s) failed'); process.exitCode = 1; }
  else console.log('\nmobile controls: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
