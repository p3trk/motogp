# Silverstone GP

2D top-down MotoGP-style racing game at Silverstone. Open `index.html` in a browser to play.

- Design: [docs/GDD.md](docs/GDD.md) (source of truth, updated before every change)
- Changes: [CHANGELOG.md](CHANGELOG.md)
- Build: `python3 tools/build.py` joins `src/` into `index.html`
- Recordings: `saved_tracks/` holds exported sessions used as ghost opponents (see [saved_tracks/README.md](saved_tracks/README.md))

Workflow: feature branch -> update GDD -> change code -> build and test -> merge to `main` with `--no-ff` -> tag `vX.Y.Z`.

Track centreline data: TUMFTM racetrack-database (LGPL-3.0).
