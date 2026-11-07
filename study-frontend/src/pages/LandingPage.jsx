import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AgentCarousel, { AGENTS } from '../components/AgentCarousel';
import RotatingWord from '../components/RotatingWord';
import SafeEffect from '../components/SafeEffect';
import { usePrefersReducedMotion, useCoarsePointer } from '../lib/motion';
import { FEATURE_TILES, AGENT_CHROMA_ITEMS } from '../landing/featureArtwork';
import Iridescence from '../reactbits/Iridescence/Iridescence';
import FoldText from '../reactbits/FoldText/FoldText';
import AnimatedContent from '../reactbits/AnimatedContent/AnimatedContent';
import Crosshair from '../reactbits/Crosshair/Crosshair';
import DriftWall from '../reactbits/DriftWall/DriftWall';
import ChromaGrid from '../reactbits/ChromaGrid/ChromaGrid';
import LightTunnel from '../reactbits/LightTunnel/LightTunnel';
import CometDial from '../reactbits/CometDial/CometDial';
import Counter from '../reactbits/Counter/Counter';

// Focus Mode runs for exactly these durations; the dial must never start an unsupported one.
const FOCUS_DURATIONS = [25, 45, 60];
const nearestDuration = value => FOCUS_DURATIONS.reduce((best, d) => (Math.abs(d - value) < Math.abs(best - value) ? d : best), FOCUS_DURATIONS[0]);

const IRIDESCENCE_COLOR = [0.86, 0.82, 0.96];

/** Scroll reveal that degrades to visible content when motion is reduced or animation fails. */
function Reveal({ children, delay = 0, distance = 100, stagger = 0.08, className = 'landing-reveal', reduced }) {
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <AnimatedContent className={className} distance={distance} direction="vertical" duration={0.8}
      ease="power3.out" blur={0} stagger={stagger} threshold={0.1} delay={delay} once>
      {children}
    </AnimatedContent>
  );
}

export default function LandingPage() {
  const { status } = useAuth();
  const reduced = usePrefersReducedMotion();
  const coarse = useCoarsePointer();
  const signedIn = status === 'authenticated';
  const primaryTo = signedIn ? '/welcome' : '/signin?mode=register';
  const workspaceState = { from: '/app' };
  const ctaRef = useRef(null);
  const [forceVisible, setForceVisible] = useState(false);
  const [duration, setDuration] = useState(25);

  // Safety net: if scroll animation never starts, show all content.
  useEffect(() => {
    const timer = window.setTimeout(() => setForceVisible(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  const wallItems = useMemo(() => FEATURE_TILES, []);
  const chromaItems = useMemo(() => AGENT_CHROMA_ITEMS, []);
  const crosshairEnabled = !reduced && !coarse;

  return (
    <div className={`landing${forceVisible ? ' force-visible' : ''}`}>
      <header className="landing-nav landing-nav--transparent">
        <Link to="/" className="landing-wordmark">EUREKA</Link>
        <nav className="landing-nav-links" aria-label="Primary">
          <a href="#agents">Study tools</a>
          <a href="#focus">Focus</a>
        </nav>
        <Link
          to={signedIn ? '/welcome' : '/signin'}
          state={signedIn ? workspaceState : undefined}
          className="landing-nav-cta"
        >
          {signedIn ? 'Open app' : 'Sign in'}
        </Link>
      </header>

      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-panel">
          <div className="hero-panel-iridescence" aria-hidden="true">
            <SafeEffect fallback={null}>
              <Iridescence color={IRIDESCENCE_COLOR} speed={reduced ? 0 : 0.4} amplitude={0.18}
                mouseReact={!reduced && !coarse} paused={reduced} fade={0}
                saturation={0.2} hueShift={0.62} brightness={1.08} contrast={0.9} />
            </SafeEffect>
          </div>
          <div className="hero-copy">
            <Reveal reduced={reduced} distance={20}>
              <p className="eyebrow">An AI study companion</p>
            </Reveal>
            <Reveal reduced={reduced} distance={100} delay={0.1}>
              <h1 id="hero-title" className="hero-wordmark">Eureka</h1>
            </Reveal>
            <Reveal reduced={reduced} distance={30} delay={0.25}>
              <p className="hero-tagline">
                <span className="visually-hidden">Every question opens a new line of thought.</span>
                <span aria-hidden="true">Every question opens a new line of <RotatingWord /></span>
              </p>
            </Reveal>
            <Reveal reduced={reduced} distance={20} delay={0.35}>
              <div className="hero-actions">
              <Link
                to={primaryTo}
                state={signedIn ? workspaceState : undefined}
                className="hero-primary"
              >
                {signedIn ? 'Go to your study space' : 'Get started'}
              </Link>
                <a href="#agents" className="hero-secondary">Explore the study tools</a>
              </div>
            </Reveal>
          </div>
        </div>
        <div className="hero-wall" aria-label="EUREKA features">
          <SafeEffect fallback={<div className="hero-wall-fallback" aria-hidden="true" />}>
            <DriftWall items={wallItems} speed={reduced ? 0 : 24} overlayColor="#1b1530" perspective={1100} />
          </SafeEffect>
        </div>
      </section>

      <section id="agents" className="landing-section" aria-labelledby="agents-title">
        <p className="eyebrow">Six study tools</p>
        <FoldText text="Meet your thinking partners" trigger="scroll" className="section-title fold-heading"
          fontSize="clamp(40px, 6vw, 84px)" fontWeight={500} color="var(--ink)" />
        <h2 id="agents-title" className="visually-hidden">Meet your thinking partners</h2>
        <Reveal reduced={reduced} distance={60}>
          <div className="chroma-wrap">
            <SafeEffect fallback={null}>
              <ChromaGrid items={chromaItems} radius={260} damping={0.45} fadeOut={0.6} theme="light" />
            </SafeEffect>
          </div>
        </Reveal>
      </section>

      <section className="landing-section" aria-labelledby="browse-title">
        <h2 id="browse-title" className="section-subtitle">Browse the tools</h2>
        <Reveal reduced={reduced} distance={60}>
          <AgentCarousel />
        </Reveal>
      </section>


      <section id="focus" className="focus-showcase" aria-labelledby="focus-title">
        <div className="focus-showcase-bg" aria-hidden="true">
          <SafeEffect fallback={null}>
            <LightTunnel speed={reduced ? 0 : 0.1} opacity={0.5} />
          </SafeEffect>
        </div>
        <div className="focus-showcase-grid">
          <div className="focus-showcase-copy">
            <p className="eyebrow">Focus Mode</p>
            <FoldText text="Make room for deep work." trigger="scroll" className="section-title fold-heading"
              fontSize="clamp(40px, 5.4vw, 72px)" fontWeight={500} color="var(--ink)" />
            <h2 id="focus-title" className="visually-hidden">Make room for deep work.</h2>
            <Reveal reduced={reduced} distance={40}>
              <p className="section-body">
                Focus Mode opens a dedicated session with a countdown. Choose 25, 45 or 60 minutes. A session you
                complete is recorded toward your streak and profile; a session you end early is not.
              </p>
            </Reveal>
            <Reveal reduced={reduced} distance={30}>
              <Link to={primaryTo} className="hero-primary">{signedIn ? 'Start a focus session' : 'Get started'}</Link>
            </Reveal>
          </div>
          <div className="focus-showcase-dial">
            <CometDial
              value={duration}
              min={25}
              max={60}
              step={1}
              unit=" min"
              label="Focus session length"
              size={300}
              accent="#5B4FCF"
              ink="#2B2640"
              onChangeEnd={raw => setDuration(nearestDuration(raw))}
            />
            <p className="focus-dial-readout" aria-live="polite">
              Session length: <Counter value={duration} fontSize={26} fontWeight={700} textColor="#2B2640" /> minutes
            </p>
            <p className="focus-dial-note">This is a preview of your choice. No session starts until you enter Focus Mode.</p>
          </div>
        </div>
      </section>

      <section ref={ctaRef} className="landing-cta" aria-labelledby="cta-title">
        {crosshairEnabled && (
          <Crosshair containerRef={ctaRef} color="#5B4FCF" opacity={0.55} thickness={1} gap={6}
            targetEffect="lock" targetSelector="a, button, [data-crosshair-target]" />
        )}
        <h2 id="cta-title" className="cta-title">Ready when you are.</h2>
        <Link to={primaryTo} className="hero-primary cta-button" data-crosshair-target>
          {signedIn ? 'Open your workspace' : 'Get Started'}
        </Link>
      </section>

      <footer className="landing-footer">
        <span className="landing-wordmark small">EUREKA</span>
        <span>Your AI study companion</span>
      </footer>
    </div>
  );
}
