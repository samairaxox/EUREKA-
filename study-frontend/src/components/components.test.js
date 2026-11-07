import { render, screen } from '@testing-library/react';
import AiThinking from './AiThinking';
import WelcomeGreeting from './WelcomeGreeting';
import StudyDaysChart from './StudyDaysChart';
import { AGENTS } from '../landing/agentData';

test('AI status line renders only while a request is active', () => {
  const { container, rerender } = render(<AiThinking active={false} label="Preparing your summary…" />);
  expect(container).toBeEmptyDOMElement();
  rerender(<AiThinking active label="Preparing your summary…" />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  rerender(<AiThinking active={false} label="Preparing your summary…" />);
  expect(container).toBeEmptyDOMElement();
});

test('greeting uses the real name and never a placeholder', () => {
  const { rerender } = render(<WelcomeGreeting name="Mira Rao" />);
  expect(screen.getByRole('heading', { level: 1, name: 'Welcome back, Mira Rao.' })).toBeInTheDocument();
  rerender(<WelcomeGreeting name="   " />);
  expect(screen.getByRole('heading', { level: 1, name: 'Welcome back.' })).toBeInTheDocument();
});

test('study chart is honest about empty history', () => {
  render(<StudyDaysChart studyDates={[]} today="2026-10-16" />);
  expect(screen.getByText(/No study days recorded in the last 12 weeks yet/)).toBeInTheDocument();
});

test('study chart counts only recorded study days', () => {
  render(<StudyDaysChart studyDates={['2026-10-14', '2026-10-15']} today="2026-10-16" />);
  expect(screen.getByRole('img')).toHaveAccessibleName(/2 study days in total/);
});

test('every agent has its own picture and meaningful alt text', () => {
  const images = AGENTS.map(agent => agent.image);
  expect(images.every(Boolean)).toBe(true);
  expect(new Set(images).size).toBe(AGENTS.length);
  AGENTS.forEach(agent => expect(agent.alt).toMatch(/\S/));
});
