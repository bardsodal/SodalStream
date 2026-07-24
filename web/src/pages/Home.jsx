import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SeriesCard from '../components/SeriesCard.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { api, fmtTime, epCode } from '../api.js';

export default function Home() {
  const [library, setLibrary] = useState(null);
  const [continueRow, setContinueRow] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stopped = false;
    let timer;
    async function load() {
      try {
        const [lib, cont] = await Promise.all([api.library(), api.continueWatching()]);
        if (stopped) return;
        setLibrary(lib.series);
        setContinueRow(cont.items);
        setError(null);
        // refresh while the initial scan/probe is still filling things in
        if (lib.series.length === 0) timer = setTimeout(load, 3000);
      } catch (e) {
        if (!stopped) setError(e.message);
      }
    }
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  if (error) return <div className="page notice">Could not reach server: {error}</div>;
  if (!library) return <div className="page notice">Loading…</div>;

  return (
    <div className="page">
      {continueRow.length > 0 && (
        <section>
          <h2>Continue Watching</h2>
          <div className="row">
            {continueRow.map((item) => (
              <Link key={item.id} to={`/play/${item.id}`} className="continue-card">
                <div className="continue-thumb">
                  {item.has_thumb ? (
                    <img src={`/api/episodes/${item.id}/thumbnail`} alt="" loading="lazy" />
                  ) : (
                    <div className="thumb-placeholder">▶</div>
                  )}
                  <ProgressBar position={item.position_s} duration={item.duration_s} />
                </div>
                <div className="continue-info">
                  <div className="continue-series">{item.series_title}</div>
                  <div className="continue-sub">
                    {epCode(item)}
                    {item.duration_s
                      ? ` · ${fmtTime(Math.max(0, item.duration_s - item.position_s))} left`
                      : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Your Series</h2>
        {library.length === 0 ? (
          <div className="notice">
            No videos found yet — scanning your library… This page refreshes automatically.
          </div>
        ) : (
          <div className="series-grid">
            {library.map((s) => (
              <SeriesCard key={s.id} series={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
