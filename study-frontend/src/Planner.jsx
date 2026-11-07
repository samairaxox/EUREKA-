import { useState } from 'react';
import AiThinking from "./components/AiThinking";
import { api, LONG_AI_TIMEOUT_MS } from './api/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PdfUpload from './PdfUpload';
import { formatScheduleDate, normalizeScheduleResponse } from './scheduleUtils';
import './Studymind.css';

export default function Planner() {
  const [topic, setTopic] = useState('');
  const [startDate, setStartDate] = useState('');
  const [examDate, setExamDate] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [pdfSessionId, setPdfSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Build the local calendar date without UTC conversion (which can shift the
  // date for users west of UTC).
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const handleSubmit = async () => {
    if ((!topic.trim() && !pdfSessionId) || !examDate || !startDate || examDate < startDate) return;
    setLoading(true);
    setError('');
    setSchedule([]);
    try {
      const res = pdfSessionId
        ? await api.post('/rag/plan', {
          session_id: pdfSessionId,
          exam_date: examDate,
          start_date: startDate,
        }, { timeout: LONG_AI_TIMEOUT_MS })
        : await api.post('/plan', {
          topic,
          exam_date: examDate,
          start_date: startDate,
        }, { timeout: LONG_AI_TIMEOUT_MS });
      setSchedule(normalizeScheduleResponse(res.data));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not generate the schedule. Please try again.');
    }
    setLoading(false);
  };

  const downloadSchedule = () => {
    if (schedule.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const compactTopic = topic.trim().replace(/\s+/g, ' ');
    const topicLabel = compactTopic.length > 180 ? `${compactTopic.slice(0, 177)}…` : compactTopic;
    const topicLines = doc.splitTextToSize(`Topic: ${topicLabel}`, pageWidth - 28);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(28, 38, 30);
    doc.text('Study Schedule — EUREKA', 14, 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(65, 78, 67);
    doc.text(topicLines, 14, 29);
    const examY = 29 + topicLines.length * 5;
    doc.text(`Exam date: ${examDate}`, 14, examY);

    autoTable(doc, {
      startY: examY + 7,
      head: [['Day', 'Date', 'Task', 'Duration']],
      body: schedule.map(row => [
        row.day ?? '',
        formatScheduleDate(row.date),
        row.task ?? '',
        row.duration ?? '',
      ]),
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 4,
        lineColor: [205, 215, 206],
        lineWidth: 0.2,
        textColor: [35, 45, 37],
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [25, 34, 27],
        textColor: [242, 247, 242],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [232, 240, 233] },
      columnStyles: {
        0: { cellWidth: 27 },
        1: { cellWidth: 30 },
        3: { cellWidth: 32 },
      },
      margin: { left: 14, right: 14 },
    });

    const safeTopic = compactTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'study';
    doc.save(`${safeTopic}-schedule.pdf`);
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__tag">Planner Agent</span>
        <h3 className="panel__title">Generate your revision schedule</h3>
      </div>
      <div className="panel__body">

        <PdfUpload onFile={async file => {
          setSchedule([]);
          setError('');
          setTopic('');
          setPdfSessionId('');
          const formData = new FormData();
          formData.append('file', file);
          const response = await api.post('/rag/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: LONG_AI_TIMEOUT_MS,
          });
          if (!response.data?.session_id) throw new Error('The PDF index could not be created. Please upload it again.');
          setPdfSessionId(response.data.session_id);
        }} />

        {/* Form row */}
        <div className="form-row">
          <div className="field">
            <label className="field__label" htmlFor="topic">Subject / Topic</label>
            <input
              className="field__input"
              id="topic"
              type="text"
              placeholder="e.g. Thermodynamics"
              value={topic}
              onChange={e => { setTopic(e.target.value); setPdfSessionId(''); }}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="start">Start Date</label>
            <input
              className="field__input"
              id="start"
              type="date"
              value={startDate}
              min={today}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="exam">Exam Date</label>
            <input
              className="field__input"
              id="exam"
              type="date"
              value={examDate}
              min={startDate || today}
              onChange={e => setExamDate(e.target.value)}
            />
          </div>
          <button
            className="btn btn--primary btn--arrow"
            id="generate-btn"
            onClick={handleSubmit}
            disabled={loading || (!topic.trim() && !pdfSessionId) || !startDate || !examDate || examDate < startDate}
          >
            {loading ? <><span className="spinner" /> BUILDING</> : 'GENERATE'}
          </button>
      <AiThinking active={loading} label="Building your study plan…" />
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#c0392b', marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
        )}

        {/* Schedule Table — always shown; empty state when no data */}
        {schedule.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">—</span>
            <p className="empty-state__text">Enter a topic and dates, then click Generate</p>
          </div>
        ) : (
          <>
          <div className="schedule-actions">
            <button className="btn btn--primary" type="button" onClick={downloadSchedule}>
              Download Schedule PDF
            </button>
          </div>
          <table className="schedule" id="schedule-table">
            <thead className="schedule__head">
              <tr>
                <th className="schedule__th">Day</th>
                <th className="schedule__th">Date</th>
                <th className="schedule__th">Task</th>
                <th className="schedule__th" style={{ textAlign: 'right' }}>Duration</th>
              </tr>
            </thead>
            <tbody id="schedule-body">
              {schedule.map((row, i) => (
                <tr
                  key={i}
                  className={`schedule__row ${i === 0 ? 'schedule__row--active' : ''} ${i === schedule.length - 1 ? 'schedule__row--dim' : ''}`}
                >
                  <td className="schedule__td schedule__td-day">{row.day}</td>
                  <td className="schedule__td schedule__td-date">{row.displayDate || formatScheduleDate(row.date)}</td>
                  <td className="schedule__td schedule__td-task">
                    {row.task || 'Task unavailable'}
                    {row.topics?.length > 0 && (
                      <div className="schedule__topics">Topics: {row.topics.join(', ')}</div>
                    )}
                  </td>
                  <td className="schedule__td schedule__td-duration">
                    <span className="duration-badge">{row.duration || 'Duration unavailable'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}

      </div>
    </div>
  );
}
