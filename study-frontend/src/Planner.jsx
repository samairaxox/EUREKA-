import { useState } from 'react';
import axios from 'axios';
import './Studymind.css';
const API = 'http://localhost:8000';

// Format YYYY-MM-DD → "25 May"
function fmtDate(dateStr) {
  if (!dateStr) return dateStr;
  const [, month, day] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]}`;
}

export default function Planner() {
  const [topic, setTopic] = useState('');
  const [startDate, setStartDate] = useState('');
  const [examDate, setExamDate] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Build the local calendar date without UTC conversion (which can shift the
  // date for users west of UTC).
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const handleSubmit = async () => {
    if (!topic.trim() || !examDate || !startDate || examDate < startDate) return;
    setLoading(true);
    setError('');
    setSchedule([]);
    try {
      const res = await axios.post(`${API}/plan`, {
        topic,
        exam_date: examDate,
        start_date: startDate,
      });
      setSchedule(res.data.schedule);
    } catch (err) {
      setError('Could not reach the backend. Make sure uvicorn is running on port 8000.');
    }
    setLoading(false);
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__tag">Planner Agent</span>
        <h3 className="panel__title">Generate your revision schedule</h3>
      </div>
      <div className="panel__body">

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
              onChange={e => setTopic(e.target.value)}
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
            disabled={loading || !topic.trim() || !startDate || !examDate || examDate < startDate}
          >
            {loading ? <><span className="spinner" /> BUILDING</> : 'GENERATE'}
          </button>
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
                  <td className="schedule__td schedule__td-date">{fmtDate(row.date)}</td>
                  <td className="schedule__td schedule__td-task">{row.task}</td>
                  <td className="schedule__td schedule__td-duration">
                    {row.duration && <span className="duration-badge">{row.duration}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>
    </div>
  );
}
