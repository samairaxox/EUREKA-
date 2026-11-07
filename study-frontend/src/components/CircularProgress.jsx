/** Ring showing completed focus sessions today against the user's daily target. */
export default function CircularProgress({ percent, label, detail }) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <figure className="circular-progress" aria-label={`${label}: ${clamped} percent`}>
      <svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
        <circle cx="80" cy="80" r={radius} className="circular-progress-track" />
        <circle
          cx="80" cy="80" r={radius}
          className="circular-progress-value"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <figcaption>
        <strong>{clamped}%</strong>
        <span>{label}</span>
        {detail && <small>{detail}</small>}
      </figcaption>
    </figure>
  );
}
