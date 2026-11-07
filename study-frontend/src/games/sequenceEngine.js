/** Pure rules for Sequence Sprint. No React, no timers, so every rule can be tested directly. */
export const TILES = [
  { id: 0, name: 'Red circle', shape: 'circle', label: 'A', color: '#E4572E', key: '1' },
  { id: 1, name: 'Blue square', shape: 'square', label: 'B', color: '#3F6FB8', key: '2' },
  { id: 2, name: 'Gold triangle', shape: 'triangle', label: 'C', color: '#C98F12', key: '3' },
  { id: 3, name: 'Green diamond', shape: 'diamond', label: 'D', color: '#2F8F6B', key: '4' },
];

export const LIVES = 3;
export const MAX_LENGTH = 8;

/** Round 1 has 3 items; each round adds one, up to MAX_LENGTH. */
export function sequenceLength(round) {
  return Math.min(MAX_LENGTH, 2 + round);
}

/** Builds a random sequence of tile ids. `rng` returns a number in [0, 1). */
export function buildSequence(length, rng = Math.random) {
  return Array.from({ length }, () => Math.floor(rng() * TILES.length));
}

/** Points for a correct tap. The multiplier grows every three correct taps in a row. */
export function tapPoints(comboAfterTap) {
  return 10 * (1 + Math.floor(comboAfterTap / 3));
}

/** Bonus for finishing a round; later rounds are worth more. */
export function roundBonus(round) {
  return 50 + 10 * round;
}

/** Time allowed to repeat a sequence of this length. */
export function inputTimeMs(length) {
  return 1500 + 1000 * length;
}

/** Checks one tap against the expected tile at `index`. */
export function checkTap(sequence, index, tileId) {
  const expected = sequence[index];
  const isCorrect = tileId === expected;
  const isLast = index === sequence.length - 1;
  return { isCorrect, roundComplete: isCorrect && isLast };
}
