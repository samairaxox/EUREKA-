/** Best scores are stored per game on this device. Storage failures never break a game. */
const key = gameId => `eureka.best.${gameId}`;

export function readBest(gameId) {
  try {
    const value = Number(window.localStorage.getItem(key(gameId)));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBest(gameId, score) {
  const best = Math.max(readBest(gameId), Math.max(0, Math.floor(score)));
  try {
    window.localStorage.setItem(key(gameId), String(best));
  } catch {
    // Private browsing or disabled storage: the score still shows for this session.
  }
  return best;
}
