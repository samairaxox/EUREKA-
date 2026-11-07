import { AGENTS } from '../landing/agentData';

/** Study Tools overview. Each card opens the real tool; no tool is duplicated or renamed. */
export default function StudyToolsHub({ onOpenGame }) {
  return (
    <section className="tools-hub" aria-labelledby="tools-hub-title">
      <h2 id="tools-hub-title" className="visually-hidden">Study tools</h2>
      <p className="panel-desc">Six tools, each built for one kind of study task.</p>
      <div className="tools-hub-grid">
        {AGENTS.map(agent => (
          <article key={agent.id} className="tools-hub-card">
            <div className="tools-hub-art"><img src={agent.image} alt={agent.alt} loading="lazy" /></div>
            <h3>{agent.name}</h3>
            <p>{agent.description}</p>
            <button type="button" className="submit-btn" onClick={() => onOpenGame?.(agent.id)}>Open {agent.name}</button>
          </article>
        ))}
      </div>
    </section>
  );
}
