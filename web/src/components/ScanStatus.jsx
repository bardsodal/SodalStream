import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ScanStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let timer;
    let stopped = false;
    async function poll() {
      try {
        const s = await api.status();
        if (stopped) return;
        setStatus(s);
        const busy =
          s.scanning ||
          s.probe.done < s.probe.total ||
          s.thumbs.done < s.thumbs.total ||
          !!s.convert?.active;
        timer = setTimeout(poll, busy ? 2000 : 15000);
      } catch {
        if (!stopped) timer = setTimeout(poll, 5000);
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const converting = status?.convert?.active;
  const busy =
    status &&
    (status.scanning ||
      status.probe.done < status.probe.total ||
      status.thumbs.done < status.thumbs.total ||
      !!converting);

  let label = 'Scan library';
  if (busy) {
    if (status.probe.done < status.probe.total) {
      label = `Analyzing ${status.probe.done}/${status.probe.total}…`;
    } else if (converting) {
      const pct = Math.round((converting.progress || 0) * 100);
      const left = status.convert.queued > 0 ? ` (+${status.convert.queued})` : '';
      label = `Converting ${pct}%${left}`;
    } else if (status.thumbs.done < status.thumbs.total) {
      label = `Thumbnails ${status.thumbs.done}/${status.thumbs.total}…`;
    } else {
      label = 'Scanning…';
    }
  }

  return (
    <button
      className={`scan-btn ${busy ? 'busy' : ''}`}
      disabled={busy}
      onClick={() => api.scan()}
      title="Rescan the media folder"
    >
      {label}
    </button>
  );
}
