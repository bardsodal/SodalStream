# SodalStream — Status

Updated: 2026-07-24

## What this is

Self-hosted streaming server for a local video library. The server scans MEDIA_ROOT
for series folders, probes each episode with ffprobe, transcodes what browsers can't
play, generates thumbnails, and tracks watch progress in SQLite. A React SPA provides
Home / SeriesDetail / Player / History with continue-watching.

## Current state

- 2026-07-24: **Ingest model.** MEDIA_ROOT is now `Videos\SodalStreamInput` (an inbox,
  not a library). On manual scan, EVERY probed file is transcoded (h264/aac mp4,
  nvenc cq23 or x264 crf20) into `LIBRARY_DIR` (`Videos\SodalStreamLibrary`,
  `<Series>\<title>.mp4`), the output is verified (ffprobe duration vs source), and
  only then is the original deleted (`episodes.source_deleted = 1`; scanner never
  marks those missing). LIBRARY_DIR is the ONLY copy of ingested media — cache/ stays
  disposable. No scan on boot anymore: scans run only via the UI button (POST /api/scan).
  Migrated the 22 Office episodes (paths re-pointed after the user had moved them into
  the input folder; converted files moved out of cache/media; originals deleted, 21.1 GB
  freed; watch progress kept). The 25 old episodes from elsewhere in Videos were marked
  missing and their series pruned.

- Server pipeline (scan → probe → convert → thumbnails): implemented, runs on boot; incremental (only processes compat='unknown' / missing thumbs)
- API routes (library, playback, progress, scan, status): implemented
- Web UI (Home, SeriesDetail, Player, History + ScanStatus/ProgressBar/cards): implemented
- Watch progress: saved via POST + sendBeacon on page leave; server parses text/plain as JSON for beacons
- End-to-end run against a real library: not yet verified in a Claude session — see todo
- 2026-07-24: "Open folder" nav button + /api/open-media-folder endpoint added, then removed same day at user request (reported not working in their session)

## Architecture snapshot

Everything hangs off `server/src/config.js` (.env → mediaRoot/libraryDir/cacheDir/port;
exits if MEDIA_ROOT invalid). `pipeline.js#runScan` is the single orchestrator (manual
trigger only): scanner walks mediaRoot into the episodes table, prober fills codec info,
converter transcodes every episode into `LIBRARY_DIR` and deletes the verified original,
thumbnails land in `cache/thumbs/` (falls back to playback_path once the original is gone). Routes read the same better-sqlite3 db (synchronous
queries). In dev the Vite server proxies `/api` to :4321; in production Express serves
`web/dist` with SPA fallback. Server binds 127.0.0.1 only — no auth, by design.

## Decisions log

- 2026-07-24: Ingest model (see Current state): input folder is disposable, converted
  library is permanent; convert-everything replaces convert-only-incompatible; manual
  scans only. Originals deleted only after ffprobe verification of the output.
- 2026-07-24: Project brought under AgenticOS templates (CLAUDE.md/status.md/todo.md/settings.local.json) — standard session hygiene.
- (earlier, from code): Bind 127.0.0.1 only, no auth — personal localhost tool.
- (earlier, from code): ffmpeg-static/ffprobe-static instead of system ffmpeg — zero-install portability.
- (earlier, from code): Transcode incompatible files into cache/ rather than on-the-fly streaming — simpler playback path, cache is disposable.

## Known issues / sharp edges

- Server exits at startup if MEDIA_ROOT in `.env` is unset/invalid — first thing to check when "it won't start".
- `Videos\SodalStreamLibrary` holds the ONLY copy of ingested episodes — do not treat
  it like cache. `cache/` (db + thumbs) remains safe to delete, but deleting the db
  orphans the library files (episode rows are the only mapping to titles/progress);
  back up `cache/sodalstream.db` if the library matters.
- Probe failures mark an episode 'no_video' permanently (compat no longer 'unknown'), so a transient probe error won't be retried by later scans.
- No tests yet; verification is curl + db queries (see CLAUDE.md ladder).
