export default function ProgressBar({ position, duration }) {
  if (!position || !duration) return null;
  const pct = Math.min(100, (position / duration) * 100);
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
