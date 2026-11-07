
import MagicBento from '../reactbits/MagicBento/MagicBento';
import CircularProgress from './CircularProgress';
import StudyDaysChart from './StudyDaysChart';
import { useProgress } from '../progress/ProgressContext';
import { useAuth } from '../auth/AuthContext';
import { usePrefersReducedMotion } from '../lib/motion';
import { NotesCard, ChecklistsCard, DailyThought } from './WorkspaceCards';

import summarizerImg from '../assets/summarizer.jpg';
import flashcardsImg from '../assets/flashcards.jpg';
import plannerImg from '../assets/planner.png';
import quizzesImg from '../assets/quiz.jpg';
import practiceTestImg from '../assets/practice-test.jpg';
import pdfStudyImg from '../assets/pdf-study.jpg';

import focusImg from '../assets/focus.png';
import notesImg from '../assets/notes.png';
import answerRushImg from '../assets/answer-rush.png';
import triviaImg from '../assets/trivia.png';

const TOOL_CARDS = [
  {
    title: 'Summarizer',
    description: 'Turn notes or a PDF into a summary and key points',
    href: '/app?tool=summarizer',
    visual: (
      <img
        className="study-tool-card-image"
        src={summarizerImg}
        alt=""
        loading="lazy"
      />
    ),
  },
  {
    title: 'Quiz',
    description: 'Multiple-choice questions on any topic',
    href: '/app?tool=quiz',
    visual: (
      <img
        className="study-tool-card-image"
        src={quizzesImg}
        alt=""
        loading="lazy"
      />
    ),
  },
  {
    title: 'Flashcards',
    description: 'Term and definition cards to review',
    href: '/app?tool=flashcards',
    visual: (
      <img
        className="study-tool-card-image"
        src={flashcardsImg}
        alt=""
        loading="lazy"
      />
    ),
  },
  {
    title: 'Practice Test',
    description: 'A timed set of questions with a score',
    href: '/app?tool=practice-test',
    visual: (
      <img
        className="study-tool-card-image"
        src={practiceTestImg}
        alt=""
        loading="lazy"
      />
    ),
  },
  {
    title: 'Study Planner',
    description: 'A dated schedule up to your exam',
    href: '/app?tool=planner',
    visual: (
      <img
        className="study-tool-card-image"
        src={plannerImg}
        alt=""
        loading="lazy"
      />
    ),
  },
  {
    title: 'PDF Study',
    description: 'Quiz, summary, cards, or plan from your PDF',
    href: '/app?tool=rag',
    visual: (
      <img
        className="study-tool-card-image"
        src={pdfStudyImg}
        alt=""
        loading="lazy"
      />
    ),
  },
];

const ACTIVITY_CARDS = [
  {
    title: 'Focus Mode',
    description: 'Timed sessions of 25, 45 or 60 minutes',
    href: '/focus',
    visual: (
      <img
        className="activity-card-image"
        src={focusImg}
        alt=""
        loading="lazy"
      />
    ),
  },
  {
    title: 'Notes & checklists',
    description: 'Saved to your account on any device',
    href: '/app?tool=workspace',
    visual: (
      <img
        className="activity-card-image"
        src={notesImg}
        alt=""
        loading="lazy"
      />
    ),
  },
  {
    title: 'Answer Rush',
    description: 'Quick questions with a points score',
    href: '/app?tool=answer-rush',
    visual: (
      <img
        className="activity-card-image"
        src={answerRushImg}
        alt=""
        loading="lazy"
      />
    ),
  },
  {
    title: 'Trivia Blast',
    description: 'Five questions a day',
    href: '/app?tool=trivia-blast',
    visual: (
      <img
        className="activity-card-image"
        src={triviaImg}
        alt=""
        loading="lazy"
      />
    ),
  },
];

const plural = (n, word) =>
  `${n} ${n === 1 ? word : `${word}s`}`;

function hoursAndMinutes(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  return hours
    ? `${hours} h ${minutes} min`
    : `${minutes} min`;
}

export default function DashboardHome({ onOpenGame }) {
  const { user } = useAuth();
  const { progress, error } = useProgress();
  const reduced = usePrefersReducedMotion();

  const firstName = (user?.display_name || '').trim().split(' ')[0];

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const statCards = progress
    ? [
        {
          title: 'Current streak',
          description: 'Consecutive study days',
          icon: '🔥',
          label: `${progress.streak.current} days`,
        },
        {
          title: 'Longest streak',
          description: 'Personal best',
          icon: '🏆',
          label: `${progress.streak.longest} days`,
        },
        {
          title: 'Focus today',
          description: 'Focus sessions completed',
          icon: '◎',
          label: `${progress.goal.today_sessions} / ${
            progress.goal.daily_session_target
          } ${
            progress.goal.daily_session_target === 1
              ? 'session'
              : 'sessions'
          }`,
          href: '/focus',
        },
        {
          title: 'Focus time',
          description: `${plural(
            progress.totals.focus_sessions,
            'session'
          )} completed`,
          icon: '◷',
          label: hoursAndMinutes(progress.totals.focus_minutes),
        },
        {
          title: 'Quiz average',
          description:
            progress.totals.quiz_average_percent === null
              ? 'No quizzes taken yet'
              : `Across ${plural(
                  progress.totals.quizzes,
                  'quiz'
                )}`,
          icon: '▥',
          label: progress.totals.quiz_average_percent === null ? '—' : `${progress.totals.quiz_average_percent}%`,
        },
      ]
    : [];

  return (
    <div className="dashboard-home">
      <header className="home-hero">
        <p className="eyebrow">{today}</p>

        <h2 className="home-title">
          {firstName
            ? `Good to see you, ${firstName}.`
            : 'Good to see you.'}
        </h2>

        <p className="home-lede">
          Pick up a tool below, or check where your study time stands.
        </p>
      </header>

      <section className="home-section home-workspace" aria-labelledby="home-workspace-title">
        <h3 id="home-workspace-title" className="home-section-title">From your workspace</h3>
        <div className="dash-grid">
          <NotesCard onOpen={onOpenGame} />
          <ChecklistsCard onOpen={onOpenGame} />
          <DailyThought />
        </div>
      </section>

      <section
        className="home-section"
        aria-labelledby="home-tools"
      >
        <h3 id="home-tools" className="home-section-title">
          Study tools
        </h3>

        <MagicBento
          className="study-tools-bento"
          items={TOOL_CARDS}
          columns={3}
          rowHeight={300}
          gap={14}
          radius={20}
          theme="light"
          glowColor="91, 79, 207"
          enableSpotlight
          enableStars={false}
          enableTilt={false}
          enableMagnetism={false}
          disableAnimations={reduced}
        />
      </section>

      <section
        className="home-section"
        aria-labelledby="home-more"
      >
        <h3 id="home-more" className="home-section-title">
          Focus, notes and games
        </h3>

        <MagicBento
          className="activity-tools-bento"
          items={ACTIVITY_CARDS}
          columns={4}
          rowHeight={300}
          gap={14}
          radius={20}
          theme="light"
          glowColor="91, 79, 207"
          enableSpotlight
          enableStars={false}
          enableTilt={false}
          enableMagnetism={false}
          disableAnimations={reduced}
        />
      </section>

      <section
        className="home-section"
        aria-labelledby="home-progress"
      >
        <h3 id="home-progress" className="home-section-title">
          Your progress
        </h3>

        {error && (
          <p className="progress-error" role="alert">
            {error}
          </p>
        )}

        {!progress && !error && (
          <p className="progress-loading" role="status">
            Loading your progress…
          </p>
        )}

        {progress && (
          <>
            <MagicBento
              className="progress-bento"
              items={statCards}
              columns={5}
            rowHeight={154}
              gap={14}
              radius={20}
              theme="light"
              glowColor="91, 79, 207"
              enableSpotlight
              enableStars={false}
              enableTilt={false}
              enableMagnetism={false}
              disableAnimations={reduced}
            />

            <div className="home-progress-row">
              <div className="home-card">
                <h4>Today's target</h4>

                <CircularProgress
                  percent={progress.goal.today_percent}
                  label="of today's target"
                  detail={`${progress.goal.today_sessions} of ${
                    progress.goal.daily_session_target
                  } focus ${
                    progress.goal.daily_session_target === 1
                      ? 'session'
                      : 'sessions'
                  }`}
                />
              </div>

              <div className="home-card home-card--wide">
                <h4>Study rhythm by week</h4>

                <StudyDaysChart
                  studyDates={progress.study_dates}
                  today={progress.today.date}
                />
              </div>

              <div className="home-card home-card--wide">
                <h4>Recent activity</h4>

                {progress.recent_activity.length === 0 ? (
                  <p className="profile-empty">
                    No study activity yet. Completed sessions,
                    quizzes and generated material appear here.
                  </p>
                ) : (
                  <ol className="activity-list">
                    {progress.recent_activity
                      .slice(0, 6)
                      .map((item, i) => (
                        <li key={`${item.kind}-${i}`}>
                          <span className="activity-kind">
                            {item.kind.replace(/_/g, ' ')}
                          </span>

                          {item.detail && (
                            <span className="activity-detail">
                              {item.detail}
                            </span>
                          )}

                          <time dateTime={item.activity_date}>
                            {item.activity_date}
                          </time>
                        </li>
                      ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
