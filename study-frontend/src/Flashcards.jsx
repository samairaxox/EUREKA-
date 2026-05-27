import { useState } from "react";
import axios from "axios";
import PdfUpload from "./PdfUpload";

const API = "http://localhost:8000";

export default function Flashcards() {
  const [topic, setTopic] = useState("");
  const [numCards, setNumCards] = useState(10);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    setCards([]);
    setFlipped({});
    try {
      const res = await axios.post(`${API}/flashcards`, { topic, num_cards: numCards });
      setCards(res.data.cards);
    } catch {
      setError("Could not reach the backend. Make sure uvicorn is running on port 8000.");
    }
    setLoading(false);
  };

  const toggle = (i) => setFlipped(f => ({ ...f, [i]: !f[i] }));
  const reviewed = Object.values(flipped).filter(Boolean).length;

  return (
    <div>
      <div className="panel-desc">
        Enter a topic or upload a PDF. Choose how many cards you want —
        click any card to flip between the term and its explanation.
      </div>

      <PdfUpload onExtract={(t) => { setTopic(t.slice(0, 300)); setCards([]); }} />

      <div className="inputs-row" style={{ marginTop: 16 }}>
        <div className="field">
          <label className="field-label">Topic or Extracted Text</label>
          <input type="text"
            placeholder="e.g. Organic Chemistry, Newton's Laws..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGenerate()}
          />
        </div>
        <div className="field">
          <label className="field-label">Number of Cards</label>
          <input type="number" min="1" max="30"
            value={numCards}
            onChange={e => setNumCards(Math.min(30, Math.max(1, parseInt(e.target.value) || 10)))}
          />
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <button className="submit-btn" onClick={handleGenerate} disabled={loading || !topic.trim()}>
        {loading ? <><span className="spin" /> Generating {numCards} cards...</> : <>Generate {numCards} Flashcards</>}
      </button>

      {cards.length > 0 && (
        <div className="result-box">
          <div className="result-divider">
            <div className="result-divider-line" />
            <span className="result-divider-label">{reviewed} of {cards.length} reviewed — click to flip</span>
            <div className="result-divider-line" />
          </div>
          <div className="fc-grid">
            {cards.map((card, i) => (
              <div key={i} className={`fc-card ${flipped[i] ? "fc-flipped" : ""}`} onClick={() => toggle(i)}>
                <div className="fc-inner">
                  <div className="fc-front">
                    <span className="fc-label">Front</span>
                    <span className="fc-text">{card.front}</span>
                  </div>
                  <div className="fc-back">
                    <span className="fc-label">Back</span>
                    <span className="fc-text">{card.back}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}