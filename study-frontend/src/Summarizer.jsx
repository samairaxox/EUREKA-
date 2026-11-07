import { useState } from "react";
import { api, errorMessage, LONG_AI_TIMEOUT_MS } from './api/client';
import PdfUpload from './PdfUpload';
import BranchedMenu from './reactbits/BranchedMenu/BranchedMenu';
import { CursorPointer01Icon, Download04Icon, Layers01Icon, TextFontIcon } from '@hugeicons/core-free-icons';
import AiThinking from './components/AiThinking';

// Every option here is a real action in this tool. Detail level and format are not offered because
// the summarization endpoint does not accept them.
// Result actions appear only once a summary exists; before that they are not offered at all.
const buildMenu = hasResult => [
  {
    label: "Source",
    children: [
      { value: "paste", label: "Paste notes", icon: TextFontIcon },
      { value: "pdf", label: "Upload a PDF", icon: Download04Icon },
    ],
  },
  ...(hasResult ? [{
    label: "Result",
    children: [
      { value: "copy", label: "Copy summary", icon: CursorPointer01Icon },
      { value: "clear", label: "Start over", icon: Layers01Icon },
    ],
  }] : []),
];

export default function Summarizer() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("paste");
  const [notice, setNotice] = useState("");

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setNotice("");
    try {
      const res = await api.post(`/summarize`, { text }, { timeout: LONG_AI_TIMEOUT_MS });
      setResult(res.data);
    } catch (err) {
      setError(errorMessage(err, "The summary could not be created. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const onMenuSelect = async value => {
    setNotice("");
    if (value === "paste" || value === "pdf") {
      setSource(value);
      const target = value === "pdf" ? document.getElementById("summarizer-upload") : document.getElementById("summarizer-text");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (value === "paste") document.getElementById("summarizer-text")?.focus();
      return;
    }
    if (value === "copy") {
      if (!result) {
        setNotice("There is no summary to copy yet.");
        return;
      }
      const lines = [result.summary, "", ...(result.key_points || []).map(point => `- ${point}`)].join("\n");
      try {
        await navigator.clipboard.writeText(lines);
        setNotice("Summary copied.");
      } catch {
        setNotice("Copying is not available in this browser.");
      }
      return;
    }
    if (value === "clear") {
      setText("");
      setResult(null);
      setError("");
    }
  };

  return (
    <div>
      <div className="panel-desc">
        Paste your study notes, or upload a PDF to fill them in. The AI distils the content into a
        concise summary and extracts 5 key points.
      </div>

      <div className="summarizer-menu">
        <BranchedMenu key={result ? "result" : "source"} items={buildMenu(Boolean(result))} defaultOpen={[0, 1]} defaultActive={source === "pdf" ? "pdf" : "paste"} onSelect={onMenuSelect} color="#2B2640" accentColor="#5B4FCF" lineColor="rgba(43,38,64,0.28)" />
      </div>
      {notice && <p className="form-status" role="status">{notice}</p>}

      <div className="field" id="summarizer-upload">
        <PdfUpload onExtract={extracted => { setText(extracted); setSource("paste"); setNotice("Text extracted from your PDF. Review it, then summarize."); }} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="summarizer-text">Study Notes</label>
        <textarea
          id="summarizer-text"
          placeholder="Paste your study notes here..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="char-count">{text.length} characters</div>
      </div>

      {error && <p className="error-msg" role="alert">{error}</p>}

      <button className="submit-btn" onClick={handleSubmit} disabled={loading || !text.trim()}>
        {loading ? "Summarizing..." : "Summarize Notes"}
      </button>
      <AiThinking active={loading} label="Preparing your summary…" />

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
              {(result.key_points || []).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
