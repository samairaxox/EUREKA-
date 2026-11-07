import { useMemo } from 'react';
import { toLocalDateString } from '../streak';

const WEEKS = 12;

function startOfWeek(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

/**
 * Bar chart of study days per week for the last 12 weeks. Built only from recorded study dates;
 * weeks with no activity show as empty bars, not as invented values.
 */
export default function StudyDaysChart({ studyDates, today }) {
  const weeks = useMemo(() => {
    const anchor = today ? new Date(`${today}T12:00:00`) : new Date();
    const current = startOfWeek(anchor);
    const dates = new Set(studyDates || []);
    return Array.from({ length: WEEKS }, (_, index) => {
      const start = new Date(current);
      start.setDate(current.getDate() - (WEEKS - 1 - index) * 7);
      let count = 0;
      for (let day = 0; day < 7; day += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + day);
        if (d > anchor) break;
        if (dates.has(toLocalDateString(d))) count += 1;
      }
      return { start: toLocalDateString(start), count };
    });
  }, [studyDates, today]);

  const max = Math.max(1, ...weeks.map(week => week.count));
  const total = weeks.reduce((sum, week) => sum + week.count, 0);

  if (total === 0) {
    return <p className="profile-empty">No study days recorded in the last {WEEKS} weeks yet. Completed sessions and generated study material will appear here.</p>;
  }

  const width = 640;
  const height = 180;
  const barWidth = width / WEEKS;
  return (
    <figure className="study-chart">
      <svg viewBox={`0 0 ${width} ${height + 26}`} role="img"
        aria-label={`Study days per week for the last ${WEEKS} weeks. ${total} study days in total.`}>
        {weeks.map((week, index) => {
          const barHeight = (week.count / max) * (height - 12);
          const x = index * barWidth + barWidth * 0.18;
          return (
            <g key={week.start}>
              <rect x={x} y={height - barHeight} width={barWidth * 0.64} height={Math.max(barHeight, 2)} rx="4"
                className={week.count ? 'study-chart-bar' : 'study-chart-bar empty'}>
                <title>{`Week of ${week.start}: ${week.count} ${week.count === 1 ? 'study day' : 'study days'}`}</title>
              </rect>
              {index % 3 === 0 && (
                <text x={x} y={height + 20} className="study-chart-label">{week.start.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>{total} study {total === 1 ? 'day' : 'days'} in the last {WEEKS} weeks. Each bar is one week.</figcaption>
    </figure>
  );
}
