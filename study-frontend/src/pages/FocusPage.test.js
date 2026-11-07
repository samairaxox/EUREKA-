import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FocusPage from './FocusPage';
import { profileApi } from '../api/auth';
import { useProgress } from '../progress/ProgressContext';

jest.mock('../progress/ProgressContext', () => ({ useProgress: jest.fn() }));
jest.mock('../api/auth', () => ({ profileApi: { recordFocusSession: jest.fn() } }));
jest.mock('../components/FocusBackdrop', () => () => null);
jest.mock('../components/ProgressTransition', () => {
  const React = require('react');
  return function ImmediateProgressTransition({ onDone }) {
    React.useEffect(() => { onDone(); }, [onDone]);
    return null;
  };
});
jest.mock('../reactbits/Counter/Counter', () => ({ value }) => <span>{value}</span>);
jest.mock('../reactbits/GlitchText/GlitchText', () => ({ children }) => <>{children}</>);
jest.mock('../lib/motion', () => ({ usePrefersReducedMotion: () => true }));

function renderFocusPage() {
  const refresh = jest.fn().mockResolvedValue({ streak: { current: 1 } });
  useProgress.mockReturnValue({ progress: null, refresh });
  render(<MemoryRouter><FocusPage /></MemoryRouter>);
  return refresh;
}

async function startFocusSession() {
  await userEvent.click(screen.getByRole('button', { name: 'Start session' }));
  expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();
}

test('landing header separates and centers the back link and Focus Mode label', () => {
  renderFocusPage();

  const backLink = screen.getByRole('link', { name: '← Back to your study space' });
  const focusLabel = screen.getByText('Focus Mode');
  expect(backLink.closest('.focus-landing-header')).toBe(focusLabel.closest('.focus-landing-header'));
  expect(backLink).toHaveClass('focus-back');
  expect(focusLabel).toHaveClass('focus-mode-label');
  expect(screen.getByRole('heading', { name: 'Ready to lock in?' })).toBeInTheDocument();
});

test('Keep going closes confirmation and leaves the current session running', async () => {
  renderFocusPage();
  await startFocusSession();
  await userEvent.click(screen.getByRole('button', { name: 'End session' }));

  const dialog = screen.getByRole('alertdialog', { name: 'End this session?' });
  expect(dialog).toHaveAttribute('aria-describedby', 'focus-confirm-description');
  expect(dialog.querySelector('.focus-confirm-card')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  expect(profileApi.recordFocusSession).not.toHaveBeenCalled();
});

test('End session exits without recording an incomplete session or changing the streak', async () => {
  const refresh = renderFocusPage();
  await startFocusSession();
  await userEvent.click(screen.getByRole('button', { name: 'End session' }));

  const endButtons = screen.getAllByRole('button', { name: 'End session' });
  await userEvent.click(endButtons[endButtons.length - 1]);

  expect(await screen.findByRole('heading', { name: 'Session ended early.' })).toBeInTheDocument();
  expect(screen.getByText('Unfinished sessions are not recorded. Your streak is unchanged.')).toBeInTheDocument();
  expect(profileApi.recordFocusSession).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});
