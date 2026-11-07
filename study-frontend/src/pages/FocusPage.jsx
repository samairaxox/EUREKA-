/*FocusPage.jsx*/
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Counter from '../reactbits/Counter/Counter';
import GlitchText from '../reactbits/GlitchText/GlitchText';
import FocusBackdrop from '../components/FocusBackdrop';
import ProgressTransition from '../components/ProgressTransition';
import { profileApi } from '../api/auth';
import { errorMessage } from '../api/client';
import { useProgress } from '../progress/ProgressContext';
import { usePrefersReducedMotion } from '../lib/motion';
import { toLocalDateString } from '../streak';

const DURATIONS = [25, 45, 60];
const TICK_MS = 250;
const ENTRY_MS = 1800;

function newSessionKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function splitClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

function playChime(audioContext) {
  // Browsers may refuse audio; a missing chime must never break completion.
  try {
    if (!audioContext) return;
    [523.25, 659.25].forEach((frequency, i) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      const start = audioContext.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 1.3);
    });
  } catch {
    // Ignore audio failures.
  }
}

export default function FocusPage() {
  const { progress, refresh } = useProgress();
  const reduced = usePrefersReducedMotion();
  // choose | entering | running | paused | complete | exited
  const [phase, setPhase] = useState('choose');
  const [minutes, setMinutes] = useState(25);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [confirmExit, setConfirmExit] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [finalStreak, setFinalStreak] = useState(null);

  const endAtRef = useRef(0);
  const pausedRemainingRef = useRef(0);
  const startedAtRef = useRef(null);
  const sessionKeyRef = useRef(null);
  const completedRef = useRef(false);
  const tickRef = useRef(null);
  const entryTimerRef = useRef(null);
  const audioRef = useRef(null);
  const activeRef = useRef(false);
  const minutesRef = useRef(25);
  activeRef.current = phase === 'running' || phase === 'paused';

  // Default duration from the user's saved goal.
  useEffect(() => {
    const saved = progress?.goal?.default_focus_minutes;
    if (DURATIONS.includes(saved) && phase === 'choose') {
      setMinutes(saved);
      setRemainingMs(saved * 60 * 1000);
    }
  }, [progress, phase]);

  useEffect(() => { minutesRef.current = minutes; }, [minutes]);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const stopTimer = useCallback(() => {
    window.clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const complete = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    stopTimer();
    setRemainingMs(0);
    setPhase('complete');
    exitFullscreen();
    playChime(audioRef.current);
    setSaving(true);
    setSaveError('');
    try {
      const completedAt = new Date();
      await profileApi.recordFocusSession({
        client_session_id: sessionKeyRef.current,
        duration_minutes: minutesRef.current,
        started_at: startedAtRef.current.toISOString(),
        completed_at: completedAt.toISOString(),
        local_date: toLocalDateString(completedAt),
      });
      const updated = await refresh();
      setFinalStreak(updated?.streak?.current ?? null);
    } catch (err) {
      completedRef.current = false;
      setSaveError(errorMessage(err, 'Your session finished, but it could not be saved. Your streak is unchanged.'));
    } finally {
      setSaving(false);
    }
  }, [exitFullscreen, refresh, stopTimer]);

  const startTicking = useCallback(() => {
    stopTimer();
    tickRef.current = window.setInterval(() => {
      const remaining = endAtRef.current - Date.now();
      if (remaining <= 0) complete();
      else setRemainingMs(remaining);
    }, TICK_MS);
  }, [complete, stopTimer]);

  // The timer starts here, after the entry transition, so the transition never shortens a session.
  const beginSession = useCallback(() => {
    entryTimerRef.current = null;
    completedRef.current = false;
    startedAtRef.current = new Date();
    endAtRef.current = Date.now() + minutesRef.current * 60 * 1000;
    setRemainingMs(minutesRef.current * 60 * 1000);
    setPhase('running');
    startTicking();
  }, [startTicking]);

  const start = async () => {
    // Created inside a click so browsers allow the chime later.
    try {
      audioRef.current = audioRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioRef.current.resume?.();
    } catch {
      audioRef.current = null;
    }
    setSaveError('');
    setNotice('');
    setFinalStreak(null);
    sessionKeyRef.current = newSessionKey();
    setPhase('entering');
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch {
      setNotice('Full screen was not available, so the session will run in this window.');
    }
  };

  const cancelEntry = () => {
    window.clearTimeout(entryTimerRef.current);
    entryTimerRef.current = null;
    exitFullscreen();
    setPhase('choose');
  };

  const pause = () => {
    pausedRemainingRef.current = Math.max(0, endAtRef.current - Date.now());
    stopTimer();
    setRemainingMs(pausedRemainingRef.current);
    setPhase('paused');
  };

  const resume = () => {
    endAtRef.current = Date.now() + pausedRemainingRef.current;
    setPhase('running');
    startTicking();
  };

  const endSession = () => {
    stopTimer();
    completedRef.current = true; // an ended session is never recorded as complete
    exitFullscreen();
    setConfirmExit(false);
    setPhase('exited');
  };

  const reset = () => {
    setPhase('choose');
    setRemainingMs(minutes * 60 * 1000);
    setConfirmExit(false);
    setNotice('');
    setSaveError('');
    completedRef.current = false;
  };

  const retrySave = () => {
    completedRef.current = false;
    complete();
  };

  // Fullscreen can be left at any time. Show a recovery prompt; never pretend the browser is locked.
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && activeRef.current) {
        setNotice('Full screen was closed. Your timer is still running.');
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Warn before a refresh or closing the tab during an active session.
  useEffect(() => {
    const onBeforeUnload = event => {
      if (!activeRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  // Full cleanup on unmount: stop timers, leave fullscreen, close audio.
  useEffect(() => () => {
    window.clearInterval(tickRef.current);
    window.clearTimeout(entryTimerRef.current);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (audioRef.current?.close) audioRef.current.close().catch(() => {});
  }, []);

  const totalMs = minutes * 60 * 1000;
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  const radius = 150;
  const circumference = 2 * Math.PI * radius;
  const clockLabel = clock.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const { minutes: remMin, seconds: remSec } = splitClock(remainingMs);

  if (phase === 'choose') {
    return (
      <main className="focus-page focus-choose">
        <FocusBackdrop />
        <header className="focus-landing-header">
          <Link to="/app" className="focus-back">← Back to your study space</Link>
          <p className="eyebrow focus-mode-label">Focus Mode</p>
        </header>
        <h1 className="focus-title">
          {reduced ? 'Ready to lock in?' : (
            <GlitchText speed={0.6} mode="slices" intensity={0.3} trigger="hover" enableOnHover>Ready to lock in?</GlitchText>
          )}
        </h1>
        <p className="focus-lede">Pick a length, then start when you are ready to give it your full attention.</p>
        <div className="focus-duration-group" role="radiogroup" aria-label="Session length">
          {DURATIONS.map(option => (
            <button key={option} type="button" role="radio" aria-checked={minutes === option}
              className={`focus-duration${minutes === option ? ' is-selected' : ''}`}
              onClick={() => { setMinutes(option); setRemainingMs(option * 60 * 1000); }}>
              <span className="focus-duration-number">{option}</span>
              <span>minutes</span>
            </button>
          ))}
        </div>
        <p className="focus-chosen" aria-live="polite">
          <span className="focus-chosen-number"><Counter value={minutes} fontSize={30} fontWeight={800} textColor="#2B2640" /></span> minutes
        </p>
        <button type="button" className="focus-start" onClick={start}>Start session</button>
        <p className="focus-footnote">
          Full screen is requested when you start. Your browser decides whether to allow it, and you can leave it at any time.
        </p>
      </main>
    );
  }

  if (phase === 'entering') {
    return (
      <main className="focus-page focus-choose">
        <FocusBackdrop />
        <h1 className="focus-title focus-title--quiet">Locking in…</h1>
        <ProgressTransition label={`${minutes} minutes starts now`} duration={ENTRY_MS}
          onDone={beginSession} />
        <button type="button" className="ghost-btn" onClick={cancelEntry}>Cancel</button>
      </main>
    );
  }

  if (phase === 'complete') {
    return (
      <main className="focus-page focus-complete" role="status">
        <FocusBackdrop />
        <p className="eyebrow">Session complete</p>
        <h1 className="focus-title">{minutes} minutes of focus.</h1>
        {saving && <p className="focus-lede">Saving your session…</p>}
        {!saving && saveError && (
          <div className="progress-error" role="alert">
            <p>{saveError}</p>
            <button type="button" className="submit-btn" onClick={retrySave}>Try saving again</button>
          </div>
        )}
        {!saving && !saveError && (
          <p className="focus-lede">
            Your streak is now <strong>{finalStreak ?? progress?.streak?.current ?? 0}</strong>{' '}
            {(finalStreak ?? progress?.streak?.current ?? 0) === 1 ? 'day' : 'days'}.
          </p>
        )}
        <div className="focus-complete-actions">
          <button type="button" className="focus-start" onClick={reset}>Start another session</button>
          <Link to="/profile" className="focus-link">View your profile</Link>
        </div>
      </main>
    );
  }

  if (phase === 'exited') {
    return (
      <main className="focus-page focus-choose">
        <FocusBackdrop />
        <p className="eyebrow">Session ended</p>
        <h1 className="focus-title">Session ended early.</h1>
        <p className="focus-lede">Unfinished sessions are not recorded. Your streak is unchanged.</p>
        <div className="focus-complete-actions">
          <button
            type="button"
            className="focus-start"
            onClick={reset}
          >
            Start a new session
          </button>

          <Link to="/app" className="focus-start">
            Back to your study space
          </Link>
        </div>

      </main>
    );
  }

  return (
    <main className={`focus-page focus-live${phase === 'paused' ? ' is-paused' : ''}`}>
      <FocusBackdrop />
      <div className="focus-live-meta">
        <span className="focus-live-clock">{clockLabel}</span>
        <span className="focus-live-state">{phase === 'paused' ? 'Paused' : 'Focus'}</span>
      </div>
      <div className="focus-ring-wrap">
        <svg viewBox="0 0 340 340" className="focus-ring" aria-hidden="true">
          <circle cx="170" cy="170" r={radius} className="focus-ring-track" />
          <circle cx="170" cy="170" r={radius} className="focus-ring-value"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)}
            transform="rotate(-90 170 170)" />
        </svg>
        <div className="focus-time" role="timer" aria-label={`${remMin} minutes ${remSec} seconds remaining`}>
          <Counter value={remMin} minDigits={2} fontSize={96} fontWeight={700} textColor="#2B2640" />
          <span className="focus-time-colon" aria-hidden="true">:</span>
          <Counter value={remSec} minDigits={2} fontSize={96} fontWeight={700} textColor="#2B2640" />
        </div>
      </div>
      {notice && <p className="focus-notice" role="status">{notice}
        {!document.fullscreenElement && (
          <button type="button" className="focus-link" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>Return to full screen</button>
        )}
      </p>}
      <div className="focus-live-actions">
        {phase === 'running' ? (
          <button type="button" className="focus-control" onClick={pause}>Pause</button>
        ) : (
          <button type="button" className="focus-control" onClick={resume}>Resume</button>
        )}
        <button type="button" className="focus-control ghost" onClick={() => setConfirmExit(true)}>End session</button>
      </div>
      {confirmExit && (
        <div className="focus-confirm" role="alertdialog" aria-modal="true"
          aria-labelledby="focus-confirm-title" aria-describedby="focus-confirm-description">
          <div className="focus-confirm-card">
            <h2 id="focus-confirm-title">End this session?</h2>
            <p id="focus-confirm-description">Ending now will not be recorded, and your streak will not change.</p>
            <div className="focus-live-actions focus-confirm-actions">
              <button type="button" className="focus-control" onClick={() => setConfirmExit(false)}>Keep going</button>
              <button type="button" className="focus-control danger" onClick={endSession}>End session</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
