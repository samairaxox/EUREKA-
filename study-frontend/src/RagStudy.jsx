import { useState, useRef } from "react";
import axios from "axios";

const API = "http://localhost:8000";

/* ── small helpers ──────────────────────────────── */
function ResultDivider({ label }) {
  return (
    <div className="result-divider">
      <div className="result-divider-line" />
      <span className="result-divider-label">{label}</span>
      <div className="result-divider-line" />
    </div>
  );
}

/* ── main component ──────────────────────────────── */
export default function RagStudy() {
  const fileRef = useRef(null);

  // upload state
  const [file, setFile]             = useState(null);
  const [sessionId, setSessionId]   = useState("");
  const [uploading, setUploading]   = useState(false);
  const [uploadErr, setUploadErr]   = useState("");

  // mode & output
  const [mode, setMode]             = useState("quiz"); // "quiz" | "summarize"
  const [numQ, setNumQ]             = useState(5);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState("");

  // quiz interaction

  /* ── upload PDF ─────────────────────────────── */
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
    } catch (e) {
      setUploadErr(
        e?.response?.data?.detail ||
        "Upload failed. Make sure uvicorn is running on port 8000."
      );
    }
    setUploading(false);
  };

  /* ── generate quiz / summary ─────────────────── */
  const handleGenerate = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      if (mode === "quiz") {
        const res = await axios.post(`${API}/rag/quiz`, {
          session_id: sessionId,
          num_questions: numQ,
        });
        setResult({ type: "quiz", raw: res.data?.quiz ?? "No quiz content was returned." });
      } else {
        const res = await axios.post(`${API}/rag/summarize`, {
          session_id: sessionId,
        });
        setResult({ type: "summary", raw: res.data?.summary ?? "No summary content was returned." });
      }
    } catch (e) {
      setError(
        e?.response?.data?.detail ||
        "Could not reach the backend. Make sure uvicorn is running on port 8000."
      );
    }
    setLoading(false);
  };

  /* ── quiz helpers ───────────────────────────── */
  const parseQuiz = (raw) => {
    // The LLM returns free-text MCQs; we surface them as readable blocks.
    // Split on numbered question boundaries e.g. "1." / "Q1" etc.
    const text = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
    return text
      .split(/\n(?=(?:Q?\d+[.)]\s))/i)
      .map((s) => s.trim())
      .filter(Boolean);
  };


  /* ── render ─────────────────────────────────── */
  return (
    <div>
      <div className="panel-desc">
        Upload a PDF — the AI indexes it with FAISS and lets you generate a
        quiz or a structured summary straight from the document content.
      </div>

      {/* ── Step 1: upload ── */}
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
              {file
                ? `${(file.size / 1024).toFixed(1)} KB`
                : "Only PDF files are supported"}
            </div>
          </div>
          {file && (
            <button
              className="reveal-btn"
              style={{ flexShrink: 0 }}
              onClick={(e) => {
                e.stopPropagation();
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
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setSessionId(""); setResult(null); setError(""); setUploadErr(""); }
          }}
        />

        {uploadErr && <p className="error-msg">{uploadErr}</p>}

        <button
          className="submit-btn"
          style={{ marginTop: 14 }}
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? (
            <><span className="spin" /> Uploading &amp; indexing…</>
          ) : (
            <>Upload &amp; Index PDF</>
          )}
        </button>

        {sessionId && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              opacity: 0.6,
              wordBreak: "break-all",
            }}
          >
            ✅ Indexed — session: <code>{sessionId}</code>
          </div>
        )}
      </div>

      {/* ── Step 2: choose mode (only after upload) ── */}
      {sessionId && (
        <>
          <div className="result-block" style={{ marginTop: 24 }}>
            <div className="result-block-label">Step 2 — Choose Action</div>

            <div className="inputs-row" style={{ marginTop: 12, gap: 10 }}>
              {/* Mode toggle */}
              <div className="field" style={{ flex: "0 0 auto" }}>
                <label className="field-label">Mode</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {["quiz", "summarize"].map((m) => (
                    <button
                      key={m}
                      className={`reveal-btn${mode === m ? " chosen" : ""}`}
                      style={{
                        fontWeight: mode === m ? 700 : 400,
                        opacity: mode === m ? 1 : 0.6,
                      }}
                      onClick={() => { setMode(m); setResult(null); }}
                    >
                      {m === "quiz" ? "📝 Quiz" : "📋 Summary"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Num questions — only for quiz */}
              {mode === "quiz" && (
                <div className="field">
                  <label className="field-label">Number of Questions</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={numQ}
                    onChange={(e) =>
                      setNumQ(Math.min(20, Math.max(1, parseInt(e.target.value) || 5)))
                    }
                  />
                </div>
              )}
            </div>

            {error && <p className="error-msg">{error}</p>}

            <button
              className="submit-btn"
              style={{ marginTop: 14 }}
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <><span className="spin" /> Generating…</>
              ) : mode === "quiz" ? (
                <>Generate {numQ} Questions from PDF</>
              ) : (
                <>Summarize PDF</>
              )}
            </button>
          </div>

          {/* ── Results ── */}
          {result && (
            <div className="result-box" style={{ marginTop: 24 }}>
              {result.type === "summary" && (
                <>
                  <ResultDivider label="Summary" />
                  <div className="result-block">
                    <div className="result-block-label">Document Summary</div>
                    <p className="result-para" style={{ whiteSpace: "pre-wrap" }}>
                      {result.raw}
                    </p>
                  </div>
                </>
              )}

              {result.type === "quiz" && (
                <>
                  <ResultDivider
                    label={
                      "Quiz"
                    }
                  />
                  <div className="quiz-list">
                    {parseQuiz(result.raw).map((block, qi) => (
                      <div key={qi} className="quiz-card">
                        <div className="quiz-q-header">
                          <span className="quiz-num">Q{qi + 1}</span>
                          <span
                            className="quiz-question"
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {block}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
