import summarizerImg from '../assets/agent-summarizer.png';
import quizImg from '../assets/agent-quiz.png';
import flashcardsImg from '../assets/agent-flashcards.png';
import practiceTestImg from '../assets/agent-practice-test.png';
import plannerImg from '../assets/agent-planner.png';
import pdfStudyImg from '../assets/agent-pdf-study.png';

/**
 * The study tools that exist in EUREKA. Every description here matches what the corresponding
 * screen does today; nothing describes a capability the application does not have.
 */
export const AGENTS = [
  {
    id: 'summarizer', name: 'Summarizer', role: 'Condenses notes',
    description: 'Paste your notes and receive one short summary plus five key points.',
    takes: 'Pasted study notes', returns: 'A summary paragraph and five key points',
    accent: '#5B4FCF', tint: '#E9E4F7',
    image: summarizerImg, alt: 'Summarizer: illustration of an open book with notes',
  },
  {
    id: 'quiz', name: 'Quiz', role: 'Checks understanding',
    description: 'Generate multiple-choice questions on any topic and reveal answers as you go.',
    takes: 'A topic and a question count', returns: 'Multiple-choice questions with answer reveal',
    accent: '#8A5CC9', tint: '#EFE6F7',
    image: quizImg, alt: 'Quiz: illustration for checking understanding',
  },
  {
    id: 'flashcards', name: 'Flashcards', role: 'Builds recall',
    description: 'Turn a topic into term and definition cards you can flip through.',
    takes: 'A topic and a card count', returns: 'Front and back cards',
    accent: '#3F6FB8', tint: '#DCE6F8',
    image: flashcardsImg, alt: 'Flashcards: illustration for building recall',
  },
  {
    id: 'practice-test', name: 'Practice Test', role: 'Simulates an exam',
    description: 'A timed set of questions that scores your answers at the end.',
    takes: 'A topic', returns: 'A timed test with a final score',
    accent: '#B5557A', tint: '#F6DDE6',
    image: practiceTestImg, alt: 'Practice Test: illustration for a timed exam',
  },
  {
    id: 'planner', name: 'Study Planner', role: 'Schedules revision',
    description: 'Build a day-by-day plan between today and your exam date, then download it as a PDF.',
    takes: 'A topic, a start date, and an exam date', returns: 'A dated schedule and a PDF export',
    accent: '#A08A1F', tint: '#F7EBB8',
    image: plannerImg, alt: 'Study Planner: illustration for scheduling revision',
  },
  {
    id: 'rag', name: 'PDF Study', role: 'Works from your document',
    description: 'Upload a PDF and generate a quiz, summary, flashcards, or plan from its contents only.',
    takes: 'A PDF file', returns: 'Material generated from that document',
    accent: '#2F7F78', tint: '#D6EFEC',
    image: pdfStudyImg, alt: 'PDF Study: illustration for studying from a document',
  },
];
