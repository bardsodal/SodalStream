import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import config from './config.js';

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic;

export function generateThumbnail(episode) {
  const out = path.join(config.thumbsDir, `${episode.id}.jpg`);
  const seek = episode.duration_s ? Math.max(1, episode.duration_s * 0.2) : 60;
  // Ingested episodes have no original anymore; thumbnail from the converted file
  const input = fs.existsSync(episode.source_path)
    ? episode.source_path
    : episode.playback_path;
  return new Promise((resolve, reject) => {
    if (!input) return reject(new Error('no file to thumbnail'));
    execFile(
      ffmpegPath,
      [
        '-y',
        '-ss', String(seek),
        '-i', input,
        '-frames:v', '1',
        '-vf', 'scale=480:-2',
        '-q:v', '4',
        out,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
      (err) => (err ? reject(err) : resolve(out))
    );
  });
}

export { ffmpegPath };
