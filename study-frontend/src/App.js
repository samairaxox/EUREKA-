import { useState } from 'react';
import Summarizer from './Summarizer';
import Planner from './Planner';
import Quiz from './Quiz';
import Flashcards from './Flashcards';
import RagStudy from './RagStudy';
import PracticeTest from './PracticeTest';
import AnswerRush from './AnswerRush';
import './App.css';

const TABS = [
  { id: 'summarizer', label: 'Summarizer'  },
  { id: 'planner',    label: 'Planner'     },
  { id: 'quiz',       label: 'Quiz'        },
  { id: 'flashcards', label: 'Flashcards'  },
  { id: 'rag',        label: 'RAG Study'   },
  { id: 'practice-test', label: 'Practice Test' },
  { id: 'answer-rush', label: '⚡ Answer Rush' },
];

const AGENTS = [
  {
    id: 'summarizer',
    mono: 'Summarizer Agent',
    title: 'Note Summarizer',
    desc: 'Paste any study material. Get a crisp paragraph summary and 5 key points extracted by AI.',
  },
  {
    id: 'planner',
    mono: 'Planner Agent',
    title: 'Study Planner',
    desc: 'Enter a topic and your exam date. Get a day-by-day revision schedule built around your timeline.',
  },
  {
    id: 'quiz',
    mono: 'Quiz Agent — EUREKA',
    title: 'MCQ Quiz',
    desc: 'Enter any topic. Get 5 multiple-choice questions with instant answer reveal and score tracking.',
  },
  {
    id: 'flashcards',
    mono: 'Flashcard Agent — EUREKA',
    title: 'Flashcards',
    desc: 'Enter a topic. Get 10 flip-cards with terms on the front and explanations on the back.',
  },
  {
    id: 'rag',
    mono: 'RAG Engine — EUREKA',
    title: 'PDF RAG Study',
    desc: 'Upload any PDF. The AI indexes it with FAISS and generates quizzes or summaries directly from your document.',
  },
  {
    id: 'practice-test',
    mono: 'Practice Test — EUREKA',
    title: 'Timed Practice Test',
    desc: 'Take a timed test, answer one question at a time, and review your score and explanations at the end.',
  },
  {
    id: 'answer-rush',
    mono: 'Answer Rush — EUREKA',
    title: '⚡ Answer Rush',
    desc: 'Race through ten rapid-fire questions, earn points, and build your streak before the clock runs out.',
  },
];

const PANEL_META = {
  summarizer: { mono: 'Summarizer Agent', title: 'Distil your notes into essentials'      },
  planner:    { mono: 'Planner Agent',    title: 'Build your revision schedule'            },
  quiz:       { mono: 'Quiz Agent',       title: 'Test your understanding'                 },
  flashcards: { mono: 'Flashcard Agent',  title: 'Review with flip-cards'                  },
  rag:        { mono: 'RAG Engine',       title: 'Quiz & summarise your own PDF documents' },
  'practice-test': { mono: 'Practice Test', title: 'Take a timed test and review your answers' },
  'answer-rush': { mono: 'Answer Rush', title: 'Think fast. Keep the streak alive.' },
};

function App() {
  const [activeTab, setActiveTab] = useState('summarizer');

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-name">StudyMind</span>
          <span className="logo-tag">AI</span>
        </div>
        <nav className="nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="hero">
        <div className="hero-left">
          <div className="hero-eyebrow">Seven study tools — one platform</div>
          <h1 className="hero-title">
            Study Smarter.<br /><em>Not Harder.</em>
          </h1>
          <p className="hero-sub">
            A unified multi-agent study platform. Summarise notes, plan your revision,
            test yourself with quizzes, timed practice tests, and Answer Rush, drill concepts with flashcards,
            and study PDFs — all powered by Gemini AI and LangGraph.
          </p>
        </div>
        <div className="hero-right">
          <div className="hero-divider">
            <div className="hero-divider-line" />
            <span className="hero-divider-label">How it works</span>
            <div className="hero-divider-line" />
          </div>
          {[
            { n: '01', title: 'Choose a tool', desc: 'Pick from Summarizer, Planner, Quiz, Flashcards, RAG Study, Practice Test, or Answer Rush below.' },
            { n: '02', title: 'Provide input',   desc: 'Enter your notes, topic, or exam date depending on the agent.' },
            { n: '03', title: 'Get results',     desc: 'Gemini AI processes your input and returns structured output instantly.' },
          ].map(s => (
            <div key={s.n} className="hiw-step">
              <span className="hiw-num">{s.n}</span>
              <div className="hiw-content">
                <div className="hiw-title">{s.title}</div>
                <div className="hiw-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="agents-section">
        <div className="agents-grid">
          {AGENTS.map(a => (
            <div
              key={a.id}
              className={`agent-card ${activeTab === a.id ? 'active' : ''}`}
              onClick={() => setActiveTab(a.id)}
            >
              <div className="agent-accent" />
              <div className="agent-body">
                <div className="agent-mono">{a.mono}</div>
                <div className="agent-title">{a.title}</div>
                <div className="agent-desc">{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="tool-section">
        <div className="tool-panel">
          <div className="panel-header">
            <div className="panel-header-accent" />
            <div className="panel-header-body">
              <div className="panel-mono">{PANEL_META[activeTab].mono}</div>
              <div className="panel-title">{PANEL_META[activeTab].title}</div>
            </div>
          </div>
          <div className="panel-body">
            {activeTab === 'summarizer' && <Summarizer />}
            {activeTab === 'planner'    && <Planner />}
            {activeTab === 'quiz'       && <Quiz />}
            {activeTab === 'flashcards' && <Flashcards />}
            {activeTab === 'rag'        && <RagStudy />}
            {activeTab === 'practice-test' && <PracticeTest />}
            {activeTab === 'answer-rush' && <AnswerRush />}
          </div>
        </div>
      </section>

      <footer className="footer">
        <span className="footer-left">FastAPI · LangChain · LangGraph · FAISS · HuggingFace · Groq · React</span>
        <span className="footer-right">v4.0</span>
      </footer>
    </div>
  );
}

export default App;
