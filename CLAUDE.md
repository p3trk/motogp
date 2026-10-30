
# Code scanning

- Every commit that changes `.js` under `src/`, `tests/` or `tools/` is scanned by the pre-commit hook
  (`tools/hooks/pre-commit`, ESLint with Sonar's rules, GDD 13a). It stops the commit on new issues in the changed lines.
- When the hook stops a commit: report the issues to Petr in the reply, fix them on the same branch, and commit again.
- Never use `git commit --no-verify` unless Petr says so.
- The hook needs ESLint: in a worktree, link `node_modules` to the main checkout's
  (`ln -s /Users/petr/Documents/AI/MOTOGP/node_modules node_modules`). `/node_modules` is excluded in `.git/info/exclude`.
- `npm run lint` scans the whole project and writes `shots/lint-report.txt`. Existing issues are fixed only when Petr asks.
