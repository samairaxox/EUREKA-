import { useState } from 'react';
import answerRushArt from '../assets/answer-rush.png';
import triviaArt from '../assets/trivia.png';
import gamesArt from '../assets/games.png';
import quizArt from '../assets/quiz.jpg';
import { readBest } from './highScores';

const GAMES = [
  { id: 'answer-rush', name: 'Answer Rush', blurb: 'Quick questions with a points score.', art: answerRushArt, scored: false },
  { id: 'trivia-blast', name: 'Trivia Blast', blurb: 'Five questions a day.', art: triviaArt, scored: false },
  { id: 'sequence-sprint', name: 'Sequence Sprint', blurb: 'Watch the tiles, then repeat the sequence.', art: gamesArt, scored: true },
  { id: 'logic-duel', name: 'Logic Duel', blurb: 'Timed reasoning questions that get harder.', art: quizArt, scored: true },
  { id: 'digital-escape', name: 'Digital Escape Rooms', blurb: 'Solve a chain of clues to escape three academic rooms.', art: gamesArt, scored: true },
  { id: 'matching-pairs', name: 'Matching Pairs & Memory Grids', blurb: 'Match study terms to their definitions from memory.', art: triviaArt, scored: true },
  { id: 'categorization-sort', name: 'Categorization Sorting', blurb: 'Sort concepts into the right topic categories.', art: quizArt, scored: true },
];

/** Game Zone front page. Opening a game still goes through the existing Radar entry. */
export default function GameZoneHub({ onOpenGame }) {
  const [bests] = useState(() => Object.fromEntries(GAMES.filter(g => g.scored).map(g => [g.id, readBest(g.id)])));
  return (
    <section className="game-hub" aria-labelledby="game-hub-title">
      <header className="game-hub-head">
        <p className="eyebrow">Game zone</p>
        <h2 id="game-hub-title" className="game-hub-title">Pick a game</h2>
        <p className="panel-desc">Best scores are kept on this device.</p>
      </header>
      <div className="game-hub-grid">
        {GAMES.map(game => (
          <article key={game.id} className="game-hub-card">
            <div className="game-hub-art"><img src={game.art} alt="" loading="lazy" /></div>
            <div className="game-hub-body">
              <h3>{game.name}</h3>
              <p>{game.blurb}</p>
              {game.scored && <p className="game-hub-best">Best on this device: <strong>{bests[game.id] || '—'}</strong></p>}
              <button type="button" className="submit-btn" onClick={() => onOpenGame?.(game.id)}>Play {game.name}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
