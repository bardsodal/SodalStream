import { execFile } from 'node:child_process';
import ffprobeStatic from 'ffprobe-static';

const ffprobePath = process.env.FFPROBE_PATH || ffprobeStatic.path;

export function probe(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      ffprobePath,
      [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        try {
          const data = JSON.parse(stdout);
          const video = (data.streams || []).find(
            (s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1
          );
          const audio =
            (data.streams || []).find((s) => s.codec_type === 'audio' && s.disposition?.default === 1) ||
            (data.streams || []).find((s) => s.codec_type === 'audio');
          resolve({
            durationS: data.format?.duration ? Number(data.format.duration) : null,
            videoCodec: video?.codec_name ?? null,
            audioCodec: audio?.codec_name ?? null,
          });
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    );
  });
}

export { ffprobePath };
