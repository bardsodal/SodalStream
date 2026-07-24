# SodalStream — Status

Updated: 2026-07-24

## What this is

Self-hosted streaming server for a local video library. The server scans MEDIA_ROOT
for series folders, probes each episode with ffprobe, transcodes what browsers can't
play, generates thumbnails, and tracks watch progress in SQLite. A React SPA provides
Home / SeriesDetail / Player / History with continue-watching.

## Current state

- Server pipeline (scan → probe → convert → thumbnails): implemented, runs on boot; incremental (only processes compat='unknown' / missing thumbs)
- API routes (library, playback, progress, scan, status): implemented
- Web UI (Home, SeriesDetail, Player, History + ScanStatus/ProgressBar/cards): implemented
- Watch progress: saved via POST + sendBeacon on page leave; server parses text/plain as JSON for beacons
- End-to-end run against a real library: not yet verified in a Claude session — see todo

## Architecture snapshot

Everything hangs off `server/src/config.js` (.env → mediaRoot/cacheDir/port; exits if
MEDIA_ROOT invalid). `pipeline.js#runScan` is the single orchestrator: scanner walks
mediaRoot into the episodes table, prober fills codec info, `compat.js#classify` decides
if a file is browser-playable, converter enqueues ffmpeg transcodes into `cache/media/`,
thumbnails land in `cache/thumbs/`. Routes read the same better-sqlite3 db (synchronous
queries). In dev the Vite server proxies `/api` to :4321; in production Express serves
`web/dist` with SPA fallback. Server binds 127.0.0.1 only — no auth, by design.

## Decisions log

- 2026-07-24: Project brought under AgenticOS templates (CLAUDE.md/status.md/todo.md/settings.local.json) — standard session hygiene.
- (earlier, from code): Bind 127.0.0.1 only, no auth — personal localhost tool.
- (earlier, from code): ffmpeg-static/ffprobe-static instead of system ffmpeg — zero-install portability.
- (earlier, from code): Transcode incompatible files into cache/ rather than on-the-fly streaming — simpler playback path, cache is disposable.

## Known issues / sharp edges

- Server exits at startup if MEDIA_ROOT in `.env` is unset/invalid — first thing to check when "it won't start".
- `cache/` can get large (full transcodes of incompatible episodes); safe to delete, rebuilt on next scan.
- Probe failures mark an episode 'no_video' permanently (compat no longer 'unknown'), so a transient probe error won't be retried by later scans.
- No tests yet; verification is curl + db queries (see CLAUDE.md ladder).
