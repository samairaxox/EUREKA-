import { useRef, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";
const MODES = [
  { id: "quiz", label: "Quiz" },
  { id: "summary", label: "Summary" },
  { id: "flashcards", label: "Flashcards" },
  { id: "planner", label: "Study Planner" },
];

function ResultDivider({ label }) {
  return (
    <div className="result-divider">
      <div className="result-divider-line" />
      <span className="result-divider-label">{label}</span>
      <div className="result-divider-line" />
    </div>
  );
}

function asText(raw) {
  return typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
}

function splitNumberedItems(raw) {
  return asText(raw)
    .split(/\n(?=(?:(?:Card|Question|Q)\s*)?\d+[.)\s:-])/i)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseFlashcards(raw) {
  return splitNumberedItems(raw).map((block, index) => {
    const front = block.match(/Front\s*:\s*([\s\S]*?)(?=\n\s*Back\s*:|$)/i)?.[1]?.trim();
    const back = block.match(/Back\s*:\s*([\s\S]*?)$/i)?.[1]?.trim();
    return front && back ? { front, back } : { raw: block, number: index + 1 };
  });
}

export default function RagStudy() {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [mode, setMode] = useState("quiz");
  const [numQ, setNumQ] = useState(5);
  const [numCards, setNumCards] = useState(10);
  const [examDate, setExamDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadErr("");
    setSessionId("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/rag/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!res.data?.session_id) {
        setUploadErr("The backend did not return a session ID. Please try again.");
      } else {
        setSessionId(res.data.session_id);
      }
    } catch (err) {
      setUploadErr(
        err?.response?.data?.detail ||
        "Upload failed. Make sure uvicorn is running on port 8000."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!sessionId || (mode === "planner" && !examDate)) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      let response;
      let resultKey;
      if (mode === "quiz") {
        response = await axios.post(`${API}/rag/quiz`, {
          session_id: sessionId,
          num_questions: numQ,
        });
        resultKey = "quiz";
      } else if (mode === "summary") {
        response = await axios.post(`${API}/rag/summarize`, { session_id: sessionId });
        resultKey = "summary";
      } else if (mode === "flashcards") {
        response = await axios.post(`${API}/rag/flashcards`, {
          session_id: sessionId,
          num_cards: numCards,
        });
        resultKey = "flashcards";
      } else {
        response = await axios.post(`${API}/rag/plan`, {
          session_id: sessionId,
          exam_date: examDate,
        });
        resultKey = "study_plan";
      }
      setResult({ type: mode, raw: response.data?.[resultKey] ?? "No content was returned." });
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        "Could not reach the backend. Make sure uvicorn is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  };

  const parseQuiz = (raw) => splitNumberedItems(raw);

  return (
    <div>
      <div className="panel-desc">
        Upload a PDF — the AI indexes it with FAISS and lets you create a quiz,
        summary, flashcards, or a study plan based on the document.
      </div>

      <div className="result-block" style={{ marginBottom: 0 }}>
        <div className="result-block-label">Step 1 — Upload PDF</div>
        <div
          className="pdf-drop"
          style={{
            border: "2px dashed var(--border, #334155)",
            borderRadius: 10,
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 10,
            background: "var(--card-bg, rgba(255,255,255,.03))",
            cursor: "pointer",
          }}
          onClick={() => fileRef.current?.click()}
        >
          <span style={{ fontSize: 26 }}>📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {file ? file.name : "Click to choose a PDF"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
              {file ? `${(file.size / 1024).toFixed(1)} KB` : "Only PDF files are supported"}
            </div>
          </div>
          {file && (
            <button
              type="button"
              className="reveal-btn"
              style={{ flexShrink: 0 }}
              onClick={(event) => {
                event.stopPropagation();
                setFile(null);
                setSessionId("");
                setResult(null);
                setError("");
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Clear
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) {
              setFile(selectedFile);
              setSessionId("");
              setResult(null);
              setError("");
              setUploadErr("");
            }
          }}
        />

        {uploadErr && <p className="error-msg">{uploadErr}</p>}
        <button
          className="submit-btn"
          style={{ marginTop: 14 }}
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? <><span className="spin" /> Uploading &amp; indexing…</> : "Upload & Index PDF"}
        </button>

        {sessionId && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6, wordBreak: "break-all" }}>
            ✅ Indexed — session: <code>{sessionId}</code>
          </div>
        )}
      </div>

      {sessionId && (
        <>
          <div className="result-block" style={{ marginTop: 24 }}>
            <div className="result-block-label">Step 2 — Choose Action</div>
            <div className="rag-mode-options" role="group" aria-label="RAG study mode">
              {MODES.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`reveal-btn${mode === option.id ? " chosen" : ""}`}
                  aria-pressed={mode === option.id}
                  onClick={() => { setMode(option.id); setResult(null); setError(""); }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {mode === "quiz" && (
              <div className="field rag-mode-field">
                <label className="field-label" htmlFor="rag-num-questions">Number of Questions</label>
                <input
                  id="rag-num-questions"
                  type="number"
                  min="1"
                  max="20"
                  value={numQ}
                  onChange={event => setNumQ(Math.min(20, Math.max(1, parseInt(event.target.value, 10) || 5)))}
                />
              </div>
            )}
            {mode === "flashcards" && (
              <div className="field rag-mode-field">
                <label className="field-label" htmlFor="rag-num-cards">Number of Cards</label>
                <input
                  id="rag-num-cards"
                  type="number"
                  min="1"
                  max="30"
                  value={numCards}
                  onChange={event => setNumCards(Math.min(30, Math.max(1, parseInt(event.target.value, 10) || 10)))}
                />
              </div>
            )}
            {mode === "planner" && (
              <div className="field rag-mode-field">
                <label className="field-label" htmlFor="rag-exam-date">Exam Date</label>
                <input
                  id="rag-exam-date"
                  type="date"
                  value={examDate}
                  onChange={event => setExamDate(event.target.value)}
                />
              </div>
            )}

            {error && <p className="error-msg" role="alert">{error}</p>}
            <button
              className="submit-btn"
              style={{ marginTop: 14 }}
              onClick={handleGenerate}
              disabled={loading || (mode === "planner" && !examDate)}
            >
              {loading ? <><span className="spin" /> Generating…</> : `Generate ${MODES.find(option => option.id === mode)?.label}`}
            </button>
          </div>

          {result && (
            <div className="result-box" style={{ marginTop: 24 }}>
              <ResultDivider label={MODES.find(option => option.id === result.type)?.label || "Results"} />

              {result.type === "summary" && (
                <div className="result-block">
                  <div className="result-block-label">Document Summary</div>
                  <p className="result-para" style={{ whiteSpace: "pre-wrap" }}>{asText(result.raw)}</p>
                </div>
              )}

              {result.type === "quiz" && (
                <div className="quiz-list">
                  {parseQuiz(result.raw).map((block, index) => (
                    <div className="quiz-card" key={index}>
                      <div className="quiz-q-header">
                        <span className="quiz-num">Q{index + 1}</span>
                        <span className="quiz-question" style={{ whiteSpace: "pre-wrap" }}>{block}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.type === "flashcards" && (
                <div className="rag-flashcard-results">
                  {parseFlashcards(result.raw).map((card, index) => (
                    <div className="result-block rag-flashcard-result" key={index}>
                      {card.front && card.back ? (
                        <>
                          <div className="result-block-label">Card {index + 1}</div>
                          <p><strong>Front:</strong> {card.front}</p>
                          <p><strong>Back:</strong> {card.back}</p>
                        </>
                      ) : (
                        <p className="result-para" style={{ whiteSpace: "pre-wrap" }}>{card.raw}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {result.type === "planner" && (
                <div className="result-block">
                  <div className="result-block-label">Study Plan · Exam {examDate}</div>
                  <p className="result-para" style={{ whiteSpace: "pre-wrap" }}>{asText(result.raw)}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
