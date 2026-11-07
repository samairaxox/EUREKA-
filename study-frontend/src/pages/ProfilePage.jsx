import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { profileApi } from '../api/auth';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useProgress } from '../progress/ProgressContext';
import CircularProgress from '../components/CircularProgress';
import StudyDaysChart from '../components/StudyDaysChart';
import StreakTracker from '../StreakTracker';

const KIND_LABELS = {
  summary: 'Summary generated',
  quiz_generated: 'Quiz generated',
  quiz: 'Quiz result',
  flashcards: 'Flashcards generated',
  plan: 'Study plan created',
  focus: 'Focus session completed',
  rag_quiz: 'PDF quiz generated',
  rag_summary: 'PDF summary generated',
  rag_flashcards: 'PDF flashcards generated',
  rag_plan: 'PDF study plan created',
};

function hoursAndMinutes(total = 0) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function plural(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { progress, refresh, error } = useProgress();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.display_name || '');
  const [nameStatus, setNameStatus] = useState('');
  const [goalFocus, setGoalFocus] = useState(25);
  const [goalTarget, setGoalTarget] = useState(1);
  const [goalStatus, setGoalStatus] = useState('');

  useEffect(() => {
    setName(user?.display_name || '');
  }, [user?.display_name]);

  useEffect(() => {
    if (!progress) return;

    setGoalFocus(progress.goal.default_focus_minutes);
    setGoalTarget(progress.goal.daily_session_target);
  }, [progress]);

  const saveName = async (event) => {
    event.preventDefault();
    setNameStatus('Saving…');

    try {
      const saved = await profileApi.updateProfile(name.trim());
      updateUser({ display_name: saved.display_name });
      setNameStatus('Your name has been updated.');
    } catch (err) {
      setNameStatus(errorMessage(err, 'Could not save your name.'));
    }
  };

  const saveGoals = async (event) => {
    event.preventDefault();
    setGoalStatus('Saving…');

    try {
      await profileApi.updateGoals({
        default_focus_minutes: Number(goalFocus),
        daily_session_target: Number(goalTarget),
      });

      await refresh();
      setGoalStatus('Your goals have been saved.');
    } catch (err) {
      setGoalStatus(errorMessage(err, 'Could not save your goals.'));
    }
  };

  const onSignOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  if (!progress) {
    return (
      <main className="profile-page profile-loading-page">
        <Link to="/app" className="profile-back-link">
          ← Study space
        </Link>

        {error ? (
          <p className="progress-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="progress-loading" role="status">
            Gathering your study progress…
          </p>
        )}
      </main>
    );
  }

  const {
    goal,
    totals,
    recent_activity: recent,
    recent_quizzes: quizzes,
  } = progress;

  const quizAverage = totals.quiz_average_percent;
  const providers = [
    user?.has_password ? 'Password' : null,
    user?.providers?.includes('google') ? 'Google' : null,
  ].filter(Boolean);

  const stats = [
    {
      label: 'Current streak',
      value: progress.streak.current,
      suffix: progress.streak.current === 1 ? 'day in a row' : 'days in a row',
      mark: '01',
    },
    {
      label: 'Longest streak',
      value: progress.streak.longest,
      suffix: progress.streak.longest === 1 ? 'day at best' : 'days at best',
      mark: '02',
    },
    {
      label: 'Focus sessions',
      value: totals.focus_sessions,
      suffix: hoursAndMinutes(totals.focus_minutes) + ' focused',
      mark: '03',
    },
    {
      label: 'Quizzes taken',
      value: totals.quizzes,
      suffix: totals.quizzes === 1 ? 'result recorded' : 'results recorded',
      mark: '04',
    },
    {
      label: 'Quiz average',
      value: quizAverage === null ? '—' : `${quizAverage}%`,
      suffix: quizAverage === null ? 'Take your first quiz' : 'overall accuracy',
      mark: '05',
    },
    {
      label: 'Sessions today',
      value: goal.today_sessions,
      suffix: `of ${goal.daily_session_target} daily ${
        goal.daily_session_target === 1 ? 'session' : 'sessions'
      }`,
      mark: '06',
    },
  ];

  return (
    <main className="profile-page">
      <header className="profile-header">
        <div className="profile-header-top">
          <Link to="/app" className="profile-back-link">
            <span aria-hidden="true">←</span>
            Study space
          </Link>

          <button
            type="button"
            className="profile-signout"
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>

          <div className="profile-hero profile-hero--github">
          <div className="profile-hero-identity">
            <div className="profile-avatar" aria-hidden="true">
              {(user?.display_name || user?.email || 'S')
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="profile-identity">
              <p className="eyebrow">YOUR EUREKA SPACE</p>
              <h1 className="profile-name">
                {user?.display_name || 'Your profile'}
                <span className="profile-name-period">.</span>
              </h1>
              <p className="profile-email">{user?.email}</p>

              {providers.length > 0 && (
                <p className="profile-providers">
                  <span className="profile-status-dot" aria-hidden="true" />
                  Signed in with {providers.join(' and ')}
                </p>
              )}
            </div>
          </div>

          <div className="profile-hero-calendar">
            <StreakTracker />
          </div>
        </div>
      </header>

      <div className="profile-content">
        <section
          className="profile-overview-grid"
          aria-label="Today's study progress"
        >
          <article className="profile-card profile-today-card">
            <div className="profile-card-heading">
              <div>
                <p className="profile-kicker">A LITTLE PROGRESS, DAILY</p>
                <h2>Today</h2>
              </div>

              <span className="profile-card-symbol" aria-hidden="true">
                ✳
              </span>
            </div>

            <CircularProgress
              percent={goal.today_percent}
              label="of today's target"
              detail={`${goal.today_sessions} of ${
                goal.daily_session_target
              } focus ${
                goal.daily_session_target === 1 ? 'session' : 'sessions'
              }`}
            />

            <Link to="/focus" className="profile-inline-link">
              Start a focus session <span aria-hidden="true">↗</span>
            </Link>
          </article>

          <article className="profile-card profile-stats-panel">
            <div className="profile-card-heading">
              <div>
                <p className="profile-kicker">YOUR JOURNEY SO FAR</p>
                <h2>Your numbers</h2>
              </div>
              <span className="profile-stats-caption">LIVE PROGRESS</span>
            </div>

            <div className="profile-stat-grid">
              {stats.map((stat) => (
                <div className="profile-stat" key={stat.label}>
                  <span className="profile-stat-mark">{stat.mark}</span>
                  <p className="profile-stat-label">{stat.label}</p>
                  <p className="profile-stat-value">{stat.value}</p>
                  <p className="profile-stat-detail">{stat.suffix}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section
          className="profile-card profile-section-card"
          aria-labelledby="chart-title"
        >
          <div className="profile-section-heading">
            <div>
              <p className="profile-kicker">CONSISTENCY OVER INTENSITY</p>
              <h2 id="chart-title">Your study rhythm</h2>
              <p className="profile-section-description">
                A week at a time. Every small step adds up.
              </p>
            </div>
            <span className="profile-section-ornament" aria-hidden="true">
              〰
            </span>
          </div>

          <StudyDaysChart
            studyDates={progress.study_dates}
            today={progress.today.date}
          />
        </section>
        <section className="profile-settings-grid" aria-label="Profile settings">
          <section
            className="profile-card profile-settings-card"
            aria-labelledby="goals-title"
          >
            <div className="profile-section-heading">
              <div>
                <p className="profile-kicker">MAKE IT WORK FOR YOU</p>
                <h2 id="goals-title">Your goals</h2>
              </div>
              <span className="profile-setting-icon" aria-hidden="true">
                ◷
              </span>
            </div>

            <p className="profile-section-description">
              Choose a rhythm that feels realistic for you.
            </p>

            <form onSubmit={saveGoals} className="profile-form">
              <label className="field-label-block">
                <span>Default focus length</span>
                <select
                  value={goalFocus}
                  onChange={(event) => setGoalFocus(event.target.value)}
                >
                  <option value={25}>25 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </label>

              <label className="field-label-block">
                <span>Focus sessions per day</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={goalTarget}
                  onChange={(event) => setGoalTarget(event.target.value)}
                  required
                />
              </label>

              <button type="submit" className="submit-btn">
                Save goals <span aria-hidden="true">↗</span>
              </button>

              {goalStatus && (
                <p
                  className={`profile-form-status ${
                    goalStatus.includes('Could not') ? 'is-error' : 'is-success'
                  }`}
                  role="status"
                >
                  {goalStatus}
                </p>
              )}
            </form>
          </section>

          <section
            className="profile-card profile-settings-card"
            aria-labelledby="name-title"
          >
            <div className="profile-section-heading">
              <div>
                <p className="profile-kicker">A SPACE THAT'S YOURS</p>
                <h2 id="name-title">Personal details</h2>
              </div>
              <span className="profile-setting-icon" aria-hidden="true">
                ✎
              </span>
            </div>

            <p className="profile-section-description">
              Keep your display name up to date.
            </p>

            <form onSubmit={saveName} className="profile-form">
              <label className="field-label-block">
                <span>Display name</span>
                <input
                  type="text"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>

              <div className="profile-account-email">
                <span>Email address</span>
                <p>{user?.email || 'No email available'}</p>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={!name.trim()}
              >
                Save name <span aria-hidden="true">↗</span>
              </button>

              {nameStatus && (
                <p
                  className={`profile-form-status ${
                    nameStatus.includes('Could not') ? 'is-error' : 'is-success'
                  }`}
                  role="status"
                >
                  {nameStatus}
                </p>
              )}
            </form>
          </section>
        </section>

        <section
          className="profile-card profile-section-card profile-activity-card"
          aria-labelledby="recent-title"
        >
          <div className="profile-section-heading">
            <div>
              <p className="profile-kicker">THE WORK YOU'VE PUT IN</p>
              <h2 id="recent-title">Recent activity</h2>
              <p className="profile-section-description">
                Your completed sessions and learning milestones.
              </p>
            </div>
          </div>

          {recent.length === 0 ? (
            <div className="profile-empty-state">
              <span aria-hidden="true">✳</span>
              <p>No activity just yet.</p>
              <span>Your completed sessions and study tools will show up here.</span>
              <Link to="/app" className="profile-inline-link">
                Explore your study space <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : (
            <ol className="activity-list">
              {recent.map((item, index) => (
                <li
                  key={`${item.kind}-${index}-${item.activity_date}`}
                >
                  <span className="profile-activity-icon" aria-hidden="true">
                    {item.kind === 'focus' ? '◷' : item.kind.includes('quiz') ? '✳' : '↗'}
                  </span>

                  <div className="profile-activity-copy">
                    <span className="activity-kind">
                      {KIND_LABELS[item.kind] || 'Study activity'}
                    </span>
                    {item.detail && (
                      <span className="activity-detail">{item.detail}</span>
                    )}
                  </div>

                  <time dateTime={item.activity_date}>
                    {item.activity_date}
                  </time>
                </li>
              ))}
            </ol>
          )}

          {quizzes.length > 0 && (
            <div className="profile-quiz-history">
              <h3 className="profile-subhead">Latest quiz scores</h3>
              <ul className="activity-list">
                {quizzes.map((quiz, index) => (
                  <li key={`${quiz.topic}-${index}-${quiz.activity_date}`}>
                    <span className="profile-activity-icon" aria-hidden="true">
                      ✳
                    </span>

                    <div className="profile-activity-copy">
                      <span className="activity-kind">{quiz.topic}</span>
                      <span className="activity-detail">
                        {quiz.score} of {quiz.total} correct
                      </span>
                    </div>

                    <time dateTime={quiz.activity_date}>
                      {quiz.activity_date}
                    </time>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <footer className="profile-footer">
          <Link to="/app">← Back to your study space</Link>
          <span>One step at a time.</span>
        </footer>
      </div>
    </main>
  );
}