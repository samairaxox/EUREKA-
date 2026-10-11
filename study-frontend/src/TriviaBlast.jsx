import { useCallback, useEffect, useState } from 'react';
import { getStreakStats, markTodayAsStudied, toLocalDateString } from './streak';

const QUESTION_SECONDS = 10;
const DAILY_QUESTION_COUNT = 5;
const DAILY_TRIVIA_EVENT = 'eureka:daily-trivia-updated';

const TRIVIA_QUESTIONS = [
  { question: 'Sharks existed before trees. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Shark ancestors appeared over 400 million years ago; the earliest trees came later.' },
  { question: 'Which planet is thought to have rain made of diamonds deep inside it?', options: ['Mars', 'Neptune', 'Venus', 'Mercury'], answer: 'Neptune', fact: 'Models suggest the extreme pressure inside ice giants like Neptune and Uranus may turn carbon into diamond rain.' },
  { question: 'How many hearts does an octopus have?', options: ['One', 'Two', 'Three', 'Four'], answer: 'Three', fact: 'Two hearts pump blood to the gills, and a third pumps it to the rest of the body.' },
  { question: 'Which language has the most native speakers worldwide?', options: ['English', 'Spanish', 'Mandarin Chinese', 'Hindi'], answer: 'Mandarin Chinese', fact: 'Mandarin Chinese has the largest number of native speakers; English leads by total speakers.' },
  { question: 'A group of flamingos is called a…', options: ['Flamboyance', 'Parliament', 'Murmuration', 'Crash'], answer: 'Flamboyance', fact: '“Flamboyance” is the delightful collective noun used for a group of flamingos.' },
  { question: 'What is the largest desert on Earth?', options: ['Sahara', 'Gobi', 'Arabian', 'Antarctica'], answer: 'Antarctica', fact: 'Deserts are defined by very low precipitation, so the cold Antarctic continent qualifies.' },
  { question: 'Which animal has fingerprints so similar to humans that they can be hard to tell apart?', options: ['Koala', 'Panda', 'Sloth', 'Lemur'], answer: 'Koala', fact: 'Koala fingerprints are remarkably similar to human fingerprints, despite our distant evolutionary paths.' },
  { question: 'On Venus, a day is longer than a year. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Venus rotates so slowly that one rotation takes longer than its trip around the Sun.' },
  { question: 'Which country has more ancient pyramids than Egypt?', options: ['Mexico', 'Sudan', 'Peru', 'Iraq'], answer: 'Sudan', fact: 'The ancient Kingdom of Kush built hundreds of pyramids in what is now Sudan.' },
  { question: 'What is the only mammal capable of sustained powered flight?', options: ['Flying squirrel', 'Bat', 'Sugar glider', 'Colugo'], answer: 'Bat', fact: 'Bats generate lift with wing beats; gliding mammals can only coast through the air.' },
  { question: 'Which ocean is larger than all Earth’s land area combined?', options: ['Atlantic', 'Indian', 'Pacific', 'Southern'], answer: 'Pacific', fact: 'The Pacific covers more area than all of the continents and islands combined.' },
  { question: 'A day on Jupiter is roughly how long?', options: ['10 hours', '24 hours', '48 hours', 'One week'], answer: '10 hours', fact: 'Jupiter spins very quickly, completing a rotation in just under ten hours.' },
  { question: 'Which bird can fly backwards?', options: ['Swift', 'Hummingbird', 'Kingfisher', 'Albatross'], answer: 'Hummingbird', fact: 'Hummingbirds can rotate their wings in a figure-eight motion and fly backwards.' },
  { question: 'What is the smallest bone in the human body?', options: ['Stapes', 'Patella', 'Ulna', 'Coccyx'], answer: 'Stapes', fact: 'The stapes, in the middle ear, is only a few millimeters long.' },
  { question: 'Which planet spins almost on its side?', options: ['Mars', 'Uranus', 'Mercury', 'Venus'], answer: 'Uranus', fact: 'Uranus has an axial tilt of about 98 degrees, so it essentially rolls around the Sun.' },
  { question: 'Wombats produce cube-shaped droppings. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Different elasticity in the wombat intestine shapes the droppings into cubes.' },
  { question: 'What is the deepest known point in Earth’s oceans?', options: ['Tonga Trench', 'Java Trench', 'Challenger Deep', 'Puerto Rico Trench'], answer: 'Challenger Deep', fact: 'Challenger Deep lies in the Mariana Trench, nearly 11 kilometers below sea level.' },
  { question: 'Which metal is liquid at typical room temperature?', options: ['Gallium', 'Mercury', 'Sodium', 'Aluminium'], answer: 'Mercury', fact: 'Mercury stays liquid at room temperature; gallium melts just above it.' },
  { question: 'How many bones does a typical adult human have?', options: ['186', '206', '226', '246'], answer: '206', fact: 'Babies have more bones, many of which fuse as they grow.' },
  { question: 'Which ancient civilization used salt as part of soldiers’ pay?', options: ['Roman', 'Mayan', 'Incan', 'Persian'], answer: 'Roman', fact: 'The Latin word salarium, associated with Roman soldiers’ salt allowance, gave us “salary.”' },
  { question: 'Which mammal has the densest fur?', options: ['Sea otter', 'Polar bear', 'Chinchilla', 'Beaver'], answer: 'Sea otter', fact: 'Sea otters can have up to about a million hairs per square inch, helping trap insulating air.' },
  { question: 'The Eiffel Tower can grow taller in hot weather. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Heat makes the iron expand, changing the tower’s height by several centimeters.' },
  { question: 'Which planet has the shortest day?', options: ['Earth', 'Mars', 'Jupiter', 'Saturn'], answer: 'Jupiter', fact: 'Jupiter’s rapid rotation gives it a day of about 9 hours and 56 minutes.' },
  { question: 'What is the only continent with land in all four hemispheres?', options: ['Asia', 'Africa', 'South America', 'Europe'], answer: 'Africa', fact: 'The Equator and Prime Meridian both cross Africa.' },
  { question: 'Which animal’s heart can weigh as much as a small car?', options: ['Blue whale', 'Elephant', 'Giraffe', 'Hippopotamus'], answer: 'Blue whale', fact: 'A blue whale’s enormous heart can weigh hundreds of kilograms.' },
  { question: 'Which country gifted the Statue of Liberty to the United States?', options: ['Spain', 'France', 'Italy', 'Canada'], answer: 'France', fact: 'France gave the statue to celebrate friendship and shared ideals between the two countries.' },
  { question: 'Which animal has three eyelids?', options: ['Camel', 'Owl', 'Dolphin', 'Lizard'], answer: 'Camel', fact: 'A camel’s third, translucent eyelid helps protect its eyes from blowing sand.' },
  { question: 'The Moon is moving slowly away from Earth. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Laser measurements show the Moon recedes by roughly 3.8 centimeters per year.' },
  { question: 'Which sport uses the terms “love” and “deuce”?', options: ['Badminton', 'Tennis', 'Squash', 'Table tennis'], answer: 'Tennis', fact: 'In tennis scoring, “love” means zero and “deuce” means a tied score at 40–40.' },
  { question: 'What is the largest living structure on Earth?', options: ['Amazon rainforest', 'Great Barrier Reef', 'Mushroom network in Oregon', 'Redwood forest'], answer: 'Great Barrier Reef', fact: 'The Great Barrier Reef is the largest coral reef system, visible from space in ideal conditions.' },
  { question: 'Which planet has a hexagon-shaped storm at its north pole?', options: ['Jupiter', 'Saturn', 'Neptune', 'Mars'], answer: 'Saturn', fact: 'A persistent six-sided jet stream surrounds Saturn’s north polar region.' },
  { question: 'A snail can sleep for years in extreme conditions. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Some land snails can enter long periods of dormancy to survive drought or cold.' },
  { question: 'Which city is farther west: Reno, Nevada, or Los Angeles?', options: ['Reno', 'Los Angeles', 'They are at the same longitude', 'It depends on the season'], answer: 'Reno', fact: 'Reno is slightly farther west than Los Angeles, despite being inland.' },
  { question: 'What is the most abundant gas in Earth’s atmosphere?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'], answer: 'Nitrogen', fact: 'Nitrogen makes up about 78% of dry air, while oxygen is about 21%.' },
  { question: 'Which animal has rectangular pupils?', options: ['Goat', 'Cat', 'Eagle', 'Dolphin'], answer: 'Goat', fact: 'Horizontal rectangular pupils give goats a wide field of view to spot predators.' },
  { question: 'Which chess piece can move in an L shape?', options: ['Bishop', 'Knight', 'Rook', 'Queen'], answer: 'Knight', fact: 'The knight is the only piece that can jump over other pieces.' },
  { question: 'What is the world’s largest island that is not considered a continent?', options: ['Borneo', 'Madagascar', 'Greenland', 'New Guinea'], answer: 'Greenland', fact: 'Greenland is the largest island; Australia is classified as a continent.' },
  { question: 'Some turtles can absorb oxygen through their rear end while underwater. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Certain freshwater turtles can take up oxygen through specialized tissues in their cloaca.' },
  { question: 'Which planet has the strongest winds in the solar system?', options: ['Earth', 'Jupiter', 'Neptune', 'Saturn'], answer: 'Neptune', fact: 'Neptune’s winds can exceed 2,000 kilometers per hour.' },
  { question: 'What is the only food that never spoils when stored properly?', options: ['Rice', 'Honey', 'Salted butter', 'Dried beans'], answer: 'Honey', fact: 'Honey’s low water content and acidity make it remarkably resistant to spoilage.' },
  { question: 'In which country did the modern Olympic Games begin in 1896?', options: ['Italy', 'Greece', 'France', 'United Kingdom'], answer: 'Greece', fact: 'Athens hosted the first modern Olympic Games in 1896.' },
  { question: 'Which animal is famous for having blue blood?', options: ['Horseshoe crab', 'Lobster', 'Scorpion', 'Jellyfish'], answer: 'Horseshoe crab', fact: 'Its copper-based hemocyanin turns blue when oxygenated.' },
  { question: 'Which seat of government is often called the world’s highest capital?', options: ['Quito', 'La Paz', 'Lhasa', 'Thimphu'], answer: 'La Paz', fact: 'La Paz, Bolivia’s seat of government, sits roughly 3,650 meters above sea level.' },
  { question: 'Which planet’s moon Titan has lakes and seas of liquid methane and ethane?', options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], answer: 'Saturn', fact: 'Titan, a moon of Saturn, has a methane-based weather cycle and hydrocarbon lakes.' },
  { question: 'A day on Mercury is longer than its year. True or false?', options: ['True', 'False'], answer: 'True', fact: 'A Mercury solar day lasts 176 Earth days, while its year lasts 88.' },
  { question: 'Which country has the longest coastline in the world?', options: ['Russia', 'Canada', 'Indonesia', 'Australia'], answer: 'Canada', fact: 'Canada’s coastline stretches across its Atlantic, Pacific, and Arctic shores.' },
  { question: 'What is the name for a word that reads the same forward and backward?', options: ['Anagram', 'Palindrome', 'Homonym', 'Isogram'], answer: 'Palindrome', fact: '“Racecar” and “level” are familiar examples of palindromes.' },
  { question: 'Which animal can regenerate a lost arm and even regrow much of its central disc?', options: ['Starfish', 'Sea urchin', 'Nautilus', 'Sea cucumber'], answer: 'Starfish', fact: 'Many sea stars can regrow arms; some can regenerate a whole body from part of one.' },
  { question: 'Which country was the first to give women the right to vote in national elections?', options: ['New Zealand', 'Finland', 'Norway', 'Australia'], answer: 'New Zealand', fact: 'New Zealand became the first self-governing country to grant women the parliamentary vote in 1893.' },
  { question: 'Which famous sports trophy is made from 18-carat gold?', options: ['The Ashes urn', 'The FIFA World Cup Trophy', 'The Stanley Cup', 'The Davis Cup'], answer: 'The FIFA World Cup Trophy', fact: 'The current FIFA World Cup Trophy is made of 18-carat gold and weighs about 6.2 kilograms.' },
];

function seededDailyQuestions(date) {
  let seed = 2166136261;
  for (const character of date) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...TRIVIA_QUESTIONS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.slice(0, DAILY_QUESTION_COUNT);
}

function readDailyRecord() {
  try {
    return {
      lastPlayedDate: window.localStorage.getItem('lastPlayedDate') || '',
      todayScore: Number(window.localStorage.getItem('todayScore') || 0),
      totalDaysPlayed: Number(window.localStorage.getItem('totalDaysPlayed') || 0),
    };
  } catch {
    return { lastPlayedDate: '', todayScore: 0, totalDaysPlayed: 0 };
  }
}

export function getDailyTriviaStatus() {
  const record = readDailyRecord();
  const today = toLocalDateString();
  return { ...record, playedToday: record.lastPlayedDate === today };
}

export { DAILY_TRIVIA_EVENT };

export default function TriviaBlast() {
  const initialStatus = getDailyTriviaStatus();
  const [phase, setPhase] = useState(initialStatus.playedToday ? 'complete' : 'intro');
  const [round, setRound] = useState(() => seededDailyQuestions(toLocalDateString()));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(initialStatus.playedToday ? initialStatus.todayScore : 0);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [todayScore, setTodayScore] = useState(initialStatus.todayScore);
  const [currentStreak, setCurrentStreak] = useState(() => getStreakStats().currentStreak);
  const [totalDaysPlayed, setTotalDaysPlayed] = useState(initialStatus.totalDaysPlayed);

  useEffect(() => { markTodayAsStudied(); }, []);

  const finishDailyRun = useCallback(finalScore => {
    const previous = readDailyRecord();
    const today = toLocalDateString();
    const total = previous.lastPlayedDate === today
      ? previous.totalDaysPlayed
      : previous.totalDaysPlayed + 1;
    try {
      window.localStorage.setItem('lastPlayedDate', today);
      window.localStorage.setItem('todayScore', String(finalScore));
      window.localStorage.setItem('totalDaysPlayed', String(total));
    } catch {
      // Keep the results visible even if browser storage is unavailable.
    }
    markTodayAsStudied();
    setTodayScore(finalScore);
    setTotalDaysPlayed(total);
    setCurrentStreak(getStreakStats().currentStreak);
    setPhase('results');
    window.dispatchEvent(new CustomEvent(DAILY_TRIVIA_EVENT));
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return undefined;
    if (secondsLeft <= 0) {
      setSelectedOption(null);
      setFeedback('Time is up! The answer was ' + round[questionIndex].answer + '.');
      setPhase('feedback');
      return undefined;
    }
    const countdown = window.setTimeout(() => setSecondsLeft(value => value - 1), 1000);
    return () => window.clearTimeout(countdown);
  }, [phase, secondsLeft, questionIndex, round]);

  useEffect(() => {
    if (phase !== 'feedback') return undefined;
    const nextQuestion = window.setTimeout(() => {
      if (questionIndex === DAILY_QUESTION_COUNT - 1) {
        finishDailyRun(score);
        return;
      }
      setQuestionIndex(index => index + 1);
      setSecondsLeft(QUESTION_SECONDS);
      setSelectedOption(null);
      setFeedback('');
      setPhase('playing');
    }, 850);
    return () => window.clearTimeout(nextQuestion);
  }, [phase, questionIndex, score, finishDailyRun]);

  const currentQuestion = round[questionIndex];
  const chooseOption = option => {
    if (phase !== 'playing') return;
    setSelectedOption(option);
    const isCorrect = option === currentQuestion.answer;
    if (isCorrect) setScore(value => value + 1);
    setFeedback(isCorrect ? 'Brilliant! ✨' : `Not quite! ${currentQuestion.fact}`);
    setPhase('feedback');
  };

  const messageForScore = value => {
    if (value === 5) return 'GENIUS! 🧠';
    if (value >= 3) return 'Not bad! 💪';
    if (value === 1) return 'Keep learning! 📚';
    return 'Every question is a new discovery! ✨';
  };

  return (
    <section className="trivia-blast" aria-label="Daily Trivia">
      {(phase === 'intro' || phase === 'complete') && (
        <div className="trivia-intro">
          <div className="trivia-kicker">🧠 YOUR DAILY KNOWLEDGE RITUAL</div>
          <h2>{phase === 'complete' ? 'Come back tomorrow!' : 'Daily Trivia ✨'}</h2>
          {phase === 'complete' ? (
            <>
              <p>You scored <strong>{todayScore} / {DAILY_QUESTION_COUNT}</strong> today. Your daily set is complete—come back tomorrow for five fresh questions.</p>
              <div className="trivia-daily-stats">
                <span>🔥 <strong>{currentStreak}</strong> day study streak</span>
                <span>📅 <strong>{totalDaysPlayed}</strong> days played</span>
              </div>
              <div className="trivia-daily-finish">See you tomorrow! ✨</div>
            </>
          ) : (
            <>
              <p>Play today’s 5 questions! A fresh, date-picked set every day. Ten seconds per question.</p>
              <button className="submit-btn trivia-start" type="button" onClick={() => { setRound(seededDailyQuestions(toLocalDateString())); setQuestionIndex(0); setScore(0); setSecondsLeft(QUESTION_SECONDS); setFeedback(''); setSelectedOption(null); setPhase('playing'); }}>Play today’s questions <span>→</span></button>
            </>
          )}
        </div>
      )}

      {(phase === 'playing' || phase === 'feedback') && currentQuestion && (
        <div className="trivia-game" key={questionIndex}>
          <header className="trivia-game-header">
            <div className="trivia-kicker">🧠 DAILY TRIVIA</div>
            <div className="trivia-stats"><span>QUESTION <strong>{questionIndex + 1}</strong> / {DAILY_QUESTION_COUNT}</span><span>SCORE <strong>{score}</strong></span><span className={`trivia-countdown${secondsLeft <= 3 ? ' urgent' : ''}`}>⏱ {secondsLeft}s</span></div>
          </header>
          <div className={`trivia-timer${secondsLeft <= 3 ? ' urgent' : ''}`}>
            <div style={{ transform: `scaleX(${secondsLeft / QUESTION_SECONDS})` }} />
          </div>
          <h2 className="trivia-question">{currentQuestion.question}</h2>
          <div className={`trivia-options${currentQuestion.options.length === 2 ? ' true-false' : ''}`}>
            {currentQuestion.options.map((option, index) => {
              const isCorrect = option === currentQuestion.answer;
              const isSelectedWrong = selectedOption === option && !isCorrect;
              const resultClass = phase === 'feedback' && isCorrect ? ' correct' : phase === 'feedback' && isSelectedWrong ? ' wrong' : '';
              return (
                <button key={option} className={`trivia-option${resultClass}`} type="button" onClick={() => chooseOption(option)} disabled={phase !== 'playing'}>
                  <span>{String.fromCharCode(65 + index)}</span>{option}
                </button>
              );
            })}
          </div>
          <div className={`trivia-feedback${feedback.startsWith('Brilliant') ? ' positive' : ''}`} aria-live="polite">{feedback || 'Trust your first thought!'}</div>
        </div>
      )}

      {phase === 'results' && (
        <div className="trivia-results">
          <div className="trivia-kicker">TODAY’S DAILY SET · {totalDaysPlayed} {totalDaysPlayed === 1 ? 'DAY' : 'DAYS'} PLAYED</div>
          <div className="trivia-results-emoji" aria-hidden="true">{score === 5 ? '🏆' : score >= 3 ? '🌟' : '🧠'}</div>
          <h2>{messageForScore(score)}</h2>
          <div className="trivia-final-score">{score}<span> / {DAILY_QUESTION_COUNT}</span></div>
          <p>{score} out of {DAILY_QUESTION_COUNT} correct · 🔥 {currentStreak} day study streak</p>
          <div className="trivia-daily-finish">See you tomorrow! ✨</div>
        </div>
      )}
    </section>
  );
}
