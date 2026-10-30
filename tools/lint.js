#!/usr/bin/env node
// Code scanning with ESLint and Sonar's rules (GDD 13a).
// Usage: node tools/lint.js            scan src/, tests/ and tools/, write shots/lint-report.txt
//        node tools/lint.js --staged   scan the staged .js files and stop on issues in the lines this commit changes
//                                      (run by tools/hooks/pre-commit)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCANNED = /^(src|tests|tools)\/.+\.js$/;

let ESLint;
try { ({ ESLint } = require('eslint')); } catch {
  console.error('Code scan: ESLint is not installed. Run `npm install` in the main checkout, and in a worktree link it:');
  console.error('  ln -s /Users/petr/Documents/AI/MOTOGP/node_modules node_modules');
  process.exit(1);
}

const GIT = '/usr/bin/git'; // a fixed path, not looked up in PATH (sonarjs/no-os-command-from-path)
const git = args => execFileSync(GIT, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const where = (file, m) => `${file}:${m.line || 0}:${m.column || 0}`;
const describe = (file, m) => `${where(file, m)}  ${m.ruleId || 'parse error'}  ${m.message}`;

// lines added or changed by the staged diff of one file, from the "+start,count" part of each hunk header
function changedLines(file) {
  const lines = new Set();
  for (const h of git(['diff', '--cached', '--unified=0', '--', file]).matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(h[1]), count = h[2] === undefined ? 1 : Number(h[2]);
    for (let k = 0; k < count; k++) lines.add(start + k);
  }
  return lines;
}

async function staged() {
  const files = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(f => SCANNED.test(f));
  if (!files.length) return 0;
  const eslint = new ESLint({ cwd: ROOT });
  const found = [];
  for (const file of files) {
    const [res] = await eslint.lintText(git(['show', ':' + file]), { filePath: path.join(ROOT, file) });
    if (!res) continue; // ignored by the config
    const lines = changedLines(file);
    for (const m of res.messages) if (m.fatal || lines.has(m.line)) found.push(describe(file, m));
  }
  if (!found.length) { console.log(`Code scan: ${files.length} file(s), no new issues.`); return 0; }
  console.error(`Code scan: ${found.length} new issue(s) in this commit. Fix them and commit again (GDD 13a).`);
  for (const f of found) console.error('  ' + f);
  return 1;
}

async function full() {
  const eslint = new ESLint({ cwd: ROOT });
  const results = await eslint.lintFiles(['src', 'tests', 'tools', 'eslint.config.js']);
  const byRule = new Map(), list = [];
  for (const r of results) {
    const file = path.relative(ROOT, r.filePath);
    for (const m of r.messages) {
      const id = m.ruleId || 'parse error';
      byRule.set(id, (byRule.get(id) || 0) + 1);
      list.push(describe(file, m));
    }
  }
  const total = list.length;
  const summary = [`Code scan: ${total} issue(s) in ${results.length} file(s).`]
    .concat([...byRule].sort((a, b) => b[1] - a[1]).map(([id, n]) => `  ${String(n).padStart(5)}  ${id}`));
  const out = path.join(ROOT, 'shots', 'lint-report.txt');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, summary.concat(['', ...list]).join('\n') + '\n');
  console.log(summary.join('\n'));
  console.log(`Full list: ${path.relative(ROOT, out)}`);
  return total ? 1 : 0;
}

(process.argv.includes('--staged') ? staged() : full())
  .then(code => { process.exitCode = code; })
  .catch(e => { console.error(e); process.exit(1); });
