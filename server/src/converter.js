import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import db from './db.js';
import config from './config.js';
import { probe } from './prober.js';

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic;

// In-memory view of the running conversion, polled via /api/status
export const convertStatus = { active: null, queued: 0 };

// Leftover temp files from a crashed conversion are never valid
for (const dir of [config.mediaCacheDir, config.libraryDir]) {
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.tmp.mp4')) fs.rmSync(path.join(dir, f), { force: true });
  }
}

let hwEncoder; // undefined = not probed yet, null = software only
async function detectHwEncoder() {
  if (hwEncoder !== undefined) return hwEncoder;
  hwEncoder = await new Promise((resolve) => {
    execFile(
      ffmpegPath,
      ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=256x256:d=0.2',
       '-c:v', 'h264_nvenc', '-f', 'null', '-'],
      (err) => resolve(err ? null : 'h264_nvenc')
    );
  });
  return hwEncoder;
}

function buildArgs(ep, encoder, out) {
  const args = ['-y', '-i', ep.source_path, '-map', '0:v:0', '-map', '0:a:0?'];
  if (encoder) {
    args.push(
      '-vf', 'yadif=deint=interlaced',
      '-c:v', encoder, '-preset', 'p5', '-cq', '23',
      '-pix_fmt', 'yuv420p'
    );
  } else {
    args.push(
      '-vf', 'yadif=deint=interlaced',
      '-c:v', 'libx264', '-crf', '20', '-preset', 'fast',
      '-pix_fmt', 'yuv420p'
    );
  }
  args.push(
    '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
    '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats',
    out
  );
  return args;
}

function runFfmpeg(ep, encoder, out) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, buildArgs(ep, encoder, out));
    let stderrTail = '';
    proc.stderr.on('data', (d) => {
      stderrTail = (stderrTail + d).slice(-2000);
    });
    proc.stdout.on('data', (d) => {
      const m = String(d).match(/out_time_us=(\d+)/);
      if (m && ep.duration_s && convertStatus.active?.episodeId === ep.id) {
        convertStatus.active.progress = Math.min(1, Number(m[1]) / 1e6 / ep.duration_s);
      }
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderrTail.trim().split('\n').slice(-4).join('\n') || `ffmpeg exit ${code}`));
    });
  });
}

const setStatus = db.prepare(
  'UPDATE episodes SET convert_status = ?, convert_error = ? WHERE id = ?'
);
const setReady = db.prepare(
  "UPDATE episodes SET convert_status = 'ready', playback_path = ?, convert_error = NULL WHERE id = ?"
);
const setSourceDeleted = db.prepare('UPDATE episodes SET source_deleted = 1 WHERE id = ?');

// Strip characters Windows forbids in file names; never end in dot/space
function sanitizeName(s) {
  return (
    s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '') ||
    'Untitled'
  );
}

// Permanent home of a converted episode: <library>/<Series>/<Episode title>.mp4
function libraryTarget(ep) {
  const dir = path.join(config.libraryDir, sanitizeName(ep.series_title));
  fs.mkdirSync(dir, { recursive: true });
  const base = sanitizeName(ep.title);
  const plain = path.join(dir, `${base}.mp4`);
  return fs.existsSync(plain) ? path.join(dir, `${base} (${ep.id}).mp4`) : plain;
}

// The converted file becomes the only copy, so sanity-check it before the
// original is deleted: it must probe cleanly and match the source duration.
async function verifyOutput(tmp, ep) {
  const info = await probe(tmp);
  if (!info.durationS || info.durationS <= 0) throw new Error('converted file has no duration');
  if (ep.duration_s) {
    const tolerance = Math.max(5, ep.duration_s * 0.02);
    if (Math.abs(info.durationS - ep.duration_s) > tolerance) {
      throw new Error(
        `converted duration ${info.durationS.toFixed(1)}s differs from source ${ep.duration_s.toFixed(1)}s`
      );
    }
  }
}

// Remove now-empty folders the ingested file leaves behind, up to mediaRoot
function pruneEmptyDirs(filePath) {
  const stop = path.resolve(config.mediaRoot);
  let dir = path.resolve(path.dirname(filePath));
  try {
    while (dir !== stop && dir.startsWith(stop + path.sep) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
      dir = path.dirname(dir);
    }
  } catch {
    // best effort — a straggler folder is harmless
  }
}

function deleteOriginal(ep) {
  try {
    fs.rmSync(ep.source_path, { force: true });
    setSourceDeleted.run(ep.id);
    pruneEmptyDirs(ep.source_path);
  } catch (err) {
    // Conversion is still valid; the leftover original just stays in the
    // ingest folder until deleted manually.
    console.error(`could not delete original ${ep.source_path}: ${err.message}`);
  }
}

const queue = [];
let draining = false;

async function convertOne(id) {
  const ep = db
    .prepare(
      `SELECT e.*, s.title AS series_title
       FROM episodes e JOIN series s ON s.id = e.series_id
       WHERE e.id = ? AND e.missing = 0 AND e.source_deleted = 0`
    )
    .get(id);
  if (!ep || ep.convert_status === 'ready') return;

  const tmp = path.join(config.libraryDir, `${id}.tmp.mp4`);
  let encoder = await detectHwEncoder();

  convertStatus.active = { episodeId: ep.id, title: ep.title, progress: 0 };
  setStatus.run('converting', null, id);
  try {
    try {
      await runFfmpeg(ep, encoder, tmp);
    } catch (err) {
      if (!encoder) throw err;
      // Hardware encode can fail on odd sources; fall back to software once
      encoder = null;
      convertStatus.active.progress = 0;
      await runFfmpeg(ep, null, tmp);
    }
    await verifyOutput(tmp, ep);
    const out = libraryTarget(ep);
    fs.renameSync(tmp, out);
    setReady.run(out, id);
    deleteOriginal(ep);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    setStatus.run('failed', String(err.message).slice(0, 500), id);
  }
}

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const id = queue.shift();
    convertStatus.queued = queue.length;
    await convertOne(id);
  }
  convertStatus.active = null;
  draining = false;
}

export function enqueueConversions() {
  // Every probed file gets converted (smaller + guaranteed browser-playable),
  // regardless of source codec; originals are deleted after verification.
  const rows = db
    .prepare(`
      SELECT id FROM episodes
      WHERE missing = 0 AND source_deleted = 0 AND compat != 'unknown'
        AND convert_status != 'ready'
      ORDER BY series_id, season, episode
    `)
    .all();
  for (const { id } of rows) {
    if (!queue.includes(id) && convertStatus.active?.episodeId !== id) {
      setStatus.run('queued', null, id);
      queue.push(id);
    }
  }
  convertStatus.queued = queue.length;
  drain();
}
