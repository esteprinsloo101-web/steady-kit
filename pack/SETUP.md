# Setup — Steady Kit web tools (local / offline-ish)

## Option A — Open files directly

1. Download or clone the Steady Kit folder.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
3. Mood, journal, and task ticks use `localStorage` (works offline after first load of the files).

Voice encouragement needs a browser that supports the Web Speech API (most desktop browsers). Music links need internet.

## Option B — Tiny local server (recommended)

From the `steady-kit` folder:

```bash
python3 -m http.server 8765
```

Then visit `http://localhost:8765`.

## Data

- Mood history, journal, and “done today” tasks stay **only in your browser**.
- Clearing site data / using private mode may erase them.
- No account. No child data collection.

## Crisis

Persistent banner + `crisis.html`: SADAG 0800 567 567 · findahelpline.com · local emergency services.
