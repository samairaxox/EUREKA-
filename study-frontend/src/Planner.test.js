import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Planner from './Planner';
import { api } from './api/client';

jest.mock('./api/client', () => ({ api: { post: jest.fn() }, LONG_AI_TIMEOUT_MS: 300000 }));
jest.mock('./PdfUpload', () => ({ onFile }) => (
  <button type="button" onClick={() => onFile(new File(['pdf bytes'], 'notes.pdf', { type: 'application/pdf' }))}>
    Upload test PDF
  </button>
));
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('jspdf-autotable', () => jest.fn());

beforeEach(() => jest.clearAllMocks());

test('renders schedule date, task, and duration from the API response', async () => {
  api.post.mockResolvedValue({
    data: {
      schedule: [{
        day: 'Day 1', date: '19-11-2026', task: 'Review algebra equations', duration: '1 hour',
      }],
    },
  });
  render(<Planner />);

  fireEvent.change(screen.getByLabelText('Subject / Topic'), { target: { value: 'Algebra' } });
  fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-11-19' } });
  fireEvent.change(screen.getByLabelText('Exam Date'), { target: { value: '2026-11-19' } });
  fireEvent.click(screen.getByRole('button', { name: 'GENERATE' }));

  expect(await screen.findByText('19 Nov')).toBeInTheDocument();
  expect(screen.getByText('Review algebra equations')).toBeInTheDocument();
  expect(screen.getByText('1 hour')).toBeInTheDocument();
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/plan', {
    topic: 'Algebra', exam_date: '2026-11-19', start_date: '2026-11-19',
  }, expect.objectContaining({ timeout: expect.any(Number) })));
});

test('shows a clear error instead of rendering blank task and duration cells', async () => {
  api.post.mockResolvedValue({ data: { schedule: [{ day: 'Day 1', date: '2026-11-19' }] } });
  render(<Planner />);
  fireEvent.change(screen.getByLabelText('Subject / Topic'), { target: { value: 'Algebra' } });
  fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-11-19' } });
  fireEvent.change(screen.getByLabelText('Exam Date'), { target: { value: '2026-11-19' } });
  fireEvent.click(screen.getByRole('button', { name: 'GENERATE' }));
  expect(await screen.findByText(/Schedule details were missing/)).toBeInTheDocument();
  expect(document.querySelector('#schedule-table')).not.toBeInTheDocument();
});

test('routes uploaded PDFs through FAISS and renders the full-document schedule', async () => {
  api.post
    .mockResolvedValueOnce({ data: { session_id: 'owned-faiss-session' } })
    .mockResolvedValueOnce({ data: { schedule: [{
      day: 'Day 1', date: '2026-11-19', task: 'Study cell structure', duration: '1 hour',
      topics: ['Cell membrane'], pages: [3, 4],
    }] } });
  render(<Planner />);

  fireEvent.click(screen.getByRole('button', { name: 'Upload test PDF' }));
  await waitFor(() => expect(api.post).toHaveBeenNthCalledWith(1, '/rag/upload', expect.any(FormData), expect.objectContaining({
    timeout: expect.any(Number),
  })));
  fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-11-19' } });
  fireEvent.change(screen.getByLabelText('Exam Date'), { target: { value: '2026-11-19' } });
  fireEvent.click(screen.getByRole('button', { name: 'GENERATE' }));

  expect(await screen.findByText('Study cell structure')).toBeInTheDocument();
  expect(screen.getByText('Topics: Cell membrane')).toBeInTheDocument();
  expect(api.post).toHaveBeenNthCalledWith(2, '/rag/plan', {
    session_id: 'owned-faiss-session', exam_date: '2026-11-19', start_date: '2026-11-19',
  }, expect.objectContaining({ timeout: expect.any(Number) }));
});
