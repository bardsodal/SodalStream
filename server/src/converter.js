import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import db from './db.js';
import config from './config.js';

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic;

// In-memory view of the running conversion, polled via /api/status
export const convertStatus = { active: null, queued: 0 };

// Leftover temp files from a crashed conversion are never valid
for (const f of fs.readdirSync(config.mediaCacheDir)) {
  if (f.endsWith('.tmp.mp4')) fs.rmSync(path.join(config.mediaCacheDir, f), { force: true });
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
  if (ep.compat === 'no_audio') {
    // Video already browser-playable: keep it, only fix the audio
    args.push('-c:v', 'copy');
  } else if (encoder) {
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

const queue = [];
let draining = false;

async function convertOne(id) {
  const ep = db.prepare('SELECT * FROM episodes WHERE id = ? AND missing = 0').get(id);
  if (!ep || ep.convert_status === 'ready') return;

  const tmp = path.join(config.mediaCacheDir, `${id}.tmp.mp4`);
  const out = path.join(config.mediaCacheDir, `${id}.mp4`);
  let encoder = ep.compat === 'no_video' ? await detectHwEncoder() : null;

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
    fs.renameSync(tmp, out);
    setReady.run(out, id);
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
  const rows = db
    .prepare(`
      SELECT id FROM episodes
      WHERE missing = 0 AND compat IN ('no_audio', 'no_video') AND convert_status != 'ready'
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
