import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtTime, epCode } from '../api.js';

function fmtWhen(ts) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function History() {
  const [items, setItems] = useState(null);

  const load = () => api.history().then((r) => setItems(r.items));
  useEffect(() => {
    load();
  }, []);

  if (!items) return <div className="page notice">Loading…</div>;

  return (
    <div className="page">
      <h2>Watch History</h2>
      {items.length === 0 && <div className="notice">Nothing watched yet.</div>}
      <div className="history-list">
        {items.map((item) => (
          <div key={item.id} className="history-item">
            <div className="history-when">{fmtWhen(item.updated_at)}</div>
            <div className="history-main">
              <Link to={`/play/${item.id}`} className="history-title">
                {item.series_title} — {epCode(item)} {item.title}
              </Link>
              <div className="history-sub">
                {item.watched
                  ? 'Watched'
                  : `Stopped at ${fmtTime(item.position_s)}${
                      item.duration_s ? ` / ${fmtTime(item.duration_s)}` : ''
                    }`}
              </div>
            </div>
            <button
              className="watched-toggle"
              title={item.watched ? 'Mark as unwatched' : 'Mark as watched'}
              onClick={async () => {
                await api.setWatched(item.id, !item.watched);
                load();
              }}
            >
              {item.watched ? '✓' : '○'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
