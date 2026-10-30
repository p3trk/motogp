# Silverstone GP

2D top-down MotoGP-style racing game at Silverstone. Open `index.html` in a browser to play.

- Design: [docs/GDD.md](docs/GDD.md) (source of truth, updated before every change)
- Changes: [CHANGELOG.md](CHANGELOG.md)
- Build: `python3 tools/build.py` joins `src/` into `index.html`
- Recordings: `saved_tracks/` holds exported sessions used as ghost opponents (see [saved_tracks/README.md](saved_tracks/README.md))
- Tests: `npm run test:unit` (unit tests for every function, about 15 s, no browser), `npm run test:browser` (Playwright, about 5 min), `npm test` (both). See GDD 13b.

Workflow: feature branch from `dev` -> update GDD -> change code and unit tests -> build -> `npm run test:unit` -> merge to `dev` with `--no-ff`. Release: `npm test` (full suite) on `dev` -> merge `dev` to `main` -> tag `vX.Y.Z`. See GDD 14.

Track centreline data: TUMFTM racetrack-database (LGPL-3.0).
