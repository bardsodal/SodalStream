const PLAYABLE_VIDEO = new Set(['h264', 'vp8', 'vp9', 'av1']);
const PLAYABLE_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac']);

// Browsers (Chrome/Edge) direct-play these codec combinations inside MKV/MP4/WebM.
export function classify({ videoCodec, audioCodec }) {
  if (!videoCodec) return 'no_video';
  if (!PLAYABLE_VIDEO.has(videoCodec)) return 'no_video';
  if (audioCodec && !PLAYABLE_AUDIO.has(audioCodec)) return 'no_audio';
  return 'ok';
}
