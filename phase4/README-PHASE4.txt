Phase 4 - two new games: Sequence Sprint and Logic Duel (plus a Game Zone hub).

Copy these files over the same paths in your project:
  study-frontend/src/games/highScores.js         best score per game, stored on the device; storage errors never break a game
  study-frontend/src/games/sequenceEngine.js     pure Sequence Sprint rules (tiles, lengths, points, timing, checks)
  study-frontend/src/games/logicEngine.js        pure Logic Duel rules + curated 18-question bank (answers hand-checked)
  study-frontend/src/games/GameShell.jsx         shared entry page (intro) and results screen
  study-frontend/src/games/SequenceSprint.jsx    the game: watch, repeat, lives, combo, rounds, results
  study-frontend/src/games/LogicDuel.jsx         the game: 10 timed questions, speed and streak scoring, results
  study-frontend/src/games/GameZoneHub.jsx       Game Zone front page listing all four games
  study-frontend/src/games/games.test.js         unit tests for the rules, storage and screens
  study-frontend/src/pages/DashboardPage.jsx     registers the two games and the hub; passes onOpenGame / onExit
  theme-FULL-with-phase4.css                     the complete styles file; replace study-frontend/src/styles/theme.css with it

Verified: frontend tests 25/25; production build compiles (the two pre-existing unused-variable warnings remain).
Browser: Logic Duel played through all 10 questions correctly (score 2467, saved best, replay works, hub shows best).
Sequence Sprint played through two rounds (3 and 4 tiles), then all lives lost (score 320, saved best, results shown).
