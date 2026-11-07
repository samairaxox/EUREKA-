import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProgressTransition from './ProgressTransition';
import WelcomePage from '../pages/WelcomePage';
import { AuthProvider } from '../auth/AuthContext';

test('progress transition finishes on its own and reports completion', () => {
  jest.useFakeTimers();
  const onDone = jest.fn();
  render(<ProgressTransition label="Starting" duration={500} onDone={onDone} />);
  expect(screen.getByRole('status')).toHaveTextContent('Starting');
  act(() => { jest.advanceTimersByTime(600); });
  expect(onDone).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('progress transition offers an explicit skip', () => {
  const onSkip = jest.fn();
  render(<ProgressTransition label="Opening" duration={60000} onDone={() => {}} onSkip={onSkip} />);
  screen.getByRole('button', { name: 'Continue' }).click();
  expect(onSkip).toHaveBeenCalled();
});

test('welcome screen uses no placeholder name when the user has none', () => {
  // Without a signed-in user the greeting is the plain form, never an invented name.
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[{ pathname: '/welcome', state: { from: '/app' } }]}>
        <WelcomePage />
      </MemoryRouter>
    </AuthProvider>,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Hello\.?$/);
});
