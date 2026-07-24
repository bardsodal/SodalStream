import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import EpisodeCard from '../components/EpisodeCard.jsx';
import { api, epCode } from '../api.js';

export default function SeriesDetail() {
  const { id } = useParams();
  const [series, setSeries] = useState(null);
  const [season, setSeason] = useState(null);
  const [activeConvert, setActiveConvert] = useState(null);
  const lastActiveId = useRef(null);

  const load = () => api.series(id).then(setSeries).catch(() => setSeries(undefined));

  useEffect(() => {
    setSeries(null);
    setSeason(null);
    api.series(id).then(setSeries).catch(() => setSeries(undefined));
  }, [id]);

  const hasPendingConversions = useMemo(
    () =>
      !!series?.episodes?.some(
        (e) =>
          ['no_audio', 'no_video'].includes(e.compat) &&
          ['none', 'queued', 'converting'].includes(e.convert_status)
      ),
    [series]
  );

  // While conversions are pending, poll for live progress and refresh when one finishes
  useEffect(() => {
    if (!hasPendingConversions) {
      setActiveConvert(null);
      return;
    }
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const s = await api.status();
        if (stopped) return;
        setActiveConvert(s.convert?.active ?? null);
        const activeId = s.convert?.active?.episodeId ?? null;
        if (lastActiveId.current !== null && lastActiveId.current !== activeId) {
          load(); // an episode finished (or failed) — refresh statuses
        }
        lastActiveId.current = activeId;
      } catch {
        /* server briefly unreachable; keep polling */
      }
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [hasPendingConversions, id]);

  const seasons = useMemo(() => {
    if (!series) return [];
    return [...new Set(series.episodes.map((e) => e.season))].sort((a, b) => a - b);
  }, [series]);

  const activeSeason = season ?? seasons[0];

  if (series === undefined) return <div className="page notice">Series not found.</div>;
  if (!series) return <div className="page notice">Loading…</div>;

  const episodes = series.episodes.filter((e) => e.season === activeSeason);

  async function toggleWatched(ep) {
    await api.setWatched(ep.id, !ep.watched);
    load();
  }

  return (
    <div className="page">
      <div className="series-header">
        <div className="series-header-poster">
          <img
            src={`/api/series/${series.id}/poster`}
            alt=""
            onError={(e) => e.target.remove()}
          />
        </div>
        <div>
          <h1>{series.title}</h1>
          {series.next_up && (
            <Link to={`/play/${series.next_up.id}`} className="btn-primary">
              ▶ {series.next_up.position_s > 30 ? 'Resume' : 'Play'}{' '}
              {epCode(series.next_up)}
            </Link>
          )}
        </div>
      </div>

      {seasons.length > 1 && (
        <div className="season-tabs">
          {seasons.map((s) => (
            <button
              key={s}
              className={s === activeSeason ? 'active' : ''}
              onClick={() => setSeason(s)}
            >
              {s === 0 ? 'Videos' : `Season ${s}`}
            </button>
          ))}
        </div>
      )}

      <div className="episode-list">
        {episodes.map((ep) => (
          <EpisodeCard
            key={ep.id}
            episode={ep}
            onToggleWatched={toggleWatched}
            activeConvert={activeConvert}
          />
        ))}
      </div>
    </div>
  );
}
