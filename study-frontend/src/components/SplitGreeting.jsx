/**
 * Reveals "Welcome back, <name>." word by word. Rendered once per mount; the caller decides when to mount it
 * (only right after a successful sign-in), so it does not replay on ordinary re-renders.
 */
export default function SplitGreeting({ name }) {
  const words = `Welcome back, ${name}.`.split(' ');
  return (
    <h1 className="split-greeting" aria-label={`Welcome back, ${name}.`}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="split-word" aria-hidden="true" style={{ animationDelay: `${index * 90}ms` }}>
          {word}{' '}
        </span>
      ))}
    </h1>
  );
}
