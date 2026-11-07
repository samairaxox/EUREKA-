import { useEffect, useMemo, useReducer, useState } from 'react';
import { GameIntro, GameResults } from './GameShell';
import { TILES, LIVES, buildSequence, sequenceLength, tapPoints, roundBonus, inputTimeMs, checkTap } from './sequenceEngine';
import { readBest, saveBest } from './highScores';
import { usePrefersReducedMotion } from '../lib/motion';
import artUrl from '../assets/games.png';

const GAME_ID = 'sequence-sprint';

const initial = { phase: 'intro', round: 0, seq: [], step: 0, lit: false, inputIdx: 0, lives: LIVES, score: 0, combo: 0, maxCombo: 0, correctTaps: 0, attempts: 0, roundsDone: 0, lastWrong: false };

function reducer(state, action) {
  switch (action.type) {
    case 'start':
      return { ...initial, phase: 'showing', round: 1, seq: action.seq };
    case 'light':
      return { ...state, lit: true };
    case 'dark':
      return { ...state, lit: false, step: state.step + 1 };
    case 'showEnd':
      return { ...state, phase: 'input', inputIdx: 0, lit: false };
    case 'tap': {
      if (state.phase !== 'input') return state;
      const { isCorrect, roundComplete } = checkTap(state.seq, state.inputIdx, action.tileId);
      const attempts = state.attempts + 1;
      if (!isCorrect) return loseLife({ ...state, attempts });
      const combo = state.combo + 1;
      let score = state.score + tapPoints(combo);
      const next = { ...state, attempts, combo, maxCombo: Math.max(state.maxCombo, combo), correctTaps: state.correctTaps + 1, score, inputIdx: state.inputIdx + 1, lastWrong: false };
      if (!roundComplete) return next;
      return { ...next, score: score + roundBonus(state.round), roundsDone: state.roundsDone + 1, phase: 'between' };
    }
    case 'timeout':
      if (state.phase !== 'input') return state;
      return loseLife({ ...state, attempts: state.attempts + 1 });
    case 'nextRound':
      return { ...state, phase: 'showing', round: state.round + 1, seq: action.seq, step: 0, lit: false, inputIdx: 0, lastWrong: false };
    default:
      return state;
  }
}

/** A wrong tap or a timeout costs a life and the combo. The same sequence is replayed, unless no lives remain. */
function loseLife(state) {
  const lives = state.lives - 1;
  if (lives <= 0) return { ...state, lives: 0, combo: 0, phase: 'over', lastWrong: true };
  return { ...state, lives, combo: 0, phase: 'showing', step: 0, lit: false, inputIdx: 0, lastWrong: true };
}

function ShapeIcon({ shape }) {
  const common = { width: 34, height: 34, viewBox: '0 0 40 40', 'aria-hidden': 'true', focusable: 'false' };
  if (shape === 'circle') return <svg {...common}><circle cx="20" cy="20" r="15" fill="currentColor" /></svg>;
  if (shape === 'square') return <svg {...common}><rect x="6" y="6" width="28" height="28" rx="4" fill="currentColor" /></svg>;
  if (shape === 'triangle') return <svg {...common}><polygon points="20,5 36,34 4,34" fill="currentColor" /></svg>;
  return <svg {...common}><polygon points="20,3 37,20 20,37 3,20" fill="currentColor" /></svg>;
}

export default function SequenceSprint({ onExit }) {
  const reduced = usePrefersReducedMotion();
  const [state, dispatch] = useReducer(reducer, initial);
  const [best, setBest] = useState(() => readBest(GAME_ID));
  const [newBest, setNewBest] = useState(false);
  const stepMs = reduced ? 300 : 650;
  const gapMs = reduced ? 150 : 250;

  const startRun = () => {
    setNewBest(false);
    dispatch({ type: 'start', seq: buildSequence(sequenceLength(1)) });
  };

  // Show the sequence one tile at a time.
  useEffect(() => {
    if (state.phase !== 'showing') return undefined;
    if (state.step >= state.seq.length) {
      dispatch({ type: 'showEnd' });
      return undefined;
    }
    const timer = window.setTimeout(() => dispatch({ type: state.lit ? 'dark' : 'light' }), state.lit ? stepMs : gapMs);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.step, state.lit, state.seq.length, stepMs, gapMs]);

  // The player has a limited time to repeat the sequence.
  useEffect(() => {
    if (state.phase !== 'input') return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'timeout' }), inputTimeMs(state.seq.length));
    return () => window.clearTimeout(timer);
  }, [state.phase, state.seq.length]);

  // Short pause between rounds, then the next, longer sequence.
  useEffect(() => {
    if (state.phase !== 'between') return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'nextRound', seq: buildSequence(sequenceLength(state.round + 1)) }), reduced ? 500 : 900);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.round, reduced]);

  // Save the best score once, when the run ends.
  useEffect(() => {
    if (state.phase !== 'over') return;
    const saved = saveBest(GAME_ID, state.score);
    setNewBest(state.score > best);
    setBest(saved);
    // Only the transition into 'over' should save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Keys 1 to 4 pick the tiles during the input phase.
  useEffect(() => {
    if (state.phase !== 'input') return undefined;
    const onKey = event => {
      const tile = TILES.find(t => t.key === event.key);
      if (tile) dispatch({ type: 'tap', tileId: tile.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase]);

  const accuracy = useMemo(() => (state.attempts ? Math.round((state.correctTaps / state.attempts) * 100) : 0), [state.attempts, state.correctTaps]);

  if (state.phase === 'intro') {
    return (
      <GameIntro
        title="Sequence Sprint"
        art={artUrl}
        artAlt="Colourful game tiles, used for Sequence Sprint"
        description="Watch the tiles light up, then repeat the sequence before time runs out. Each round is one tile longer."
        instructions={[
          'Watch the sequence of tiles. Each tile lights up in turn.',
          'Tap the tiles in the same order, or press keys 1 to 4.',
          'You have a limited time to repeat each sequence.',
          `You have ${LIVES} lives. A wrong tap or a timeout costs one life, and the same sequence plays again.`,
        ]}
        scoring={[
          '10 points per correct tap. Every three correct taps in a row doubles that tap value.',
          'Finishing a round earns a bonus that grows with each round.',
          'A wrong tap resets your combo.',
        ]}
        best={best}
        onStart={startRun}
        onExit={onExit}
      />
    );
  }

  if (state.phase === 'over') {
    return (
      <GameResults
        title="Sequence Sprint"
        score={state.score}
        best={best}
        newBest={newBest}
        stats={[
          ['Rounds completed', state.roundsDone],
          ['Longest sequence', sequenceLength(state.round)],
          ['Best combo', state.maxCombo],
          ['Accuracy', `${accuracy}%`],
        ]}
        onReplay={startRun}
        onExit={onExit}
      />
    );
  }

  const statusText = {
    showing: `Watch the sequence… (${Math.min(state.step + 1, state.seq.length)} of ${state.seq.length})`,
    input: `Your turn: ${state.inputIdx} of ${state.seq.length} repeated`,
    between: `Round ${state.round} complete!`,
  }[state.phase];

  const litTile = state.phase === 'showing' && state.lit ? state.seq[state.step] : null;

  return (
    <section className="sprint" aria-labelledby="sprint-title">
      <div className="sprint-hud" aria-live="polite">
        <span>Round {state.round}</span>
        <span>Score {state.score}</span>
        <span>Combo ×{1 + Math.floor(state.combo / 3)}</span>
        <span aria-label={`${state.lives} lives left`}>{'♥'.repeat(state.lives)}</span>
      </div>
      <h2 id="sprint-title" className="sprint-title">Sequence Sprint</h2>
      <p className="sprint-status" role="status">{statusText}</p>
      {state.phase === 'input' && !reduced && (
        <div className="sprint-timer" key={`${state.round}-${state.lives}`} style={{ animationDuration: `${inputTimeMs(state.seq.length)}ms` }} aria-hidden="true" />
      )}
      <div className="sprint-grid">
        {TILES.map(tile => {
          const lit = litTile === tile.id;
          const interactive = state.phase === 'input';
          return (
            <button
              key={tile.id}
              type="button"
              className={`sprint-tile${lit ? ' is-lit' : ''}${interactive ? '' : ' is-idle'}`}
              style={{ '--tile': tile.color }}
              aria-label={`${tile.name}, key ${tile.key}`}
              aria-disabled={!interactive}
              onClick={() => interactive && dispatch({ type: 'tap', tileId: tile.id })}
            >
              <ShapeIcon shape={tile.shape} />
              <span className="sprint-tile-label">{tile.label}</span>
              <span className="sprint-tile-key" aria-hidden="true">{tile.key}</span>
            </button>
          );
        })}
      </div>
      {state.lastWrong && state.phase === 'showing' && <p className="sprint-note" role="alert">Wrong. You lost a life. Watch the sequence again.</p>}
      <button type="button" className="ghost-btn small" onClick={onExit}>Leave game</button>
    </section>
  );
}
