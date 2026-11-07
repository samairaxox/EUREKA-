/*SignInPage.jsx*/
import { useCallback, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';
import SignInBackground from '../components/SignInBackground';
import GoogleSignIn from '../components/GoogleSignIn';

export default function SignInPage() {
  const { status, login, register, googleSignIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const destination = location.state?.from || '/app';

  const finish = useCallback(() => {
    navigate('/welcome', { replace: true, state: { from: destination } });
  }, [navigate, destination]);

  const onGoogle = useCallback(async credential => {
    setError('');
    setBusy(true);
    try {
      await googleSignIn(credential);
      finish();
    } catch (err) {
      setError(errorMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  }, [googleSignIn, finish]);

  const onGoogleError = useCallback(message => setError(message), []);

  if (status === 'authenticated') return <Navigate to={destination} replace />;

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (mode === 'register' && password.length < 10) {
      setError('Use at least 10 characters for your password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') await register(email, password, name);
      else await login(email, password);
      finish();
    } catch (err) {
      setError(errorMessage(err, 'We could not sign you in. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="signin-page">
      <SignInBackground />
      <div className="signin-card">
        <Link to="/" className="signin-brand" aria-label="EUREKA home">EUREKA</Link>
        <p className="signin-lede">
          {mode === 'register' ? 'Create your study space.' : 'Pick up where you left off.'}
        </p>

        <div className="signin-tabs" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'is-active' : ''} onClick={() => { setMode('signin'); setError(''); }}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'}
            className={mode === 'register' ? 'is-active' : ''} onClick={() => { setMode('register'); setError(''); }}>
            Create account
          </button>
        </div>

        <form className="signin-form" onSubmit={submit} noValidate>
          {mode === 'register' && (
            <label className="field-label-block">
              <span>Name</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder="How should we greet you?" />
            </label>
          )}
          <label className="field-label-block">
            <span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="field-label-block">
            <span>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              minLength={mode === 'register' ? 10 : 1}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
          </label>
          {error && <p className="error-msg" role="alert">{error}</p>}
          <button type="submit" className="submit-btn" disabled={busy || !email || !password}>
            {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="signin-divider"><span>or</span></div>
        <GoogleSignIn onCredential={onGoogle} onError={onGoogleError} />
      </div>
    </main>
  );
}
