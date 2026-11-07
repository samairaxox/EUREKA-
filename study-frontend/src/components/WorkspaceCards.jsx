import { useEffect, useState } from 'react';
import { notesApi, checklistsApi } from '../api/workspace';
import { errorMessage } from '../api/client';
import { COLORS } from '../workspace/NoteEditor';
import { getDailyQuote } from '../quotes';

const colorHex = id => (COLORS.find(c => c.id === id) || COLORS[0]).hex;
const loadNotes = () => notesApi.list(false);
const loadChecklists = () => checklistsApi.list();

/** Loads one list. A failure stays inside its own card, so the rest of the dashboard keeps working. */
function useList(load) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  useEffect(() => {
    let live = true;
    load()
      .then(data => { if (live) setState({ status: 'ready', data, error: '' }); })
      .catch(err => { if (live) setState({ status: 'error', data: null, error: errorMessage(err, 'This could not be loaded.') }); });
    return () => { live = false; };
  }, [load]);
  return state;
}

export function NotesCard({ onOpen }) {
  const { status, data, error } = useList(loadNotes);
  return (
    <section className="dash-card dash-card--notes" aria-labelledby="dash-notes-title">
      <div className="dash-card-head">
        <h3 id="dash-notes-title">Notes</h3>
        <button type="button" className="ghost-btn small" onClick={() => onOpen?.('workspace')}>New note</button>
      </div>
      {status === 'loading' && <p className="progress-loading" role="status">Loading notes…</p>}
      {status === 'error' && <p className="error-msg" role="alert">{error}</p>}
      {status === 'ready' && data.length === 0 && <p className="profile-empty">No notes yet. Write your first one to see it here.</p>}
      {status === 'ready' && data.length > 0 && (
        <ul className="sticky-notes">
          {data.slice(0, 4).map((note, i) => (
            <li key={note.id}>
              <button type="button" className="sticky-note" style={{ background: colorHex(note.color), transform: `rotate(${i % 2 ? 0.8 : -0.9}deg)` }} onClick={() => onOpen?.('workspace')}>
                <span className="sticky-note-title">{note.title}</span>
                <span className="sticky-note-body">{note.body ? note.body.slice(0, 110) : 'No text yet'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ChecklistsCard({ onOpen }) {
  const { status, data, error } = useList(loadChecklists);
  return (
    <section className="dash-card dash-card--checklists" aria-labelledby="dash-checklists-title">
      <div className="dash-card-head">
        <h3 id="dash-checklists-title">Checklists</h3>
        <button type="button" className="ghost-btn small" onClick={() => onOpen?.('workspace')}>Open all</button>
      </div>
      {status === 'loading' && <p className="progress-loading" role="status">Loading checklists…</p>}
      {status === 'error' && <p className="error-msg" role="alert">{error}</p>}
      {status === 'ready' && data.length === 0 && <p className="profile-empty">No checklists yet.</p>}
      {status === 'ready' && data.length > 0 && (
        <ul className="sticky-checks">
          {data.slice(0, 3).map(list => (
            <li key={list.id}>
              <button type="button" className="sticky-check" style={{ background: colorHex(list.color) }} onClick={() => onOpen?.('workspace')}>
                <span className="sticky-check-title">{list.title}</span>
                <span className="sticky-check-count">{list.progress.done} of {list.progress.total} done</span>
                <span className="sticky-check-bar" aria-hidden="true"><span style={{ width: `${list.progress.percent}%` }} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DailyThought() {
  const quote = getDailyQuote();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`\u201C${quote.quote}\u201D \u2014 ${quote.author}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <figure className="dash-card dash-card--thought">
      <p className="sidebar-daily-quote-label">Today’s thought</p>
      <blockquote>{quote.quote}</blockquote>
      <figcaption>— {quote.author}</figcaption>
      <button type="button" className="quote-copy" onClick={copy} aria-label={copied ? 'Quote copied' : 'Copy quote'} title={copied ? 'Copied' : 'Copy quote'}>
        {copied ? <span aria-hidden="true">✓</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>}
        <span className="visually-hidden">{copied ? 'Copied' : 'Copy quote'}</span>
      </button>
    </figure>
  );
}
