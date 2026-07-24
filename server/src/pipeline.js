import db from './db.js';
import config from './config.js';
import { scanLibrary } from './scanner.js';
import { probe } from './prober.js';
import { classify } from './compat.js';
import { generateThumbnail } from './thumbnails.js';
import { enqueueConversions } from './converter.js';

export const status = {
  scanning: false,
  lastScan: null,
  files: 0,
  probe: { done: 0, total: 0 },
  thumbs: { done: 0, total: 0 },
  errors: [],
};

const updateProbe = db.prepare(`
  UPDATE episodes SET duration_s = ?, video_codec = ?, audio_codec = ?, compat = ? WHERE id = ?
`);
const setThumb = db.prepare('UPDATE episodes SET thumb_path = ? WHERE id = ?');

async function probePass() {
  const pending = db
    .prepare("SELECT id, source_path FROM episodes WHERE compat = 'unknown' AND missing = 0")
    .all();
  status.probe = { done: 0, total: pending.length };
  for (const ep of pending) {
    try {
      const info = await probe(ep.source_path);
      updateProbe.run(info.durationS, info.videoCodec, info.audioCodec, classify(info), ep.id);
    } catch (err) {
      status.errors.push(`probe ${ep.source_path}: ${err.message}`);
      updateProbe.run(null, null, null, 'no_video', ep.id);
    }
    status.probe.done++;
  }
}

async function thumbnailPass() {
  const pending = db
    .prepare('SELECT id, source_path, duration_s FROM episodes WHERE thumb_path IS NULL AND missing = 0')
    .all();
  status.thumbs = { done: 0, total: pending.length };
  for (const ep of pending) {
    try {
      const out = await generateThumbnail(ep);
      setThumb.run(out, ep.id);
    } catch (err) {
      status.errors.push(`thumbnail ${ep.source_path}: ${err.message}`);
    }
    status.thumbs.done++;
  }
}

let running = null;

export function runScan() {
  if (running) return running;
  status.scanning = true;
  status.errors = [];
  running = (async () => {
    try {
      const { files } = scanLibrary(config.mediaRoot);
      status.files = files;
      await probePass();
      enqueueConversions();
      await thumbnailPass();
      status.lastScan = Date.now();
    } finally {
      status.scanning = false;
      running = null;
    }
  })();
  return running;
}
