import { useCallback, useEffect, useState } from 'react';
import SpringCheck from '../reactbits/SpringCheck/SpringCheck';
import { errorMessage } from '../api/client';
import { checklistsApi } from '../api/workspace';
import { COLORS } from './NoteEditor';

function ChecklistCard({ checklist, onChanged, onError }) {
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const colorHex = COLORS.find(c => c.id === checklist.color)?.hex || COLORS[1].hex;
  const { progress } = checklist;

  const run = async (fn, fallback) => {
    setBusy(true);
    try {
      onChanged(await fn());
    } catch (err) {
      onError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const addItem = event => {
    event.preventDefault();
    if (!newItem.trim()) return;
    run(() => checklistsApi.addItem(checklist.id, newItem.trim()).then(c => { setNewItem(''); return c; }), 'The item could not be added.');
  };

  const toggle = (item, done) => run(() => checklistsApi.updateItem(checklist.id, item.id, { done }), 'The item could not be updated.');
  const saveEdit = item => {
    if (!editText.trim()) return;
    run(() => checklistsApi.updateItem(checklist.id, item.id, { text: editText.trim() }).then(c => { setEditingId(null); return c; }), 'The item could not be saved.');
  };
  const removeItem = item => run(() => checklistsApi.removeItem(checklist.id, item.id), 'The item could not be removed.');
  const deleteList = () => {
    if (!window.confirm(`Delete the checklist “${checklist.title}”?`)) return;
    checklistsApi.remove(checklist.id).then(() => onChanged(null)).catch(err => onError(errorMessage(err, 'The checklist could not be deleted.')));
  };

  return (
    <article className="checklist-card" style={{ background: colorHex }} aria-label={`Checklist: ${checklist.title}`}>
      <header className="checklist-head">
        <h4>{checklist.title}</h4>
        <button type="button" className="ghost-btn small danger" onClick={deleteList}>Delete</button>
      </header>
      <div className="checklist-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={progress.percent} aria-label={`${progress.done} of ${progress.total} done`}>
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="checklist-progress-label">{progress.done} of {progress.total} done</p>

      <ul className="checklist-items">
        {checklist.items.map(item => (
          <li key={item.id} className="checklist-item">
            {editingId === item.id ? (
              <form className="checklist-edit" onSubmit={e => { e.preventDefault(); saveEdit(item); }}>
                <input value={editText} maxLength={300} onChange={e => setEditText(e.target.value)} aria-label="Item text" autoFocus />
                <button type="submit" className="ghost-btn small" disabled={busy}>Save</button>
                <button type="button" className="ghost-btn small" onClick={() => setEditingId(null)}>Cancel</button>
              </form>
            ) : (
              <>
                <SpringCheck
                  label={item.text}
                  checked={item.done}
                  onChange={done => toggle(item, done)}
                  disabled={busy}
                  color="#2B2640"
                  fillColor="#5B4FCF"
                  checkColor="#FBF8F2"
                />
                <span className="checklist-item-buttons">
                  <button type="button" className="ghost-btn small" onClick={() => { setEditingId(item.id); setEditText(item.text); }}>Edit</button>
                  <button type="button" className="ghost-btn small danger" onClick={() => removeItem(item)}>Remove</button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      {checklist.items.length === 0 && <p className="profile-empty">No items yet.</p>}

      <form className="checklist-add" onSubmit={addItem}>
        <input value={newItem} maxLength={300} placeholder="Add an item" aria-label="New checklist item"
          onChange={e => setNewItem(e.target.value)} />
        <button type="submit" className="ghost-btn small" disabled={busy || !newItem.trim()}>Add</button>
      </form>
    </article>
  );
}

export default function ChecklistsPanel() {
  const [lists, setLists] = useState(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setLists(await checklistsApi.list());
    } catch (err) {
      setError(errorMessage(err, 'Your checklists could not be loaded.'));
      setLists([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async event => {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await checklistsApi.create({ title: title.trim() });
      setTitle('');
      load();
    } catch (err) {
      setError(errorMessage(err, 'The checklist could not be created.'));
    }
  };

  // Replace one card with the server's latest version, or reload if it was deleted.
  const onChanged = (updated, id) => {
    if (updated === null) return load();
    setLists(current => current.map(c => (c.id === (updated.id ?? id) ? updated : c)));
  };

  return (
    <section className="workspace-section" aria-labelledby="checklists-heading">
      <div className="workspace-section-head">
        <h3 id="checklists-heading">Checklists</h3>
      </div>
      <form className="checklist-create" onSubmit={create}>
        <input value={title} maxLength={120} placeholder="New checklist title" aria-label="New checklist title"
          onChange={e => setTitle(e.target.value)} />
        <button type="submit" className="submit-btn" disabled={!title.trim()}>Create checklist</button>
      </form>
      {error && <p className="error-msg" role="alert">{error}</p>}
      {lists === null && <p className="progress-loading" role="status">Loading your checklists…</p>}
      {lists !== null && lists.length === 0 && !error && <p className="profile-empty">No checklists yet.</p>}
      <div className="checklist-grid">
        {lists && lists.map(list => (
          <ChecklistCard key={list.id} checklist={list}
            onChanged={updated => onChanged(updated, list.id)} onError={setError} />
        ))}
      </div>
    </section>
  );
}
