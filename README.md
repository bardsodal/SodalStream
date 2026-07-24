# SodalStream

A personal, local Netflix-style streaming app. It scans a folder of video files
(series → seasons → episodes), streams them in your browser at
`http://localhost:4321`, and remembers what you've watched: Continue Watching,
auto-resume, next-episode autoplay, and a watch history.

Everything runs locally on this machine only (the server binds to 127.0.0.1).
Your video files are never modified.

## Requirements

- Node.js 20+ (installed via `winget install OpenJS.NodeJS.LTS`)
- ffmpeg/ffprobe are bundled automatically via npm packages — no install needed.

## Setup

```powershell
npm install
```

Edit `.env` and point `MEDIA_ROOT` at your video library:

```
MEDIA_ROOT=C:\Users\evahe\Videos
```

Optional settings (see `.env.example`): `CACHE_DIR` (thumbnails + database,
default `<repo>\cache`), `PORT` (default 4321).

## Run

Production (single port, recommended):

```powershell
npm run build
npm start
```

Then open http://localhost:4321

Development (hot reload, UI at http://localhost:5173):

```powershell
npm run dev
```

## How it works

- On startup (and via the **Scan library** button) the server walks
  `MEDIA_ROOT`, parses series/season/episode from folder and file names
  (`S05E03` patterns, `Season N` folders, alphabetical fallback), and probes
  each file with ffprobe to record codecs and duration.
- Compatible episodes are **direct-played** — the original file is streamed to
  the browser with HTTP range support so seeking works. Files whose codecs a
  browser can't decode (e.g. MPEG-2, HEVC video; AC3/DTS audio) are
  **converted automatically in the background** to H.264/AAC MP4 in
  `cache/media/` (originals untouched); the episode list shows live progress
  and playback switches to the converted copy the moment it's ready. An
  NVIDIA hardware encoder is used automatically when available.
- Watch progress is saved every 5 seconds while playing (SQLite in `cache/`).
  An episode counts as watched at 90%. Progress survives rescans.
- Thumbnails are generated in the background with ffmpeg (frame at 20% mark).
  Drop a `poster.jpg` or `folder.jpg` in a series folder to use it as the
  series poster.

## Player shortcuts

| Key | Action |
|---|---|
| Space | Play / pause |
| ← / → | Seek 10s |
| F | Fullscreen |
| N | Next episode |
| Esc | Cancel next-episode countdown |

## Notes on conversion

- Converted copies live in `cache/media/<episode-id>.mp4` — delete the cache
  folder any time to reclaim space; conversions re-run on the next scan.
- Video that is already browser-playable but has bad audio (e.g. AC3) keeps
  its video stream untouched — only the audio is re-encoded (fast).
- A failed conversion shows a red badge with the error on hover; hitting
  **Scan library** retries it.
