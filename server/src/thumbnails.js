import { execFile } from 'node:child_process';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import config from './config.js';

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic;

export function generateThumbnail(episode) {
  const out = path.join(config.thumbsDir, `${episode.id}.jpg`);
  const seek = episode.duration_s ? Math.max(1, episode.duration_s * 0.2) : 60;
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      [
        '-y',
        '-ss', String(seek),
        '-i', episode.source_path,
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
