import { Router } from 'express';
import config from '../config.js';
import { runScan, status } from '../pipeline.js';
import { convertStatus } from '../converter.js';
import db from '../db.js';
import { listSeries, getSeries, seriesEpisodes, nextUpForSeries } from '../queries.js';
import { ffprobePath } from '../prober.js';
import { ffmpegPath } from '../thumbnails.js';

const router = Router();

router.get('/library', (req, res) => {
  const series = listSeries.all().map((s) => ({
    ...s,
    next_up: nextUpForSeries.get(s.id) ?? null,
  }));
  res.json({ series });
});

router.get('/series/:id', (req, res) => {
  const series = getSeries.get(req.params.id);
  if (!series) return res.status(404).json({ error: 'series not found' });
  const episodes = seriesEpisodes.all(series.id);
  res.json({ ...series, episodes, next_up: nextUpForSeries.get(series.id) ?? null });
});

router.post('/scan', (req, res) => {
  runScan();
  res.json({ started: true });
});

const convertCounts = db.prepare(`
  SELECT convert_status, COUNT(*) AS n FROM episodes
  WHERE missing = 0 AND compat IN ('no_audio', 'no_video')
  GROUP BY convert_status
`);

router.get('/status', (req, res) => {
  const counts = Object.fromEntries(convertCounts.all().map((r) => [r.convert_status, r.n]));
  res.json({
    ok: true,
    mediaRoot: config.mediaRoot,
    ffmpegPath,
    ffprobePath,
    ...status,
    convert: { ...convertStatus, counts },
  });
});

export default router;
