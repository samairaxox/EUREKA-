
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import SplitText from '../reactbits/SplitText/SplitText';
import Iridescence from '../reactbits/Iridescence/Iridescence';
import SafeEffect from '../components/SafeEffect';
import { usePrefersReducedMotion } from '../lib/motion';

const WELCOME_MS = 1500;

const IRIDESCENCE_COLOR = [0.86, 0.82, 0.96];

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();

  const destination = location.state?.from || '/app';
  const name = (user?.display_name || '').trim();
  const text = name ? `Hello, ${name}.` : 'Hello.';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate(destination, { replace: true });
    }, WELCOME_MS);

    return () => window.clearTimeout(timer);
  }, [navigate, destination]);

  return (
    <main className="welcome-page">
      <div className="welcome-background" aria-hidden="true">
        <SafeEffect fallback={null}>
          <Iridescence
            color={IRIDESCENCE_COLOR}
            speed={reduced ? 0 : 0.4}
            amplitude={0.18}
            mouseReact={!reduced}
            paused={reduced}
            saturation={0.2}
            hueShift={0.62}
            brightness={1.08}
            contrast={0.9}
            fade={0}
          />
        </SafeEffect>
      </div>

      <section className="welcome-content" aria-live="polite">
        {reduced ? (
          <h1 className="welcome-title">{text}</h1>
        ) : (
          <SplitText
            text={text}
            tag="h1"
            className="welcome-title"
            splitType="words"
            trigger="load"
            delay={120}
            duration={1}
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0 }}
            textAlign="center"
            effect="rise"
          />
        )}
      </section>
    </main>
  );
}
