# SodalStream

Self-hosted streaming server for a local video library: scans a folder of series,
probes/transcodes episodes for browser playback, and serves a React UI with watch
progress and continue-watching. Personal use, runs on localhost only.

## Layout

```
server/         Express API + media pipeline (Node, ES modules)
  src/index.js        App entry: routes, static serving of web/dist, scan on boot
  src/config.js       .env loading (MEDIA_ROOT, CACHE_DIR, PORT) — exits if MEDIA_ROOT invalid
  src/pipeline.js     Scan orchestration: scanner -> prober -> converter -> thumbnails
  src/db.js, queries.js   better-sqlite3 database in cache/sodalstream.db
  src/routes/         library.js, playback.js, progress.js
web/            React 18 + Vite SPA (pages: Home, SeriesDetail, Player, History)
cache/          GENERATED (db, thumbs, transcoded media) — gitignored, never edit
.env            Local config, gitignored — .env.example documents the keys
status.md       Project snapshot — READ THIS FIRST each session
todo.md         Open work items
```

## Rules for working here (token discipline)

- Read `status.md` before starting non-trivial work; it's the current-state snapshot.
- **Locate before you read**: use Grep to find the relevant section, then Read with
  offset/limit. Never read files >40KB in full — grep for the symbol/section instead.
- **No screenshot loops.** Verify changes programmatically first (see Verification
  below). A screenshot is a final confirmation, taken once, cropped to the relevant
  region — never one-per-iteration.
- Delegate broad searches ("find everywhere that…") to an Explore subagent so file
  dumps stay out of the main context.
- Prefer new small files over growing an existing large one. If a file is becoming
  a god-class, say so instead of adding to it.
- Keep working files in the scratchpad, not the repo.
- Never commit `.env` or anything under `cache/`.

## Verification (cheapest first)

1. Syntax: `node --check server/src/<file>.js` (for web/, `npm run build` in web/ catches errors)
2. API: curl the endpoint (`curl http://localhost:4321/api/status`) and inspect JSON
3. DB state: query `cache/sodalstream.db` with a one-liner instead of clicking through the UI
4. Browser / screenshot — last resort, once, at the end (Player/video behavior only)

## Build & run

```
cd server; npm run dev      # API on http://localhost:4321, scans MEDIA_ROOT on boot
cd web; npm run dev         # Vite dev server, proxies /api to :4321
cd web; npm run build       # production build; server then serves web/dist itself
```

Requires a valid `MEDIA_ROOT` in `.env` (server exits immediately otherwise).
ffmpeg/ffprobe come from ffmpeg-static/ffprobe-static — no system install needed.

## Conventions

- Plain JavaScript, ES modules, no TypeScript. English throughout.
- Server code is Node-only; browser code lives in web/src. Shared logic is duplicated,
  not imported across the boundary.
- New API routes go in `server/src/routes/` and are mounted under `/api` in index.js;
  add the matching client call to `web/src/api.js`.
- Episode compat states: 'unknown' | playable | needs-conversion | 'no_video' — set by
  `compat.js#classify`, consumed by converter and playback routes.

## When done with a feature

- Update `status.md` (short delta, dated) and check off `todo.md` items you completed.
