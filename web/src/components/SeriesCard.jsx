import { Link } from 'react-router-dom';

export default function SeriesCard({ series }) {
  const unwatched = series.episode_count - (series.watched_count || 0);
  return (
    <Link to={`/series/${series.id}`} className="series-card">
      <div className="poster">
        <img
          src={`/api/series/${series.id}/poster`}
          alt=""
          loading="lazy"
          onError={(e) => {
            if (series.next_up) {
              e.target.onerror = () => e.target.remove();
              e.target.src = `/api/episodes/${series.next_up.id}/thumbnail`;
            } else {
              e.target.remove();
            }
          }}
        />
        <div className="poster-fallback">{series.title[0]}</div>
      </div>
      <div className="series-card-info">
        <div className="series-card-title">{series.title}</div>
        <div className="series-card-sub">
          {unwatched > 0 ? `${unwatched} unwatched` : 'All watched'}
        </div>
      </div>
    </Link>
  );
}
