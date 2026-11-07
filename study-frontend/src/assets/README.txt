EUREKA study card image assets

All image files are separate assets, prepared at 600 x 400 px (3:2 landscape) for the EUREKA MagicBento/dashboard cards. The artwork is kept undistorted; soft matching background fills the landscape card area.

Study tools:
- summarizer.jpg
- quiz.jpg
- flashcards.jpg
- practice-test.jpg
- planner.jpg
- pdf-study.jpg

Activity cards:
- focus.png
- notes.png
- answer-rush.png
- trivia.png
- streak.png

Six study-agent images:
- agent-summarizer.png
- agent-quiz.png
- agent-flashcards.png
- agent-planner.png
- agent-pdf-study.png
- agent-practice-test.png

Copy the files into: study-frontend/src/assets/
Use imported asset paths in React, e.g. `import plannerImg from '../assets/planner.jpg';`
Do not use `src="../assets/planner.jpg"` in JSX; bundlers require imported assets or public-folder paths.
