import { useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

export default function Quiz() {
  const [topic, setTopic] = useState("");
  const [numQ, setNumQ] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [revealed, setRevealed] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    setQuestions([]);
    setSelected({});
    setRevealed({});
    try {
      const res = await axios.post(`${API}/quiz`, { topic, num_questions: numQ });
      setQuestions(res.data.questions);
    } catch {
      setError("Could not reach the backend. Make sure uvicorn is running on port 8000.");
    }
    setLoading(false);
  };

  const handleSelect = (qi, opt) => { if (!revealed[qi]) setSelected(s => ({ ...s, [qi]: opt })); };
  const handleReveal = (qi) => { if (selected[qi]) setRevealed(r => ({ ...r, [qi]: true })); };

  const score = questions.filter((q, i) => revealed[i] && selected[i] === q.answer).length;
  const attempted = Object.keys(revealed).length;

  return (
    <div>
      <div className="panel-desc">
        Enter a topic. Choose how many questions you want —
        the AI generates MCQs with instant answer reveal and score tracking.
      </div>

      <div className="inputs-row">
        <div className="field">
          <label className="field-label">Topic or Extracted Text</label>
          <input type="text"
            placeholder="e.g. Photosynthesis, World War II..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGenerate()}
          />
        </div>
        <div className="field">
          <label className="field-label">Number of Questions</label>
          <input type="number" min="1" max="20"
            value={numQ}
            onChange={e => setNumQ(Math.min(20, Math.max(1, parseInt(e.target.value) || 5)))}
          />
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <button className="submit-btn" onClick={handleGenerate} disabled={loading || !topic.trim()}>
        {loading ? <><span className="spin" /> Generating {numQ} questions...</> : <>Generate {numQ} Questions</>}
      </button>

      {questions.length > 0 && (
        <div className="result-box">
          <div className="result-divider">
            <div className="result-divider-line" />
            <span className="result-divider-label">
              {attempted}/{questions.length} answered — Score: {score}/{attempted || "—"}
            </span>
            <div className="result-divider-line" />
          </div>
          <div className="quiz-list">
            {questions.map((q, qi) => {
              const isRevealed = revealed[qi];
              return (
                <div key={qi} className="quiz-card">
                  <div className="quiz-q-header">
                    <span className="quiz-num">Q{qi + 1}</span>
                    <span className="quiz-question">{q.question}</span>
                  </div>
                  <div className="quiz-options">
                    {q.options.map((opt, oi) => {
                      let cls = "quiz-option";
                      if (isRevealed) {
                        if (opt === q.answer) cls += " correct";
                        else if (selected[qi] === opt) cls += " wrong";
                        else cls += " dim";
                      } else if (selected[qi] === opt) cls += " chosen";
                      return (
                        <button key={oi} className={cls} onClick={() => handleSelect(qi, opt)}>
                          <span className="opt-letter">{String.fromCharCode(65 + oi)}</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!isRevealed
                    ? <button className="reveal-btn" onClick={() => handleReveal(qi)} disabled={!selected[qi]}>Reveal Answer</button>
                    : <div className="answer-badge">{selected[qi] === q.answer ? "Correct" : `Incorrect — Answer: ${q.answer}`}</div>
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
