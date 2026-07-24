import Database from 'better-sqlite3';
import config from './config.js';

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const MIGRATIONS = [
  `
  CREATE TABLE series (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL UNIQUE,
    dir_path    TEXT NOT NULL,
    poster_path TEXT,
    added_at    INTEGER NOT NULL
  );

  CREATE TABLE episodes (
    id           INTEGER PRIMARY KEY,
    series_id    INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    season       INTEGER NOT NULL,
    episode      INTEGER NOT NULL,
    title        TEXT NOT NULL,
    source_path  TEXT NOT NULL UNIQUE,
    source_size  INTEGER,
    source_mtime INTEGER,
    duration_s   REAL,
    video_codec  TEXT,
    audio_codec  TEXT,
    compat       TEXT NOT NULL DEFAULT 'unknown',
    thumb_path   TEXT,
    missing      INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_ep_order ON episodes(series_id, season, episode);

  CREATE TABLE progress (
    episode_id INTEGER PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
    position_s REAL NOT NULL,
    duration_s REAL NOT NULL,
    watched    INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_progress_recent ON progress(updated_at DESC);
  `,
  `
  ALTER TABLE episodes ADD COLUMN playback_path TEXT;
  ALTER TABLE episodes ADD COLUMN convert_status TEXT NOT NULL DEFAULT 'none';
  ALTER TABLE episodes ADD COLUMN convert_error TEXT;
  `,
  // Ingest model: original was deleted from MEDIA_ROOT after a verified
  // conversion; the episode lives on through playback_path only.
  `
  ALTER TABLE episodes ADD COLUMN source_deleted INTEGER NOT NULL DEFAULT 0;
  `,
];

const applied = db.pragma('user_version', { simple: true });
for (let v = applied; v < MIGRATIONS.length; v++) {
  db.transaction(() => {
    db.exec(MIGRATIONS[v]);
    db.pragma(`user_version = ${v + 1}`);
  })();
}

export default db;
