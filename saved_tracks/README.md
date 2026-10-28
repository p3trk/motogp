# saved_tracks

Session recordings (`silverstone_*.json`) live here. Load them as ghost opponents from the menu panel **Recordings & ghosts**.

- **Chrome / Edge:** click **Open saved_tracks folder…** once and pick this folder. The game remembers it, re-reads it with **Reload saved_tracks**, and saves every new session here automatically.
- **Safari / Firefox:** **Open saved_tracks folder…** reads the folder (read only). Exported sessions go to Downloads; move them here by hand.
- **Served over http(s)** (for example `python3 -m http.server`): run `python3 tools/index_saved_tracks.py` to write `index.json`, and the files listed in it load automatically.
