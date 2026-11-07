import { Link } from 'react-router-dom';

/** Entry page shown before any game: title, artwork, instructions, scoring, best score, and Start. */
export function GameIntro({ title, art, artAlt, description, instructions, scoring, best, onStart, onExit }) {
  return (
    <section className="game-intro" aria-labelledby="game-intro-title">
      <div className="game-intro-art">
        <img src={art} alt={artAlt} loading="lazy" />
      </div>
      <div className="game-intro-copy">
        <p className="eyebrow">Game zone</p>
        <h2 id="game-intro-title" className="game-intro-title">{title}</h2>
        <p className="game-intro-desc">{description}</p>
        <h3 className="game-intro-sub">How to play</h3>
        <ul className="game-intro-list">{instructions.map(item => <li key={item}>{item}</li>)}</ul>
        <h3 className="game-intro-sub">How scoring works</h3>
        <ul className="game-intro-list">{scoring.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="game-best">Best score on this device: <strong>{best}</strong></p>
        <div className="game-actions">
          <button type="button" className="focus-start" onClick={onStart}>Start game</button>
          <button type="button" className="ghost-btn" onClick={onExit}>Back to Game Zone</button>
        </div>
      </div>
    </section>
  );
}

/** Results screen: final score, best, statistics, and replay / return actions. */
export function GameResults({ title, score, best, newBest, stats, onReplay, onExit }) {
  return (
    <section className="game-results" aria-labelledby="game-results-title" role="status">
      <p className="eyebrow">Game over</p>
      <h2 id="game-results-title" className="game-results-title">{title}</h2>
      <p className="game-results-score"><span>{score}</span> points</p>
      <p className="game-best">
        {newBest ? 'New best score on this device!' : `Best score on this device: ${best}`}
      </p>
      <dl className="game-stats">
        {stats.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <div className="game-actions">
        <button type="button" className="focus-start" onClick={onReplay}>Play again</button>
        <button type="button" className="ghost-btn" onClick={onExit}>Back to Game Zone</button>
      </div>
    </section>
  );
}

/** Used by the Game Zone hub and the games' own exit buttons. */
export function ReturnLink({ to, children }) {
  return <Link to={to} className="focus-link">{children}</Link>;
}
