import { useEffect, useReducer, useState } from 'react';
import { GameIntro, GameResults } from './GameShell';
import { buildRun, scoreAnswer, RUN_PLAN } from './logicEngine';
import { readBest, saveBest } from './highScores';
import { usePrefersReducedMotion } from '../lib/motion';
import artUrl from '../assets/trivia.png';

const GAME_ID = 'logic-duel';
const TICK_MS = 100;
const FEEDBACK_MS = 1100;

const initial = { phase: 'intro', run: [], index: 0, remaining: 0, score: 0, streak: 0, bestStreak: 0, correct: 0, timeouts: 0, chosen: null, lastCorrect: null, lastDelta: 0 };

function reducer(state, action) {
  switch (action.type) {
    case 'start': {
      const run = action.run;
      return { ...initial, phase: 'question', run, index: 0, remaining: run[0].seconds * 1000 };
    }
    case 'tick': {
      if (state.phase !== 'question') return state;
      const remaining = state.remaining - TICK_MS;
      return remaining > 0 ? { ...state, remaining } : answer(state, -1);
    }
    case 'answer':
      return answer(state, action.choice);
    case 'next': {
      if (state.phase !== 'feedback') return state;
      const next = state.index + 1;
      if (next >= state.run.length) return { ...state, phase: 'over' };
      return { ...state, phase: 'question', index: next, remaining: state.run[next].seconds * 1000 };
    }
    default:
      return state;
  }
}

/** Applies one answer (or a timeout, choice -1). Ignored unless a question is open, so double clicks cannot score twice. */
function answer(state, choice) {
  if (state.phase !== 'question') return state;
  const question = state.run[state.index];
  const correct = choice === question.answer;
  const { delta, streak } = scoreAnswer({
    correct,
    remainingMs: state.remaining,
    limitMs: question.seconds * 1000,
    streak: state.streak,
  });
  return {
    ...state,
    phase: 'feedback',
    score: Math.max(0, state.score + delta),
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    correct: state.correct + (correct ? 1 : 0),
    timeouts: state.timeouts + (choice === -1 ? 1 : 0),
    chosen: choice,
    lastCorrect: correct,
    lastDelta: delta,
  };
}

export default function LogicDuel({ onExit }) {
  const reduced = usePrefersReducedMotion();
  const [state, dispatch] = useReducer(reducer, initial);
  const [best, setBest] = useState(() => readBest(GAME_ID));
  const [newBest, setNewBest] = useState(false);
  const total = state.run.length;
  const current = state.run[state.index];

  const startRun = () => {
    setNewBest(false);
    dispatch({ type: 'start', run: buildRun() });
  };

  // Count down the open question.
  useEffect(() => {
    if (state.phase !== 'question') return undefined;
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), TICK_MS);
    return () => window.clearInterval(timer);
  }, [state.phase, state.index]);

  // Show the result of each answer briefly, then move on.
  useEffect(() => {
    if (state.phase !== 'feedback') return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'next' }), reduced ? 500 : FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.index, reduced]);

  // Save the best score once, when the run ends.
  useEffect(() => {
    if (state.phase !== 'over') return;
    setNewBest(state.score > best);
    setBest(saveBest(GAME_ID, state.score));
    // Only the transition into 'over' should save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Keys 1 to 4 pick an option while a question is open.
  useEffect(() => {
    if (state.phase !== 'question' || !current) return undefined;
    const onKey = event => {
      const n = Number(event.key);
      if (n >= 1 && n <= current.options.length) dispatch({ type: 'answer', choice: n - 1 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, current]);

  if (state.phase === 'intro') {
    const plan = RUN_PLAN.map(t => `${t.count} ${t.difficulty} (${t.seconds} s each)`).join(', ');
    return (
      <GameIntro
        title="Logic Duel"
        art={artUrl}
        artAlt="Quiz card illustration, used for Logic Duel"
        description="Ten short reasoning and pattern questions. The clock is running on every question, and the questions get harder as you go."
        instructions={[
          `Each run has ${RUN_PLAN.reduce((sum, t) => sum + t.count, 0)} questions: ${plan}.`,
          'Choose an answer by clicking it, or press the number key shown beside it.',
          'If the time runs out, the question counts as wrong.',
        ]}
        scoring={[
          '100 points for each correct answer.',
          'Up to 50 more points for answering quickly.',
          'Streak bonus: 25 points for each extra correct answer in a row (up to 150).',
          'A wrong answer or timeout costs 50 points and resets your streak. Your score never goes below zero.',
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
        title="Logic Duel"
        score={state.score}
        best={best}
        newBest={newBest}
        stats={[
          ['Correct', `${state.correct} of ${total}`],
          ['Accuracy', `${Math.round((state.correct / total) * 100)}%`],
          ['Best streak', state.bestStreak],
          ['Timeouts', state.timeouts],
        ]}
        onReplay={startRun}
        onExit={onExit}
      />
    );
  }

  const fraction = state.phase === 'question' ? Math.max(0, state.remaining / (current.seconds * 1000)) : 0;
  const locked = state.phase !== 'question';

  return (
    <section className="duel" aria-labelledby="duel-title">
      <div className="duel-hud" aria-live="polite">
        <span>Question {state.index + 1} of {total}</span>
        <span>Score {state.score}</span>
        <span>Streak {state.streak}</span>
        <span className={`duel-level duel-level--${current.difficulty}`}>{current.difficulty}</span>
      </div>
      <h2 id="duel-title" className="duel-title">Logic Duel</h2>
      <div className="duel-clock" role="timer" aria-label={`${Math.ceil(state.remaining / 1000)} seconds left`}>
        <div className="duel-clock-track" aria-hidden="true">
          <span style={{ transform: `scaleX(${fraction})`, transition: reduced ? 'none' : `transform ${TICK_MS}ms linear` }} />
        </div>
        <span className="duel-clock-text">{state.phase === 'question' ? `${Math.ceil(state.remaining / 1000)} s` : ''}</span>
      </div>
      <p className="duel-prompt">{current.prompt}</p>
      <div className="duel-options" role="group" aria-label="Answers">
        {current.options.map((option, i) => {
          const feedback = !locked ? '' : i === current.answer ? 'is-right' : i === state.chosen ? 'is-wrong' : '';
          return (
            <button
              key={option}
              type="button"
              className={`duel-option ${feedback}`}
              disabled={locked}
              onClick={() => dispatch({ type: 'answer', choice: i })}
            >
              <span className="duel-option-key" aria-hidden="true">{i + 1}</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
      {locked && (
        <p className="duel-feedback" role="status">
          {state.lastCorrect ? `Correct! +${state.lastDelta}` : state.chosen === -1 ? 'Time is up.' : 'Not quite.'}
        </p>
      )}
      <button type="button" className="ghost-btn small" onClick={onExit}>Leave game</button>
    </section>
  );
}
