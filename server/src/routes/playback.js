import { Router } from 'express';
import fs from 'node:fs';
import db from '../db.js';
import { getEpisode } from '../queries.js';

const router = Router();

const posterPath = db.prepare('SELECT poster_path FROM series WHERE id = ?');
const thumbPath = db.prepare('SELECT thumb_path FROM episodes WHERE id = ?');

router.get('/episodes/:id/stream', (req, res) => {
  const ep = getEpisode.get(req.params.id);
  if (!ep) return res.status(404).json({ error: 'episode not found' });
  if (ep.convert_status === 'ready' && ep.playback_path && fs.existsSync(ep.playback_path)) {
    return res.sendFile(ep.playback_path, { acceptRanges: true });
  }
  if (!fs.existsSync(ep.source_path)) {
    return res.status(404).json({ error: 'episode not found' });
  }
  res.sendFile(ep.source_path, { acceptRanges: true });
});

router.get('/episodes/:id/thumbnail', (req, res) => {
  const row = thumbPath.get(req.params.id);
  if (!row?.thumb_path || !fs.existsSync(row.thumb_path)) return res.sendStatus(404);
  res.sendFile(row.thumb_path, { maxAge: '1d' });
});

router.get('/series/:id/poster', (req, res) => {
  const row = posterPath.get(req.params.id);
  if (!row?.poster_path || !fs.existsSync(row.poster_path)) return res.sendStatus(404);
  res.sendFile(row.poster_path, { maxAge: '1d' });
});

export default router;
