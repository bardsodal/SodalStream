import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, epCode } from '../api.js';

const COMPAT_BANNERS = {
  no_audio: 'This file has an audio codec the browser cannot decode — it may play without sound until conversion finishes.',
  no_video: 'This file has a video codec the browser cannot decode — it will play once conversion finishes.',
};

export default function Player() {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const posRef = useRef({ position: 0, duration: 0 });
  const [episode, setEpisode] = useState(null);
  const [next, setNext] = useState(null);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    setEpisode(null);
    setNext(null);
    setCountdown(null);
    posRef.current = { position: 0, duration: 0 };
    api.episode(id).then(setEpisode).catch(() => setEpisode(undefined));
    api.next(id).then((r) => setNext(r.next));
  }, [id]);

  const send = useCallback(() => {
    const { position, duration } = posRef.current;
    if (duration > 0 && position > 0) api.progress(id, position, duration).catch(() => {});
  }, [id]);

  // Heartbeat while playing + final send on leave
  useEffect(() => {
    if (!episode) return;
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) send();
    }, 5000);
    const onPageHide = () => {
      const { position, duration } = posRef.current;
      if (duration > 0 && position > 0) api.progressBeacon(id, position, duration);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
      send();
    };
  }, [episode, id, send]);

  // Next-episode countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      navigate(`/play/${next.id}`);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, next, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      const v = videoRef.current;
      if (!v || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'Escape') {
        setCountdown(null);
        return;
      }
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'VIDEO') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case 'ArrowLeft':
          v.currentTime = Math.max(0, v.currentTime - 10);
          break;
        case 'ArrowRight':
          v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
          break;
        case 'f':
          document.fullscreenElement
            ? document.exitFullscreen()
            : wrapRef.current?.requestFullscreen();
          break;
        case 'n':
          if (next) navigate(`/play/${next.id}`);
          break;
        default:
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, navigate]);

  if (episode === undefined) return <div className="page notice">Episode not found.</div>;
  if (!episode) return <div className="player-page notice">Loading…</div>;

  const banner =
    episode.convert_status === 'ready' ? null : COMPAT_BANNERS[episode.compat];

  return (
    <div className="player-page" ref={wrapRef}>
      <div className="player-topbar">
        <Link to={`/series/${episode.series_id}`} className="back-btn">
          ← Back
        </Link>
        <div className="player-title">
          {episode.series_title} <span>{epCode(episode)} · {episode.title}</span>
        </div>
      </div>

      {banner && <div className="compat-banner">{banner}</div>}

      <video
        ref={videoRef}
        className="player-video"
        src={`/api/episodes/${episode.id}/stream`}
        controls
        autoPlay
        onLoadedMetadata={(e) => {
          const v = e.target;
          const pos = episode.position_s;
          if (pos && pos > 30 && (!v.duration || pos < v.duration * 0.9)) {
            v.currentTime = pos;
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.target;
          if (v.duration) posRef.current = { position: v.currentTime, duration: v.duration };
        }}
        onPause={send}
        onSeeked={send}
        onEnded={() => {
          send();
          if (next) setCountdown(10);
        }}
      />

      {countdown !== null && next && (
        <div className="next-overlay">
          <div className="next-overlay-card">
            <div className="next-overlay-label">Up next</div>
            <div className="next-overlay-title">
              {epCode(next)} · {next.title}
            </div>
            <div className="next-overlay-count">Playing in {countdown}…</div>
            <div className="next-overlay-actions">
              <button className="btn-primary" onClick={() => navigate(`/play/${next.id}`)}>
                ▶ Play now
              </button>
              <button className="btn-secondary" onClick={() => setCountdown(null)}>
                Cancel (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {countdown === null && videoRef.current?.ended && !next && (
        <div className="next-overlay">
          <div className="next-overlay-card">
            <div className="next-overlay-label">That was the last episode</div>
            <div className="next-overlay-actions">
              <Link to={`/series/${episode.series_id}`} className="btn-primary">
                Back to series
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
