import ThoughtLine from '../reactbits/ThoughtLine/ThoughtLine';

/**
 * Status line shown only while a real request is in flight. It is unmounted as soon as the request
 * succeeds or fails, which stops its animation. It never receives model reasoning; only the label
 * describes what the application is doing.
 */
export default function AiThinking({ active, label }) {
  if (!active) return null;
  return (
    <div className="ai-thinking">
      <ThoughtLine label={label} working showTimer={false} doneLabel="" />
    </div>
  );
}
