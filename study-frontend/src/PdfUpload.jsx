import { useState, useRef } from "react";
import axios from "axios";

const API = "http://localhost:8000";

export default function PdfUpload({ onExtract }) {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setFileName(file.name);
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/extract-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        onExtract(res.data.text);
      }
    } catch {
      setError("Failed to extract PDF. Make sure the backend is running.");
    }
    setLoading(false);
  };

  return (
    <div className="pdf-upload-box">
      <div className="pdf-upload-inner" onClick={() => inputRef.current.click()}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={handleFile}
        />
        <div className="pdf-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        </div>
        <div className="pdf-upload-text">
          {loading ? "Extracting text..." :
           fileName ? fileName :
           "Upload a PDF to auto-fill content"}
        </div>
        <div className="pdf-upload-hint">Click to browse — PDF only</div>
      </div>
      {error && <p className="error-msg" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}