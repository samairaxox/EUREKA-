import { useEffect, useState } from 'react';
import { readBest, saveBest } from './highScores';

const escapeRooms = [
  { room: 'The Observatory', story: 'A storm has locked the observatory. Decode the star chart to open the first door.', clue: 'Multiply the number of sides on a hexagon by 2.', answer: '12', hint: 'A hexagon has six sides.', next: 'The telescope points to a clock. Its hands show 3:15.' },
  { room: 'The Clockwork Hall', story: 'A brass clock guards the next passage. Find the missing number in its sequence.', clue: '2, 6, 12, 20, 30, ?', answer: '42', hint: 'The gaps grow by two each time.', next: 'A final note reads: “I am an odd prime between 10 and 14.”' },
  { room: 'The Archive', story: 'The archive exit is sealed. Solve its final academic riddle.', clue: 'What is the only even prime number?', answer: '2', hint: 'It is the smallest prime.', next: 'The archive door unlocks. You escaped!' },
];

const pairs = [
  ['Photosynthesis', 'Plants convert light into chemical energy'], ['Mitosis', 'Cell division producing two matching cells'],
  ['Evaporation', 'Liquid changes into gas'], ['Molecule', 'Two or more atoms bonded together'],
  ['Gravity', 'Attraction between objects with mass'], ['Ecosystem', 'Organisms interacting with their environment'],
];
const packs = { Science: pairs, Geography: [['Peninsula', 'Land surrounded by water on three sides'], ['Equator', 'Line at zero degrees latitude'], ['Delta', 'Landform at a river mouth'], ['Archipelago', 'A chain or group of islands'], ['Glacier', 'A slow-moving mass of ice'], ['Isthmus', 'Narrow land joining two larger land areas']] };

const sortPacks = {
  'Living things': { bins: ['Mammal', 'Not a mammal'], cards: [['Dolphin', 0], ['Bat', 0], ['Penguin', 1], ['Frog', 1], ['Whale', 0], ['Lizard', 1], ['Elephant', 0], ['Salmon', 1]] },
  'Technology': { bins: ['Hardware', 'Software'], cards: [['Keyboard', 0], ['Operating system', 1], ['Graphics card', 0], ['Web browser', 1], ['SSD', 0], ['Spreadsheet app', 1], ['Microphone', 0], ['Video editor', 1]] },
  'Energy': { bins: ['Renewable', 'Non-renewable'], cards: [['Wind', 0], ['Coal', 1], ['Solar', 0], ['Natural gas', 1], ['Hydropower', 0], ['Oil', 1], ['Geothermal', 0], ['Uranium', 1]] },
};

function Instructions({ title, text, onStart, onExit }) {
  return <div className="new-game-intro"><p className="eyebrow">Eureka game zone</p><h2>{title}</h2><p>{text}</p><div className="new-game-actions"><button className="submit-btn" onClick={onStart}>Start game</button><button className="ghost-btn" onClick={onExit}>Back to Game Zone</button></div></div>;
}
function Results({ score, total, best, onReplay, onExit }) {
  return <div className="new-game-results" role="status"><span aria-hidden="true">✦</span><h2>Challenge complete</h2><p>Your score: <strong>{score}</strong> / {total}</p><p>Best on this device: <strong>{best}</strong></p><div className="new-game-actions"><button className="submit-btn" onClick={onReplay}>Play again</button><button className="ghost-btn" onClick={onExit}>Return to Game Zone</button></div></div>;
}

export function DigitalEscape({ onExit = () => {} }) {
  const [started, setStarted] = useState(false); const [room, setRoom] = useState(0); const [answer, setAnswer] = useState(''); const [hints, setHints] = useState(0); const [feedback, setFeedback] = useState(''); const [score, setScore] = useState(0); const [best, setBest] = useState(() => readBest('digital-escape'));
  const done = room >= escapeRooms.length; const stage = escapeRooms[Math.min(room, escapeRooms.length - 1)];
  useEffect(() => { if (done) setBest(saveBest('digital-escape', score)); }, [done, score]);
  const restart = () => { setRoom(0); setAnswer(''); setHints(0); setFeedback(''); setScore(0); setStarted(true); };
  if (!started) return <Instructions title="Digital Escape Rooms" text="Solve three self-checking puzzles, collect each clue, and escape the archive. Hints help when you get stuck; each hint slightly reduces your score." onStart={restart} onExit={onExit} />;
  if (done) return <Results score={score} total={3} best={best} onReplay={restart} onExit={onExit} />;
  const submit = event => { event.preventDefault(); if (answer.trim().toLowerCase() === stage.answer.toLowerCase()) { setScore(value => value + Math.max(1, 10 - hints * 2)); setFeedback(stage.next); setRoom(value => value + 1); setAnswer(''); setHints(0); } else setFeedback('That code did not open the lock. Recheck the clue or reveal a hint.'); };
  return <section className="new-game-play"><div className="new-game-top"><span>Room {room + 1} of {escapeRooms.length}</span><span>Score {score}</span></div><div className="new-game-progress"><span style={{ width: `${(room / escapeRooms.length) * 100}%` }} /></div><p className="eyebrow">{stage.room}</p><h2>{stage.story}</h2><div className="escape-clue">{stage.clue}</div><form onSubmit={submit} className="new-game-answer"><label htmlFor="escape-answer">Your answer</label><input id="escape-answer" value={answer} onChange={event => setAnswer(event.target.value)} autoComplete="off" /><button className="submit-btn" type="submit">Unlock</button></form><button className="ghost-btn" onClick={() => { setHints(value => value + 1); setFeedback(`Hint: ${stage.hint}`); }}>Reveal a hint</button>{feedback && <p role="status" className="new-game-feedback">{feedback}</p>}<button className="new-game-exit" onClick={onExit}>Exit game</button></section>;
}

export function MatchingPairs({ onExit = () => {} }) {
  const [pack, setPack] = useState('Science'); const [cards, setCards] = useState([]); const [selected, setSelected] = useState([]); const [moves, setMoves] = useState(0); const [seconds, setSeconds] = useState(0); const [started, setStarted] = useState(false); const [best, setBest] = useState(() => readBest('matching-pairs'));
  const matched = cards.filter(card => card.matched).length / 2; const done = started && cards.length > 0 && matched === cards.length / 2;
  useEffect(() => { if (!started || done) return undefined; const timer = window.setInterval(() => setSeconds(value => value + 1), 1000); return () => window.clearInterval(timer); }, [started, done]);
  useEffect(() => { if (done) setBest(saveBest('matching-pairs', Math.max(1, 1000 - moves * 25 - seconds))); }, [done, moves, seconds]);
  const start = () => { const shuffled = packs[pack].flatMap(([term, definition], pair) => [{ id: `${pair}-a`, pair, text: term }, { id: `${pair}-b`, pair, text: definition }]).sort(() => Math.random() - .5); setCards(shuffled); setSelected([]); setMoves(0); setSeconds(0); setStarted(true); };
  const flip = id => { if (selected.length === 2) return; const card = cards.find(item => item.id === id); if (!card || card.matched || selected.includes(id)) return; const next = [...selected, id]; setSelected(next); if (next.length === 2) { setMoves(value => value + 1); const [first, second] = next.map(key => cards.find(item => item.id === key)); if (first.pair === second.pair) { setCards(value => value.map(item => item.pair === first.pair ? { ...item, matched: true } : item)); setSelected([]); } else window.setTimeout(() => setSelected([]), 850); } };
  if (!started) return <div className="new-game-intro"><p className="eyebrow">Memory grid</p><h2>Matching Pairs</h2><p>Find the term and definition pairs. Match all six pairs in as few moves as you can.</p><label className="pack-select">Study pack<select value={pack} onChange={event => setPack(event.target.value)}>{Object.keys(packs).map(name => <option key={name}>{name}</option>)}</select></label><div className="new-game-actions"><button className="submit-btn" onClick={start}>Start game</button><button className="ghost-btn" onClick={onExit}>Back to Game Zone</button></div></div>;
  if (done) return <Results score={Math.max(1, 1000 - moves * 25 - seconds)} total={1000} best={best} onReplay={start} onExit={onExit} />;
  return <section className="new-game-play"><div className="new-game-top"><span>{pack} · {matched} / 6 pairs</span><span>{moves} moves · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div><div className="memory-grid">{cards.map(card => { const face = card.matched || selected.includes(card.id); return <button key={card.id} className={`memory-card${face ? ' is-face-up' : ''}${card.matched ? ' is-matched' : ''}`} onClick={() => flip(card.id)} aria-label={face ? card.text : 'Face-down card'} aria-pressed={face} disabled={card.matched}>{face ? card.text : '?'}</button>; })}</div><button className="new-game-exit" onClick={onExit}>Exit game</button></section>;
}

export function CategorizationSort({ onExit = () => {} }) {
  const [topic, setTopic] = useState('Living things'); const [items, setItems] = useState([]); const [index, setIndex] = useState(0); const [score, setScore] = useState(0); const [feedback, setFeedback] = useState(''); const [started, setStarted] = useState(false); const [best, setBest] = useState(() => readBest('categorization-sort')); const [dragged, setDragged] = useState(null);
  const pack = sortPacks[topic]; const done = started && index >= items.length;
  useEffect(() => { if (done) setBest(saveBest('categorization-sort', score)); }, [done, score]);
  const start = () => { setItems([...pack.cards].sort(() => Math.random() - .5)); setIndex(0); setScore(0); setFeedback(''); setStarted(true); };
  const classify = bin => { if (!started || done) return; const correct = items[index][1] === bin; setScore(value => value + (correct ? 1 : 0)); setFeedback(correct ? 'Correct classification!' : `Not quite. ${items[index][0]} belongs in “${pack.bins[items[index][1]]}”.`); setIndex(value => value + 1); };
  if (!started) return <div className="new-game-intro"><p className="eyebrow">Sort and classify</p><h2>Categorization Sorting</h2><p>Drag each concept into its category. Prefer a keyboard? Select a category with the buttons instead.</p><label className="pack-select">Topic pack<select value={topic} onChange={event => setTopic(event.target.value)}>{Object.keys(sortPacks).map(name => <option key={name}>{name}</option>)}</select></label><div className="new-game-actions"><button className="submit-btn" onClick={start}>Start game</button><button className="ghost-btn" onClick={onExit}>Back to Game Zone</button></div></div>;
  if (done) return <Results score={score} total={items.length} best={best} onReplay={start} onExit={onExit} />;
  const current = items[index];
  return <section className="new-game-play"><div className="new-game-top"><span>{topic} · Card {index + 1} of {items.length}</span><span>Correct {score}</span></div><div className="new-game-progress"><span style={{ width: `${(index / items.length) * 100}%` }} /></div><div className="sort-card" draggable onDragStart={event => { setDragged(index); event.dataTransfer.setData('text/plain', String(index)); }} onDragEnd={() => setDragged(null)}>{current[0]}</div><div className="sort-bins">{pack.bins.map((bin, binIndex) => <div key={bin} className="sort-bin" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged !== null) classify(binIndex); setDragged(null); }}><h3>{bin}</h3><button className="submit-btn" onClick={() => classify(binIndex)}>Place here</button></div>)}</div>{feedback && <p role="status" className="new-game-feedback">{feedback}</p>}<button className="new-game-exit" onClick={onExit}>Exit game</button></section>;
}
