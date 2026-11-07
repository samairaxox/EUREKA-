import { useEffect, useRef, useState } from 'react';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

/**
 * Renders Google's official sign-in button. The browser only receives a Google ID token; the server
 * verifies it. If REACT_APP_GOOGLE_CLIENT_ID is not set, the button is replaced by a clear notice.
 */
export default function GoogleSignIn({ onCredential, onError }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: response => {
          if (response?.credential) onCredential(response.credential);
          else onError('Google did not return a sign-in credential. Please try again.');
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 320,
      });
      setReady(true);
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      let script = document.querySelector(`script[src="${GIS_SRC}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = GIS_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', init);
      script.addEventListener('error', () => onError('Google sign-in could not load. Check your connection.'));
    }
    return () => { cancelled = true; };
  }, [onCredential, onError]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="google-unavailable">
        Google sign-in is not configured yet. Add REACT_APP_GOOGLE_CLIENT_ID to enable it.
      </p>
    );
  }
  return (
    <div className="google-sign-in">
      <div ref={containerRef} className="google-button-slot" />
      {!ready && <span className="google-loading">Loading Google sign-in…</span>}
    </div>
  );
}
