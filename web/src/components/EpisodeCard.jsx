import { Link } from 'react-router-dom';
import ProgressBar from './ProgressBar.jsx';
import { fmtTime, epCode } from '../api.js';

function convertBadge(episode, activeConvert) {
  if (!['no_audio', 'no_video'].includes(episode.compat)) return null;
  switch (episode.convert_status) {
    case 'ready':
      return null;
    case 'converting': {
      const pct =
        activeConvert?.episodeId === episode.id
          ? ` ${Math.round((activeConvert.progress || 0) * 100)}%`
          : '';
      return { text: `Converting…${pct}`, cls: 'busy' };
    }
    case 'queued':
      return { text: 'Waiting to convert', cls: '' };
    case 'failed':
      return { text: 'Conversion failed', cls: 'failed', title: episode.convert_error };
    default:
      return {
        text: '⚠ Incompatible codec',
        cls: 'failed',
        title: 'This file needs conversion before it can play in a browser.',
      };
  }
}

export default function EpisodeCard({ episode, onToggleWatched, activeConvert }) {
  const badge = convertBadge(episode, activeConvert);
  return (
    <div className={`episode-card ${episode.watched ? 'watched' : ''}`}>
      <Link to={`/play/${episode.id}`} className="episode-thumb">
        {episode.has_thumb ? (
          <img src={`/api/episodes/${episode.id}/thumbnail`} alt="" loading="lazy" />
        ) : (
          <div className="thumb-placeholder">▶</div>
        )}
        <ProgressBar position={episode.position_s} duration={episode.duration_s} />
      </Link>
      <div className="episode-info">
        <div className="episode-title">
          <span className="ep-code">{epCode(episode)}</span> {episode.title}
        </div>
        <div className="episode-sub">
          {episode.duration_s ? fmtTime(episode.duration_s) : ''}
          {episode.watched ? ' · Watched ✓' : ''}
          {badge && (
            <span className={`convert-badge ${badge.cls}`} title={badge.title || ''}>
              {badge.text}
            </span>
          )}
        </div>
      </div>
      <button
        className="watched-toggle"
        title={episode.watched ? 'Mark as unwatched' : 'Mark as watched'}
        onClick={() => onToggleWatched(episode)}
      >
        {episode.watched ? '✓' : '○'}
      </button>
    </div>
  );
}
