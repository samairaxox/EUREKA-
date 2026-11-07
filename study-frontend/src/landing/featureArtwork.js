
import { AGENTS } from './agentData';

import summarizerImg from '../assets/summarizer.jpg';
import flashcardsImg from '../assets/flashcards.jpg';
import plannerImg from '../assets/planner.png';
import quizzesImg from '../assets/quiz.jpg';
import practiceTestImg from '../assets/practice-test.jpg';
import pdfStudyImg from '../assets/pdf-study.jpg';
import gamesImg from '../assets/games.png';
import streaksImg from '../assets/streak.png';
import focusImg from '../assets/focus.png';

/**
 * Landing-page feature tiles.
 * Keep these paths aligned with the actual files in src/assets.
 */
export const FEATURE_TILES = [
  {
    image: summarizerImg,
    title: 'Summarizer',
    href: '/app?tool=summarizer',
  },
  {
    image: flashcardsImg,
    title: 'Flashcards',
    href: '/app?tool=flashcards',
  },
  {
    image: plannerImg,
    title: 'Study Planner',
    href: '/app?tool=planner',
  },
  {
    image: quizzesImg,
    title: 'Quiz',
    href: '/app?tool=quiz',
  },
  {
    image: practiceTestImg,
    title: 'Practice Test',
    href: '/app?tool=practice-test',
  },
  {
    image: pdfStudyImg,
    title: 'PDF Study',
    href: '/app?tool=rag',
  },
  {
    image: gamesImg,
    title: 'Study Games',
    href: '/app?tool=answer-rush',
  },
  {
    image: streaksImg,
    title: 'Streaks & Progress',
    href: '/app?tool=streak',
  },
  {
    image: focusImg,
    title: 'Focus Mode',
    href: '/focus',
  },
];

/**
 * Items for the landing-page ChromaGrid.
 * agentArtwork() remains responsible for the six study-agent images.
 */
export const AGENT_CHROMA_ITEMS = AGENTS.map((agent, index) => ({
  image: agent.image,
  title: agent.name,
  subtitle: agent.role,
  handle: agent.id,
  location: agent.takes,
  borderColor: agent.accent,
  gradient: `linear-gradient(145deg, ${agent.tint}, #FBF8F2)`,
  url: `/app?tool=${agent.id}`,
}));
