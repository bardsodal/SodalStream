import db from './db.js';

export const listSeries = db.prepare(`
  SELECT s.id, s.title, s.poster_path,
         COUNT(e.id) AS episode_count,
         SUM(CASE WHEN p.watched = 1 THEN 1 ELSE 0 END) AS watched_count
  FROM series s
  JOIN episodes e ON e.series_id = s.id AND e.missing = 0
  LEFT JOIN progress p ON p.episode_id = e.id
  GROUP BY s.id
  ORDER BY s.title
`);

export const getSeries = db.prepare('SELECT id, title, poster_path FROM series WHERE id = ?');

export const seriesEpisodes = db.prepare(`
  SELECT e.id, e.season, e.episode, e.title, e.duration_s, e.compat,
         e.convert_status, e.convert_error,
         e.thumb_path IS NOT NULL AS has_thumb,
         p.position_s, p.watched
  FROM episodes e
  LEFT JOIN progress p ON p.episode_id = e.id
  WHERE e.series_id = ? AND e.missing = 0
  ORDER BY e.season, e.episode, e.id
`);

export const nextUpForSeries = db.prepare(`
  SELECT e.id, e.season, e.episode, e.title, e.duration_s, p.position_s
  FROM episodes e
  LEFT JOIN progress p ON p.episode_id = e.id
  WHERE e.series_id = ? AND e.missing = 0 AND (p.watched IS NULL OR p.watched = 0)
  ORDER BY e.season, e.episode, e.id
  LIMIT 1
`);

export const getEpisode = db.prepare(`
  SELECT e.*, s.title AS series_title,
         p.position_s, p.watched
  FROM episodes e
  JOIN series s ON s.id = e.series_id
  LEFT JOIN progress p ON p.episode_id = e.id
  WHERE e.id = ?
`);

export const nextEpisode = db.prepare(`
  SELECT e.id, e.season, e.episode, e.title
  FROM episodes e
  WHERE e.series_id = @seriesId AND e.missing = 0
    AND (e.season > @season OR (e.season = @season AND e.episode > @episode)
         OR (e.season = @season AND e.episode = @episode AND e.id > @id))
  ORDER BY e.season, e.episode, e.id
  LIMIT 1
`);

export const continueWatching = db.prepare(`
  SELECT * FROM (
    SELECT e.id, e.season, e.episode, e.title, e.series_id, e.duration_s,
           e.thumb_path IS NOT NULL AS has_thumb,
           s.title AS series_title,
           p.position_s, p.updated_at,
           ROW_NUMBER() OVER (PARTITION BY e.series_id ORDER BY p.updated_at DESC) AS rn
    FROM progress p
    JOIN episodes e ON e.id = p.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE p.watched = 0 AND p.position_s > 30 AND e.missing = 0
  )
  WHERE rn = 1
  ORDER BY updated_at DESC
  LIMIT 20
`);

export const history = db.prepare(`
  SELECT e.id, e.season, e.episode, e.title, e.series_id, e.duration_s,
         s.title AS series_title,
         p.position_s, p.watched, p.updated_at
  FROM progress p
  JOIN episodes e ON e.id = p.episode_id
  JOIN series s ON s.id = e.series_id
  WHERE e.missing = 0
  ORDER BY p.updated_at DESC
  LIMIT 200
`);

export const upsertProgress = db.prepare(`
  INSERT INTO progress (episode_id, position_s, duration_s, watched, updated_at)
  VALUES (@episodeId, @position, @duration, @watched, @now)
  ON CONFLICT(episode_id) DO UPDATE SET
    position_s = @position,
    duration_s = @duration,
    watched = MAX(watched, @watched),
    updated_at = @now
`);

export const setWatched = db.prepare(`
  INSERT INTO progress (episode_id, position_s, duration_s, watched, updated_at)
  VALUES (@episodeId, 0, 0, @watched, @now)
  ON CONFLICT(episode_id) DO UPDATE SET watched = @watched, updated_at = @now
`);
