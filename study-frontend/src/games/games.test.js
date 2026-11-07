import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TILES, sequenceLength, buildSequence, tapPoints, roundBonus, inputTimeMs, checkTap, LIVES, MAX_LENGTH } from './sequenceEngine';
import { QUESTIONS, RUN_PLAN, buildRun, scoreAnswer, WRONG_PENALTY } from './logicEngine';
import { readBest, saveBest } from './highScores';
import SequenceSprint from './SequenceSprint';
import LogicDuel from './LogicDuel';
import GameZoneHub from './GameZoneHub';

beforeEach(() => window.localStorage.clear());

describe('Sequence Sprint rules', () => {
  test('round 1 has three tiles and each round adds one, up to the cap', () => {
    expect(sequenceLength(1)).toBe(3);
    expect(sequenceLength(2)).toBe(4);
    expect(sequenceLength(50)).toBe(MAX_LENGTH);
  });

  test('a sequence uses only valid tiles and has the requested length', () => {
    const seq = buildSequence(6, () => 0.99);
    expect(seq).toHaveLength(6);
    seq.forEach(id => expect(TILES.map(t => t.id)).toContain(id));
  });

  test('points grow with the combo: 10 per tap, doubled after every three in a row', () => {
    expect(tapPoints(1)).toBe(10);
    expect(tapPoints(3)).toBe(20);
    expect(tapPoints(6)).toBe(30);
    expect(roundBonus(2)).toBe(70);
    expect(inputTimeMs(3)).toBeGreaterThan(inputTimeMs(2));
    expect(LIVES).toBe(3);
  });

  test('checkTap accepts only the expected tile and flags the last correct one', () => {
    const seq = [0, 2];
    expect(checkTap(seq, 0, 0)).toEqual({ isCorrect: true, roundComplete: false });
    expect(checkTap(seq, 1, 2)).toEqual({ isCorrect: true, roundComplete: true });
    expect(checkTap(seq, 1, 1).isCorrect).toBe(false);
  });
});

describe('Logic Duel rules and question bank', () => {
  test('every question has a valid, unique answer position and no duplicate options', () => {
    QUESTIONS.forEach(q => {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
    });
  });

  test('a run has 10 questions in the planned difficulty order without repeats', () => {
    const run = buildRun(() => 0.5);
    expect(run).toHaveLength(RUN_PLAN.reduce((sum, t) => sum + t.count, 0));
    expect(run.slice(0, 3).every(q => q.difficulty === 'easy')).toBe(true);
    expect(run.slice(-3).every(q => q.difficulty === 'hard')).toBe(true);
    expect(new Set(run.map(q => q.prompt)).size).toBe(run.length);
  });

  test('a correct answer earns base, speed and streak points; a wrong one costs points and resets the streak', () => {
    expect(scoreAnswer({ correct: true, remainingMs: 20000, limitMs: 20000, streak: 0 })).toEqual({ delta: 150, streak: 1 });
    expect(scoreAnswer({ correct: true, remainingMs: 0, limitMs: 20000, streak: 0 })).toEqual({ delta: 100, streak: 1 });
    expect(scoreAnswer({ correct: true, remainingMs: 0, limitMs: 20000, streak: 10 }).delta).toBe(100 + 150);
    expect(scoreAnswer({ correct: false, remainingMs: 5000, limitMs: 20000, streak: 4 })).toEqual({ delta: -WRONG_PENALTY, streak: 0 });
  });
});

describe('high scores', () => {
  test('only the best score is kept, and a broken store does not throw', () => {
    expect(readBest('logic-duel')).toBe(0);
    saveBest('logic-duel', 300);
    expect(saveBest('logic-duel', 120)).toBe(300);
    expect(readBest('logic-duel')).toBe(300);
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error('quota'); };
    expect(() => saveBest('logic-duel', 999)).not.toThrow();
    window.localStorage.setItem = original;
  });
});

describe('game screens', () => {
  const renderIn = ui => render(<MemoryRouter>{ui}</MemoryRouter>);

  test('Sequence Sprint opens on its entry page with instructions and a Start button', () => {
    renderIn(<SequenceSprint onExit={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Sequence Sprint' })).toBeInTheDocument();
    expect(screen.getByText(/How to play/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start game' })).toBeInTheDocument();
  });

  test('Logic Duel starts a timed run and shows the first question', () => {
    jest.useFakeTimers();
    renderIn(<LogicDuel onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(screen.getByText(/Question 1 of 10/)).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByRole('timer')).toBeInTheDocument();
    jest.useRealTimers();
  });

  test('the Game Zone hub lists all four games and sends the chosen one onward', () => {
    const opened = jest.fn();
    renderIn(<GameZoneHub onOpenGame={opened} />);
    ['Answer Rush', 'Trivia Blast', 'Sequence Sprint', 'Logic Duel'].forEach(name => {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Play Logic Duel' }));
    expect(opened).toHaveBeenCalledWith('logic-duel');
  });
});
