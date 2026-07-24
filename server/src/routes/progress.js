import { Router } from 'express';
import {
  getEpisode,
  nextEpisode,
  continueWatching,
  history,
  upsertProgress,
  setWatched,
} from '../queries.js';

const router = Router();

router.get('/continue-watching', (req, res) => {
  res.json({ items: continueWatching.all() });
});

router.get('/history', (req, res) => {
  res.json({ items: history.all() });
});

router.get('/episodes/:id', (req, res) => {
  const ep = getEpisode.get(req.params.id);
  if (!ep) return res.status(404).json({ error: 'episode not found' });
  res.json(ep);
});

router.get('/episodes/:id/next', (req, res) => {
  const ep = getEpisode.get(req.params.id);
  if (!ep) return res.status(404).json({ error: 'episode not found' });
  res.json({
    next: nextEpisode.get({
      seriesId: ep.series_id,
      season: ep.season,
      episode: ep.episode,
      id: ep.id,
    }) ?? null,
  });
});

router.post('/episodes/:id/progress', (req, res) => {
  const ep = getEpisode.get(req.params.id);
  if (!ep) return res.status(404).json({ error: 'episode not found' });
  const { position, duration } = req.body ?? {};
  if (typeof position !== 'number' || typeof duration !== 'number' || duration <= 0) {
    return res.status(400).json({ error: 'position and duration (numbers) required' });
  }
  upsertProgress.run({
    episodeId: ep.id,
    position,
    duration,
    watched: position / duration >= 0.9 ? 1 : 0,
    now: Date.now(),
  });
  res.json({ ok: true });
});

router.post('/episodes/:id/watched', (req, res) => {
  const ep = getEpisode.get(req.params.id);
  if (!ep) return res.status(404).json({ error: 'episode not found' });
  setWatched.run({
    episodeId: ep.id,
    watched: req.body?.watched ? 1 : 0,
    now: Date.now(),
  });
  res.json({ ok: true });
});

export default router;
