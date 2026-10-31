// Function inventory (GDD 13b): every top-level function and every method of the top-level objects in src/ is named
// in at least one unit test title ("name: what it checks", several names as "a, b: ..."), and no test title names a
// function that no longer exists. Helpers defined inside another function are covered through it and not listed.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { inventoryNames } = require('./load');

const inv = inventoryNames().list;
const titles = [];
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f !== 'inventory.test.js')) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf-8');
  for (const m of src.matchAll(/\btest\(\s*(['"`])((?:\\.|(?!\1).)*?)\1/g)) titles.push({ file: f, title: m[2] });
}
// the names a title covers: the part before ': ' when it is a list of identifiers (Obj.method allowed)
const named = t => { const m = t.match(/^([\w$.]+(?:, [\w$.]+)*): /); return m ? m[1].split(', ') : []; };

test('inventory: the source has functions to check', () => {
  assert.ok(inv.length > 200, 'found ' + inv.length);
  const dup = inv.map(f => f.name).filter((n, k, a) => a.indexOf(n) !== k);
  assert.deepEqual(dup, [], 'function names must be unique');
});

test('inventory: every function has a unit test', () => {
  const covered = new Set(titles.flatMap(t => named(t.title)));
  const missing = inv.filter(f => !covered.has(f.name)).map(f => `${f.name} (src/${f.file}:${f.line})`);
  assert.deepEqual(missing, [], missing.length + ' function(s) without a unit test');
});

test('inventory: no test names a function that does not exist', () => {
  const have = new Set(inv.map(f => f.name));
  const stale = titles.flatMap(t => named(t.title).filter(n => !have.has(n)).map(n => `${n} (tests/unit/${t.file}: "${t.title}")`));
  assert.deepEqual(stale, [], 'stale test titles');
});
