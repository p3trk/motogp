# Git workspaces

- The main checkout (`/Users/petr/Documents/AI/MOTOGP`) is for merging and tagging only.
  Never run `git checkout` / `git switch` to change branches there while another agent may be working.
- Feature work happens in a git worktree under `.claude/worktrees/<name>`, one task per worktree,
  one branch per worktree. This folder is excluded via `.git/info/exclude`; don't add it to `.gitignore`.
- If you start in the main checkout and need a new branch, create a worktree instead:
  `git worktree add .claude/worktrees/<name> -b <branch>`
- After a branch is merged into `dev`, remove its worktree with `git worktree remove .claude/worktrees/<name>`.

# Branches and releases

- `dev` is the integration branch. Every feature branch merges into `dev` (`--no-ff`), through the `.claude/worktrees/dev` worktree. Never merge a feature branch into `main` directly.
- Feature commits do not touch versions: no GDD version bump, no CHANGELOG version entry, no tag.
- **Release** (when Petr says "Release"): compare `main` and `dev` (`git log main..dev`, `git diff main dev`), choose the new version (MINOR for features, PATCH for fixes, MAJOR for redesigns), add the CHANGELOG entry and bump the GDD version on `dev`, commit, merge `dev` into `main` with `--no-ff` in the main checkout, tag `vX.Y.Z` on `main`.
- **Push** (when Petr says "Push"): push `main` to `origin` (GitHub). Nothing else is pushed unless Petr asks.

# Code scanning

- Every commit that changes `.js` under `src/`, `tests/` or `tools/` is scanned by the pre-commit hook
  (`tools/hooks/pre-commit`, ESLint with Sonar's rules, GDD 13a). It stops the commit on new issues in the changed lines.
- When the hook stops a commit: report the issues to Petr in the reply, fix them on the same branch, and commit again.
- Never use `git commit --no-verify` unless Petr says so.
- The hook needs ESLint: in a worktree, link `node_modules` to the main checkout's
  (`ln -s /Users/petr/Documents/AI/MOTOGP/node_modules node_modules`). `/node_modules` is excluded in `.git/info/exclude`.
- `npm run lint` scans the whole project and writes `shots/lint-report.txt`. Existing issues are fixed only when Petr asks.

# Tests (GDD 13b)

- Every function in `src/` has a unit test in `tests/unit/` (titles start with the function name: `test('fmtTime: ...')`).
  New or changed functions get their unit tests in the same feature branch; `tests/unit/inventory.test.js` fails otherwise.
- Before merging a feature branch into `dev`: `npm run test:unit` (about 15 s, no browser) must pass. The browser tests are not required.
- Release: the full suite `npm test` (unit + Playwright, about 5 min) must pass on `dev` before `dev` is merged into `main`.
- The tests need no `node_modules` link in a worktree: Node finds the main checkout's one from `.claude/worktrees/<name>`.
