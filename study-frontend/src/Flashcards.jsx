import { useEffect, useState } from "react";
import axios from "axios";
import { markTodayAsStudied } from './streak';

const API = "http://localhost:8000";

export default function Flashcards() {
  useEffect(() => { markTodayAsStudied(); }, []);
  const [mode, setMode] = useState("ai");
  const [topic, setTopic] = useState("");
  const [numCards, setNumCards] = useState(10);
  const [cards, setCards] = useState([]);
  const [manualCards, setManualCards] = useState([{ id: 1, front: "", back: "" }]);
  const [nextManualId, setNextManualId] = useState(2);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studyMode) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [studyMode]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    setStudyMode(true);
    setCards([]);
    setCurrentIndex(0);
    setFlipped(false);
    try {
      const res = await axios.post(`${API}/flashcards`, { topic, num_cards: numCards });
      if (!Array.isArray(res.data?.cards)) {
        throw new Error("The backend returned an invalid flashcard response.");
      }
      if (res.data.cards.length === 0) {
        throw new Error("No flashcards were returned. Try another topic.");
      }
      setCards(res.data.cards);
    } catch (err) {
      setError(err.message === "The backend returned an invalid flashcard response."
        || err.message === "No flashcards were returned. Try another topic."
        ? err.message
        : "Could not reach the backend. Make sure uvicorn is running on port 8000.");
      setStudyMode(false);
    } finally {
      setLoading(false);
    }
  };

  const startManualStudy = () => {
    const incomplete = manualCards.some(card => !card.front.trim() || !card.back.trim());
    if (incomplete) {
      setError("Add a term and definition to each card before starting study mode.");
      return;
    }
    setError("");
    setCards(manualCards.map(({ front, back }) => ({ front: front.trim(), back: back.trim() })));
    setCurrentIndex(0);
    setFlipped(false);
    setStudyMode(true);
  };

  const addManualCard = () => {
    setManualCards(current => [...current, { id: nextManualId, front: "", back: "" }]);
    setNextManualId(id => id + 1);
    setError("");
  };

  const updateManualCard = (id, field, value) => {
    setManualCards(current => current.map(card => card.id === id ? { ...card, [field]: value } : card));
    setError("");
  };

  const removeManualCard = (id) => {
    setManualCards(current => current.length === 1
      ? [{ ...current[0], front: "", back: "" }]
      : current.filter(card => card.id !== id));
    setError("");
  };

  const goToCard = (index) => {
    setCurrentIndex(index);
    setFlipped(false);
  };

  const currentCard = cards[currentIndex];

  if (studyMode) {
    return (
      <section className="fc-fullscreen" aria-label="Flashcard study mode">
        <header className="fc-fullscreen-header">
          <button
            type="button"
            className="fc-exit-btn"
            onClick={() => setStudyMode(false)}
            aria-label="Exit study mode and return to inputs"
          >
            <span aria-hidden="true">×</span><span className="fc-exit-label">Exit</span>
          </button>
          <h1 className="fc-fullscreen-title">Study Mode — EUREKA Flashcards</h1>
          {currentCard ? (
            <span className="fc-progress-count" aria-live="polite">
              {currentIndex + 1} / {cards.length}
            </span>
          ) : <span className="fc-progress-count" aria-hidden="true" />}
        </header>

        <div className="fc-study-stage">
          {loading ? (
            <div className="fc-loading" role="status">
              <span className="spin" />
              <span>Generating {numCards} flashcards...</span>
            </div>
          ) : currentCard ? (
            <button
              type="button"
              className={`fc-study-card${flipped ? " fc-study-card-flipped" : ""}`}
              onClick={() => setFlipped(value => !value)}
              aria-label={flipped ? "Show term" : "Show definition"}
              aria-pressed={flipped}
            >
              <span className="fc-study-card-inner">
                <span className="fc-study-face fc-study-front">
                  <span className="fc-label">Term</span>
                  <span className="fc-study-text">{currentCard.front}</span>
                  <span className="fc-study-hint">Click to flip</span>
                </span>
                <span className="fc-study-face fc-study-back">
                  <span className="fc-label">Definition</span>
                  <span className="fc-study-text">{currentCard.back}</span>
                  <span className="fc-study-hint">Click to flip back</span>
                </span>
              </span>
            </button>
          ) : null}
        </div>

        {currentCard && (
          <footer className="fc-study-controls">
            <button
              type="button"
              className="fc-nav-btn"
              onClick={() => goToCard(currentIndex - 1)}
              disabled={currentIndex === 0}
              aria-label="Previous card"
            >
              <span aria-hidden="true">←</span> Previous
            </button>
            <button
              type="button"
              className="fc-restart-btn"
              onClick={() => goToCard(0)}
              disabled={currentIndex === 0 && !flipped}
            >
              Restart
            </button>
            <button
              type="button"
              className="fc-nav-btn"
              onClick={() => goToCard(currentIndex + 1)}
              disabled={currentIndex === cards.length - 1}
              aria-label="Next card"
            >
              Next <span aria-hidden="true">→</span>
            </button>
          </footer>
        )}
      </section>
    );
  }

  return (
    <div>
      <div className="panel-desc">
        Create a deck with AI or write your own terms and definitions, then study one card at a time.
      </div>

      <div className="fc-mode-tabs" role="tablist" aria-label="Flashcard creation mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "ai"}
          className={`fc-mode-tab${mode === "ai" ? " active" : ""}`}
          onClick={() => { setMode("ai"); setError(""); }}
        >
          AI Generate
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          className={`fc-mode-tab${mode === "manual" ? " active" : ""}`}
          onClick={() => { setMode("manual"); setError(""); }}
        >
          Create Your Own
        </button>
      </div>

      {mode === "ai" ? (
        <div role="tabpanel" aria-label="AI Generate flashcards">
          <div className="inputs-row" style={{ marginTop: 16 }}>
            <div className="field">
              <label className="field-label" htmlFor="flashcard-topic">Topic or Extracted Text</label>
              <input
                id="flashcard-topic"
                type="text"
                placeholder="e.g. Organic Chemistry, Newton's Laws..."
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGenerate()}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="flashcard-count">Number of Cards</label>
              <input
                id="flashcard-count"
                type="number"
                min="1"
                max="30"
                value={numCards}
                onChange={e => setNumCards(Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 10)))}
              />
            </div>
          </div>

          {error && <p className="error-msg" role="alert">{error}</p>}
          <button className="submit-btn" onClick={handleGenerate} disabled={loading || !topic.trim()}>
            Generate {numCards} Flashcards
          </button>
        </div>
      ) : (
        <div className="fc-manual-panel" role="tabpanel" aria-label="Create your own flashcards">
          <div className="fc-manual-heading">
            <div>
              <h2>Create Your Own</h2>
              <p>Add as many term and definition pairs as you need.</p>
            </div>
            <span className="fc-manual-count">{manualCards.length} {manualCards.length === 1 ? "card" : "cards"}</span>
          </div>

          <div className="fc-manual-list">
            {manualCards.map((card, index) => (
              <section className="fc-manual-card" key={card.id} aria-label={`Flashcard ${index + 1}`}>
                <div className="fc-manual-card-heading">
                  <span>Card {String(index + 1).padStart(2, "0")}</span>
                  <button
                    type="button"
                    className="fc-remove-btn"
                    onClick={() => removeManualCard(card.id)}
                    aria-label={`Remove card ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
                <div className="fc-manual-fields">
                  <div className="field">
                    <label className="field-label" htmlFor={`fc-front-${card.id}`}>Front · Term</label>
                    <textarea
                      id={`fc-front-${card.id}`}
                      value={card.front}
                      onChange={e => updateManualCard(card.id, "front", e.target.value)}
                      placeholder="Enter a term or question"
                      rows="2"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={`fc-back-${card.id}`}>Back · Definition</label>
                    <textarea
                      id={`fc-back-${card.id}`}
                      value={card.back}
                      onChange={e => updateManualCard(card.id, "back", e.target.value)}
                      placeholder="Enter its definition or answer"
                      rows="2"
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>

          {error && <p className="error-msg" role="alert">{error}</p>}
          <div className="fc-manual-actions">
            <button type="button" className="fc-add-btn" onClick={addManualCard}>
              <span aria-hidden="true">＋</span> Add another card
            </button>
            <button type="button" className="submit-btn" onClick={startManualStudy}>
              Start Study Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
