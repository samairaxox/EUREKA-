import { useEffect, useState } from "react";
import axios from "axios";
import "./AnswerRush.css";

const API = "http://localhost:8000";
const FEEDBACK_TIME = 420;

export default function AnswerRush() {
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [phase, setPhase] = useState("setup");
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [gameOverReason, setGameOverReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startGame = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(`${API}/quiz`, {
        topic: topic.trim(),
        num_questions: 10,
      });
      const generatedQuestions = response.data?.questions;
      if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
        throw new Error("The backend returned no questions. Try another topic.");
      }
      setQuestions(generatedQuestions.slice(0, 10));
      setQuestionIndex(0);
      setScore(0);
      setStreak(0);
      setBestStreak(0);
      setQuestionsAnswered(0);
      setSelectedAnswer(null);
      setGameOverReason("");
      setPhase("playing");
    } catch (requestError) {
      setError(requestError.message === "The backend returned no questions. Try another topic."
        ? requestError.message
        : "Could not reach the backend. Make sure uvicorn is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phase !== "correct-feedback" && phase !== "wrong-feedback" && phase !== "ground-hit-feedback") return undefined;
    const feedbackTimer = window.setTimeout(() => {
      if (phase === "correct-feedback" && questionIndex < questions.length - 1) {
        setQuestionIndex(index => index + 1);
        setSelectedAnswer(null);
        setPhase("playing");
      } else {
        setPhase("game-over");
      }
    }, FEEDBACK_TIME);
    return () => window.clearTimeout(feedbackTimer);
  }, [phase, questionIndex, questions.length]);

  const answerQuestion = (option, optionIndex) => {
    if (phase !== "playing") return;
    const currentQuestion = questions[questionIndex];
    const correct = option === currentQuestion.answer;
    setSelectedAnswer(optionIndex);
    setQuestionsAnswered(count => count + 1);
    if (correct) {
      setScore(points => points + 10);
      setStreak(value => value + 1);
      setBestStreak(value => Math.max(value, streak + 1));
      setPhase("correct-feedback");
    } else {
      setStreak(0);
      setGameOverReason("wrong");
      setPhase("wrong-feedback");
    }
  };

  const bubbleHitGround = (event, isCorrectBubble) => {
    if (!isCorrectBubble) return;
    if (event.target !== event.currentTarget || event.animationName !== "bubble-fall" || phase !== "playing") return;
    setGameOverReason("ground");
    setPhase("ground-hit-feedback");
  };

  const changeTopic = () => {
    setPhase("setup");
    setQuestions([]);
    setTopic("");
    setError("");
    setGameOverReason("");
  };

  const currentQuestion = questions[questionIndex];

  if (phase === "setup") {
    return (
      <section className="answer-rush" aria-label="Answer Rush setup">
        <div className="answer-rush-kicker"><span>⚡</span> QUICK THINKING · QUICK POINTS</div>
        <h2 className="answer-rush-title">Answer Rush</h2>
        <p className="answer-rush-copy">Ten questions. Four answers. Keep the right bubbles off the ground and your streak alive.</p>
        <div className="field answer-rush-topic-field">
          <label className="field-label" htmlFor="answer-rush-topic">Choose a topic</label>
          <input
            id="answer-rush-topic"
            type="text"
            value={topic}
            placeholder="e.g. Cell Biology, World History..."
            onChange={event => setTopic(event.target.value)}
            onKeyDown={event => event.key === "Enter" && startGame()}
          />
        </div>
        {error && <p className="error-msg" role="alert">{error}</p>}
        <button className="submit-btn answer-rush-start" type="button" onClick={startGame} disabled={loading || !topic.trim()}>
          {loading ? <><span className="spin" /> Getting questions...</> : <>Start Game <span aria-hidden="true">→</span></>}
        </button>
      </section>
    );
  }

  if (phase === "game-over") {
    return (
      <section className="answer-rush answer-rush-results" aria-label="Answer Rush results">
        <div className="answer-rush-kicker"><span>⚡</span> RUN COMPLETE · {topic}</div>
        <h2 className="answer-rush-title">{gameOverReason === "ground" ? "A bubble hit the ground!" : gameOverReason === "wrong" ? "Wrong bubble!" : "Run complete!"}</h2>
        {error && <p className="error-msg" role="alert">{error}</p>}
        <div className="answer-rush-score">{score}<span>PTS</span></div>
        <div className="answer-rush-stats">
          <div className="answer-rush-stat"><strong>{bestStreak}</strong><span>Best streak</span></div>
          <div className="answer-rush-stat"><strong>{questionsAnswered} / {questions.length}</strong><span>Questions answered</span></div>
        </div>
        <div className="answer-rush-result-actions">
          <button className="submit-btn" type="button" onClick={startGame} disabled={loading}>
            {loading ? "Getting questions..." : "Play Again"}
          </button>
          <button className="fc-nav-btn" type="button" onClick={changeTopic}>Change Topic</button>
        </div>
      </section>
    );
  }

  if (!currentQuestion) return null;

  return (
    <section className={`answer-rush answer-rush-game${phase === "correct-feedback" ? " is-correct" : ""}${phase === "wrong-feedback" ? " is-wrong" : ""}${phase === "ground-hit-feedback" ? " is-ground-hit" : ""}`} aria-label="Answer Rush game">
      <header className="answer-rush-game-header">
        <div>
          <div className="answer-rush-kicker"><span>⚡</span> ANSWER RUSH</div>
          <div className="answer-rush-topic">{topic}</div>
        </div>
        <div className="answer-rush-question-progress">QUESTION <strong>{questionIndex + 1}</strong><span> / {questions.length}</span></div>
        <div className="answer-rush-score-chip"><span>Score</span><strong>{score}</strong></div>
      </header>
      <div key={questionIndex} className="answer-rush-round">
        <h2 className="answer-rush-question">{currentQuestion.question}</h2>
        <div className="answer-rush-meta"><span>STREAK <strong>{streak}</strong></span><span>Choose before they land</span></div>
        <div className="answer-rush-bubble-field" aria-label="Falling answer choices">
          {(currentQuestion.options || []).map((option, optionIndex) => {
            const isSelected = optionIndex === selectedAnswer;
            const outcome = phase === "correct-feedback" && isSelected ? " correct" : phase === "wrong-feedback" && isSelected ? " wrong" : phase === "ground-hit-feedback" ? " falling-danger" : "";
            const baseLeft = [1, 25, 49, 73][optionIndex];
            const drift = ((questionIndex * 13 + optionIndex * 17) % 19) - 9;
            const left = Math.max(0, Math.min(74, baseLeft + ((questionIndex * 5 + optionIndex * 3) % 9) - 4));
            const speedFactor = [1.08, 0.94, 1.16, 1][optionIndex];
            const fallDuration = Math.max(2.2, (6.4 - questionIndex * 0.42) * speedFactor);
            return (
              <button
                type="button"
                className={`answer-rush-option bubble-${String.fromCharCode(97 + optionIndex)}${outcome}`}
                key={`${questionIndex}-${optionIndex}`}
                onClick={() => answerQuestion(option, optionIndex)}
                onAnimationEnd={event => bubbleHitGround(event, option === currentQuestion.answer)}
                style={{ left: `${left}%`, "--bubble-left": `${left}%`, "--fall-duration": `${fallDuration}s`, "--drift": `${drift}px`, "--wobble-duration": `${1.8 + optionIndex * 0.27}s`, "--bubble-delay": `${optionIndex * 65}ms` }}
                disabled={phase !== "playing"}
              >
                <span className="answer-rush-bubble-letter">{String.fromCharCode(65 + optionIndex)}</span>
                <span className="answer-rush-bubble-copy">{option}</span>
                {isSelected && phase === "correct-feedback" && <span className="answer-rush-sparkle" aria-hidden="true">✦ ✧ ✦</span>}
              </button>
            );
          })}
          <div className="answer-rush-ground" aria-hidden="true"><span>GROUND</span></div>
        </div>
      </div>
    </section>
  );
}
