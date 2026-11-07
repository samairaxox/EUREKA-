import { useCallback, useEffect, useState } from 'react';
import SwipeRow from '../reactbits/SwipeRow/SwipeRow';
import { errorMessage } from '../api/client';
import { notesApi } from '../api/workspace';
import NoteEditor, { COLORS } from './NoteEditor';

const ROW_ACTIONS = [
  { id: 'archive', label: 'Archive' },
  { id: 'delete', label: 'Delete' },
];

export default function NotesPanel() {
  const [notes, setNotes] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | note
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setNotes(await notesApi.list(showArchived));
    } catch (err) {
      setError(errorMessage(err, 'Your notes could not be loaded.'));
      setNotes([]);
    }
  }, [showArchived]);

  useEffect(() => { load(); }, [load]);

  const colorOf = id => COLORS.find(c => c.id === id)?.hex || COLORS[0].hex;

  const archiveNote = async note => {
    try {
      await notesApi.update(note.id, { archived: !note.archived });
      setNotice(note.archived ? 'Note restored.' : 'Note archived.');
      load();
    } catch (err) {
      setError(errorMessage(err, 'The note could not be archived.'));
    }
  };

  const deleteNote = async note => {
    if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
    try {
      await notesApi.remove(note.id);
      setNotice('Note deleted.');
      load();
    } catch (err) {
      setError(errorMessage(err, 'The note could not be deleted.'));
    }
  };

  const onRowAction = (note, action) => {
    if (action.id === 'archive') archiveNote(note);
    if (action.id === 'delete') deleteNote(note);
  };

  if (editing) {
    return (
      <NoteEditor
        note={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); setNotice('Note saved.'); load(); }}
      />
    );
  }

  return (
    <section className="workspace-section" aria-labelledby="notes-heading">
      <div className="workspace-section-head">
        <h3 id="notes-heading">Notes</h3>
        <div className="workspace-section-actions">
          <button type="button" className="ghost-btn" onClick={() => setShowArchived(v => !v)} aria-pressed={showArchived}>
            {showArchived ? 'Show active' : 'Show archived'}
          </button>
          <button type="button" className="submit-btn" onClick={() => setEditing('new')}>New note</button>
        </div>
      </div>
      {notice && <p className="form-status" role="status">{notice}</p>}
      {error && <p className="error-msg" role="alert">{error}</p>}

      {notes === null && <p className="progress-loading" role="status">Loading your notes…</p>}
      {notes !== null && notes.length === 0 && !error && (
        <p className="profile-empty">{showArchived ? 'No archived notes.' : 'No notes yet. Start one with “New note”.'}</p>
      )}

      {notes && notes.length > 0 && (
        <ul className="note-list">
          {notes.map(note => (
            <li key={note.id} className="note-list-item">
              <SwipeRow
                label={`Note: ${note.title}`}
                actions={ROW_ACTIONS.map(action => action.id === 'archive'
                  ? { ...action, label: note.archived ? 'Restore' : 'Archive' }
                  : action)}
                actionColor="#5B4FCF"
                drawerColor="#2B2640"
                rowColor={colorOf(note.color)}
                textColor="#2B2640"
                height={84}
                radius={14}
                onAction={action => onRowAction(note, action)}
                onCommit={action => onRowAction(note, action)}
              >
                <div className="note-row">
                  <button type="button" className="note-row-open" onClick={() => setEditing(note)}>
                    <span className="note-row-title">{note.title}</span>
                    <span className="note-row-preview">{note.body ? note.body.slice(0, 120) : 'No text yet'}</span>
                  </button>
                </div>
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}
      <p className="workspace-hint">Swipe a note left to reveal actions. Keyboard: Tab to a note’s “2 actions” control and press Enter or Space, then choose Archive or Delete.</p>
    </section>
  );
}
