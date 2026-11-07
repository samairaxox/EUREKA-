import SplitText from '../reactbits/SplitText/SplitText';
import { usePrefersReducedMotion } from '../lib/motion';

/**
 * Shown once, right after a successful sign-in. Uses the authenticated user's stored display name.
 * If the name is missing, the greeting falls back to a plain "Welcome back." rather than a placeholder name.
 */
export default function WelcomeGreeting({ name }) {
  const reduced = usePrefersReducedMotion();
  const clean = (name || '').trim();
  const text = clean ? `Welcome back, ${clean}.` : 'Welcome back.';
  if (reduced) return <h1 className="split-greeting">{text}</h1>;
  return (
    <SplitText
      text={text}
      tag="h1"
      className="split-greeting"
      splitType="words"
      from={{ opacity: 0, y: 18 }}
      to={{ opacity: 1, y: 0 }}
      delay={70}
      duration={0.9}
      textAlign="left"
    />
  );
}
