import { useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

export default function Summarizer() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await axios.post(`${API}/summarize`, { text });
      setResult(res.data);
    } catch {
      setError("Could not reach the backend. Make sure uvicorn is running on port 8000.");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="panel-desc">
        Paste your study notes. The AI distils the content into a
        concise summary and extracts 5 key points.
      </div>

      <div className="field">
        <label className="field-label">Study Notes</label>
        <textarea
          placeholder="Paste your study notes here..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="char-count">{text.length} characters</div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <button className="submit-btn" onClick={handleSubmit} disabled={loading || !text.trim()}>
        {loading ? <><span className="spin" /> Summarizing...</> : <>Summarize Notes</>}
      </button>

      {result && (
        <div className="result-box">
          <div className="result-divider">
            <div className="result-divider-line" />
            <span className="result-divider-label">Results</span>
            <div className="result-divider-line" />
          </div>
          <div className="result-block">
            <div className="result-block-label">Summary</div>
            <p className="result-para">{result.summary}</p>
          </div>
          <div className="result-block">
            <div className="result-block-label">Key Points</div>
            <ul className="result-list">
              {result.key_points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
