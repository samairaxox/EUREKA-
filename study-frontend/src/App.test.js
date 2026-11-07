import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProgressProvider } from './progress/ProgressContext';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import ProtectedRoute from './components/ProtectedRoute';
import { AGENTS } from './components/AgentCarousel';
import { errorMessage } from './api/client';
import { toLocalDateString } from './streak';
import { makeYearGrid } from './StreakTracker';

function renderWithProviders(ui, route = '/') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>
        <ProgressProvider>{ui}</ProgressProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
}

test('landing page presents EUREKA and a clear call to action', async () => {
  renderWithProviders(<LandingPage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Eureka' })).toBeInTheDocument();
  expect(screen.getAllByText(/Every question opens a new line of/).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link', { name: /get started|sign in/i }).length).toBeGreaterThan(0);
});

test('the carousel lists only the real study tools', () => {
  expect(AGENTS.map(a => a.id)).toEqual(['summarizer', 'quiz', 'flashcards', 'practice-test', 'planner', 'rag']);
});

test('protected routes send signed-out visitors to sign in', async () => {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/app']}>
        <ProgressProvider>
          <Routes>
            <Route path="/app" element={<ProtectedRoute><p>secret study space</p></ProtectedRoute>} />
            <Route path="/signin" element={<p>sign-in screen</p>} />
          </Routes>
        </ProgressProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
  expect(await screen.findByText('sign-in screen')).toBeInTheDocument();
  expect(screen.queryByText('secret study space')).not.toBeInTheDocument();
});

test('sign-in shows Google as not configured when no client ID is set', async () => {
  renderWithProviders(<SignInPage />, '/signin');
  expect(await screen.findByText(/Google sign-in is not configured yet/i)).toBeInTheDocument();
});

test('session expiry and network failures produce readable messages', () => {
  expect(errorMessage({ response: undefined }, 'x')).toMatch(/could not reach/i);
  expect(errorMessage({ response: { status: 401, data: { detail: 'Incorrect email or password.' } } }))
    .toBe('Incorrect email or password.');
  expect(errorMessage({ response: { status: 429, data: { detail: 'Too many requests.' } } })).toBe('Too many requests.');
});

test('streak calendar grid covers 365 real calendar days ending today', () => {
  const grid = makeYearGrid('2026-10-16').filter(Boolean);
  expect(grid).toHaveLength(365);
  expect(grid[grid.length - 1]).toBe('2026-10-16');
  expect(toLocalDateString(new Date(2026, 9, 16, 9))).toBe('2026-10-16');
});
