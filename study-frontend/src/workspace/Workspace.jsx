import NotesPanel from './NotesPanel';
import ChecklistsPanel from './ChecklistsPanel';

/** Notes and checklists, saved to the account on the server. */
export default function Workspace() {
  return (
    <div className="workspace">
      <p className="workspace-lede">
        Saved to your account, so they follow you across devices. Swipe a note left to archive or delete,
        or use the buttons beside it.
      </p>
      <div className="workspace-columns">
        <NotesPanel />
        <ChecklistsPanel />
      </div>
    </div>
  );
}
