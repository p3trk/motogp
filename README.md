# Silverstone GP

2D top-down MotoGP-style racing game at Silverstone. Open `motogp.html` in a browser to play.

- Design: [docs/GDD.md](docs/GDD.md) (source of truth, updated before every change)
- Changes: [CHANGELOG.md](CHANGELOG.md)
- Build: `python3 tools/build.py` joins `src/` into `motogp.html`

Workflow: feature branch -> update GDD -> change code -> build and test -> merge to `main` with `--no-ff` -> tag `vX.Y.Z`.

Track centreline data: TUMFTM racetrack-database (LGPL-3.0).
