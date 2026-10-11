import { useEffect, useRef, useState } from 'react';
import Summarizer from './Summarizer';
import Planner from './Planner';
import Quiz from './Quiz';
import Flashcards from './Flashcards';
import PracticeTest from './PracticeTest';
import AnswerRush from './AnswerRush';
import RagStudy from './RagStudy';
import TriviaBlast, { DAILY_TRIVIA_EVENT, getDailyTriviaStatus } from './TriviaBlast';
import StreakTracker from './StreakTracker';
import { getStreakStats, STUDY_DATES_EVENT } from './streak';
import { getDailyQuote } from './quotes';
import './App.css';

const STUDY_MODES = [
  { id: 'summarizer', icon: '📝', name: 'Summarizer', description: 'Distil your notes into key points', Component: Summarizer },
  { id: 'quiz', icon: '❓', name: 'Quiz', description: 'Test your understanding', Component: Quiz },
  { id: 'flashcards', icon: '🃏', name: 'Flashcards', description: 'Review with flip cards', Component: Flashcards },
  { id: 'practice-test', icon: '🎯', name: 'Practice Test', description: 'Timed exam simulation', Component: PracticeTest },
  { id: 'planner', icon: '📅', name: 'Study Planner', description: 'Build your revision schedule', Component: Planner },
  { id: 'rag', icon: '🔍', name: 'RAG Study', description: 'Generate from your own PDF', Component: RagStudy, featured: true, badge: 'PDF Powered' },
];
const GAME_MODES = [
  { id: 'answer-rush', icon: '⚡', name: 'Answer Rush', Component: AnswerRush },
  { id: 'trivia-blast', icon: '🧠', name: 'Trivia Blast', Component: TriviaBlast },
];
const STREAK_MODE = { id: 'streak', icon: '🔥', name: 'My Streak', Component: StreakTracker };
const MODES = [...STUDY_MODES, ...GAME_MODES, STREAK_MODE];

function App() {
  const [currentPage, setCurrentPage] = useState('summarizer');
  const [heroStreak, setHeroStreak] = useState(() => getStreakStats().currentStreak);
  const [dailyTrivia, setDailyTrivia] = useState(() => getDailyTriviaStatus());
  const [quoteCopied, setQuoteCopied] = useState(false);
  const quoteToastTimer = useRef(null);
  const dailyQuote = getDailyQuote();
  const selectedMode = MODES.find(mode => mode.id === currentPage);
  const ModeComponent = selectedMode.Component;

  useEffect(() => {
    const refreshStreak = () => setHeroStreak(getStreakStats().currentStreak);
    window.addEventListener(STUDY_DATES_EVENT, refreshStreak);
    window.addEventListener('storage', refreshStreak);
    refreshStreak();
    return () => {
      window.removeEventListener(STUDY_DATES_EVENT, refreshStreak);
      window.removeEventListener('storage', refreshStreak);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(quoteToastTimer.current), []);

  useEffect(() => {
    const refreshDailyTrivia = () => setDailyTrivia(getDailyTriviaStatus());
    window.addEventListener(DAILY_TRIVIA_EVENT, refreshDailyTrivia);
    window.addEventListener('storage', refreshDailyTrivia);
    refreshDailyTrivia();
    return () => {
      window.removeEventListener(DAILY_TRIVIA_EVENT, refreshDailyTrivia);
      window.removeEventListener('storage', refreshDailyTrivia);
    };
  }, []);

  const scrollToWorkspace = () => {
    document.getElementById('eureka-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openDailyTrivia = () => {
    setCurrentPage('trivia-blast');
    window.requestAnimationFrame(scrollToWorkspace);
  };

  const copyDailyQuote = async () => {
    const quoteText = `“${dailyQuote.quote}” — ${dailyQuote.author}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(quoteText);
    } catch {
      const helper = document.createElement('textarea');
      helper.value = quoteText;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }
    setQuoteCopied(true);
    window.clearTimeout(quoteToastTimer.current);
    quoteToastTimer.current = window.setTimeout(() => setQuoteCopied(false), 1800);
  };

  return (
    <div className="app eureka-app">
      <header className="eureka-hero">
        <div className="eureka-hero-decor eureka-stars" aria-hidden="true">✦　·　✧</div>
        <div className="eureka-hero-decor eureka-cloud eureka-cloud-one" aria-hidden="true" />
        <div className="eureka-hero-decor eureka-cloud eureka-cloud-two" aria-hidden="true" />
        <div className="eureka-floating-study-icons" aria-hidden="true">
          {['📚', '✏️', '🧠', '💡', '🎯', '⚡'].map((icon, index) => (
            <span key={icon} className={`eureka-floating-study-icon study-icon-${index + 1}`}>{icon}</span>
          ))}
        </div>
        <div className="eureka-hero-content">
          <h1>EUREKA</h1>
          <p>Your AI Study Companion ✨</p>
          <div className="eureka-hero-stats" aria-label="Study app features">
            <span>🧠 4 AI Agents</span>
            <span>⚡ Real-time Quiz</span>
            <span>📄 PDF Powered</span>
          </div>
          <article className="daily-quote-card">
            <span className="daily-quote-mark" aria-hidden="true">“</span>
            <blockquote>{dailyQuote.quote}</blockquote>
            <div className="daily-quote-footer">
              <cite>— {dailyQuote.author}</cite>
              <button type="button" className="daily-quote-copy" onClick={copyDailyQuote} aria-label="Copy daily quote">{quoteCopied ? 'Copied! ✨' : 'Copy quote'}</button>
            </div>
          </article>
          <div className="eureka-hero-streak-pill" aria-live="polite">🔥 {heroStreak} day streak</div>
          <button type="button" className="eureka-scroll-button" onClick={scrollToWorkspace}>
            Explore your study space <span aria-hidden="true">↓</span>
          </button>
        </div>
        <button type="button" className="eureka-scroll-cue" onClick={scrollToWorkspace} aria-label="Scroll to study tools">
          <span aria-hidden="true">↓</span>
        </button>
      </header>

      <section className="daily-trivia-home" aria-label="Daily Trivia">
        <button className={`daily-trivia-home-card${dailyTrivia.playedToday ? ' completed' : ''}`} type="button" onClick={openDailyTrivia}>
          <span className="daily-trivia-home-icon" aria-hidden="true">🧠</span>
          <span className="daily-trivia-home-copy">
            <strong>{dailyTrivia.playedToday ? 'Completed today! ✅' : 'Daily Trivia ✨'}</strong>
            <span>{dailyTrivia.playedToday ? 'Come back tomorrow' : 'Play today’s 5 questions!'}</span>
          </span>
          <span className="daily-trivia-home-action" aria-hidden="true">{dailyTrivia.playedToday ? 'DONE' : 'PLAY'} <span>→</span></span>
        </button>
      </section>

      <main className="eureka-workspace" id="eureka-workspace">
        <aside className="eureka-sidebar" aria-label="Study mode navigation">
          <div className="eureka-sidebar-brand"><span>✦</span> YOUR WORKSPACE</div>
          <div className="eureka-sidebar-section">
            <h2>Study Tools</h2>
            {STUDY_MODES.map(mode => (
              <button key={mode.id} type="button" className={`eureka-sidebar-item study-item${currentPage === mode.id ? ' active' : ''}${mode.id === 'rag' ? ' rag-item' : ''}`} onClick={() => setCurrentPage(mode.id)} aria-current={currentPage === mode.id ? 'page' : undefined}>
                <span className="eureka-sidebar-icon" aria-hidden="true">{mode.icon}</span>
                <span>{mode.id === 'planner' ? 'Planner' : mode.name}</span>
                {mode.badge && <span className="eureka-sidebar-badge">PDF</span>}
              </button>
            ))}
          </div>
          <div className="eureka-sidebar-section game-section">
            <h2>Game Zone</h2>
            {GAME_MODES.map(mode => (
              <button key={mode.id} type="button" className={`eureka-sidebar-item game-item${currentPage === mode.id ? ' active' : ''}`} onClick={() => setCurrentPage(mode.id)} aria-current={currentPage === mode.id ? 'page' : undefined}>
                <span className="eureka-sidebar-icon" aria-hidden="true">{mode.icon}</span>
                <span>{mode.name}</span>
              </button>
            ))}
          </div>
          <div className="eureka-sidebar-section progress-section">
            <h2>Your Progress</h2>
            <button type="button" className={`eureka-sidebar-item streak-item${currentPage === STREAK_MODE.id ? ' active' : ''}`} onClick={() => setCurrentPage(STREAK_MODE.id)} aria-current={currentPage === STREAK_MODE.id ? 'page' : undefined}>
              <span className="eureka-sidebar-icon" aria-hidden="true">🔥</span>
              <span>My Streak</span>
            </button>
          </div>
          <article className="sidebar-daily-quote">
            <div className="sidebar-daily-quote-label">✦ TODAY’S THOUGHT</div>
            <blockquote>{dailyQuote.quote}</blockquote>
            <cite>— {dailyQuote.author}</cite>
            <button type="button" onClick={copyDailyQuote}>{quoteCopied ? 'Copied! ✨' : 'Copy quote'}</button>
          </article>
        </aside>

        <section className="eureka-main-content" aria-labelledby="selected-mode-title">
          <header className="eureka-content-heading">
            <span className={`eureka-content-icon${selectedMode.id === 'rag' ? ' rag-icon' : ''}`} aria-hidden="true">{selectedMode.icon}</span>
            <div>
              <div className="eureka-content-eyebrow">{GAME_MODES.some(mode => mode.id === selectedMode.id) ? 'GAME ZONE' : selectedMode.id === 'streak' ? 'YOUR PROGRESS' : 'STUDY TOOLS'}</div>
              <h2 id="selected-mode-title">{selectedMode.name}</h2>
            </div>
          </header>
          <div className="eureka-content-card">
            <ModeComponent />
          </div>
        </section>
      </main>
      {quoteCopied && <div className="quote-copy-toast" role="status">Copied! ✨</div>}
      <footer className="eureka-app-footer">EUREKA <span>✦</span> Your AI Study Companion</footer>
    </div>
  );
}

export default App;
