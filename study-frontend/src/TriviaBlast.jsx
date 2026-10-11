import { useEffect, useState } from 'react';
import { markTodayAsStudied } from './streak';

const QUESTION_SECONDS = 10;

const TRIVIA_QUESTIONS = [
  { question: 'Sharks existed before trees. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Sharks have been around for roughly 400 million years; the earliest trees appeared later.' },
  { question: 'As of 2026, which planet has the most confirmed moons?', options: ['Jupiter', 'Saturn', 'Neptune', 'Uranus'], answer: 'Saturn', fact: 'NASA lists Saturn as the planet with the most confirmed moons.' },
  { question: 'Which language has the most speakers worldwide when second-language speakers are included?', options: ['Mandarin Chinese', 'Spanish', 'English', 'Hindi'], answer: 'English', fact: 'English has the largest total number of speakers, while Mandarin has the most native speakers.' },
  { question: 'How many hearts does an octopus have?', options: ['One', 'Two', 'Three', 'Four'], answer: 'Three', fact: 'Two hearts pump blood to the gills, and one pumps it to the rest of the body.' },
  { question: 'What is the largest desert on Earth?', options: ['Sahara', 'Gobi', 'Arabian', 'Antarctica'], answer: 'Antarctica', fact: 'A desert is defined by its low precipitation, and Antarctica is the largest one.' },
  { question: 'A banana is botanically a berry. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Botanically, bananas are berries; strawberries are not.' },
  { question: 'On Venus, one rotation takes longer than one trip around the Sun. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Venus rotates very slowly: its sidereal day is longer than its year.' },
  { question: 'Butterflies taste with their feet. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Taste sensors on their feet help butterflies identify plants.' },
  { question: 'What is the fastest land animal?', options: ['Lion', 'Cheetah', 'Pronghorn', 'Ostrich'], answer: 'Cheetah', fact: 'Cheetahs can sprint faster than any other land animal.' },
  { question: 'A lightning bolt can be hotter than the surface of the Sun. True or false?', options: ['True', 'False'], answer: 'True', fact: 'The air in a lightning channel can briefly reach around 30,000 kelvin.' },
  { question: 'Which mammals are capable of powered flight?', options: ['Flying squirrels', 'Sugar gliders', 'Bats', 'Colugos'], answer: 'Bats', fact: 'Bats are the only mammals capable of sustained powered flight.' },
  { question: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], answer: 'Canberra', fact: 'Canberra was selected as the capital between the rival cities of Sydney and Melbourne.' },
  { question: 'Wombats produce cube-shaped droppings. True or false?', options: ['True', 'False'], answer: 'True', fact: 'The shape forms in the wombat’s intestine and helps keep the droppings from rolling away.' },
  { question: 'The University of Oxford was teaching before the Aztec Empire was founded. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Teaching at Oxford dates to at least 1096; the Aztec Empire was founded in the 15th century.' },
  { question: 'Sharks are mammals. True or false?', options: ['True', 'False'], answer: 'False', fact: 'Sharks are fish. They breathe through gills and have skeletons made mostly of cartilage.' },
  { question: 'What is the closest star to Earth?', options: ['Sirius', 'Proxima Centauri', 'The Sun', 'Alpha Centauri A'], answer: 'The Sun', fact: 'The Sun is a star and is by far the closest one to Earth.' },
  { question: 'How do whales breathe?', options: ['Through gills', 'Through blowholes connected to lungs', 'Through their skin', 'They do not breathe air'], answer: 'Through blowholes connected to lungs', fact: 'Whales are mammals and must surface to breathe air through their blowholes.' },
  { question: 'What is the smallest bone in the human body?', options: ['Stapes', 'Patella', 'Ulna', 'Coccyx'], answer: 'Stapes', fact: 'The stapes is a tiny bone in the middle ear.' },
  { question: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 'Pacific', fact: 'The Pacific Ocean covers more area than any other ocean.' },
  { question: 'What is a group of flamingos sometimes called?', options: ['A flamboyance', 'A parliament', 'A tower', 'A crash'], answer: 'A flamboyance', fact: '“Flamboyance” is a collective noun used for a group of flamingos.' },
  { question: 'How many legs does a spider have?', options: ['Six', 'Eight', 'Ten', 'Twelve'], answer: 'Eight', fact: 'Spiders are arachnids, which have eight legs.' },
  { question: 'Sound travels faster through water than through air. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Sound generally travels faster in water because its molecules are closer together.' },
  { question: 'Which continent has the most countries?', options: ['Asia', 'Europe', 'Africa', 'South America'], answer: 'Africa', fact: 'Africa has more sovereign countries than any other continent.' },
  { question: 'Which element has the chemical symbol Au?', options: ['Silver', 'Gold', 'Aluminium', 'Copper'], answer: 'Gold', fact: 'Au comes from the Latin word aurum, meaning gold.' },
  { question: 'What is the largest planet in our solar system?', options: ['Saturn', 'Neptune', 'Earth', 'Jupiter'], answer: 'Jupiter', fact: 'Jupiter is the largest planet by both diameter and mass.' },
  { question: 'How many bones are typically in an adult human body?', options: ['186', '206', '226', '246'], answer: '206', fact: 'Most adults have 206 bones; some bones fuse as a person grows.' },
  { question: 'Tardigrades have survived exposure to the vacuum of space for limited periods. True or false?', options: ['True', 'False'], answer: 'True', fact: 'Some tardigrades can survive extreme conditions, including brief exposure to space vacuum.' },
  { question: 'Which planet spins almost on its side?', options: ['Mars', 'Uranus', 'Mercury', 'Venus'], answer: 'Uranus', fact: 'Uranus has an extreme axial tilt of about 98 degrees.' },
  { question: 'Which bird can fly backwards?', options: ['Swift', 'Hummingbird', 'Kingfisher', 'Albatross'], answer: 'Hummingbird', fact: 'Hummingbirds can hover and fly backwards thanks to the motion of their wings.' },
  { question: 'What is Scotland’s national animal?', options: ['Red deer', 'Golden eagle', 'Unicorn', 'Highland cow'], answer: 'Unicorn', fact: 'The unicorn is Scotland’s national animal and appears in its heraldry.' },
];

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
}

export default function TriviaBlast() {
  useEffect(() => { markTodayAsStudied(); }, []);
  const [round, setRound] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [phase, setPhase] = useState('intro');
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState('');

  const startGame = () => {
    setRound(shuffle(TRIVIA_QUESTIONS));
    setQuestionIndex(0);
    setScore(0);
    setSecondsLeft(QUESTION_SECONDS);
    setSelectedOption(null);
    setFeedback('');
    setPhase('playing');
  };

  useEffect(() => {
    if (phase !== 'playing') return undefined;
    if (secondsLeft === 0) {
      setSelectedOption(null);
      setFeedback('Time is up!');
      setPhase('feedback');
      return undefined;
    }
    const countdown = window.setTimeout(() => setSecondsLeft(value => value - 1), 1000);
    return () => window.clearTimeout(countdown);
  }, [phase, secondsLeft]);

  useEffect(() => {
    if (phase !== 'feedback') return undefined;
    const nextQuestion = window.setTimeout(() => {
      if (questionIndex === round.length - 1) {
        setPhase('results');
        return;
      }
      setQuestionIndex(index => index + 1);
      setSecondsLeft(QUESTION_SECONDS);
      setSelectedOption(null);
      setFeedback('');
      setPhase('playing');
    }, 850);
    return () => window.clearTimeout(nextQuestion);
  }, [phase, questionIndex, round.length]);

  const currentQuestion = round[questionIndex];
  const chooseOption = option => {
    if (phase !== 'playing') return;
    setSelectedOption(option);
    const isCorrect = option === currentQuestion.answer;
    if (isCorrect) setScore(value => value + 1);
    setFeedback(isCorrect ? 'Brilliant! ✨' : `Not quite! ${currentQuestion.fact}`);
    setPhase('feedback');
  };

  return (
    <section className="trivia-blast" aria-label="Trivia Blast">
      {phase === 'intro' && (
        <div className="trivia-intro">
          <div className="trivia-kicker">🧠 QUICK-FIRE KNOWLEDGE</div>
          <h2>Trivia Blast</h2>
          <p>Thirty curious facts. Ten seconds each. How many can you get right?</p>
          <button className="submit-btn trivia-start" type="button" onClick={startGame}>Let’s Play <span>→</span></button>
        </div>
      )}

      {(phase === 'playing' || phase === 'feedback') && currentQuestion && (
        <div className="trivia-game" key={questionIndex}>
          <header className="trivia-game-header">
            <div className="trivia-kicker">🧠 TRIVIA BLAST</div>
            <div className="trivia-stats"><span>QUESTION <strong>{questionIndex + 1}</strong> / {round.length}</span><span>SCORE <strong>{score}</strong></span><span className={`trivia-countdown${secondsLeft <= 3 ? ' urgent' : ''}`}>⏱ {secondsLeft}s</span></div>
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
          <div className="trivia-kicker">ROUND COMPLETE · 30 QUESTIONS</div>
          <div className="trivia-results-emoji" aria-hidden="true">{score >= 24 ? '🏆' : score >= 15 ? '🌟' : '🧠'}</div>
          <h2>{score >= 24 ? 'Trivia legend!' : score >= 15 ? 'Great run!' : 'Keep getting curious!'}</h2>
          <div className="trivia-final-score">{score}<span> / {round.length}</span></div>
          <p>You got {score} {score === 1 ? 'answer' : 'answers'} right.</p>
          <button className="submit-btn trivia-start" type="button" onClick={startGame}>Play Again <span>↻</span></button>
        </div>
      )}
    </section>
  );
}
