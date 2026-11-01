// ESLint with Sonar's JavaScript rules (GDD 13a). Run by the pre-commit hook (tools/hooks/pre-commit) on the
// staged lines and by `npm run lint` on the whole project.
const js = require('@eslint/js');
const globals = require('globals');
const sonarjs = require('eslint-plugin-sonarjs');

module.exports = [
  { ignores: ['index.html', 'node_modules/**', 'saved_tracks/**', 'shots/**', '.claude/**'] },
  js.configs.recommended,
  sonarjs.configs.recommended,
  {
    // the game: browser scripts joined into one file by tools/build.py, so names come from the other files
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser } },
    // no-implicit-global is Sonar's version of no-undef: it flags names declared in another src file.
    // Math.random only drives camera shake, speed lines, sound noise and recording ids; the race has its own seeded
    // generator, so pseudo-random is not a risk here (GDD 13a)
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off', 'sonarjs/no-implicit-global': 'off', 'sonarjs/pseudo-random': 'off' },
  },
  {
    files: ['tests/**/*.js', 'tools/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    // Playwright runs the evaluate() callbacks inside the page. The tests are plain scripts, not describe/it
    // blocks, so the empty test file rule does not apply
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'sonarjs/no-empty-test-file': 'off' },
  },
];
