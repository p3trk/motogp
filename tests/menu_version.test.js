#!/usr/bin/env node
// Menu version test (GDD 11, since 1.19.6): the version shown next to the menu title is the newest "## vX.Y.Z" heading
// in CHANGELOG.md, and it is shown on the menu only.
// Usage: node tests/menu_version.test.js [path/to/index.html]   (needs Playwright + Chromium)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(ROOT, 'index.html'));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const fails = [];
  const check = (name, ok, info) => { console.log((ok ? 'ok    ' : 'FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if (!ok) fails.push(name); };

  const newest = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8').match(/^## v(\d+\.\d+\.\d+)/m)[1];

  const page = await browser.newPage();
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  await page.goto(FILE);
  await page.waitForFunction(() => window.__sgp && document.getElementById('loading').hidden);

  const label = await page.evaluate(() => { const v = document.querySelector('h1 .ver'); return { text: v && v.textContent, title: document.querySelector('h1').textContent }; });
  check('menu shows the newest CHANGELOG version next to the title', label.text === 'v' + newest, { shown: label.text, changelog: 'v' + newest });
  check('title still reads Silverstone GP', /Silverstone\s+GP/.test(label.title), label.title);

  await browser.close();
  if (fails.length) { console.log('\n' + fails.length + ' failed'); process.exit(1); }
  console.log('\nmenu version checks passed');
})().catch(e => { console.error(e); process.exit(1); });
