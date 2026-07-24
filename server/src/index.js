import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import config from './config.js';
import libraryRoutes from './routes/library.js';
import playbackRoutes from './routes/playback.js';
import progressRoutes from './routes/progress.js';
import { runScan } from './pipeline.js';

const app = express();

// sendBeacon posts arrive as text/plain; parse both as JSON
app.use(express.json({ type: ['application/json', 'text/plain'] }));

app.use('/api', libraryRoutes);
app.use('/api', playbackRoutes);
app.use('/api', progressRoutes);

// Production: serve the built frontend with SPA fallback
const dist = path.join(config.root, 'web', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(config.port, '127.0.0.1', () => {
  console.log(`SodalStream server on http://localhost:${config.port}`);
  console.log(`Media root: ${config.mediaRoot}`);
  runScan();
});
