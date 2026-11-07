import { useState } from 'react';
import { errorMessage } from '../api/client';
import { notesApi } from '../api/workspace';

export const COLORS = [
  { id: 'lavender', label: 'Lavender', hex: '#E9E4F7' },
  { id: 'butter', label: 'Butter', hex: '#F7EBB8' },
  { id: 'blush', label: 'Blush', hex: '#EDCFCB' },
  { id: 'powder', label: 'Powder blue', hex: '#DCE6F8' },
  { id: 'sage', label: 'Sage', hex: '#DDEBD9' },
];

export default function NoteEditor({ note, onSaved, onCancel }) {
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [color, setColor] = useState(note?.color || 'lavender');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async event => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Give your note a title.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { title: title.trim(), body, color };
      const saved = note ? await notesApi.update(note.id, payload) : await notesApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, 'The note could not be saved. Your text is still here; try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="note-editor" onSubmit={save} style={{ background: COLORS.find(c => c.id === color)?.hex }}>
      <label className="field-label-block">
        <span>Title</span>
        <input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} required />
      </label>
      <label className="field-label-block">
        <span>Note</span>
        <textarea rows={6} value={body} maxLength={20000} onChange={e => setBody(e.target.value)} />
      </label>
      <div className="note-colors" role="group" aria-label="Note colour">
        {COLORS.map(c => (
          <button key={c.id} type="button" aria-pressed={color === c.id} aria-label={c.label}
            className={`note-swatch${color === c.id ? ' is-active' : ''}`} style={{ background: c.hex }}
            onClick={() => setColor(c.id)} />
        ))}
      </div>
      {error && <p className="error-msg" role="alert">{error}</p>}
      <div className="note-editor-actions">
        <button type="submit" className="submit-btn" disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
        <button type="button" className="ghost-btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
