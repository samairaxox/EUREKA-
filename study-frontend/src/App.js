import { useEffect, useState } from 'react';
import Summarizer from './Summarizer';
import Planner from './Planner';
import Quiz from './Quiz';
import Flashcards from './Flashcards';
import PracticeTest from './PracticeTest';
import AnswerRush from './AnswerRush';
import RagStudy from './RagStudy';
import TriviaBlast from './TriviaBlast';
import StreakTracker from './StreakTracker';
import { getStreakStats, STUDY_DATES_EVENT } from './streak';
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

  const scrollToWorkspace = () => {
    document.getElementById('eureka-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          <div className="eureka-hero-streak-pill" aria-live="polite">🔥 {heroStreak} day streak</div>
          <button type="button" className="eureka-scroll-button" onClick={scrollToWorkspace}>
            Explore your study space <span aria-hidden="true">↓</span>
          </button>
        </div>
        <button type="button" className="eureka-scroll-cue" onClick={scrollToWorkspace} aria-label="Scroll to study tools">
          <span aria-hidden="true">↓</span>
        </button>
      </header>

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
      <footer className="eureka-app-footer">EUREKA <span>✦</span> Your AI Study Companion</footer>
    </div>
  );
}

export default App;
