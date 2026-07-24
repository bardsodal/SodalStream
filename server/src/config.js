import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(ROOT, '.env') });

const mediaRoot = process.env.MEDIA_ROOT;
if (!mediaRoot || !fs.existsSync(mediaRoot) || !fs.statSync(mediaRoot).isDirectory()) {
  console.error(
    `MEDIA_ROOT is not a valid directory: ${mediaRoot ?? '(unset)'}\n` +
    `Edit ${path.join(ROOT, '.env')} and set MEDIA_ROOT to your video library folder.`
  );
  process.exit(1);
}

const cacheDir = process.env.CACHE_DIR || path.join(ROOT, 'cache');
fs.mkdirSync(path.join(cacheDir, 'thumbs'), { recursive: true });
fs.mkdirSync(path.join(cacheDir, 'media'), { recursive: true });

// Permanent home of converted episodes. NOT disposable: once an original is
// ingested and deleted from MEDIA_ROOT, the file here is the only copy.
const libraryDir = process.env.LIBRARY_DIR || path.join(ROOT, 'library');
fs.mkdirSync(libraryDir, { recursive: true });

export default {
  root: ROOT,
  mediaRoot: path.resolve(mediaRoot),
  cacheDir,
  libraryDir: path.resolve(libraryDir),
  thumbsDir: path.join(cacheDir, 'thumbs'),
  mediaCacheDir: path.join(cacheDir, 'media'),
  dbPath: path.join(cacheDir, 'sodalstream.db'),
  port: Number(process.env.PORT || 4321),
};
