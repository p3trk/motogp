#!/usr/bin/env node
// Phone emulation test (GDD 13, since 1.19.8): runs the phone checks in emulated phones on the Mac.
// iPhone profile in WebKit (the engine of Safari, not Safari itself) and Pixel profile in Chromium (the engine of
// Chrome on Android). Touch halves use pointer events, tilt uses fake motion events, and the two-finger pinch is sent
// through the DevTools protocol (Chromium only). Real iPhone Safari and real Android are not covered here.
// Screenshots go to shots/ for a visual check of the HUD layout; they are not compared automatically.
// Usage: node tests/phone_emulation.test.js [path/to/index.html]   (needs Playwright with Chromium and WebKit)
const path = require('path');
const { chromium, webkit, devices } = require('playwright');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const SHOTS = path.join(__dirname, '..', 'shots');

const PHONES = [
  { name: 'iPhone (WebKit)', type: webkit, device: 'iPhone 13 landscape', pinch: false, portrait: false },
  { name: 'Pixel (Chromium)', type: chromium, device: 'Pixel 7 landscape', pinch: true, portrait: true },
];

let failures = 0;
const check = (name, ok, info) => {
  console.log((ok ? 'ok    ' : 'FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
  if (!ok) failures++;
};

async function runPhone(phone) {
  const desc = devices[phone.device];
  const launch = phone.type === chromium && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await phone.type.launch(launch);
  const ctx = await browser.newContext({ ...desc });
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.error('page error:', e.message); failures++; });
  // iPhone asks for motion access from the Go tap; the browser is told to allow it
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch (e) { }
    if (window.DeviceMotionEvent) DeviceMotionEvent.requestPermission = () => Promise.resolve('granted');
  });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);

  console.log('\n== ' + phone.name + ' ==');
  const meta = await page.evaluate(() => ({
    viewport: document.querySelector('meta[name=viewport]').content,
    game: getComputedStyle(document.getElementById('game')).touchAction,
    overlay: getComputedStyle(document.getElementById('menu')).touchAction,
  }));
  check('viewport: pinch and double-tap zoom off', /user-scalable=no/.test(meta.viewport) && /maximum-scale=1/.test(meta.viewport), meta.viewport);
  check('game canvas ignores touch gestures', meta.game === 'none', meta.game);
  check('menu scrolls with a finger, no double-tap zoom', meta.overlay === 'manipulation', meta.overlay);

  const menu = await page.evaluate(() => ({
    touch: window.__sgp.Touch.want(),
    transHidden: document.getElementById('optTrans').closest('.opt').hidden,
    sideShown: !document.getElementById('optSideWrap').hidden,
    tiltShown: !document.getElementById('optTiltWrap').hidden,
  }));
  check('phone: touch controls on, gearbox row hidden, side and tilt rows shown', menu.touch && menu.transHidden && menu.sideShown && menu.tiltShown, menu);

  // practice with no curve training: the bike waits on the grid until the first input
  await page.evaluate(() => {
    document.querySelector('.mode[data-mode="practice"]').click();
    document.querySelector('#optTrain button[data-v="off"]').click();
    document.getElementById('btnStart').click();
  });
  await page.waitForFunction(() => window.__sgp.UI.state === 'play');
  await page.waitForFunction(() => window.__sgp.Touch.listening, null, { timeout: 5000 }).catch(() => { });

  const sensor = await page.evaluate(() => ({ listening: window.__sgp.Touch.listening, tiltOk: window.__sgp.Touch.tiltOk }));
  check('motion: sensor access granted and listening', sensor.listening && sensor.tiltOk, sensor);

  await page.waitForTimeout(200); // one frame, so the touch layer has been shown
  const visible = await page.evaluate(() => ({
    touch: !document.getElementById('touch').hidden,
    pause: !document.getElementById('touchPause').hidden,
    turn: !document.getElementById('turn').hidden,
  }));
  check('play: both touch halves and the pause button visible', visible.touch && visible.pause && !visible.turn, visible);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 'phone-' + phone.device.split(' ')[0].toLowerCase() + '-play.png') });

  const step = n => page.evaluate(n => { const S = window.__sgp; for (let k = 0; k < n; k++) S.simStep(S.SUB); }, n);
  const press = (id, x) => page.evaluate(([id, x]) => document.getElementById('touch').dispatchEvent(
    new PointerEvent('pointerdown', { clientX: x, clientY: 200, pointerId: id, bubbles: true })), [id, x]);
  const release = id => page.evaluate(id => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, bubbles: true })), id);
  const ctl = () => page.evaluate(() => { const b = window.__sgp.W.player; return { thr: b.ctl.thr, brk: b.ctl.brk, auto: b.auto, lean: b.ctl.leanT }; });
  // a plain event with the same field: WebKit does not let scripts build DeviceMotionEvent
  const motion = (x, y) => page.evaluate(([x, y]) => { const e = new Event('devicemotion'); e.accelerationIncludingGravity = { x, y, z: 0 }; window.dispatchEvent(e); }, [x, y]);
  const width = await page.evaluate(() => innerWidth);

  // touch halves: left brakes, right throttles, both together brake
  await press(1, width * 0.25); await step(60);
  let c = await ctl();
  check('left half brakes', c.brk > 0.5 && c.thr < 0.01, c);
  await release(1); await step(60);
  await press(2, width * 0.75); await step(60);
  c = await ctl();
  check('right half throttles', c.thr > 0.5 && c.brk < 0.01, c);
  await press(3, width * 0.25); await step(5);
  c = await ctl();
  check('both halves: brake wins', c.brk > 0.1 && c.thr < 0.7, c);
  await release(2); await release(3); await step(60);
  check('automatic gearbox', (await ctl()).auto === true);

  // tilt: a 45 degree turn is inside the Low range (dead zone 12, full lean 60), so it leans right
  await page.evaluate(() => { window.__sgp.Touch.angle = () => 0; });
  for (let k = 0; k < 5; k++) await motion(0, 9.8);
  for (let k = 0; k < 40; k++) await motion(-0.4, 9.8); // about 2 degrees: dead zone
  let t = await page.evaluate(() => window.__sgp.Touch.tilt);
  check('tilt: dead zone holds the bike straight', Math.abs(t) < 0.001, t);
  for (let k = 0; k < 60; k++) await motion(-6.93, 6.93); // 45 degrees, right side low
  await step(5);
  t = await page.evaluate(() => window.__sgp.Touch.tilt);
  c = await ctl();
  check('tilt: 45 degrees right leans right (Low)', t > 0.5 && c.lean > 0, { tilt: t, leanT: c.lean });

  // pinch and double tap: the page must stay at scale 1
  if (phone.pinch) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const cx = width / 2, cy = 195;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 20, y: cy, id: 0 }, { x: cx + 20, y: cy, id: 1 }] });
    for (let k = 1; k <= 10; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 20 - k * 8, y: cy, id: 0 }, { x: cx + 20 + k * 8, y: cy, id: 1 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    const pinch = await page.evaluate(() => window.visualViewport.scale);
    check('pinch: page scale stays 1', Math.abs(pinch - 1) < 0.001, { scale: pinch });
    for (let k = 0; k < 2; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width * 0.75, y: 200, id: 0 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await page.waitForTimeout(400);
    const dbl = await page.evaluate(() => window.visualViewport.scale);
    check('double tap on the throttle half: page scale stays 1', Math.abs(dbl - 1) < 0.001, { scale: dbl });
  } else {
    console.log('skip  pinch and double tap (CDP touch emulation is Chromium only)');
  }

  // portrait: the turn prompt shows and pauses; back in landscape it is hidden again. WebKit's orientation query does not
  // follow a resized emulated viewport, so there the check is skipped (see GDD 13 limits)
  if (!phone.portrait) { console.log('skip  portrait prompt (WebKit emulation does not change the orientation query)'); await browser.close(); return; }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const portrait = await page.evaluate(() => ({ turn: !document.getElementById('turn').hidden, paused: window.__sgp.W.paused }));
  check('portrait: turn prompt shown and race paused', portrait.turn && portrait.paused, portrait);
  await page.setViewportSize(desc.viewport);
  await page.waitForTimeout(400);
  check('landscape: turn prompt hidden again', await page.evaluate(() => document.getElementById('turn').hidden));

  await browser.close();
}

(async () => {
  for (const phone of PHONES) await runPhone(phone);
  if (failures) { console.error('\nphone emulation: ' + failures + ' check(s) failed'); process.exitCode = 1; }
  else console.log('\nphone emulation: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
