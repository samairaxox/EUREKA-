import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CircularCarousel from '../reactbits/CircularCarousel/CircularCarousel';
import { AGENTS } from '../landing/agentData';

export { AGENTS };

/**
 * React Bits Circular Carousel showing EUREKA's study tools. Each card shows the tool's picture; the
 * tool's description, inputs and outputs are shown in the panel that follows the active card.
 */
export default function AgentCarousel() {
  const [active, setActive] = useState(0);
  const items = useMemo(() => AGENTS.map(agent => ({
    src: agent.image,
    alt: agent.alt,
    title: agent.name,
    subtitle: agent.role,
  })), []);
  const agent = AGENTS[active];

  return (
    <div className="agent-showcase">
      <CircularCarousel
        items={items}
        preset="cylinder"
        cardWidth={240}
        aspectRatio={1}
        autoplay={false}
        draggable
        snap
        focusOnClick
        captions
        fadeColor="#FBF8F2"
        innerShade={0.25}
        depthFade={0.7}
        onChange={setActive}
        className="agent-carousel-3d"
      />
      <article className="agent-detail-panel" aria-live="polite">
        <p className="agent-card-role">{agent.role}</p>
        <h3>{agent.name}</h3>
        <p>{agent.description}</p>
        <dl>
          <div><dt>Takes</dt><dd>{agent.takes}</dd></div>
          <div><dt>Returns</dt><dd>{agent.returns}</dd></div>
        </dl>
        <Link className="agent-card-open" to={`/app?tool=${agent.id}`}>
          Open {agent.name} <span aria-hidden="true">→</span>
        </Link>
      </article>
    </div>
  );
}
