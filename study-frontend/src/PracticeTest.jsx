import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";
const QUESTION_COUNTS = [10, 20, 30];

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export default function PracticeTest() {
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimit, setTimeLimit] = useState(15);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [view, setView] = useState("setup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (view !== "taking") return undefined;
    if (timeRemaining <= 0) {
      setView("results");
      return undefined;
    }
    const timer = window.setTimeout(() => setTimeRemaining(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [view, timeRemaining]);

  const startTest = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(`${API}/quiz`, {
        topic: topic.trim(),
        num_questions: numQuestions,
      });
      if (!Array.isArray(response.data?.questions) || response.data.questions.length === 0) {
        throw new Error("The backend returned no questions. Try another topic.");
      }
      setQuestions(response.data.questions);
      setAnswers({});
      setCurrentIndex(0);
      setTimeRemaining(timeLimit * 60);
      setView("taking");
    } catch (requestError) {
      setError(requestError.message === "The backend returned no questions. Try another topic."
        ? requestError.message
        : "Could not reach the backend. Make sure uvicorn is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const submitTest = () => setView("results");
  const currentQuestion = questions[currentIndex];
  const score = questions.reduce((total, question, index) => (
    total + (answers[index] === question.answer ? 1 : 0)
  ), 0);

  if (view === "taking" && currentQuestion) {
    return (
      <section className="practice-test" aria-label="Practice test">
        <header className="practice-test-header">
          <div className="practice-test-topic">{topic}</div>
          <div className={`practice-test-timer${timeRemaining <= 60 ? " urgent" : ""}`} role="timer" aria-live="off">
            <span aria-hidden="true">◷</span> {formatTime(timeRemaining)}
          </div>
          <div className="practice-test-progress">{currentIndex + 1} / {questions.length}</div>
        </header>

        <div className="practice-test-content">
          <div className="practice-question-card">
            <div className="practice-question-label">Question {currentIndex + 1}</div>
            <h2>{currentQuestion.question}</h2>
            <div className="quiz-options practice-options">
              {(currentQuestion.options || []).map((option, index) => (
                <button
                  type="button"
                  key={`${currentIndex}-${index}`}
                  className={`quiz-option${answers[currentIndex] === option ? " chosen" : ""}`}
                  onClick={() => setAnswers(current => ({ ...current, [currentIndex]: option }))}
                >
                  <span className="opt-letter">{String.fromCharCode(65 + index)}</span>
                  <span>{option}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="practice-test-controls">
          <button
            type="button"
            className="fc-nav-btn"
            onClick={() => setCurrentIndex(index => index - 1)}
            disabled={currentIndex === 0}
          >
            ← Previous
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              className="fc-nav-btn practice-next"
              onClick={() => setCurrentIndex(index => index + 1)}
            >
              Next →
            </button>
          ) : (
            <button type="button" className="submit-btn practice-submit" onClick={submitTest}>
              Submit Test
            </button>
          )}
        </footer>
        <button type="button" className="practice-finish-btn" onClick={submitTest}>
          Finish test now
        </button>
      </section>
    );
  }

  if (view === "results") {
    return (
      <section className="practice-results" aria-label="Practice test results">
        <div className="practice-results-summary">
          <div className="practice-results-eyebrow">Test complete · {topic}</div>
          <h2>{score} <span>/ {questions.length}</span></h2>
          <p>Correct answers</p>
          {timeRemaining === 0 && <div className="practice-timeout-note">Time is up. Your test was submitted automatically.</div>}
          <button
            type="button"
            className="fc-restart-btn"
            onClick={() => { setView("setup"); setError(""); }}
          >
            Start a New Test
          </button>
        </div>

        <div className="practice-review-list">
          {questions.map((question, questionIndex) => (
            <article className="practice-review-card" key={questionIndex}>
              <div className="practice-review-heading">
                <span className="quiz-num">Q{questionIndex + 1}</span>
                <h3>{question.question}</h3>
                <span className={`practice-mark${answers[questionIndex] === question.answer ? " is-correct" : " is-wrong"}`}>
                  {answers[questionIndex] === question.answer ? "Correct" : "Incorrect"}
                </span>
              </div>
              <div className="quiz-options practice-review-options">
                {(question.options || []).map((option, optionIndex) => {
                  const isCorrect = option === question.answer;
                  const isWrongSelection = answers[questionIndex] === option && !isCorrect;
                  const className = isCorrect ? "correct" : isWrongSelection ? "wrong" : "dim";
                  return (
                    <div className={`quiz-option ${className}`} key={`${questionIndex}-${optionIndex}`}>
                      <span className="opt-letter">{String.fromCharCode(65 + optionIndex)}</span>
                      <span>{option}</span>
                      {isCorrect && <span className="practice-answer-tag">Correct answer</span>}
                      {isWrongSelection && <span className="practice-answer-tag">Your answer</span>}
                    </div>
                  );
                })}
              </div>
              <div className="practice-explanation">
                <strong>Why:</strong> {question.explanation || "No explanation was provided for this question."}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="practice-setup">
      <div className="panel-desc">
        Build a timed test on any topic. Work through one question at a time and review explanations after submitting.
      </div>

      <div className="field">
        <label className="field-label" htmlFor="practice-topic">Topic</label>
        <input
          id="practice-topic"
          type="text"
          value={topic}
          placeholder="e.g. Cell Biology, Thermodynamics..."
          onChange={event => setTopic(event.target.value)}
          onKeyDown={event => event.key === "Enter" && startTest()}
        />
      </div>

      <div className="practice-setup-row">
        <div className="field">
          <span className="field-label">Number of Questions</span>
          <div className="practice-choice-group" role="group" aria-label="Number of questions">
            {QUESTION_COUNTS.map(count => (
              <button
                type="button"
                key={count}
                className={`practice-choice${numQuestions === count ? " selected" : ""}`}
                aria-pressed={numQuestions === count}
                onClick={() => setNumQuestions(count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="practice-time-limit">Time Limit (minutes)</label>
          <input
            id="practice-time-limit"
            type="number"
            min="1"
            max="180"
            value={timeLimit}
            onChange={event => setTimeLimit(Math.min(180, Math.max(1, parseInt(event.target.value, 10) || 1)))}
          />
        </div>
      </div>

      {error && <p className="error-msg" role="alert">{error}</p>}
      <button type="button" className="submit-btn" onClick={startTest} disabled={loading || !topic.trim()}>
        {loading ? <><span className="spin" /> Preparing test...</> : `Start ${numQuestions}-Question Test`}
      </button>
    </section>
  );
}
