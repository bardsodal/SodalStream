async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export const api = {
  library: () => get('/api/library'),
  continueWatching: () => get('/api/continue-watching'),
  history: () => get('/api/history'),
  series: (id) => get(`/api/series/${id}`),
  episode: (id) => get(`/api/episodes/${id}`),
  next: (id) => get(`/api/episodes/${id}/next`),
  status: () => get('/api/status'),
  scan: () => post('/api/scan'),
  setWatched: (id, watched) => post(`/api/episodes/${id}/watched`, { watched }),
  progress: (id, position, duration) =>
    post(`/api/episodes/${id}/progress`, { position, duration }),
  progressBeacon: (id, position, duration) =>
    navigator.sendBeacon(
      `/api/episodes/${id}/progress`,
      JSON.stringify({ position, duration })
    ),
};

export function fmtTime(s) {
  if (s == null || Number.isNaN(s)) return '';
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export function epCode(ep) {
  return `S${ep.season}:E${ep.episode}`;
}
