import { useEffect, useMemo, useState } from 'react';
import { getStreakStats, getStudyDates, STUDY_DATES_EVENT, toLocalDateString } from './streak';

const BADGES = [
  { days: 1, icon: '✨', name: 'Spark', tone: 'spark' },
  { days: 10, icon: '🔥', name: 'On Fire', tone: 'fire' },
  { days: 30, icon: '💫', name: 'Rising Star', tone: 'star' },
  { days: 50, icon: '🏆', name: 'Legend', tone: 'legend' },
  { days: 100, icon: '🐐', name: 'GOAT', tone: 'goat' },
];

function makeYearGrid() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const firstDay = new Date(today);
  firstDay.setDate(today.getDate() - 364);
  const offset = firstDay.getDay();
  return [...Array(offset).fill(null), ...Array.from({ length: 365 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (364 - index));
    return toLocalDateString(day);
  })];
}

function dateLabel(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function StreakTracker() {
  const [studyDates, setStudyDates] = useState(() => getStudyDates());
  const gridDates = useMemo(() => makeYearGrid(), []);
  const studyDateSet = useMemo(() => new Set(studyDates), [studyDates]);
  const { currentStreak, longestStreak } = getStreakStats(studyDates);

  useEffect(() => {
    const refresh = event => setStudyDates(event?.detail?.studyDates || getStudyDates());
    window.addEventListener(STUDY_DATES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STUDY_DATES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return (
    <section className="streak-tracker" aria-label="Study streak tracker">
      <header className="streak-summary">
        <div className="streak-current-card">
          <span className="streak-eyebrow">CURRENT STREAK</span>
          <div className="streak-current-number"><span aria-hidden="true">🔥</span> {currentStreak}</div>
          <span className="streak-day-unit">{currentStreak === 1 ? 'day' : 'days'} in a row</span>
        </div>
        <div className="streak-record-card">
          <span className="streak-eyebrow">LONGEST STREAK</span>
          <strong>{longestStreak} <small>{longestStreak === 1 ? 'day' : 'days'}</small></strong>
          <span className="streak-record-note">Your personal best ✨</span>
        </div>
      </header>

      <section className="streak-calendar-section" aria-labelledby="streak-calendar-title">
        <div className="streak-section-heading">
          <div>
            <span className="streak-eyebrow">SHOWING THE LAST 365 DAYS</span>
            <h2 id="streak-calendar-title">Your study rhythm</h2>
          </div>
          <div className="streak-legend"><span className="streak-legend-studied" /> Studied <span className="streak-legend-empty" /> Rest day</div>
        </div>
        <div className="streak-calendar-scroll">
          <div className="streak-calendar" role="img" aria-label="Study activity calendar for the last 365 days">
            <div className="streak-weekday-labels" aria-hidden="true">
              <span /> <span>Mon</span> <span /> <span>Wed</span> <span /> <span>Fri</span> <span />
            </div>
            <div className="streak-grid">
              {gridDates.map((date, index) => {
                if (!date) return <span key={`calendar-offset-${index}`} className="streak-day-padding" aria-hidden="true" />;
                const studied = studyDateSet.has(date);
                return <span key={date} className={`streak-day${studied ? ' studied' : ''}`} title={`${dateLabel(date)}${studied ? ' · Studied' : ' · No study activity'}`} aria-label={`${dateLabel(date)}${studied ? ', studied' : ', no study activity'}`} />;
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="streak-badges-section" aria-labelledby="streak-badges-title">
        <div className="streak-section-heading">
          <div>
            <span className="streak-eyebrow">LITTLE WINS, BIG MOMENTUM</span>
            <h2 id="streak-badges-title">Your badges</h2>
          </div>
          <span className="streak-badge-count">{BADGES.filter(badge => longestStreak >= badge.days).length} / {BADGES.length} earned</span>
        </div>
        <div className="streak-badge-list">
          {BADGES.map(badge => {
            const earned = longestStreak >= badge.days;
            return (
              <article key={badge.name} className={`streak-badge ${badge.tone}${earned ? ' earned' : ' locked'}`} aria-label={`${badge.name}, day ${badge.days}${earned ? ', earned' : ', locked'}`}>
                <span className="streak-badge-icon" aria-hidden="true">{earned ? badge.icon : '🔒'}</span>
                <span className="streak-badge-name">{badge.name}</span>
                <span className="streak-badge-days">Day {badge.days}</span>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
