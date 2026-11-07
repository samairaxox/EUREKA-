import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import SiteBackground from '../components/SiteBackground';
import GameEntry from '../components/GameEntry';
import Summarizer from '../Summarizer';
import Planner from '../Planner';
import Quiz from '../Quiz';
import Flashcards from '../Flashcards';
import PracticeTest from '../PracticeTest';
import RagStudy from '../RagStudy';
import AnswerRush from '../AnswerRush';
import TriviaBlast from '../TriviaBlast';
import StreakTracker from '../StreakTracker';
import Workspace from '../workspace/Workspace';
import DashboardHome from '../components/DashboardHome';
import SequenceSprint from '../games/SequenceSprint';
import LogicDuel from '../games/LogicDuel';
import { DigitalEscape, MatchingPairs, CategorizationSort } from '../games/NewGames';
import GameZoneHub from '../games/GameZoneHub';
import StudyToolsHub from '../components/StudyToolsHub';

const STUDY_MODES = [
  { id: 'summarizer', name: 'Summarizer', description: 'Distil your notes into key points', Component: Summarizer },
  { id: 'quiz', name: 'Quiz', description: 'Test your understanding', Component: Quiz },
  { id: 'flashcards', name: 'Flashcards', description: 'Review with flip cards', Component: Flashcards },
  { id: 'practice-test', name: 'Practice Test', description: 'Timed exam simulation', Component: PracticeTest },
  { id: 'planner', name: 'Study Planner', description: 'Build your revision schedule', Component: Planner },
  { id: 'rag', name: 'PDF Study', description: 'Generate from your own PDF', Component: RagStudy, badge: 'PDF' },
];

const GAME_MODES = [
  { id: 'answer-rush', name: 'Answer Rush', Component: AnswerRush },
  { id: 'trivia-blast', name: 'Trivia Blast', Component: TriviaBlast },
  { id: 'sequence-sprint', name: 'Sequence Sprint', Component: SequenceSprint },
  { id: 'logic-duel', name: 'Logic Duel', Component: LogicDuel },
  { id: 'digital-escape', name: 'Digital Escape Rooms', Component: DigitalEscape },
  { id: 'matching-pairs', name: 'Matching Pairs & Memory Grids', Component: MatchingPairs },
  { id: 'categorization-sort', name: 'Categorization Sorting', Component: CategorizationSort },
];
const GAME_ZONE_MODE = { id: 'game-zone', name: 'Game Zone', Component: GameZoneHub };
const STUDY_TOOLS_MODE = { id: 'study-tools', name: 'Study Tools', Component: StudyToolsHub };

// Main navigation. Each tab opens the same state the old sidebar used.
const TABS = [
  { key: 'study', label: 'Study Tools', target: 'study-tools' },
  { key: 'games', label: 'Game Zone', target: 'game-zone' },
  { key: 'workspace', label: 'Notes & Checklists', target: 'workspace' },
];
const sectionOf = id => {
  if (id === 'study-tools' || STUDY_MODES.some(m => m.id === id)) return 'study';
  if (id === 'game-zone' || GAME_MODES.some(m => m.id === id)) return 'games';
  if (id === 'workspace') return 'workspace';
  return 'home';
};
const STREAK_MODE = { id: 'streak', name: 'My Streak', Component: StreakTracker };
const WORKSPACE_MODE = { id: 'workspace', name: 'Notes & checklists', Component: Workspace };
const HOME_MODE = { id: 'home', name: 'Overview', Component: DashboardHome };
const MODES = [HOME_MODE, STUDY_TOOLS_MODE, GAME_ZONE_MODE, ...STUDY_MODES, ...GAME_MODES, STREAK_MODE, WORKSPACE_MODE];

export default function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tool');
  const isGame = id => GAME_MODES.some(mode => mode.id === id);
  const [currentPage, setCurrentPage] = useState(() => (MODES.some(m => m.id === requested && !isGame(requested)) ? requested : 'home'));
  // A game in the URL starts on its Radar entry in the first render, so the game never shows first.
  const [entering, setEntering] = useState(() => (requested && isGame(requested) ? requested : null));
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const selectedMode = MODES.find(mode => mode.id === currentPage) || MODES[0];
  const ModeComponent = selectedMode.Component;

  // A tool link or a game link selects that screen. A game link always goes through the Radar entry.
  useEffect(() => {
    if (!requested) return;
    if (isGame(requested)) setEntering(requested);
    else if (MODES.some(m => m.id === requested)) setCurrentPage(requested);
  }, [requested]);

  const open = id => {
    setCurrentPage(id);
    if (id === 'home') {
      if (params.get('tool')) setParams({}, { replace: true });
      return;
    }
    if (params.get('tool') !== id) setParams({ tool: id }, { replace: true });
  };

  // Games pass through the Radar entry first; study tools open directly.
  const choose = id => {
    if (isGame(id)) {
      setEntering(id);
      return;
    }
    open(id);
  };

  const onSignOut = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (!profileOpen) return undefined;
    const outside = event => { if (!profileRef.current?.contains(event.target)) setProfileOpen(false); };
    const escape = event => { if (event.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [profileOpen]);


  return (
    <div className="app eureka-app dashboard">
      <SiteBackground />
      {entering && (
        <GameEntry
          gameName={GAME_MODES.find(mode => mode.id === entering)?.name || 'game'}
          onDone={() => { const id = entering; setEntering(null); open(id); }}
        />
      )}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <Link to="/" className="dashboard-brand">EUREKA</Link>
          <nav className="dashboard-tabs" aria-label="Main">
            {TABS.map(tab => {
              const active = sectionOf(currentPage) === tab.key;
              return (
                <button key={tab.key} type="button" className={`dashboard-tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => choose(tab.target)}>
                  {tab.label}
                </button>
              );
            })}
          </nav>
          <nav className="dashboard-nav" aria-label="Account">
            <Link to="/focus" className="dashboard-focus-link">Focus Mode</Link>
            <div className="profile-menu-wrap" ref={profileRef}>
              <button type="button" className="profile-menu-trigger" aria-label="Account menu" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-1.5a7 7 0 0 1 14 0V21z"/></svg>
              </button>
              {profileOpen && <div className="profile-menu" role="menu">
                <Link role="menuitem" to="/profile" onClick={() => setProfileOpen(false)}>My Profile</Link>
                <button role="menuitem" type="button" onClick={onSignOut}>Sign out</button>
              </div>}
            </div>
          </nav>
        </div>
      </header>

      <main className="eureka-workspace" id="eureka-workspace">
        <section className="eureka-main-content" aria-labelledby="selected-mode-title">
          <header className="eureka-content-heading">
            <div>
              <div className="eureka-content-eyebrow">
                {sectionOf(currentPage) === 'games' ? 'Game zone' : selectedMode.id === 'streak' ? 'Your progress' : selectedMode.id === 'workspace' ? 'Workspace' : 'Study tools'}
              </div>
              <h2 id="selected-mode-title">{selectedMode.name}</h2>
              {STUDY_MODES.some(m => m.id === currentPage) && (
                <button type="button" className="ghost-btn small" onClick={() => choose('study-tools')}>← All study tools</button>
              )}
            </div>
          </header>
          <div className="eureka-content-card">
            <ModeComponent onOpenGame={choose} onExit={() => choose(GAME_ZONE_MODE.id)} />
          </div>
        </section>
      </main>
    </div>
  );
}
