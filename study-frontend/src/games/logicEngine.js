/**
 * Pure rules and the curated question bank for Logic Duel.
 * Every answer below was checked by hand. `answer` is the index into `options`.
 */
export const QUESTIONS = [
  { difficulty: 'easy', prompt: 'What comes next? 2, 4, 8, 16, ?', options: ['24', '30', '32', '36'], answer: 2 },
  { difficulty: 'easy', prompt: 'What comes next? 3, 6, 9, 12, ?', options: ['13', '14', '15', '16'], answer: 2 },
  { difficulty: 'easy', prompt: 'Which one does not belong? Apple, Carrot, Grape, Banana', options: ['Apple', 'Carrot', 'Grape', 'Banana'], answer: 1 },
  { difficulty: 'easy', prompt: 'All cats are animals. Tom is a cat. Is Tom an animal?', options: ['Yes', 'No', 'Cannot tell'], answer: 0 },
  { difficulty: 'easy', prompt: 'What comes next? 5, 10, 20, 40, ?', options: ['60', '70', '80', '90'], answer: 2 },
  { difficulty: 'easy', prompt: 'Hot is to cold as up is to ?', options: ['left', 'down', 'high', 'under'], answer: 1 },
  { difficulty: 'medium', prompt: 'What comes next? 1, 1, 2, 3, 5, 8, ?', options: ['11', '12', '13', '14'], answer: 2 },
  { difficulty: 'medium', prompt: 'What comes next? 100, 90, 81, 73, ?', options: ['64', '65', '66', '67'], answer: 2 },
  { difficulty: 'medium', prompt: 'A is taller than B. B is taller than C. Who is the shortest?', options: ['A', 'B', 'C'], answer: 2 },
  { difficulty: 'medium', prompt: '3 workers paint 3 walls in 3 hours. How long do 6 workers take to paint 6 walls?', options: ['1 hour', '2 hours', '3 hours', '6 hours'], answer: 2 },
  { difficulty: 'medium', prompt: 'What is the angle between the hour and minute hands at 3:00?', options: ['30°', '60°', '90°', '120°'], answer: 2 },
  { difficulty: 'medium', prompt: 'You have 12 apples. You give away 5, then buy 3. How many do you have?', options: ['8', '9', '10', '12'], answer: 2 },
  { difficulty: 'hard', prompt: 'What comes next? 2, 6, 12, 20, 30, ?', options: ['38', '40', '42', '44'], answer: 2 },
  { difficulty: 'hard', prompt: 'What comes next? A1, C3, E5, G7, ?', options: ['H8', 'I9', 'J9', 'K11'], answer: 1 },
  { difficulty: 'hard', prompt: 'A family has 4 boys and 3 girls. How many brothers does each boy have?', options: ['2', '3', '4', '5'], answer: 1 },
  { difficulty: 'hard', prompt: 'Which number is NOT prime? 2, 3, 9, 11', options: ['2', '3', '9', '11'], answer: 2 },
  { difficulty: 'hard', prompt: 'What comes next? 1, 4, 9, 16, 25, ?', options: ['30', '35', '36', '49'], answer: 2 },
  { difficulty: 'hard', prompt: 'A fair coin is flipped twice. What is the chance of two heads?', options: ['1/2', '1/4', '1/3', '1/8'], answer: 1 },
];

/** Questions per run by difficulty, in the order the run is played. */
export const RUN_PLAN = [
  { difficulty: 'easy', count: 3, seconds: 20 },
  { difficulty: 'medium', count: 4, seconds: 15 },
  { difficulty: 'hard', count: 3, seconds: 12 },
];

export const BASE_POINTS = 100;
export const SPEED_BONUS_MAX = 50;
export const STREAK_BONUS_STEP = 25;
export const STREAK_BONUS_CAP = 150;
export const WRONG_PENALTY = 50;

/** Picks a shuffled run: no repeats, difficulty rising through the run. */
export function buildRun(rng = Math.random) {
  const run = [];
  for (const tier of RUN_PLAN) {
    const pool = QUESTIONS.filter(q => q.difficulty === tier.difficulty);
    const shuffled = [...pool].sort(() => rng() - 0.5);
    for (let i = 0; i < tier.count; i += 1) {
      run.push({ ...shuffled[i], seconds: tier.seconds });
    }
  }
  return run;
}

/**
 * Scores one answer. `timedOut` counts as wrong. A correct answer earns points for speed and for streak;
 * a wrong one costs points (never below zero overall) and resets the streak.
 */
export function scoreAnswer({ correct, remainingMs, limitMs, streak }) {
  if (!correct) {
    return { delta: -WRONG_PENALTY, streak: 0 };
  }
  const nextStreak = streak + 1;
  const speed = Math.round(SPEED_BONUS_MAX * Math.max(0, Math.min(1, remainingMs / limitMs)));
  const streakBonus = Math.min(STREAK_BONUS_CAP, STREAK_BONUS_STEP * (nextStreak - 1));
  return { delta: BASE_POINTS + speed + streakBonus, streak: nextStreak };
}
